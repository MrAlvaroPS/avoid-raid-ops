import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLootEligibilityV1, simcSlotsForItemV1 } from '../../server/loot/eligibility-v1.mjs';

const item=({itemClass='Armor',subclass='Plate',inventory='CHEST'}={})=>({id:1,itemClass:{name:itemClass},itemSubclass:{name:subclass},inventoryType:{type:inventory}});
const player=(className)=>({name:'Raider',className});

test('plate is intended for plate classes, not cloth classes',()=>{
  assert.equal(evaluateLootEligibilityV1(item(),player('Warrior')).eligible,true);
  assert.equal(evaluateLootEligibilityV1(item(),player('Mage')).eligible,false);
});

test('cloth is intended for cloth classes, not plate classes',()=>{
  const cloth=item({subclass:'Cloth'});
  assert.equal(evaluateLootEligibilityV1(cloth,player('Mage')).eligible,true);
  assert.equal(evaluateLootEligibilityV1(cloth,player('Warrior')).eligible,false);
});

test('trinkets remain class-universal and can be delegated to SimC',()=>{
  const trinket=item({subclass:'Miscellaneous',inventory:'TRINKET'});
  assert.equal(evaluateLootEligibilityV1(trinket,player('Mage')).eligible,true);
  assert.deepEqual(simcSlotsForItemV1(trinket),['trinket1','trinket2']);
});

test('shield proficiency is class-filtered',()=>{
  const shield=item({subclass:'Shields',inventory:'SHIELD'});
  assert.equal(evaluateLootEligibilityV1(shield,player('Shaman')).eligible,true);
  assert.equal(evaluateLootEligibilityV1(shield,player('Mage')).eligible,false);
});

test('rings generate both candidate SimC slots',()=>{
  assert.deepEqual(simcSlotsForItemV1(item({subclass:'Miscellaneous',inventory:'FINGER'})),['finger1','finger2']);
});

test('weapon proficiency blocks impossible classes before simulation',()=>{
  const bow=item({itemClass:'Weapon',subclass:'Bows',inventory:'RANGED'});
  assert.equal(evaluateLootEligibilityV1(bow,player('Hunter')).eligible,true);
  assert.equal(evaluateLootEligibilityV1(bow,player('Priest')).eligible,false);
});
