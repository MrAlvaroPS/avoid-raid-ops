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
  assert.match(source,/sourceSeedMetadataFrozenBeforeCombatEvidence:true/);
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

test('CRITICAL v3.9.10 ACQUISITION: combat evidence is previewed, bounded and locked to frozen candidates/sources/seed reports',async()=>{
  const [route,acquisition]=await Promise.all([
    read('routes/api/wcl/untouched-holdout.js'),
    read('server/corpus/untouched-holdout-acquisition-v1.mjs'),
  ]);
  assert.match(route,/acquire-evidence-preview/);
  assert.match(route,/acquire-evidence/);
  assert.match(route,/confirmExecution:true is required for Holdout combat acquisition/);
  assert.match(route,/Holdout combat-acquisition preview fingerprint is stale/);
  assert.match(route,/Compatible automatic Holdout combat acquisition is required before evaluation/);
  assert.doesNotMatch(route,/body\.holdoutEvidence/,'production evaluation must consume persisted automatic acquisition, not caller-authored evidence');

  assert.match(acquisition,/CORPUS_REPORT_HEADER_QUERY/);
  assert.match(acquisition,/fetchSemanticEventBundle/);
  assert.match(acquisition,/buildMatchedNullBaselinePlanV1/);
  assert.match(acquisition,/buildMatchedNullControlEvidenceRecordV1/);
  assert.match(acquisition,/sourceExpansionForbidden:true/);
  assert.match(acquisition,/onlyFrozenSeedReportsQueried:true/);
  assert.match(acquisition,/fightSelectionUsesOutcomeMetrics:false/);
  assert.match(acquisition,/rawActorIdsPersisted:false/);
  assert.match(acquisition,/rawActorNamesPersisted:false/);
  assert.match(acquisition,/automaticPromotion:false/);
  assert.match(acquisition,/hardWclCallCap/);
  assert.match(acquisition,/minimumRateLimitReservePoints/);
  assert.doesNotMatch(acquisition,/CORPUS_SOURCE_REPORTS_QUERY|CORPUS_WIDE_TABLES_QUERY|CORPUS_DEEP_EVENTS_QUERY|fetchSourceReports/,'Holdout acquisition must not expand reports or reuse broad corpus acquisition');
});

test('CRITICAL v3.9.10 ACQUISITION: seed source identity is verified before any combat read and failures settle conservatively',async()=>{
  const acquisition=await read('server/corpus/untouched-holdout-acquisition-v1.mjs');
  const identityCheck=acquisition.indexOf('reportSourceKey(report)!==source');
  const anchorRead=acquisition.indexOf('fetchSemanticEventBundle({code,fightIDs:selectedFightIDs');
  assert.ok(identityCheck>=0&&anchorRead>identityCheck,'frozen seed identity must be checked before the first semantic combat query');
  assert.match(acquisition,/inconclusive-seed-source-mismatch/);
  assert.match(acquisition,/inconclusive-no-anchor/);
  assert.match(acquisition,/inconclusive-no-valid-pair/);
  assert.match(acquisition,/sourceSettled/);
});
