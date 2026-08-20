import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWclReportReferenceV1,normalizePullSelectionV1,classifyActiveReportManifestV1,buildAvoidExecutionContextV1 } from '../../server/execution/execution-context-v1.mjs';

test('WCL report references accept code or URL without treating unrelated URLs as reports',()=>{
  assert.deepEqual(normalizeWclReportReferenceV1('AbCd1234'),{reportCode:'AbCd1234',requestedFight:null,source:'report-code'});
  assert.deepEqual(normalizeWclReportReferenceV1('https://www.warcraftlogs.com/reports/AbCd1234#fight=42&type=damage-done'),{reportCode:'AbCd1234',requestedFight:42,source:'warcraftlogs-url'});
  assert.deepEqual(normalizeWclReportReferenceV1('https://www.warcraftlogs.com/reports/AbCd1234#fight=last'),{reportCode:'AbCd1234',requestedFight:'last',source:'warcraftlogs-url'});
  assert.equal(normalizeWclReportReferenceV1('https://example.com/reports/AbCd1234'),null);
});

test('empty live report is a waiting state, never a failed pull or wrong difficulty',()=>{
  const manifest=classifyActiveReportManifestV1({report:{code:'AbCd1234',title:'Tonight',fights:[]},live:true,generatedAt:1});
  assert.equal(manifest.state,'waiting-for-first-combat');
  assert.equal(manifest.waitingForFirstCombat,true);
  assert.equal(manifest.isError,false);
  assert.equal(manifest.fights.length,0);
  assert.equal(manifest.selectedScope,null);
  assert.equal(manifest.evidenceContract.emptyLiveReportIsNotFailure,true);
});

test('difficulty is classified per fight and a mixed report never aggregates scopes',()=>{
  const report={code:'AbCd1234',revision:3,fights:[
    {id:10,encounterID:8001,name:'Synthetic Boss',difficulty:3,startTime:100,endTime:200,inProgress:false,kill:false,fightPercentage:44},
    {id:11,encounterID:8001,name:'Synthetic Boss',difficulty:4,startTime:300,endTime:400,inProgress:false,kill:false,fightPercentage:71},
    {id:12,encounterID:8002,name:'Second Boss',difficulty:4,startTime:500,endTime:600,inProgress:true,kill:false,fightPercentage:99},
  ]};
  const manifest=classifyActiveReportManifestV1({report,live:true,generatedAt:1});
  assert.deepEqual(manifest.scopes.map(row=>row.scopeKey),['8001:d3','8001:d4','8002:d4']);
  assert.equal(manifest.selectedFight.fightId,12);
  assert.equal(manifest.selectedScope.scopeKey,'8002:d4');
  assert.equal(manifest.evidenceContract.crossDifficultyAggregationForbidden,true);
});

test('explicit pull selection is optional and all is the default',()=>{
  assert.deepEqual(normalizePullSelectionV1(),{mode:'all',fightId:null});
  assert.deepEqual(normalizePullSelectionV1('all'),{mode:'all',fightId:null});
  assert.deepEqual(normalizePullSelectionV1(17),{mode:'single',fightId:17});
  assert.throws(()=>normalizePullSelectionV1('bad'),/all or a positive fight id/);
  const context=buildAvoidExecutionContextV1({homeHistory:{revision:'h1'},activeReport:{state:'ready'}});
  assert.equal(context.pullSelection.mode,'all');
  assert.equal(context.isolation.globalIrisIndependent,true);
  assert.equal(context.isolation.activeReportDoesNotMutateHomeHistory,true);
  assert.equal(context.isolation.firstPageWclNetworkAllowed,false);
});
