import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStatisticalStabilityV1 } from '../../server/corpus/statistical-stability-v1.mjs';

function group(source,{direction='supportive-direction',anchor=1,background=0,matchedPairs=1}={}){
  return{groupId:`source:${source}`,source,eligible:true,matchedPairs,anchorPrevalence:anchor,nullPrevalence:background,supportivePairs:direction==='supportive-direction'?1:0,contradictoryPairs:direction==='contradictory-direction'?1:0,neutralPairs:direction==='neutral-direction'?1:0,direction};
}
function product(groups,status='independent-groups-evidence-available'){
  return{
    fingerprint:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',episodeId:'episode:test',interpretationBuildFingerprint:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',empiricalEvidenceFingerprint:'cccccccccccccccccccccccccccccccccccccccc',scope:{encounterId:9876,difficulty:5,partition:4},signalId:700001,
    patterns:[{patternKey:'after-1s|debuffs|700002|applydebuff',abilityId:700002,displayName:'State',status,independentGroups:groups}],
  };
}

test('three independently supportive source groups satisfy the v1 stability contract',()=>{
  const result=buildStatisticalStabilityV1({evidenceGroups:product([group('guild:1'),group('guild:2'),group('user:3')])});
  const row=result.patterns[0];
  assert.equal(row.status,'source-stratified-stability-supported');
  assert.equal(row.metrics.eligibleGroups,3);
  assert.equal(row.metrics.supportiveGroupShare,1);
  assert.equal(row.metrics.contradictoryGroupShare,0);
  assert.equal(row.metrics.medianPrevalenceDelta,1);
  assert.equal(row.metrics.deltaMad,0);
  assert.equal(row.holdoutEligible,true);
  assert.equal(result.holdoutContribution.statisticalStabilityGate,'evidence-available');
  assert.equal(result.evidenceContract.formalNullHypothesisSignificanceClaimed,false);
  assert.equal(result.evidenceContract.holdoutNotYetExecuted,true);
  assert.equal(result.evidenceContract.automaticPromotion,false);
});

test('one high-volume source still weighs once and contradiction can block stability',()=>{
  const result=buildStatisticalStabilityV1({evidenceGroups:product([
    group('guild:1',{matchedPairs:100}),
    group('guild:2'),
    group('guild:3',{direction:'contradictory-direction',anchor:0,background:1,matchedPairs:1}),
  ])});
  const row=result.patterns[0];
  assert.equal(row.metrics.eligibleGroups,3);
  assert.equal(row.metrics.supportiveGroups,2);
  assert.equal(row.metrics.contradictoryGroups,1);
  assert.equal(row.metrics.supportiveGroupShare,2/3);
  assert.equal(row.metrics.contradictoryGroupShare,1/3);
  assert.equal(row.gates.contradictoryShare,false);
  assert.equal(row.status,'source-stratified-stability-insufficient');
  assert.equal(result.evidenceContract.equalSourceWeighting,true);
  assert.equal(result.evidenceContract.reportPullVolumeCannotIncreaseSourceWeight,true);
});

test('neutral source is tolerated when the remaining source-balanced evidence is sufficiently supportive',()=>{
  const result=buildStatisticalStabilityV1({evidenceGroups:product([
    group('guild:1'),group('guild:2'),group('guild:3',{direction:'neutral-direction',anchor:1,background:1}),
  ])});
  const row=result.patterns[0];
  assert.equal(row.metrics.supportiveGroupShare,2/3);
  assert.equal(row.metrics.contradictoryGroupShare,0);
  assert.equal(row.metrics.medianPrevalenceDelta,1);
  assert.equal(row.status,'source-stratified-stability-supported');
});

test('no Evidence Groups-eligible patterns produces not-eligible rather than manufactured stability',()=>{
  const result=buildStatisticalStabilityV1({evidenceGroups:product([], 'independent-groups-insufficient')});
  assert.equal(result.patterns.length,0);
  assert.equal(result.summary.eligibleEvidenceGroupPatterns,0);
  assert.equal(result.holdoutContribution.statisticalStabilityGate,'not-eligible-no-independent-evidence-pattern');
  assert.deepEqual(result.holdoutContribution.holdoutReadyPatterns,[]);
});
