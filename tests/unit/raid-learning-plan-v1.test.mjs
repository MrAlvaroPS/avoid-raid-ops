import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRaidLearningPlanPreviewV1,resolveRaidLearningAvailabilityV1 } from '../../server/knowledge/raid-learning-plan-v1.mjs';

const catalog={fingerprint:'a'.repeat(40),currentRaid:{zoneId:600,name:'Synthetic Raid',defaultPartition:{id:8},difficulties:[{id:3,name:'Normal'},{id:4,name:'Heroic'},{id:5,name:'Mythic'}],encounters:[
  {name:'Boss Alpha',journalEncounterId:8001,wclEncounterId:7001,difficulties:[{id:3,name:'Normal'},{id:4,name:'Heroic'},{id:5,name:'Mythic'}]},
  {name:'Boss Beta',journalEncounterId:8002,wclEncounterId:null,difficulties:[{id:3,name:'Normal'},{id:4,name:'Heroic'},{id:5,name:'Mythic'}]},
]}};

test('raid learning preview budgets metadata per published boss+difficulty and zero combat events',()=>{
  const preview=buildRaidLearningPlanPreviewV1(catalog);
  assert.equal(preview.scopes.length,6);
  assert.equal(preview.networkUpperBound.wclMetadataCalls,3);
  assert.equal(preview.networkUpperBound.wclCombatEventCalls,0);
  assert.equal(preview.safety.crossDifficultyComparisonForbidden,true);
});

test('Normal Heroic and Mythic availability are classified independently and ranking outcomes are discarded',async()=>{
  const calls=[];
  const result=await resolveRaidLearningAvailabilityV1(catalog,{rankingPage:async input=>{
    calls.push({...input});
    if(input.difficulty===3)return{rows:[{reportCode:'NORMALAAA',rank:99},{reportCode:'NORMALBBB',rank:1}],resolvedPartition:8};
    if(input.difficulty===4)return{rows:[{reportCode:'HEROICAA',rank:50}],resolvedPartition:8};
    return{rows:[],resolvedPartition:8};
  }});
  assert.deepEqual(calls.map(x=>x.difficulty),[3,4,5]);
  const alpha=result.scopes.filter(row=>row.wclEncounterId===7001);
  assert.equal(alpha.find(row=>row.difficulty.id===3).status,'public-evidence-available');
  assert.equal(alpha.find(row=>row.difficulty.id===4).status,'public-evidence-available');
  assert.equal(alpha.find(row=>row.difficulty.id===5).status,'no-public-evidence-yet');
  assert.equal(alpha.find(row=>row.difficulty.id===3).publicSources,2);
  assert.equal(result.scopes.filter(row=>row.journalEncounterId===8002).every(row=>row.status==='wcl-encounter-not-published'),true);
  assert.equal(result.usage.wclCombatEventCalls,0);
  assert.equal(result.evidenceContract.normalHeroicCannotCountAsMythicEvidence,true);
});
