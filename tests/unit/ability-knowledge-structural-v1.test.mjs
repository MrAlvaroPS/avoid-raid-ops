import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAbilityKnowledgeV1 } from '../../server/knowledge/ability-knowledge-v1.mjs';

const officialGraph={
  fingerprint:'0123456789abcdef0123456789abcdef01234567',
  source:{namespace:'static-12.1.0_68914-eu'},
  encounter:{journalEncounterId:9001,wclEncounterId:9876,name:'Synthetic Boss'},
  abilities:[{
    abilityId:700002,
    name:'Official State',
    officialEncounterAssociation:true,
    memberships:[{sectionId:44,title:'Official State',structuralRole:'submechanic',path:['Stage One','Mechanic A','Official State']}],
  }],
};

const structuralKnowledge={
  fingerprint:'abcdef0123456789abcdef0123456789abcdef01',
  scope:{wclEncounterId:9876},
  provider:{id:'wago-db2',build:'12.1.0.68914'},
  relations:[{
    provider:'wago-db2',providerBuild:'12.1.0.68914',providerTable:'SpellEffect',providerRowId:991,
    sourceAbilityId:700001,targetAbilityId:700002,relationKind:'trigger-spell',relationLabel:'SpellEffect.EffectTriggerSpell',
    officialContext:{status:'unlisted-source-to-official-target'},
    structuralEvidence:{effectIndex:0,effect:32,implicitTarget0:25},
  }],
  coverage:{queryCoverage:{
    'SpellID|700001':{field:'SpellID',value:700001,status:'resolved',matchedRows:1,serverFilterVerified:true,negativeEvidence:false},
    'EffectTriggerSpell|700001':{field:'EffectTriggerSpell',value:700001,status:'resolved',matchedRows:0,serverFilterVerified:true,negativeEvidence:false},
    'SpellID|700002':{field:'SpellID',value:700002,status:'resolved',matchedRows:0,serverFilterVerified:true,negativeEvidence:false},
    'EffectTriggerSpell|700002':{field:'EffectTriggerSpell',value:700002,status:'resolved',matchedRows:1,serverFilterVerified:true,negativeEvidence:false},
  }},
};

test('Ability Knowledge exposes stored build-pinned DB2 relations with zero provider/WCL execution',async()=>{
  const result=await resolveAbilityKnowledgeV1({
    abilityIds:[700001,700002,700003],encounterId:9876,providers:{lorrgs:false,parseWowhead:false,wcl:false},
  },{officialGraph,structuralKnowledge,fetcher:async()=>{throw new Error('network must not execute');}});

  assert.equal(result.usage.officialJournalReadsAttempted,0);
  assert.equal(result.usage.structuralReadsAttempted,0);
  assert.equal(result.usage.structuralCacheHit,true);
  assert.equal(result.usage.structuralInjected,true);
  assert.equal(result.usage.lorrgsCallsAttempted,0);
  assert.equal(result.usage.wclCallsAttempted,0);
  assert.equal(result.providers.spellStructure.networkRequested,false);
  assert.equal(result.providers.spellStructure.build,'12.1.0.68914');

  const source=result.abilities.find(row=>row.abilityId===700001);
  assert.equal(source.providerSignals.spellStructure.status,'resolved');
  assert.equal(source.providerSignals.spellStructure.outbound.length,1);
  assert.equal(source.providerSignals.spellStructure.outbound[0].targetAbilityId,700002);
  assert.equal(source.providerSignals.spellStructure.negativeEvidence,false);

  const target=result.abilities.find(row=>row.abilityId===700002);
  assert.equal(target.semanticClass,'official-encounter-ability');
  assert.equal(target.providerSignals.spellStructure.status,'resolved');
  assert.equal(target.providerSignals.spellStructure.inbound[0].sourceAbilityId,700001);
  assert.equal(target.interpretation.structuralRelationsObservedInClientMetadata,true);
  assert.equal(target.interpretation.canonicalCombatEvidence,false);
  assert.equal(target.interpretation.promotionEligible,false);

  const notQueried=result.abilities.find(row=>row.abilityId===700003);
  assert.equal(notQueried.providerSignals.spellStructure.status,'not-queried');
  assert.equal(notQueried.providerSignals.spellStructure.negativeEvidence,false);
});

test('Ability Knowledge refuses stale DB2 build when official Blizzard build changed',async()=>{
  const stale={...structuralKnowledge,provider:{id:'wago-db2',build:'12.1.0.60000'}};
  const result=await resolveAbilityKnowledgeV1({
    abilityIds:[700002],encounterId:9876,providers:{lorrgs:false,parseWowhead:false,wcl:false},
  },{officialGraph,structuralKnowledge:stale});

  assert.equal(result.usage.structuralCacheHit,false);
  assert.equal(result.providers.spellStructure.storedGraphAvailable,false);
  assert.equal(result.abilities[0].providerSignals.spellStructure.status,'not-cached-or-unavailable');
  assert.ok(result.errors.some(row=>row.provider==='wago-db2'&&/does not match current official Blizzard build/.test(row.error)));
});
