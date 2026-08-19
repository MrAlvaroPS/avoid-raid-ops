import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLootLedgerV1, awardLootV1, removeLootAwardV1, lootCountsV1 } from '../../server/loot/ledger-v1.mjs';

function memory(){let value=null;return{get:async()=>value,set:async(_key,next)=>{value=structuredClone(next);return next;}};}

test('loot ledger starts empty and records awards deterministically',async()=>{
  const store=memory();
  const empty=await loadLootLedgerV1({storageGet:store.get});
  assert.equal(empty.awards.length,0);
  const first=await awardLootV1({playerName:'RaiderOne',itemId:123,itemName:'Raid Trinket',difficulty:3,difficultyName:'Normal'},{storageGet:store.get,storageSet:store.set,now:()=>1000});
  assert.equal(first.ledger.awards.length,1);
  assert.equal(first.award.playerName,'RaiderOne');
  assert.equal(first.counts[0].count,1);
  const second=await awardLootV1({playerName:'RaiderOne',itemId:124,itemName:'Raid Ring'},{storageGet:store.get,storageSet:store.set,now:()=>2000});
  assert.equal(lootCountsV1(second.ledger)[0].count,2);
});

test('loot award can be undone without touching unrelated awards',async()=>{
  const store=memory();
  const a=await awardLootV1({playerName:'A',itemId:1,itemName:'One'},{storageGet:store.get,storageSet:store.set,now:()=>1});
  await awardLootV1({playerName:'B',itemId:2,itemName:'Two'},{storageGet:store.get,storageSet:store.set,now:()=>2});
  const removed=await removeLootAwardV1(a.award.id,{storageGet:store.get,storageSet:store.set,now:()=>3});
  assert.equal(removed.ledger.awards.length,1);
  assert.equal(removed.ledger.awards[0].playerName,'B');
});
