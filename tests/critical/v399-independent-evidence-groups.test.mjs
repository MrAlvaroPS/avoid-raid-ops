import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL v3.9.9 EVIDENCE GROUPS: only Matched Null-supported patterns can enter independent groups',async()=>{
  const module=await read('server/corpus/independent-evidence-groups-v1.mjs');
  assert.match(module,/status==='matched-specificity-supported'/);
  assert.match(module,/matchedNullSupportedPatternsOnly:true/);
  assert.match(module,/not-eligible-no-matched-supported-pattern/);
  assert.match(module,/No candidate cleared Matched Null specificity/);
});

test('CRITICAL v3.9.9 EVIDENCE GROUPS: source identity is guild/uploader isolated, not report/pull replication',async()=>{
  const [module,doc]=await Promise.all([read('server/corpus/independent-evidence-groups-v1.mjs'),read('docs/IRIS-INDEPENDENT-EVIDENCE-GROUPS-V1.md')]);
  assert.match(module,/reportSourceKey:guild-id-else-owner-id-else-report-code/);
  assert.match(module,/reportsFromSameGuildOrUploaderDoNotBecomeIndependentGroups:true/);
  assert.match(module,/homeAvoidDataUsed:false/);
  assert.match(doc,/Reports from the same guild\/uploader do \*\*not\*\* become separate independent evidence groups/);
  assert.match(doc,/HOME\/AvoiD data used = false/);
});

test('CRITICAL v3.9.9 EVIDENCE GROUPS: this layer cannot claim stability, holdout or Promotion',async()=>{
  const module=await read('server/corpus/independent-evidence-groups-v1.mjs');
  assert.match(module,/statisticalStabilityNotYetClaimed:true/);
  assert.match(module,/holdoutNotYetClaimed:true/);
  assert.match(module,/directScoreDelta:0/);
  assert.match(module,/automaticPromotion:false/);
  assert.match(module,/stabilityClaimed:false/);
  assert.match(module,/promotionEligible:false/);
});

test('CRITICAL v3.9.9 EVIDENCE GROUPS API: preview/build/latest/result are zero-network surfaces',async()=>{
  const route=await read('routes/api/wcl/evidence-groups.js');
  assert.match(route,/action==='preview'/);
  assert.match(route,/action==='build'/);
  assert.match(route,/action==='latest'/);
  assert.match(route,/action==='result'/);
  assert.match(route,/networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0/);
  assert.doesNotMatch(route,/wclGraphql|fetchSemanticEventBundle|wholeReport/);
});

test('CRITICAL v3.9.9 EMPIRICAL REUSE: provider reinterpretation cannot force identical Matched Null evidence reacquisition',async()=>{
  const [route,executor,doc]=await Promise.all([
    read('routes/api/wcl/matched-null-baseline.js'),
    read('server/corpus/matched-null-baseline-executor-v1.mjs'),
    read('docs/IRIS-INDEPENDENT-EVIDENCE-GROUPS-V1.md'),
  ]);
  assert.match(route,/episode\?\.empiricalBuildFingerprint\|\|episode\?\.matchedNullEvidenceFingerprint\|\|episode\?\.buildFingerprint/);
  assert.match(route,/plan\.empiricalEvidenceFingerprint=evidenceFingerprint/);
  assert.match(executor,/empiricalEvidenceFingerprint/);
  assert.match(executor,/semanticReinterpretationMayReuseEvidence:true/);
  assert.match(doc,/Matched Null control storage is addressed by the empirical evidence fingerprint/);
});
