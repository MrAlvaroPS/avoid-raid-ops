import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLootEligibilityV1, simcSlotsForItemV1, canonicalWeaponSubclassV1 } from '../../server/loot/eligibility-v1.mjs';

const item=({itemClass='Armor',subclass='Plate',inventory='CHEST',primaryStats=[]}={})=>({id:1,itemClass:{name:itemClass},itemSubclass:{name:subclass},inventoryType:{type:inventory},primaryStats});
const player=(className,spec=null)=>({name:'Raider',className,spec});

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

test('Blizzard singular Polearm resolves to the canonical polearm proficiency',()=>{
  const polearm=item({itemClass:'Weapon',subclass:'Polearm',inventory:'TWOHWEAPON'});
  assert.equal(canonicalWeaponSubclassV1('Polearm'),'polearm');
  assert.equal(canonicalWeaponSubclassV1('Polearms'),'polearm');
  assert.equal(evaluateLootEligibilityV1(polearm,player('Warrior')).eligible,true);
  assert.equal(evaluateLootEligibilityV1(polearm,player('Monk')).eligible,true);
  assert.equal(evaluateLootEligibilityV1(polearm,player('Mage')).eligible,false);
});

test('two-handed swords are not accidentally matched as one-handed swords',()=>{
  const twoHand=item({itemClass:'Weapon',subclass:'Two-Handed Swords',inventory:'TWOHWEAPON'});
  const oneHand=item({itemClass:'Weapon',subclass:'Sword',inventory:'WEAPONMAINHAND'});
  assert.equal(canonicalWeaponSubclassV1('Two-Handed Swords'),'two-handed sword');
  assert.equal(evaluateLootEligibilityV1(oneHand,player('Mage')).eligible,true);
  assert.equal(evaluateLootEligibilityV1(twoHand,player('Mage')).eligible,false);
  assert.equal(evaluateLootEligibilityV1(twoHand,player('Warrior')).eligible,true);
});

test('physical equipability does not make a Beast Mastery Hunter a polearm loot candidate',()=>{
  const polearm=item({itemClass:'Weapon',subclass:'Polearm',inventory:'TWOHWEAPON',primaryStats:['AGILITY']});
  const result=evaluateLootEligibilityV1(polearm,player('Hunter','Beast Mastery'));
  assert.equal(result.physicalEligible,true);
  assert.equal(result.specCompatible,false);
  assert.equal(result.allocationEligible,false);
  assert.equal(result.simEligible,false);
  assert.equal(result.candidateStatus,'spec-incompatible');
});

test('matching active spec and primary stat becomes a SimulationCraft candidate',()=>{
  const polearm=item({itemClass:'Weapon',subclass:'Polearm',inventory:'TWOHWEAPON',primaryStats:['STRENGTH']});
  const result=evaluateLootEligibilityV1(polearm,player('Warrior','Arms'));
  assert.equal(result.physicalEligible,true);
  assert.equal(result.specCompatible,true);
  assert.equal(result.allocationEligible,true);
  assert.equal(result.simEligible,true);
});

test('primary-stat contradiction blocks raid allocation but remains distinct from physical proficiency',()=>{
  const polearm=item({itemClass:'Weapon',subclass:'Polearm',inventory:'TWOHWEAPON',primaryStats:['AGILITY']});
  const result=evaluateLootEligibilityV1(polearm,player('Druid','Balance'));
  assert.equal(result.physicalEligible,true);
  assert.equal(result.specCompatible,false);
  assert.equal(result.status,'eligible');
  assert.match(result.specReason,/INTELLECT/);
});
