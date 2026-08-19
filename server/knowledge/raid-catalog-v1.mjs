import { createHash } from 'node:crypto';
import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { WCL_RAID_CATALOG_QUERY } from '../wcl/queries/raid-catalog.mjs';
import { getBlizzardAccessTokenV1,fetchBlizzardJournalExpansionsIndexV1,fetchBlizzardJournalExpansionV1 } from './providers/blizzard-game-data-v1.mjs';

export const RAID_CATALOG_V1_VERSION='raid-catalog-v1';
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=value=>createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const norm=value=>String(value||'').normalize('NFKD').replace(/[’']/g,"'").replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase();
const hasDifficulty=(rows,id,name)=>rows.some(row=>row.id===id||norm(row.name)===name);

function normalizeZone(zone={},officialRaidNames=new Set()){
  const difficulties=(zone.difficulties||[]).map(row=>({id:finite(row?.id),name:row?.name||null,sizes:(row?.sizes||[]).map(Number).filter(Number.isFinite)}));
  const rawEncounters=(zone.encounters||[]).map(row=>({wclEncounterId:finite(row?.id),name:row?.name||null,journalEncounterId:finite(row?.journalID)})).filter(row=>row.wclEncounterId);
  const encounters=rawEncounters.filter(row=>row.journalEncounterId);
  const partitions=(zone.partitions||[]).map(row=>({id:finite(row?.id),name:row?.name||null,compactName:row?.compactName||null,default:Boolean(row?.default)})).filter(row=>row.id!=null);
  const mythic=hasDifficulty(difficulties,5,'mythic'),heroic=hasDifficulty(difficulties,4,'heroic'),normal=hasDifficulty(difficulties,3,'normal');
  const raidDifficultySignature=mythic&&(heroic||normal);
  const officialRaidMatch=officialRaidNames.has(norm(zone.name));
  const defaultPartition=partitions.find(row=>row.default)||partitions.slice().sort((a,b)=>Number(b.id)-Number(a.id))[0]||null;
  const empiricalDifficulties=difficulties.map(row=>({...row,scopeKey:`difficulty:${row.id}`,learningScope:'difficulty-isolated'}));
  return{
    zoneId:finite(zone.id),name:zone.name||null,frozen:Boolean(zone.frozen),
    expansion:{id:finite(zone?.expansion?.id),name:zone?.expansion?.name||null},
    difficulties,empiricalDifficulties,partitions,defaultPartition,encounters,
    metadata:{rawEncounterCount:rawEncounters.length,journalLinkedEncounterCount:encounters.length,missingJournalEncounterCount:rawEncounters.length-encounters.length},
    classification:{officialRaidMatch,raidDifficultySignature,source:officialRaidMatch?'blizzard-journal-expansion':raidDifficultySignature?'wcl-difficulty-fallback':'unclassified'},
    raidLike:Boolean(encounters.length>0&&(officialRaidMatch||raidDifficultySignature)),
  };
}

function currentRaid(candidates=[]){
  const live=candidates.filter(row=>row.raidLike&&!row.frozen),pool=live.length?live:candidates.filter(row=>row.raidLike);
  return pool.slice().sort((a,b)=>Number(b.classification?.officialRaidMatch)-Number(a.classification?.officialRaidMatch)||Number(b.expansion?.id||0)-Number(a.expansion?.id||0)||Number(b.zoneId||0)-Number(a.zoneId||0))[0]||null;
}

function diagnostics(normalized=[]){
  const recent=[...normalized].sort((a,b)=>Number(b.expansion?.id||0)-Number(a.expansion?.id||0)||Number(b.zoneId||0)-Number(a.zoneId||0)).slice(0,20);
  return{
    rawZoneCount:normalized.length,
    zonesWithEncounters:normalized.filter(row=>row.metadata.rawEncounterCount>0).length,
    zonesWithJournalLinkedEncounters:normalized.filter(row=>row.metadata.journalLinkedEncounterCount>0).length,
    zonesWithOfficialRaidMatch:normalized.filter(row=>row.classification.officialRaidMatch).length,
    zonesWithRaidDifficultySignature:normalized.filter(row=>row.classification.raidDifficultySignature).length,
    recentZones:recent.map(row=>({zoneId:row.zoneId,name:row.name,frozen:row.frozen,expansion:row.expansion,difficultyIds:row.difficulties.map(item=>item.id),difficultyNames:row.difficulties.map(item=>item.name),difficultySizes:row.difficulties.map(item=>({id:item.id,name:item.name,sizes:item.sizes})),partitionIds:row.partitions.map(item=>item.id),rawEncounterCount:row.metadata.rawEncounterCount,journalLinkedEncounterCount:row.metadata.journalLinkedEncounterCount,missingJournalEncounterCount:row.metadata.missingJournalEncounterCount,sampleEncounters:row.encounters.slice(0,12),classification:row.classification,raidLike:row.raidLike})),
  };
}

export function compileRaidCatalogV1(zones=[],{officialRaidNames=[]}={}){
  const officialSet=new Set((officialRaidNames||[]).map(norm).filter(Boolean));
  const all=(zones||[]).map(zone=>normalizeZone(zone,officialSet)).filter(row=>row.zoneId);
  const normalized=all.filter(row=>row.raidLike).sort((a,b)=>Number(b.classification?.officialRaidMatch)-Number(a.classification?.officialRaidMatch)||Number(b.expansion?.id||0)-Number(a.expansion?.id||0)||Number(b.zoneId)-Number(a.zoneId));
  const selected=currentRaid(normalized),payload={version:RAID_CATALOG_V1_VERSION,zones:normalized,currentZoneId:selected?.zoneId||null};
  return{
    ...payload,fingerprint:digest(payload),currentRaid:selected,diagnostics:diagnostics(all),
    selection:{policy:'blizzard-official-raid-classification-then-wcl-fallback',usesCombatLogs:false,usesRankingOutcome:false,hardcodedZoneId:false,reason:selected?(selected.classification.officialRaidMatch?'Newest non-frozen WCL zone classified as a raid by Blizzard JournalExpansion.':selected.frozen?'No non-frozen official raid zone was available; WCL difficulty fallback selected newest frozen raid-like zone.':'No Blizzard raid-name match was available; newest non-frozen WCL raid-difficulty fallback selected.'):'No raid-like WCL zone was available.'},
    evidenceContract:{metadataOnly:true,wclCombatEventCalls:0,reportRequired:false,difficultyIsolatedEmpiricalLearning:true,normalHeroicCannotCountAsMythicEvidence:true,automaticPromotion:false},
  };
}

function newestExpansionFromZones(zones=[]){
  const rows=(zones||[]).filter(zone=>(zone?.encounters||[]).length&&zone?.expansion?.id).sort((a,b)=>Number(b.expansion.id)-Number(a.expansion.id)||Number(b.id)-Number(a.id));
  return rows[0]?.expansion||null;
}

async function officialRaidNamesForWclExpansion(zones,{region,locale}={}){
  const target=newestExpansionFromZones(zones);if(!target)return{raidNames:[],usage:{oauthCalls:0,blizzardGameDataCalls:0},status:'no-wcl-expansion'};
  try{
    const token=await getBlizzardAccessTokenV1();
    const index=await fetchBlizzardJournalExpansionsIndexV1({accessToken:token.accessToken,region,locale});
    const exact=index.tiers.find(row=>norm(row.name)===norm(target.name));
    const selected=exact||index.tiers.slice().sort((a,b)=>Number(b.id)-Number(a.id))[0]||null;
    if(!selected)return{raidNames:[],usage:{oauthCalls:token.oauthCalls,blizzardGameDataCalls:1},status:'no-blizzard-expansion'};
    const expansion=await fetchBlizzardJournalExpansionV1(selected.id,{accessToken:token.accessToken,region,locale,href:selected.href});
    return{raidNames:(expansion.expansion.raids||[]).map(row=>row.name).filter(Boolean),journalExpansion:{id:expansion.expansion.id,name:expansion.expansion.name,matchedBy:exact?'name':'latest-fallback'},usage:{oauthCalls:token.oauthCalls,blizzardGameDataCalls:2},status:'resolved'};
  }catch(error){return{raidNames:[],usage:{oauthCalls:0,blizzardGameDataCalls:0},status:'provider-unavailable',error:error instanceof Error?error.message:String(error)};}
}

export async function resolveRaidCatalogV1({graphql=wclGraphql,region=process.env.BLIZZARD_REGION||'eu',locale=process.env.BLIZZARD_LOCALE||'en_US'}={}){
  const data=await graphql(WCL_RAID_CATALOG_QUERY,{}),zones=data?.worldData?.zones||[];
  const official=await officialRaidNamesForWclExpansion(zones,{region,locale});
  const catalog=compileRaidCatalogV1(zones,{officialRaidNames:official.raidNames});
  return{...catalog,officialRaidClassification:{status:official.status,journalExpansion:official.journalExpansion||null,raidNames:official.raidNames,error:official.error||null},usage:{wclMetadataCalls:1,wclCombatEventCalls:0,oauthCalls:Number(official.usage?.oauthCalls||0),blizzardGameDataCalls:Number(official.usage?.blizzardGameDataCalls||0)}};
}
