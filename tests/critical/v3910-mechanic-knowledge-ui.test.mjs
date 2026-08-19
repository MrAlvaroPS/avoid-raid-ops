import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');
const fixtureConstants=/Belo'ren|Child of Al'ar|\b3182\b|\b2739\b|\b1243866\b|\b1241163\b|\b1243560\b/i;

test('CRITICAL v3.9.10 MECHANICS UI: boss+difficulty scope is generic and contains no validation-boss constants',async()=>{
  const [runtime,view,service,react]=await Promise.all([read('public/iris-mechanics-knowledge-v3910.js'),read('server/corpus/mechanic-knowledge-view-v1.mjs'),read('server/services/mechanic-knowledge-view-service.mjs'),read('apps/web/src/features/mechanics/IrisKnowledge.js')]);
  for(const text of [runtime,view,service,react])assert.doesNotMatch(text,fixtureConstants);
  assert.match(runtime,/RAID EXECUTION/);
  assert.match(runtime,/IRIS<\/span> BOSS KNOWLEDGE/);
  assert.match(runtime,/data-boss/);
  assert.match(runtime,/data-difficulty/);
  assert.match(runtime,/Cross-difficulty evidence forbidden/);
  assert.match(runtime,/window\.__AVOID_WCL__/);
  assert.match(runtime,/LOAD THIS EXECUTION SCOPE/);
  assert.doesNotMatch(runtime,/searchParams\.set\(['"]difficulty['"],\s*['"]5['"]\)/);
  assert.match(react,/DIFFICULTY/);
  assert.match(react,/journalEncounterId/);
  assert.match(view,/automaticPromotion:false/);
  assert.match(view,/observedTruth:'wcl'/);
});

test('CRITICAL v3.9.10 MECHANICS UI: injected Mechanics DOM is torn down on SPA navigation',async()=>{
  const runtime=await read('public/iris-mechanics-knowledge-v3910.js');
  assert.match(runtime,/function teardown\(\)/);
  assert.match(runtime,/iris-mechanics-tabs,:scope > \.iris-mechanics-scope/);
  assert.match(runtime,/node\.hidden=false/);
  assert.match(runtime,/delete node\.dataset\.irisMechanicsExecution/);
  assert.match(runtime,/MutationObserver/);
  assert.match(runtime,/if\(page\(\)\).*else teardown\(\)/s);
  assert.match(runtime,/host\.isConnected&&page\(\)/);
});

test('CRITICAL v3.9.10 MECHANICS UI: DB2 table presence is not mislabeled as difficulty verification',async()=>{
  const [runtime,compiler,provider]=await Promise.all([read('public/iris-mechanics-knowledge-v3910.js'),read('server/knowledge/official-encounter-difficulty-v1.mjs'),read('server/knowledge/providers/wago-db2-journal-difficulty-v1.mjs')]);
  assert.match(runtime,/difficultyVerified===true/);
  assert.match(runtime,/DIFFICULTY UNRESOLVED/);
  assert.match(runtime,/JOURNAL MECHANICS · UNRESOLVED/);
  assert.match(compiler,/difficultyVerified:metadataUsable/);
  assert.match(compiler,/journalDifficultyRowsAreApplicabilityRestrictions:true/);
  assert.match(provider,/journalEncounterXDifficultyIsApplicabilityRestriction:true/);
  assert.match(provider,/journalSectionXDifficultyIsApplicabilityRestriction:true/);
});

test('CRITICAL v3.9.10 MECHANICS API: difficulty is mandatory and read model exposes GLOBAL reference maturity without network',async()=>{
  const [route,service,index]=await Promise.all([read('routes/api/wcl/mechanic-knowledge.js'),read('server/services/mechanic-knowledge-view-service.mjs'),read('index.html')]);
  assert.match(route,/difficulty is required; boss knowledge is never loaded across difficulties/);
  assert.match(route,/networkExecuted:false/);
  assert.match(route,/wclCallsExecuted:0/);
  assert.match(route,/providerNetworkCallsExecuted:0/);
  assert.doesNotMatch(route,/wclGraphql|fetch\(/);
  assert.doesNotMatch(service,/wclGraphql|fetch\(/);
  assert.match(service,/Cross-difficulty model load rejected/);
  assert.match(service,/Cross-difficulty GLOBAL reference rejected/);
  assert.match(service,/Cross-difficulty aggregate rejected/);
  assert.match(service,/Cross-difficulty Episode rejected/);
  assert.match(service,/globalReferenceMaturity/);
  assert.match(service,/foundationReferenceIsOperationalComparisonNotAcceptedKnowledge:true/);
  assert.match(service,/evaluateMatchedNullBaselineV1/);
  assert.match(service,/buildIndependentEvidenceGroupsV1/);
  assert.match(service,/buildStatisticalStabilityV1/);
  assert.match(index,/iris-mechanics-knowledge-v3910\.js\?v=3\.9\.10\.4/);
  assert.match(index,/iris-mechanics-global-reference-v3910\.js\?v=3\.9\.10\.6/);
  assert.match(index,/raidops-v3910-difficulty\.css\?v=3\.9\.10\.4/);
});
