import test from 'node:test';
import assert from 'node:assert/strict';
import { lootItemCacheKeyV1, loadLootItemSnapshotV1, persistLootItemSnapshotV1 } from '../../server/loot/item-cache-v1.mjs';

test('verified Blizzard item snapshots are keyed by region locale and item id',async()=>{
  const memory=new Map(),storageSet=async(key,value)=>{memory.set(key,value);return value;},storageGet=async key=>memory.get(key)||null;
  const item={id:268215,name:"Abyssal Broodfiend's Bardiche",itemClass:{name:'Weapon'},itemSubclass:{name:'Polearms'},inventoryType:{type:'TWOHWEAPON'}};
  const saved=await persistLootItemSnapshotV1({item,region:'eu',locale:'en_US',verifiedAt:123,storageSet});
  assert.equal(saved.canonical,true);
  assert.equal(memory.has(lootItemCacheKeyV1({itemId:268215,region:'eu',locale:'en_US'})),true);
  const loaded=await loadLootItemSnapshotV1({itemId:268215,region:'eu',locale:'en_US',storageGet});
  assert.equal(loaded.item.name,item.name);
  assert.equal(loaded.verifiedAt,123);
});
