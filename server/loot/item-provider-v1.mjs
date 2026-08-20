import { getBlizzardAccessTokenV1, blizzardLocalizationV1 } from '../knowledge/providers/blizzard-game-data-v1.mjs';
import { loadLootItemSnapshotV1, persistLootItemSnapshotV1 } from './item-cache-v1.mjs';

export const LOOT_ITEM_PROVIDER_VERSION='loot-item-provider-v1.3';
const cleanRegion=value=>String(value||process.env.BLIZZARD_REGION||'eu').trim().toLowerCase()||'eu';
const cleanLocale=value=>String(value||process.env.BLIZZARD_LOCALE||'en_US').trim()||'en_US';
const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
const numberOrNull=value=>value===null||value===undefined||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const localized=(value,locale)=>blizzardLocalizationV1.localized(value,locale);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const retryableError=error=>Boolean(error?.classification?.retryable)||[429,500,502,503,504].includes(Number(error?.status))||(!error?.status&&/network|timeout|fetch failed/i.test(String(error?.message||'')));
async function withRetry(task,{attempts=3}={}){let last;for(let attempt=1;attempt<=attempts;attempt++){try{return await task(attempt);}catch(error){last=error;if(attempt>=attempts||!retryableError(error))throw error;await wait(attempt===1?180:550);}}throw last;}

async function requestJson(url,{accessToken,fetcher=fetch}={}){
  const response=await fetcher(url,{headers:{authorization:`Bearer ${accessToken}`,accept:'application/json'}}),text=await response.text();
  let payload=null;try{payload=text?JSON.parse(text):null}catch{payload=text}
  if(!response.ok){const error=new Error(`Blizzard item API HTTP ${response.status}${payload?.detail?`: ${payload.detail}`:''}`);error.name='BlizzardItemApiError';error.status=response.status;error.retryable=[429,500,502,503,504].includes(Number(response.status));error.body=payload;throw error;}
  return payload;
}

function normalizeStats(row,{locale='en_US'}={}){
  const source=Array.isArray(row?.preview_item?.stats)?row.preview_item.stats:Array.isArray(row?.stats)?row.stats:[];
  return source.map(stat=>{
    const type=String(stat?.type?.type||stat?.type||'').trim().toUpperCase()||null,name=localized(stat?.type?.name,locale)||null,value=numberOrNull(stat?.value);
    return type?{type,name,value}:null;
  }).filter(Boolean);
}
function primaryStats(stats=[]){return[...new Set((stats||[]).map(row=>String(row?.type||'').toUpperCase()).filter(type=>['STRENGTH','AGILITY','INTELLECT'].includes(type)))];}
function normalizeItem(row,{locale='en_US'}={}){
  if(!row)return null;const id=positive(row.id);if(!id)return null;
  const inventoryType=row.inventory_type||row.inventoryType||null,itemClass=row.item_class||row.itemClass||null,itemSubclass=row.item_subclass||row.itemSubclass||null,name=localized(row.name,locale)||`Item ${id}`,stats=normalizeStats(row,{locale});
  return{
    id,name,names:{[locale]:name},
    quality:{type:row.quality?.type||null,name:localized(row.quality?.name,locale)},
    level:Number.isFinite(Number(row.level))?Number(row.level):null,
    requiredLevel:Number.isFinite(Number(row.required_level))?Number(row.required_level):null,
    itemClass:{id:positive(itemClass?.id),name:localized(itemClass?.name,locale)},
    itemSubclass:{id:positive(itemSubclass?.id),name:localized(itemSubclass?.name,locale)},
    inventoryType:{type:String(inventoryType?.type||'').trim()||null,name:localized(inventoryType?.name,locale)},
    stats,primaryStats:primaryStats(stats),
    mediaId:positive(row.media?.id),purchasePrice:Number.isFinite(Number(row.purchase_price))?Number(row.purchase_price):null,sellPrice:Number.isFinite(Number(row.sell_price))?Number(row.sell_price):null,maxCount:Number.isFinite(Number(row.max_count))?Number(row.max_count):null,
    wowheadUrl:`https://www.wowhead.com/item=${id}`,
  };
}
function mergeItemNames(base,incoming){if(!base)return incoming;if(!incoming)return base;return{...base,...incoming,name:base.name||incoming.name,names:{...(base.names||{}),...(incoming.names||{})}};}

export async function fetchLootItemV1(itemId,{region,locale,fetcher=fetch,refresh=false}={}){
  const id=positive(itemId);if(!id)throw new Error('itemId must be a positive integer');
  const r=cleanRegion(region),l=cleanLocale(locale),cached=await loadLootItemSnapshotV1({itemId:id,region:r,locale:l});
  if(cached&&!refresh){
    // Old snapshots retained the canonical raw Blizzard payload. Re-normalize locally when
    // newer Loot versions learn additional fields such as preview_item.stats; no network call required.
    const migrated=cached.raw?normalizeItem(cached.raw,{locale:l}):null,item=migrated?mergeItemNames(cached.item,migrated):cached.item;
    if(migrated&&(!Array.isArray(cached.item?.stats)||cached.item.stats.length!==migrated.stats.length))await persistLootItemSnapshotV1({item,raw:cached.raw,region:r,locale:l,verifiedAt:cached.verifiedAt}).catch(()=>{});
    return{version:LOOT_ITEM_PROVIDER_VERSION,provider:'blizzard-game-data',item,raw:cached.raw||null,cache:{hit:true,verifiedAt:cached.verifiedAt,staleFallback:false,migratedFromRaw:Boolean(migrated)},usage:{oauthCalls:0,blizzardCalls:0}};
  }
  try{
    const token=await withRetry(()=>getBlizzardAccessTokenV1({fetcher}));
    const url=new URL(`https://${r}.api.blizzard.com/data/wow/item/${id}`);url.searchParams.set('namespace',`static-${r}`);url.searchParams.set('locale',l);
    const raw=await withRetry(()=>requestJson(url.toString(),{accessToken:token.accessToken,fetcher})),item=normalizeItem(raw,{locale:l});
    if(item)await persistLootItemSnapshotV1({item,raw,region:r,locale:l});
    return{version:LOOT_ITEM_PROVIDER_VERSION,provider:'blizzard-game-data',item,raw,cache:{hit:false,persisted:Boolean(item),staleFallback:false},usage:{oauthCalls:token.oauthCalls,blizzardCalls:1}};
  }catch(error){
    if(cached&&retryableError(error))return{version:LOOT_ITEM_PROVIDER_VERSION,provider:'blizzard-game-data',item:cached.item,raw:cached.raw||null,cache:{hit:true,verifiedAt:cached.verifiedAt,staleFallback:true},providerStatus:{status:error?.classification?.status||'temporarily-unavailable',retryable:true,error:error.message},usage:{oauthCalls:0,blizzardCalls:0}};
    throw error;
  }
}

async function searchLocale(text,{region,locale,limit,accessToken,fetcher}){
  const url=new URL(`https://${region}.api.blizzard.com/data/wow/search/item`);url.searchParams.set('namespace',`static-${region}`);url.searchParams.set('locale',locale);url.searchParams.set(`name.${locale}`,text);url.searchParams.set('_pageSize',String(Math.max(1,Math.min(50,Number(limit)||12))));url.searchParams.set('_page','1');url.searchParams.set('orderby','id');
  const raw=await withRetry(()=>requestJson(url.toString(),{accessToken,fetcher})),rows=(raw?.results||[]).slice(0,Math.max(1,Math.min(50,Number(limit)||12))),items=[];
  for(const row of rows){const data=row?.data||null;if(data?.id){const item=normalizeItem(data,{locale});if(item){items.push(item);await persistLootItemSnapshotV1({item,raw:data,region,locale}).catch(()=>{});}continue;}const href=String(row?.key?.href||'').trim();if(!href)continue;try{const detail=await withRetry(()=>requestJson(href,{accessToken,fetcher})),item=normalizeItem(detail,{locale});if(item){items.push(item);await persistLootItemSnapshotV1({item,raw:detail,region,locale}).catch(()=>{});}}catch{}}
  return{items,blizzardCalls:1+Math.max(0,rows.filter(row=>!row?.data?.id).length)};
}

export async function searchLootItemsV1(query,{region,locale,limit=12,fetcher=fetch}={}){
  const text=String(query||'').trim();if(!text)throw new Error('query is required');
  if(/^\d+$/.test(text)){const exact=await fetchLootItemV1(Number(text),{region,locale,fetcher});return{...exact,query:text,items:exact.item?[exact.item]:[]};}
  const r=cleanRegion(region),requested=cleanLocale(locale),token=await withRetry(()=>getBlizzardAccessTokenV1({fetcher})),locales=[...new Set([requested,'en_US','es_ES'])],merged=new Map();let calls=0;
  for(const l of locales){try{const result=await searchLocale(text,{region:r,locale:l,limit,accessToken:token.accessToken,fetcher});calls+=result.blizzardCalls;for(const item of result.items)merged.set(item.id,mergeItemNames(merged.get(item.id),item));}catch(error){if(!retryableError(error))throw error;}}
  const items=[...merged.values()].slice(0,Math.max(1,Math.min(50,Number(limit)||12)));
  return{version:LOOT_ITEM_PROVIDER_VERSION,provider:'blizzard-game-data',query:text,searchLocales:locales,items,usage:{oauthCalls:token.oauthCalls,blizzardCalls:calls},negativeEvidence:false,evidenceContract:{identityCanonical:'blizzard-item-id',searchAcceptsEnglishOrSpanish:true,exactIdPreferred:true}};
}
