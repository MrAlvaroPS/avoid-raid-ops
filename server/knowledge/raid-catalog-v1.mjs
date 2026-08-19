import { createHash } from 'node:crypto';
import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { WCL_RAID_CATALOG_QUERY } from '../wcl/queries/raid-catalog.mjs';
import { getBlizzardAccessTokenV1,fetchBlizzardJournalExpansionsIndexV1,fetchBlizzardJournalExpansionV1,fetchBlizzardJournalInstanceV1 } from './providers/blizzard-game-data-v1.mjs';

export const RAID_CATALOG_V1_VERSION='raid-catalog-v2';
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=value=>createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const norm=value=>String(value||'').normalize('NFKD').replace(/[’']/g,"'").replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase();
const WCL_DIFFICULTY_BY_NAME=new Map([['lfr',{id:1,name:'LFR'}],['raid finder',{id:1,name:'LFR'}],['normal',{id:3,name:'Normal'}],['heroic',{id:4,name:'Heroic'}],['mythic',{id:5,name:'Mythic'}]]);

function difficultyRows(zone={},instanceModes=[]){
  const wcl=(zone.difficulties||[]).map(row=>({id:finite(row?.id),name:row?.name||null,sizes:(row?.sizes||[]).map(Number).filter(Number.isFinite),source:'wcl-worlddata'})).filter(row=>row.id&&row.name);
  const byId=new Map(wcl.map(row=>[row.id,row]));
  for(const mode of instanceModes||[]){const fallback=WCL_DIFFICULTY_BY_NAME.get(norm(mode?.name));if(fallback&&!byId.has(fallback.id))byId.set(fallback.id,{...fallback,sizes:[],source:'blizzard-mode+wcl-protocol-id'});}
  return[...byId.values()].sort((a,b)=>a.id-b.id).map(row=>({...row,scopeKey:`difficulty:${row.id}`,learningScope:'strictly-difficulty-isolated'}));
}
function rawZone(zone={}){
  const partitions=(zone.partitions||[]).map(row=>({id:finite(row?.id),name:row?.name||null,compactName:row?.compactName||null,default:Boolean(row?.default)})).filter(row=>row.id!=null);
  const encounters=(zone.encounters||[]).map(row=>({wclEncounterId:finite(row?.id),name:row?.name||null,journalEncounterId:finite(row?.journalID)})).filter(row=>row.wclEncounterId);
  return{zoneId:finite(zone.id),name:zone.name||null,frozen:Boolean(zone.frozen),expansion:{id:finite(zone?.expansion?.id),name:zone?.expansion?.name||null},wclDifficulties:(zone.difficulties||[]).map(row=>({id:finite(row?.id),name:row?.name||null,sizes:(row?.sizes||[]).map(Number).filter(Number.isFinite)})),partitions,defaultPartition:partitions.find(row=>row.default)||partitions.slice().sort((a,b)=>Number(b.id)-Number(a.id))[0]||null,wclEncounters:encounters};
}
function matchOfficialRaid(zone,officialRaids=[]){return officialRaids.find(raid=>norm(raid.name)===norm(zone.name))||null;}
function currentRaid(candidates=[]){const live=candidates.filter(row=>!row.frozen),pool=live.length?live:candidates;return pool.slice().sort((a,b)=>Number(b.expansion?.id||0)-Number(a.expansion?.id||0)||Number(b.zoneId||0)-Number(a.zoneId||0))[0]||null;}
function mapBosses(zone,instance){
  const difficulties=difficultyRows(zone,instance?.modes||[]),wcl=zone.wclEncounters||[];
  return(instance?.encounters||[]).map((boss,index)=>{
    const match=wcl.find(row=>Number(row.journalEncounterId)===Number(boss.id))||wcl.find(row=>norm(row.name)===norm(boss.name))||null;
    return{order:index+1,name:boss.name||match?.name||null,journalEncounterId:Number(boss.id),wclEncounterId:match?.wclEncounterId||null,wclJournalLinked:Boolean(match?.journalEncounterId),difficulties:difficulties.map(row=>({...row})),knowledgeScope:{journalEncounterId:Number(boss.id),wclEncounterId:match?.wclEncounterId||null,difficultyRequired:true,partitionRequiredForEmpirical:true}};
  });
}

export function compileRaidCatalogV1(zones=[],{officialRaids=[],officialInstances=[]}={}){
  const instances=new Map((officialInstances||[]).map(row=>[Number(row?.id),row]));
  const all=(zones||[]).map(rawZone).filter(row=>row.zoneId);
  const classified=[];
  for(const zone of all){
    const official=matchOfficialRaid(zone,officialRaids);if(!official)continue;
    const instance=instances.get(Number(official.id))||null;
    const difficulties=difficultyRows(zone,instance?.modes||[]);
    const bosses=instance?mapBosses(zone,instance):zone.wclEncounters.filter(row=>row.journalEncounterId).map((row,index)=>({order:index+1,...row,difficulties:difficulties.map(item=>({...item})),knowledgeScope:{journalEncounterId:row.journalEncounterId,wclEncounterId:row.wclEncounterId,difficultyRequired:true,partitionRequiredForEmpirical:true}}));
    classified.push({...zone,journalInstanceId:Number(official.id),officialRaidName:official.name,difficulties,encounters:bosses,classification:{source:'blizzard-journal-expansion',officialRaidMatch:true},raidLike:true});
  }
  const selected=currentRaid(classified);
  const payload={version:RAID_CATALOG_V1_VERSION,zones:classified.sort((a,b)=>Number(b.expansion?.id||0)-Number(a.expansion?.id||0)||Number(b.zoneId)-Number(a.zoneId)),currentZoneId:selected?.zoneId||null};
  return{
    ...payload,fingerprint:digest(payload),currentRaid:selected,
    diagnostics:{rawZoneCount:all.length,officialRaidMatches:classified.length,recentWclZones:all.slice().sort((a,b)=>Number(b.expansion?.id||0)-Number(a.expansion?.id||0)||Number(b.zoneId)-Number(a.zoneId)).slice(0,20).map(row=>({zoneId:row.zoneId,name:row.name,frozen:row.frozen,expansion:row.expansion,difficulties:row.wclDifficulties,encounters:row.wclEncounters.slice(0,12)}))},
    selection:{policy:'blizzard-journal-expansion-classifies-raids-wcl-supplies-operational-ids',usesCombatLogs:false,usesRankingOutcome:false,hardcodedZoneId:false,reason:selected?'Newest non-frozen WCL zone whose name matches an official Blizzard Journal raid in the current expansion.':'No WCL zone matched an official Blizzard Journal raid.'},
    evidenceContract:{metadataOnly:true,reportRequired:false,wclCombatEventCalls:0,difficultyRequiredForKnowledge:true,difficultyScopedEmpiricalLearning:true,crossDifficultyComparisonForbidden:true,normalHeroicCannotCountAsMythicEvidence:true,automaticPromotion:false},
  };
}

function newestExpansionFromZones(zones=[]){const rows=(zones||[]).filter(zone=>(zone?.encounters||[]).length&&zone?.expansion?.id).sort((a,b)=>Number(b.expansion.id)-Number(a.expansion.id)||Number(b.id)-Number(a.id));return rows[0]?.expansion||null;}
async function officialExpansion(zones,{region,locale}={}){
  const target=newestExpansionFromZones(zones);if(!target)return{status:'no-wcl-expansion',raids:[],instances:[],usage:{oauthCalls:0,blizzardGameDataCalls:0}};
  const token=await getBlizzardAccessTokenV1();
  const index=await fetchBlizzardJournalExpansionsIndexV1({accessToken:token.accessToken,region,locale});
  const exact=index.tiers.find(row=>norm(row.name)===norm(target.name));const selected=exact||index.tiers.slice().sort((a,b)=>Number(b.id)-Number(a.id))[0]||null;
  if(!selected)return{status:'no-blizzard-expansion',raids:[],instances:[],usage:{oauthCalls:token.oauthCalls,blizzardGameDataCalls:1}};
  const expansion=await fetchBlizzardJournalExpansionV1(selected.id,{accessToken:token.accessToken,region,locale,href:selected.href});
  const raids=expansion.expansion.raids||[],instances=[];let calls=2;
  for(const raid of raids){try{const fetched=await fetchBlizzardJournalInstanceV1(raid.id,{accessToken:token.accessToken,region,locale,href:raid.href});calls++;instances.push(fetched.instance);}catch(error){instances.push({id:raid.id,name:raid.name,encounters:[],modes:[],error:error instanceof Error?error.message:String(error)});}}
  return{status:'resolved',journalExpansion:{id:expansion.expansion.id,name:expansion.expansion.name,matchedBy:exact?'name':'latest-fallback'},raids,instances,usage:{oauthCalls:token.oauthCalls,blizzardGameDataCalls:calls}};
}

export async function resolveRaidCatalogV1({graphql=wclGraphql,region=process.env.BLIZZARD_REGION||'eu',locale=process.env.BLIZZARD_LOCALE||'en_US'}={}){
  const data=await graphql(WCL_RAID_CATALOG_QUERY,{}),zones=data?.worldData?.zones||[];
  let official;
  try{official=await officialExpansion(zones,{region,locale});}catch(error){official={status:'provider-unavailable',raids:[],instances:[],usage:{oauthCalls:0,blizzardGameDataCalls:0},error:error instanceof Error?error.message:String(error)};}
  const catalog=compileRaidCatalogV1(zones,{officialRaids:official.raids,officialInstances:official.instances});
  return{...catalog,officialRaidClassification:{status:official.status,journalExpansion:official.journalExpansion||null,error:official.error||null},usage:{wclMetadataCalls:1,wclCombatEventCalls:0,oauthCalls:Number(official.usage?.oauthCalls||0),blizzardGameDataCalls:Number(official.usage?.blizzardGameDataCalls||0)}};
}
