import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');
const fixtureConstants=/Belo'ren|Child of Al'ar|\b3182\b|\b2739\b|\b1243866\b|\b1241163\b|\b1243560\b/i;

test('CRITICAL v3.9.10 MECHANICS UI: Iris Knowledge is generic and contains no validation-boss constants',async()=>{
  const [runtime,view,service]=await Promise.all([
    read('public/iris-mechanics-knowledge-v3910.js'),
    read('server/corpus/mechanic-knowledge-view-v1.mjs'),
    read('server/services/mechanic-knowledge-view-service.mjs'),
  ]);
  assert.doesNotMatch(runtime,fixtureConstants);
  assert.doesNotMatch(view,fixtureConstants);
  assert.doesNotMatch(service,fixtureConstants);
  assert.match(runtime,/RAID EXECUTION/);
  assert.match(runtime,/IRIS<\/span> KNOWLEDGE/);
  assert.match(runtime,/window\.__AVOID_WCL__/);
  assert.match(view,/automaticPromotion:false/);
  assert.match(view,/observedTruth:'wcl'/);
});

test('CRITICAL v3.9.10 MECHANICS API: knowledge screen is persisted-evidence-only and zero-network',async()=>{
  const [route,service,index]=await Promise.all([
    read('routes/api/wcl/mechanic-knowledge.js'),
    read('server/services/mechanic-knowledge-view-service.mjs'),
    read('index.html'),
  ]);
  assert.match(route,/request\.method!=='GET'/);
  assert.match(route,/networkExecuted:false/);
  assert.match(route,/wclCallsExecuted:0/);
  assert.match(route,/providerNetworkCallsExecuted:0/);
  assert.doesNotMatch(route,/wclGraphql|fetch\(/);
  assert.doesNotMatch(service,/wclGraphql|fetch\(/);
  assert.match(service,/evaluateMatchedNullBaselineV1/);
  assert.match(service,/buildIndependentEvidenceGroupsV1/);
  assert.match(service,/buildStatisticalStabilityV1/);
  assert.match(index,/iris-mechanics-knowledge-v3910\.js/);
  assert.match(index,/raidops-v3910\.css/);
});
