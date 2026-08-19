import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildUntouchedHoldoutReservationV1 } from '../../server/corpus/untouched-holdout-v1.mjs';

const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL v3.9.10 HOLDOUT: old corpus/validation evidence cannot be relabeled untouched',()=>{
  const stability={fingerprint:'a'.repeat(40),episodeId:'episode:test',patterns:[{patternKey:'p1',abilityId:1,status:'source-stratified-stability-supported',holdoutEligible:true}]};
  const reservation=buildUntouchedHoldoutReservationV1({stability,sourceCandidates:[{source:'guild:1',homeSource:false,preexistingCorpusMember:true,priorLearningUse:false,combatEvidenceObservedBeforeReservation:false}]});
  assert.equal(reservation.status,'holdout-unavailable-insufficient-unseen-sources');
  assert.equal(reservation.evidenceContract.legacyValidationIsUntouchedHoldout,false);
  assert.equal(reservation.evidenceContract.preexistingCorpusSourcesForbidden,true);
});

test('CRITICAL v3.9.10 HOLDOUT: candidate/source sets freeze before holdout evidence and cannot be retuned',async()=>{
  const source=await read('server/corpus/untouched-holdout-v1.mjs');
  assert.match(source,/candidateSetFrozen:true/);
  assert.match(source,/sourceSetFrozen:true/);
  assert.match(source,/sourceSelectionUsesCombatOutcomes:false/);
  assert.match(source,/holdoutMayNotDiscoverNewCandidates:true/);
  assert.match(source,/holdoutMayNotRetuneThresholds:true/);
  assert.match(source,/failedHoldoutRequiresNewCandidateAndNewReservation:true/);
  assert.match(source,/thresholdRetuningFromHoldoutForbidden:true/);
  assert.match(source,/holdoutReuseAfterRetuningForbidden:true/);
});

test('CRITICAL v3.9.10 HOLDOUT: this layer never promotes and executes no provider/WCL network itself',async()=>{
  const [source,route]=await Promise.all([read('server/corpus/untouched-holdout-v1.mjs'),read('routes/api/wcl/untouched-holdout.js')]);
  assert.match(source,/automaticPromotion:false/);
  assert.match(source,/promotionEligible:false/);
  assert.match(source,/wclCallsExecuted:0/);
  assert.match(source,/providerNetworkCallsExecuted:0/);
  assert.match(route,/networkExecuted:false/);
  assert.match(route,/wclCallsExecuted:0/);
  assert.match(route,/providerNetworkCallsExecuted:0/);
  assert.doesNotMatch(route,/fetch\(/);
});
