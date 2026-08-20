import test from 'node:test';
import assert from 'node:assert/strict';
import { compileOfficialEncounterGraphV1 } from '../../server/knowledge/official-encounter-knowledge-v1.mjs';
import { reconcileOfficialEncounterAbilitiesV1 } from '../../server/knowledge/official-encounter-reconciliation-v1.mjs';

const journal={
  id:5000,
  name:{en_US:'Synthetic Encounter'},
  sections:[
    {id:10,title:{en_US:'Stage One'},creature_display:{id:1},sections:[
      {id:11,title:{en_US:'Mechanic A'},spell:{id:1001,name:{en_US:'Mechanic A'}},sections:[
        {id:12,title:{en_US:'State A'},spell:{id:1002,name:{en_US:'State A'}}},
      ]},
      {id:13,title:{en_US:'Mechanic B'},spell:{id:1003,name:{en_US:'Mechanic B'}}},
    ]},
    {id:20,title:{en_US:'Stage Two'},creature_display:{id:2},sections:[
      {id:21,title:{en_US:'Mechanic C'},spell:{id:1004,name:{en_US:'Mechanic C'}}},
    ]},
  ],
};

const graph=compileOfficialEncounterGraphV1({journal,locale:'en_US',wclEncounterId:7000,namespace:'static-test-eu'});

test('official reconciliation distinguishes same branch, sibling branch, different stage and unresolved membership',()=>{
  const same=reconcileOfficialEncounterAbilitiesV1(graph,1001,1002);
  assert.equal(same.status,'same-official-mechanic-branch');
  assert.equal(same.evidenceContract.causalCombatEvidence,false);
  assert.equal(same.evidenceContract.automaticPromotion,false);

  const sibling=reconcileOfficialEncounterAbilitiesV1(graph,1002,1003);
  assert.equal(sibling.status,'same-stage-different-official-branch');
  assert.equal(sibling.bestRelation.left.stage.title,'Stage One');
  assert.equal(sibling.bestRelation.right.stage.title,'Stage One');

  const otherStage=reconcileOfficialEncounterAbilitiesV1(graph,1002,1004);
  assert.equal(otherStage.status,'different-official-stage');

  const missing=reconcileOfficialEncounterAbilitiesV1(graph,1002,9999);
  assert.equal(missing.status,'official-membership-unresolved');
  assert.equal(missing.rightOfficial,false);
  assert.equal(missing.evidenceContract.negativeEvidence,false);
});
