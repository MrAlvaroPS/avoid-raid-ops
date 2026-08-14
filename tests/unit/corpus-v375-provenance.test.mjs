import test from 'node:test';
import assert from 'node:assert/strict';
import { createAggregate, mergeDeepProfile } from '../../server/corpus/aggregate.mjs';
import { filterRelationDerivedMechanicsV375, isRelationDerivedMechanicV375 } from '../../server/corpus/model-policy-v375.mjs';

test('v3.7.5 unverified cast-to-aura mechanics cannot remain accepted',()=>{
  const mechanics=[
    {key:'real-cast',name:'Real Cast',category:'interrupt',castIds:[10],generated:{primaryAbilityId:10}},
    {key:'aura-a',name:'Aura A',inference:'failure-aura-is-failure',semanticInference:'enemy-aura-after-cast',triggerCastIds:[10],failureAuraIds:[20],generated:{primaryAbilityId:20}},
    {key:'aura-b',name:'Aura B',inference:'failure-aura-is-failure',semanticInference:'enemy-aura-after-cast',triggerCastIds:[10],failureAuraIds:[30],generated:{primaryAbilityId:30}},
  ];
  const verified=[{targetId:30,triggerCastIds:[10],confidence:.9}];
  const out=filterRelationDerivedMechanicsV375(mechanics,verified);
  assert.equal(isRelationDerivedMechanicV375(mechanics[1]),true);
  assert.deepEqual(out.kept.map(x=>x.key),['real-cast','aura-b']);
  assert.deepEqual(out.filtered.map(x=>x.key),['aura-a']);
  assert.equal(out.filtered[0].reason,'relation-origin-unverified-v1');
});

test('v3.7.5 Deep origin evidence is merged by aggregate core and survives recompilation paths',()=>{
  const aggregate=createAggregate({encounterId:3182,difficulty:5,partition:4,validationFraction:.2});
  const profile={
    code:'origin-test-report',guild:{id:12345},kills:0,wipes:1,
    fights:[{id:1,kill:false}],completeness:{},abilityStats:{},statePairs:[],relations:{},
    originEvidence:{
      '1241291':{friendlySourceEvents:0,encounterOrUnknownSourceEvents:42,unknownSourceEvents:1,events:43},
      '48517':{friendlySourceEvents:31,encounterOrUnknownSourceEvents:0,unknownSourceEvents:0,events:31},
    },
  };
  const splitName=mergeDeepProfile(aggregate,profile,{validationFraction:.2});
  const origin=aggregate.splits[splitName].originEvidence;
  assert.equal(origin['1241291'].encounterOrUnknownSourceEvents,42);
  assert.equal(origin['1241291'].reportsWithEvidence,1);
  assert.equal(origin['48517'].friendlySourceEvents,31);
  assert.equal(origin['48517'].reportsWithEvidence,1);
});
