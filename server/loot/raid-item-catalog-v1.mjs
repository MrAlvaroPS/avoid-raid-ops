import { corpusGet,corpusSet } from '../corpus/storage.mjs';
import { loadLatestRaidCatalogV1 } from '../knowledge/raid-catalog-store-v1.mjs';
import { getBlizzardAccessTokenV1,fetchBlizzardJournalEncounterV1,blizzardLocalizationV1 } from '../knowledge/providers/blizzard-game-data-v1.mjs';
import { fetchLootItemV1 } from './item-provider-v1.mjs';

export const RAID_LOOT_CATALOG_VERSION='raid-loot-catalog-v1.1';
const norm=value=>String(value||'').normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const finite=value=>Number.isInteger(Number(value))&&Number(value)>0?Number(value):null;
const keyFor=zoneId=>`loot/raid-catalog/v1/zone/${Number(zoneId)}/latest.json`;
const localeName=(value,locale)=>blizzardLocalizationV1.localized(value,locale);

function encounterItems(journal,locale,boss){
  return (journal?.items||[]).map(row=>{
    const ref=row?.item||row,id=finite(ref?.id),name=localeName(ref?.name,locale);if(!id)return null;
    return{id,name:name||`Item ${id}`,href:String(ref?.key?.href||'').trim()||null,boss:{journalEncounterId:Number(boss.journalEncounterId),wclEncounterId:Number(boss.wclEncounterId)||null,name:boss.name||null,order:Number(boss.order)||null}};
  }).filter(Boolean);
}
function mergeRows(rows=[]){
  const map=new Map();
  for(const row of rows){const current=map.get(row.id)||{id:row.id,names:{},bosses:[],href:row.href||null};if(row.locale&&row.name)current.names[row.locale]=row.name;if(!current.href&&row.href)current.href=row.href;if(row.boss&&!current.bosses.some(b=>Number(b.journalEncounterId)===Number(row.boss.journalEncounterId)))current.bosses.push(row.boss);map.set(row.id,current);}
  return [...map.values()].map(row=>({...row,name:row.names.en_US||row.names.es_ES||Object.values(row.names)[0]||`Item ${row.id}`,bosses:row.bosses.sort((a,b)=>Number(a.order)-Number(b.order))})).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
}
export async function loadRaidLootCatalogV1({zoneId,storageGet=corpusGet}={}){const id=finite(zoneId);if(!id)return null;return storageGet(keyFor(id)).catch(()=>null);}
export async function persistRaidLootCatalogV1(catalog,{storageSet=corpusSet}={}){await storageSet(keyFor(catalog.zoneId),catalog);return catalog;}

export async function refreshRaidLootCatalogV1({region=process.env.BLIZZARD_REGION||'eu',locales=['en_US','es_ES'],fetcher=fetch}={}){
  const raidCatalog=await loadLatestRaidCatalogV1(),raid=raidCatalog?.currentRaid;if(!raid?.zoneId)throw new Error('Persisted current raid catalog is required');
  const bosses=(raid.encounters||[]).filter(row=>finite(row?.journalEncounterId));if(!bosses.length)throw new Error('Current raid has no journal-linked encounters');
  const token=await getBlizzardAccessTokenV1({fetcher}),rows=[],errors=[];let calls=0;
  for(const locale of [...new Set(locales)])for(const boss of bosses){try{const fetched=await fetchBlizzardJournalEncounterV1(boss.journalEncounterId,{fetcher,accessToken:token.accessToken,region,locale});calls++;for(const item of encounterItems(fetched.journal,locale,boss))rows.push({...item,locale});}catch(error){errors.push({journalEncounterId:boss.journalEncounterId,bossName:boss.name,locale,error:error instanceof Error?error.message:String(error)});}}
  const items=mergeRows(rows),catalog={version:RAID_LOOT_CATALOG_VERSION,zoneId:Number(raid.zoneId),raidName:raid.name||null,raidCatalogFingerprint:raidCatalog.fingerprint||null,generatedAt:Date.now(),locales:[...new Set(locales)],items,bosses:bosses.map(b=>({order:b.order,name:b.name,journalEncounterId:b.journalEncounterId,wclEncounterId:b.wclEncounterId})),coverage:{bosses:bosses.length,itemCount:items.length,requestsExpected:bosses.length*[...new Set(locales)].length,requestsCompleted:calls,errors},source:{provider:'blizzard-game-data',kind:'journal-encounter-items',officialEncounterLoot:true},usage:{oauthCalls:token.oauthCalls,blizzardGameDataCalls:calls},evidenceContract:{currentRaidOnly:true,bossEncounterLoot:true,zoneTrashAndBoECompletenessNotGuaranteed:true,itemIdentityCanonical:'blizzard-item-id',searchOfflineAfterRefresh:true}};
  await persistRaidLootCatalogV1(catalog);return catalog;
}

export async function ensureRaidLootCatalogV1({refresh=false,...options}={}){
  const raidCatalog=await loadLatestRaidCatalogV1(),raid=raidCatalog?.currentRaid;if(!raid?.zoneId)throw new Error('Persisted current raid catalog is required');
  const cached=await loadRaidLootCatalogV1({zoneId:raid.zoneId});if(!refresh&&cached?.raidCatalogFingerprint===raidCatalog.fingerprint&&Array.isArray(cached.items)&&cached.items.length)return{catalog:cached,networkExecuted:false,usage:{oauthCalls:0,blizzardGameDataCalls:0}};
  const catalog=await refreshRaidLootCatalogV1(options);return{catalog,networkExecuted:true,usage:catalog.usage};
}

export async function searchRaidLootCatalogV1(query,{limit=30,refresh=false,region=process.env.BLIZZARD_REGION||'eu',...options}={}){
  const text=String(query||'').trim();if(!text)throw new Error('query is required');const ensured=await ensureRaidLootCatalogV1({refresh,region,...options}),catalog=ensured.catalog;
  const exactId=/^\d+$/.test(text)?Number(text):null,n=norm(text),refs=(catalog.items||[]).filter(item=>exactId?Number(item.id)===exactId:[item.name,...Object.values(item.names||{})].some(name=>norm(name).includes(n))).slice(0,Math.max(1,Math.min(100,Number(limit)||30))),items=[];let detailCalls=0;
  for(const ref of refs){try{const detail=await fetchLootItemV1(ref.id,{region});detailCalls+=Number(detail?.usage?.blizzardCalls||0);if(detail.item)items.push({...detail.item,name:ref.names?.en_US||detail.item.name,names:{...(detail.item.names||{}),...(ref.names||{})},bosses:ref.bosses,raidDrop:true});}catch{items.push({...ref,raidDrop:true});}}
  return{version:RAID_LOOT_CATALOG_VERSION,provider:'blizzard-journal-raid-loot',query:text,raid:{zoneId:catalog.zoneId,name:catalog.raidName},items,networkExecuted:ensured.networkExecuted||detailCalls>0,usage:{oauthCalls:Number(ensured.usage?.oauthCalls||0),blizzardGameDataCalls:Number(ensured.usage?.blizzardGameDataCalls||0)+detailCalls},catalog:{generatedAt:catalog.generatedAt,itemCount:catalog.items.length,locales:catalog.locales,coverage:catalog.coverage},evidenceContract:catalog.evidenceContract};
}
