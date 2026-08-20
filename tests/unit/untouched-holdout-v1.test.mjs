import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUntouchedHoldoutReservationV1,evaluateUntouchedHoldoutV1 } from '../../server/corpus/untouched-holdout-v1.mjs';

function stability(patterns=[]){
  return{
    fingerprint:'a'.repeat(40),episodeId:'episode:test',empiricalEvidenceFingerprint:'b'.repeat(40),
    patterns:patterns.map(patternKey=>({patternKey,abilityId:700001,displayName:'Test Mechanic',status:'source-stratified-stability-supported',holdoutEligible:true})),
  };
}

function unseen(source){
  return{source,metadataOnlyDiscovery:true,homeSource:false,preexistingCorpusMember:false,priorLearningUse:false,combatEvidenceObservedBeforeReservation:false};
}

test('no stability-supported pattern stops before holdout reservation and spends no network',()=>{
  const result=buildUntouchedHoldoutReservationV1({stability:stability([]),sourceCandidates:[unseen('guild:1')]});
  assert.equal(result.status,'not-eligible-no-stability-supported-pattern');
  assert.equal(result.acquisitionRequired,false);
  assert.deepEqual(result.frozenCandidatePatterns,[]);
  assert.equal(result.evidenceContract.wclCallsExecuted,0);
  assert.equal(result.evidenceContract.providerNetworkCallsExecuted,0);
});

test('legacy corpus or previously used validation sources cannot masquerade as untouched holdout',()=>{
  const result=buildUntouchedHoldoutReservationV1({
    stability:stability(['p1']),
    sourceCandidates:[
      {...unseen('guild:1'),preexistingCorpusMember:true},
      {...unseen('guild:2'),priorLearningUse:true},
      {...unseen('guild:3'),combatEvidenceObservedBeforeReservation:true},
      unseen('guild:4'),
    ],
  });
  assert.equal(result.status,'holdout-unavailable-insufficient-unseen-sources');
  assert.equal(result.reservedSources.length,1);
  assert.equal(result.rejectedSources.length,3);
  assert.equal(result.evidenceContract.legacyValidationIsUntouchedHoldout,false);
  assert.equal(result.evidenceContract.preexistingCorpusSourcesForbidden,true);
});

test('reservation freezes candidate and unseen source sets before combat evidence',()=>{
  const result=buildUntouchedHoldoutReservationV1({
    stability:stability(['p1']),
    sourceCandidates:[unseen('guild:1'),unseen('guild:2'),unseen('guild:3'),unseen('guild:4')],
    config:{targetReservedSources:3,minimumEvaluableSources:3},
    reservedAt:1000,
  });
  assert.equal(result.status,'reservation-ready');
  assert.equal(result.reservedSources.length,3);
  assert.equal(result.frozenCandidatePatterns.length,1);
  assert.equal(result.evidenceContract.candidateSetFrozen,true);
  assert.equal(result.evidenceContract.sourceSetFrozen,true);
  assert.equal(result.evidenceContract.sourceSelectionUsesCombatOutcomes,false);
  assert.equal(result.evidenceContract.holdoutMayNotRetuneThresholds,true);
});

test('supportive reserved unseen sources can pass holdout without becoming Promotion',()=>{
  const reservation=buildUntouchedHoldoutReservationV1({
    stability:stability(['p1']),
    sourceCandidates:[unseen('guild:1'),unseen('guild:2'),unseen('guild:3')],
    config:{targetReservedSources:3,minimumEvaluableSources:3},
    reservedAt:1000,
  });
  const sources=reservation.reservedSources.map(row=>({source:row.source,patterns:[{patternKey:'p1',matchedPairs:4,anchorHits:4,nullHits:1}]}));
  const result=evaluateUntouchedHoldoutV1({reservation,holdoutEvidence:{reservationFingerprint:reservation.fingerprint,collectedAt:2000,sources}});
  assert.equal(result.patterns[0].status,'untouched-holdout-supported');
  assert.equal(result.promotionContribution.untouchedHoldoutGate,'evidence-available');
  assert.equal(result.promotionContribution.automaticPromotion,false);
  assert.equal(result.patterns[0].promotionEligible,false);
});

test('holdout rejects unreserved sources and new candidate discovery',()=>{
  const reservation=buildUntouchedHoldoutReservationV1({
    stability:stability(['p1']),sourceCandidates:[unseen('guild:1'),unseen('guild:2'),unseen('guild:3')],config:{targetReservedSources:3},reservedAt:1000,
  });
  assert.throws(()=>evaluateUntouchedHoldoutV1({reservation,holdoutEvidence:{reservationFingerprint:reservation.fingerprint,collectedAt:2000,sources:[{source:'guild:999',patterns:[{patternKey:'p1',matchedPairs:1,anchorHits:1,nullHits:0}]}]}}),/unreserved sources/);
  const source=reservation.reservedSources[0].source;
  assert.throws(()=>evaluateUntouchedHoldoutV1({reservation,holdoutEvidence:{reservationFingerprint:reservation.fingerprint,collectedAt:2000,sources:[{source,patterns:[{patternKey:'new-pattern',matchedPairs:1,anchorHits:1,nullHits:0}]}]}}),/cannot discover or add candidate patterns/);
});

test('failed holdout remains rejected rather than inviting threshold retuning',()=>{
  const reservation=buildUntouchedHoldoutReservationV1({
    stability:stability(['p1']),sourceCandidates:[unseen('guild:1'),unseen('guild:2'),unseen('guild:3')],config:{targetReservedSources:3},reservedAt:1000,
  });
  const sources=reservation.reservedSources.map(row=>({source:row.source,patterns:[{patternKey:'p1',matchedPairs:4,anchorHits:1,nullHits:3}]}));
  const result=evaluateUntouchedHoldoutV1({reservation,holdoutEvidence:{reservationFingerprint:reservation.fingerprint,collectedAt:2000,sources}});
  assert.equal(result.patterns[0].status,'untouched-holdout-rejected');
  assert.equal(result.promotionContribution.untouchedHoldoutGate,'rejected');
  assert.equal(result.evidenceContract.thresholdRetuningFromHoldoutForbidden,true);
  assert.equal(result.evidenceContract.holdoutReuseAfterRetuningForbidden,true);
});
