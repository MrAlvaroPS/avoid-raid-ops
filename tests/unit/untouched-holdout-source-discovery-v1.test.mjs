import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGlobalBossLearningSourceLineageV1 } from '../../server/corpus/untouched-holdout-source-pool-v1.mjs';
import { buildUntouchedHoldoutSourceDiscoveryPreviewV1,executeUntouchedHoldoutSourceDiscoveryV1 } from '../../server/corpus/untouched-holdout-source-discovery-v1.mjs';

const scope={encounterId:8765,difficulty:5,partition:7};
const supportedStability={fingerprint:'e'.repeat(40),patterns:[{patternKey:'after-2.5s|debuffs|765432|removedebuff',abilityId:765432,status:'source-stratified-stability-supported',holdoutEligible:true}]};

function cleanLineage(){return buildGlobalBossLearningSourceLineageV1({aggregate:{sourceReports:{'guild:1001':2},splits:{train:{sourceReports:{'guild:1001':2}},validation:{sourceReports:{}}}},job:{sourceSeen:['guild:1001'],sourceQueue:[{type:'guild',id:1001}]},stability:supportedStability});}

test('preview is zero-network and no-op when Stability has no holdout candidate',()=>{
  const stability={fingerprint:'f'.repeat(40),patterns:[]};
  const preview=buildUntouchedHoldoutSourceDiscoveryPreviewV1({scope,stability,lineage:cleanLineage()});
  assert.equal(preview.executable,false);
  assert.equal(preview.status,'not-eligible-no-stability-supported-pattern');
  assert.equal(preview.networkUpperBound.wclCalls,0);
  assert.equal(preview.networkUpperBound.wclCombatEventCalls,0);
});

test('metadata discovery ignores rank ordering, excludes prior sources and stops after enough unseen sources',async()=>{
  const lineage=cleanLineage();
  const preview=buildUntouchedHoldoutSourceDiscoveryPreviewV1({scope,stability:supportedStability,lineage,config:{targetEligibleSources:3,maxRankingPages:2,maxIdentityLookups:10,startRankingPage:11}});
  assert.equal(preview.executable,true);
  assert.equal(preview.networkUpperBound.wclCombatEventCalls,0);
  const rankingPages=[];
  const identityCalls=[];
  const identities={
    RPT00000001:{code:'RPT00000001',guild:{id:1001,name:'Already Used'},owner:{id:9001}},
    RPT00000002:{code:'RPT00000002',guild:{id:2002,name:'Fresh A'},owner:{id:9002}},
    RPT00000003:{code:'RPT00000003',guild:{id:2003,name:'Fresh B'},owner:{id:9003}},
    RPT00000004:{code:'RPT00000004',guild:{id:2004,name:'Fresh C'},owner:{id:9004}},
    RPT00000005:{code:'RPT00000005',guild:{id:2005,name:'Fresh D'},owner:{id:9005}},
  };
  const result=await executeUntouchedHoldoutSourceDiscoveryV1({scope,stability:supportedStability,lineage,preview,
    fetchRanking:async({page})=>{rankingPages.push(page);return{resolvedPartition:7,hasMore:page===11,rows:page===11?
      [{reportCode:'RPT00000001',rank:1},{reportCode:'RPT00000005',rank:2},{reportCode:'RPT00000003',rank:3}]:
      [{reportCode:'RPT00000004',rank:4},{reportCode:'RPT00000002',rank:5}],rateLimit:{limitPerHour:10000,pointsSpentThisHour:20}};},
    fetchIdentity:async code=>{identityCalls.push(code);return{identity:identities[code],rateLimit:{limitPerHour:10000,pointsSpentThisHour:30}};},
  });
  assert.deepEqual(rankingPages,[11,12]);
  assert.equal(result.usage.wclCombatEventCalls,0);
  assert.ok(result.usage.wclCalls<=12);
  assert.equal(result.sourcePool.summary.eligibleUnseenSources,3);
  assert.equal(result.sourcePool.candidates.some(row=>row.source==='guild:1001'&&row.eligible),false);
  assert.equal(result.sourcePool.candidates.filter(row=>row.eligible).length,3);
  assert.equal(result.evidenceContract.rankingOrderUsedForSelection,false);
  assert.ok(identityCalls.length>=3);
});

test('incomplete source lineage blocks discovery before spending WCL',async()=>{
  const lineage=buildGlobalBossLearningSourceLineageV1({aggregate:null,job:null,stability:supportedStability,lineageComplete:false});
  const preview=buildUntouchedHoldoutSourceDiscoveryPreviewV1({scope,stability:supportedStability,lineage});
  assert.equal(preview.status,'holdout-source-lineage-incomplete');
  assert.equal(preview.networkUpperBound.wclCalls,0);
  const result=await executeUntouchedHoldoutSourceDiscoveryV1({scope,stability:supportedStability,lineage,preview,fetchRanking:async()=>{throw new Error('must not execute');},fetchIdentity:async()=>{throw new Error('must not execute');}});
  assert.equal(result.executed,false);
  assert.equal(result.usage.wclCalls,0);
});
