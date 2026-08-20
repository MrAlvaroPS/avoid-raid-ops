import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLootEligibilityV1,simcSlotsForItemV1 } from '../../server/loot/eligibility-v1.mjs';
import { lootCountsV1,awardLootV1 } from '../../server/loot/ledger-v1.mjs';
import { simulateLootForPlayerV1 } from '../../server/loot/simc-runner-v1.mjs';

const plateChest={id:1,itemClass:{name:'Armor'},itemSubclass:{name:'Plate'},inventoryType:{type:'CHEST',name:'Chest'}};
const bow={id:2,itemClass:{name:'Weapon'},itemSubclass:{name:'Bows'},inventoryType:{type:'RANGED',name:'Ranged'}};

test('loot eligibility rejects wrong armor and unsupported weapons',()=>{
  assert.equal(evaluateLootEligibilityV1(plateChest,{className:'Mage'}).eligible,false);
  assert.equal(evaluateLootEligibilityV1(plateChest,{className:'Warrior'}).eligible,true);
  assert.equal(evaluateLootEligibilityV1(bow,{className:'Hunter'}).eligible,true);
  assert.equal(evaluateLootEligibilityV1(bow,{className:'Priest'}).eligible,false);
  assert.deepEqual(simcSlotsForItemV1(plateChest),['chest']);
});

test('loot ledger is local, auditable and counts awards',async()=>{
  let row=null;const storageGet=async()=>row,storageSet=async(_key,value)=>{row=value;};
  const first=await awardLootV1({playerName:'Raider',itemId:99,itemName:'Raid Item',difficulty:3},{storageGet,storageSet,now:()=>1000});
  await awardLootV1({playerName:'Raider',itemId:100,itemName:'Second Item',difficulty:3},{storageGet,storageSet,now:()=>2000});
  assert.equal(first.award.playerName,'Raider');
  assert.equal(row.source,'local-ledger');
  assert.equal(row.networkExecuted,false);
  assert.equal(lootCountsV1(row)[0].count,2);
});

test('healer and tank gains are not fabricated without a raid-value model',async()=>{
  const item={id:10,inventoryType:{type:'TRINKET'},itemClass:{name:'Armor'},itemSubclass:{name:'Miscellaneous'}};
  const healer=await simulateLootForPlayerV1({player:{name:'Heal',role:'HEALER'},item});
  const tank=await simulateLootForPlayerV1({player:{name:'Tank',role:'TANK'},item});
  assert.equal(healer.status,'role-model-pending');
  assert.equal(tank.status,'role-model-pending');
  assert.equal(healer.gainPct,null);
  assert.equal(tank.gainPct,null);
});
