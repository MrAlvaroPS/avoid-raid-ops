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

test('CRITICAL v3.9.10 HOLDOUT: reservation/evaluation remain zero-network and never promote',async()=>{
  const source=await read('server/corpus/untouched-holdout-v1.mjs');
  assert.match(source,/automaticPromotion:false/);
  assert.match(source,/promotionEligible:false/);
  assert.match(source,/wclCallsExecuted:0/);
  assert.match(source,/providerNetworkCallsExecuted:0/);
});

test('CRITICAL v3.9.10 SOURCE DISCOVERY: automatic source selection is fingerprinted metadata-only WCL with zero combat-event calls',async()=>{
  const [route,discovery,pool]=await Promise.all([
    read('routes/api/wcl/untouched-holdout.js'),
    read('server/corpus/untouched-holdout-source-discovery-v1.mjs'),
    read('server/corpus/untouched-holdout-source-pool-v1.mjs'),
  ]);
  assert.match(route,/discover-sources-preview/);
  assert.match(route,/discover-sources/);
  assert.match(route,/confirmExecution:true is required for Holdout source discovery/);
  assert.match(route,/previewFingerprint/);
  assert.match(route,/Automatic Holdout source discovery must complete before reservation/);
  assert.doesNotMatch(route,/body\.sourceCandidates/,'production Holdout route must not accept a hand-authored source list');
  assert.match(discovery,/wclCombatEventCalls:0/);
  assert.match(discovery,/rankingOrderUsedForSelection:false/);
  assert.match(discovery,/sourceIdentityOnly:true/);
  assert.match(discovery,/fetchRankingPage/);
  assert.match(discovery,/fetchReportIdentity/);
  assert.doesNotMatch(discovery,/CORPUS_(?:WIDE|DEEP)|events\(|table\(/i,'source discovery must not query combat evidence');
  assert.match(pool,/unknownLineageCannotBecomeUntouched:true/);
  assert.match(pool,/metadataOnlyBeforeReservation:true/);
  assert.match(pool,/homeAvoidDataUsed:false/);
});
