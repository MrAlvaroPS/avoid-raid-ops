import { corpusGet, corpusSet } from '../corpus/storage.mjs';

export const LOOT_ITEM_CACHE_VERSION='loot-item-cache-v1';
const clean=value=>String(value||'').trim();
const safe=value=>clean(value).toLowerCase().replace(/[^a-z0-9_-]+/g,'_')||'unknown';
const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
export const lootItemCacheKeyV1=({itemId,region='eu',locale='en_US'}={})=>`home/loot/items/v1/${safe(region)}/${safe(locale)}/${positive(itemId)}.json`;

export async function loadLootItemSnapshotV1({itemId,region='eu',locale='en_US',storageGet=corpusGet}={}){
  const id=positive(itemId);if(!id)return null;
  const row=await storageGet(lootItemCacheKeyV1({itemId:id,region,locale}));
  if(!row?.item?.id||Number(row.item.id)!==id)return null;
  return row;
}

export async function persistLootItemSnapshotV1({item,raw=null,region='eu',locale='en_US',verifiedAt=Date.now(),storageSet=corpusSet}={}){
  const id=positive(item?.id);if(!id)throw new Error('Verified loot item snapshot requires item.id');
  const row={version:LOOT_ITEM_CACHE_VERSION,provider:'blizzard-game-data',canonical:true,item,raw,region:safe(region),locale:clean(locale)||'en_US',verifiedAt:Number(verifiedAt)||Date.now()};
  await storageSet(lootItemCacheKeyV1({itemId:id,region,locale}),row);
  return row;
}
