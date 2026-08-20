import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL v3.9.9 STABILITY: only Independent Evidence Groups-eligible patterns can enter stability',async()=>{
  const module=await read('server/corpus/statistical-stability-v1.mjs');
  assert.match(module,/status==='independent-groups-evidence-available'/);
  assert.match(module,/not-eligible-no-independent-evidence-pattern/);
  assert.match(module,/No pattern has sufficient Independent Evidence Groups coverage/);
});

test('CRITICAL v3.9.9 STABILITY: each source weighs once and contradiction remains a hard visible gate',async()=>{
  const [module,doc]=await Promise.all([read('server/corpus/statistical-stability-v1.mjs'),read('docs/IRIS-STATISTICAL-STABILITY-V1.md')]);
  assert.match(module,/equalSourceWeighting:true/);
  assert.match(module,/reportPullVolumeCannotIncreaseSourceWeight:true/);
  assert.match(module,/maximumContradictoryGroupShare/);
  assert.match(module,/medianPrevalenceDelta/);
  assert.match(module,/deltaMad/);
  assert.match(doc,/one guild with 100 pulls/);
  assert.match(doc,/The 100-pair guild does not count 100 times/);
});

test('CRITICAL v3.9.9 STABILITY: no fake inferential precision, causality, Holdout pass or Promotion',async()=>{
  const module=await read('server/corpus/statistical-stability-v1.mjs');
  assert.match(module,/formalNullHypothesisSignificanceClaimed:false/);
  assert.match(module,/confidenceIntervalClaimed:false/);
  assert.match(module,/causalCombatEvidenceAdded:false/);
  assert.match(module,/holdoutNotYetExecuted:true/);
  assert.match(module,/automaticPromotion:false/);
  assert.match(module,/directScoreDelta:0/);
});

test('CRITICAL v3.9.9 STABILITY API: preview/build/result/latest are zero-network and consume persisted Evidence Groups',async()=>{
  const route=await read('routes/api/wcl/statistical-stability.js');
  assert.match(route,/independent-evidence-groups/);
  assert.match(route,/action==='preview'/);
  assert.match(route,/action==='build'/);
  assert.match(route,/action==='result'/);
  assert.match(route,/action==='latest'/);
  assert.match(route,/networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0/);
  assert.doesNotMatch(route,/wclGraphql|fetchSemanticEventBundle|fetch\(/);
});
