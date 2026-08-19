import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');
const bossFixture=/Belo'ren|Child of Al'ar|\b3182\b|\b2739\b|\b1243866\b|\b1241163\b|\b1243560\b/i;

test('CRITICAL v3.9.10 RAID CORPUS: fresh-tier bootstrap is generic, difficulty-scoped and foundation-only',async()=>{
  const [planner,route,config,keys,execution,service,reference,referenceRoute,pkgText]=await Promise.all([read('server/corpus/raid-corpus-bootstrap-v1.mjs'),read('routes/api/knowledge/raid-corpus-bootstrap.js'),read('server/corpus/config.mjs'),read('server/corpus/keys.mjs'),read('server/corpus/execution.mjs'),read('server/services/corpus-service.mjs'),read('server/services/global-raid-reference-service.mjs'),read('routes/api/knowledge/global-reference.js'),read('package.json')]);
  for(const text of [planner,route,config,keys,execution,service,reference,referenceRoute])assert.doesNotMatch(text,bossFixture);
  assert.match(planner,/DEFAULT_DIFFICULTIES=.*normal.*heroic.*mythic/i);
  assert.match(planner,/public-evidence-available/);
  assert.match(planner,/foundationIsAcceptedKnowledge:false/);
  assert.match(planner,/foundationCanAutoPromote:false/);
  assert.match(planner,/crossDifficultyComparisonForbidden:true/);
  assert.match(planner,/previewWclCalls:0/);
  assert.match(route,/confirmExecution:true is required/);
  assert.match(route,/previewFingerprint is required/);
  assert.match(config,/CORPUS_FOUNDATION_PROFILE/);
  assert.match(config,/targetPulls:\s*300/);
  assert.match(config,/deepTargetPulls:\s*60/);
  assert.doesNotMatch(keys,/difficulty\s*=\s*5/);
  assert.doesNotMatch(execution,/difficulty\|\|5|difficulty\s*\?\?\s*5/);
  assert.doesNotMatch(service,/searchParams\.get\('difficulty'\)\|\|5/);
  assert.match(reference,/foundation-ready/);assert.match(reference,/foundationCanSupportOperationalComparison:true/);assert.match(reference,/foundationIsAcceptedKnowledge:false/);
  assert.match(referenceRoute,/difficulty is required; GLOBAL reference is difficulty-scoped/);assert.match(referenceRoute,/wclCallsExecuted:0/);
  const pkg=JSON.parse(pkgText);
  assert.equal(pkg.scripts['validate:raid-corpus-bootstrap'],'node --env-file=.env.local scripts/iris-raid-corpus-bootstrap.mjs');
  assert.equal(pkg.scripts['bootstrap:raid-corpus'],'node --env-file=.env.local scripts/iris-raid-corpus-bootstrap.mjs --start');
  assert.equal(pkg.scripts['work:raid-corpus'],'node --env-file=.env.local scripts/iris-raid-corpus-worker.mjs');
});

test('CRITICAL v3.9.10 MECHANICS HEADER: report-independent Mechanics owns and restores header context',async()=>{
  const [header,index]=await Promise.all([read('public/iris-mechanics-header-v3910.js'),read('index.html')]);
  assert.match(header,/iris-k-scope-raid/);
  assert.match(header,/\.breadcrumbs/);
  assert.match(header,/\.selectors > button:not\(\.live\)/);
  assert.match(header,/function restore\(/);
  assert.match(header,/MutationObserver/);
  assert.match(header,/raidSpan\.textContent=name\.toUpperCase\(\)/);
  assert.match(index,/iris-mechanics-header-v3910\.js\?v=3\.9\.10\.5/);
  assert.doesNotMatch(header,bossFixture);
});
