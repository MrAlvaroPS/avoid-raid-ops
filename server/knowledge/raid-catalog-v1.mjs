import { createHash } from 'node:crypto';
import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { WCL_RAID_CATALOG_QUERY } from '../wcl/queries/raid-catalog.mjs';

export const RAID_CATALOG_V1_VERSION='raid-catalog-v1';
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=value=>createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');
const finite=value=>Number.isFinite(Number(value))?Number(value):null;

function normalizeZone(zone={}){
  const difficulties=(zone.difficulties||[]).map(row=>({id:finite(row?.id),name:row?.name||null,sizes:(row?.sizes||[]).map(Number).filter(Number.isFinite)}));
  const encounters=(zone.encounters||[]).map(row=>({wclEncounterId:finite(row?.id),name:row?.name||null,journalEncounterId:finite(row?.journalID)})).filter(row=>row.wclEncounterId&&row.journalEncounterId);
  const partitions=(zone.partitions||[]).map(row=>({id:finite(row?.id),name:row?.name||null,compactName:row?.compactName||null,default:Boolean(row?.default)})).filter(row=>row.id!=null);
  const mythic=difficulties.some(row=>row.id===5||String(row.name||'').toLowerCase()==='mythic');
  const defaultPartition=partitions.find(row=>row.default)||partitions.slice().sort((a,b)=>Number(b.id)-Number(a.id))[0]||null;
  return{
    zoneId:finite(zone.id),name:zone.name||null,frozen:Boolean(zone.frozen),
    expansion:{id:finite(zone?.expansion?.id),name:zone?.expansion?.name||null},
    difficulties,partitions,defaultPartition,encounters,
    raidLike:Boolean(mythic&&encounters.length>0),
  };
}

function currentRaid(candidates=[]){
  const live=candidates.filter(row=>row.raidLike&&!row.frozen);
  const pool=live.length?live:candidates.filter(row=>row.raidLike);
  return pool.slice().sort((a,b)=>Number(b.expansion?.id||0)-Number(a.expansion?.id||0)||Number(b.zoneId||0)-Number(a.zoneId||0))[0]||null;
}

export function compileRaidCatalogV1(zones=[]){
  const normalized=(zones||[]).map(normalizeZone).filter(row=>row.zoneId&&row.raidLike).sort((a,b)=>Number(b.expansion?.id||0)-Number(a.expansion?.id||0)||Number(b.zoneId)-Number(a.zoneId));
  const selected=currentRaid(normalized);
  const payload={version:RAID_CATALOG_V1_VERSION,zones:normalized,currentZoneId:selected?.zoneId||null};
  return{
    ...payload,
    fingerprint:digest(payload),
    currentRaid:selected,
    selection:{
      policy:'latest-non-frozen-mythic-raid-zone-by-expansion-and-zone-id',
      usesCombatLogs:false,
      usesRankingOutcome:false,
      hardcodedZoneId:false,
      reason:selected?(selected.frozen?'No non-frozen raid zone was available; newest raid-like zone selected as fallback.':'Newest non-frozen raid-like zone in the newest expansion.'):'No raid-like WCL zone was available.',
    },
    evidenceContract:{metadataOnly:true,wclCombatEventCalls:0,reportRequired:false,automaticPromotion:false},
  };
}

export async function resolveRaidCatalogV1({graphql=wclGraphql}={}){
  const data=await graphql(WCL_RAID_CATALOG_QUERY,{});
  const catalog=compileRaidCatalogV1(data?.worldData?.zones||[]);
  return{...catalog,usage:{wclMetadataCalls:1,wclCombatEventCalls:0,blizzardCalls:0}};
}
