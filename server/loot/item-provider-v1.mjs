import { getBlizzardAccessTokenV1, blizzardLocalizationV1 } from '../knowledge/providers/blizzard-game-data-v1.mjs';

export const LOOT_ITEM_PROVIDER_VERSION='loot-item-provider-v1';
const cleanRegion=value=>String(value||process.env.BLIZZARD_REGION||'eu').trim().toLowerCase()||'eu';
const cleanLocale=value=>String(value||process.env.BLIZZARD_LOCALE||'en_US').trim()||'en_US';
const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
const localized=(value,locale)=>blizzardLocalizationV1.localized(value,locale);

async function requestJson(url,{accessToken,fetcher=fetch}={}){
  const response=await fetcher(url,{headers:{authorization:`Bearer ${accessToken}`,accept:'application/json'}}),text=await response.text();
  let payload=null;try{payload=text?JSON.parse(text):null}catch{payload=text}
  if(!response.ok)throw new Error(`Blizzard item API HTTP ${response.status}${payload?.detail?`: ${payload.detail}`:''}`);
  return payload;
}

function normalizeItem(row,{locale='en_US'}={}){
  if(!row)return null;const id=positive(row.id);if(!id)return null;
  const inventoryType=row.inventory_type||row.inventoryType||null,itemClass=row.item_class||row.itemClass||null,itemSubclass=row.item_subclass||row.itemSubclass||null;
  return{
    id,
    name:localized(row.name,locale)||`Item ${id}`,
    quality:{type:row.quality?.type||null,name:localized(row.quality?.name,locale)},
    level:Number.isFinite(Number(row.level))?Number(row.level):null,
    requiredLevel:Number.isFinite(Number(row.required_level))?Number(row.required_level):null,
    itemClass:{id:positive(itemClass?.id),name:localized(itemClass?.name,locale)},
    itemSubclass:{id:positive(itemSubclass?.id),name:localized(itemSubclass?.name,locale)},
    inventoryType:{type:String(inventoryType?.type||'').trim()||null,name:localized(inventoryType?.name,locale)},
    mediaId:positive(row.media?.id),
    purchasePrice:Number.isFinite(Number(row.purchase_price))?Number(row.purchase_price):null,
    sellPrice:Number.isFinite(Number(row.sell_price))?Number(row.sell_price):null,
    maxCount:Number.isFinite(Number(row.max_count))?Number(row.max_count):null,
    wowheadUrl:`https://www.wowhead.com/item=${id}`,
  };
}

export async function fetchLootItemV1(itemId,{region,locale,fetcher=fetch}={}){
  const id=positive(itemId);if(!id)throw new Error('itemId must be a positive integer');
  const r=cleanRegion(region),l=cleanLocale(locale),token=await getBlizzardAccessTokenV1({fetcher});
  const url=new URL(`https://${r}.api.blizzard.com/data/wow/item/${id}`);url.searchParams.set('namespace',`static-${r}`);url.searchParams.set('locale',l);
  const raw=await requestJson(url.toString(),{accessToken:token.accessToken,fetcher});
  return{version:LOOT_ITEM_PROVIDER_VERSION,provider:'blizzard-game-data',item:normalizeItem(raw,{locale:l}),raw,usage:{oauthCalls:token.oauthCalls,blizzardCalls:1}};
}

export async function searchLootItemsV1(query,{region,locale,limit=12,fetcher=fetch}={}){
  const text=String(query||'').trim();if(!text)throw new Error('query is required');
  if(/^\d+$/.test(text))return{...(await fetchLootItemV1(Number(text),{region,locale,fetcher})),query:text,items:[(await fetchLootItemV1(Number(text),{region,locale,fetcher})).item]};
  const r=cleanRegion(region),l=cleanLocale(locale),token=await getBlizzardAccessTokenV1({fetcher});
  const url=new URL(`https://${r}.api.blizzard.com/data/wow/search/item`);url.searchParams.set('namespace',`static-${r}`);url.searchParams.set(`name.${l}`,text);url.searchParams.set('_pageSize',String(Math.max(1,Math.min(50,Number(limit)||12))));url.searchParams.set('_page','1');url.searchParams.set('orderby','id');
  let raw=await requestJson(url.toString(),{accessToken:token.accessToken,fetcher});
  // Blizzard search has intermittently returned an authenticated empty result when the token is only in the header.
  // Retry once with the same token in the documented query form, but never treat absence as negative evidence.
  if(!Array.isArray(raw?.results)||raw.results.length===0){const retry=new URL(url);retry.searchParams.set('access_token',token.accessToken);raw=await requestJson(retry.toString(),{accessToken:token.accessToken,fetcher});}
  const rows=(raw?.results||[]).slice(0,Math.max(1,Math.min(50,Number(limit)||12))),items=[];
  for(const row of rows){const data=row?.data||null;if(data?.id){items.push(normalizeItem(data,{locale:l}));continue;}const href=String(row?.key?.href||'').trim();if(!href)continue;try{items.push(normalizeItem(await requestJson(href,{accessToken:token.accessToken,fetcher}),{locale:l}));}catch{}}
  const unique=[...new Map(items.filter(Boolean).map(item=>[item.id,item])).values()];
  return{version:LOOT_ITEM_PROVIDER_VERSION,provider:'blizzard-game-data',query:text,items:unique,usage:{oauthCalls:token.oauthCalls,blizzardCalls:1+Math.max(0,rows.filter(row=>!row?.data?.id).length)},negativeEvidence:false};
}
