import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');
const BOSS_SPECIFIC=/Nek.?zali|3470|The Venomous Abyss/i;

test('CRITICAL operational reference remains stricter than descriptive GLOBAL benchmark',async()=>{
  const [service,partial]=await Promise.all([read('server/corpus/service-v2.mjs'),read('server/corpus/global-observational-benchmark-v1.mjs')]);
  assert.match(service,/minWidePulls:100/);assert.match(service,/minDeepPulls:20/);assert.match(service,/canonicalSourceSafety/);assert.match(service,/automaticPromotion:false/);
  assert.match(partial,/GLOBAL_DESCRIPTIVE_MIN_REPORTS=5/);assert.match(partial,/classifyGlobalBossSourceProfile\(p\)\.eligible===true/);assert.match(partial,/doesNotSatisfyDataReady:true/);assert.match(partial,/doesNotSatisfyLiveReady:true/);assert.match(partial,/doesNotPromote:true/);assert.match(partial,/wipePrimaryUnit:'per-minute'/);assert.match(partial,/percentilesRequireReports/);
  assert.doesNotMatch(partial,BOSS_SPECIFIC,'descriptive GLOBAL benchmark must stay boss agnostic');
});

test('CRITICAL HOME GLOBAL comparison is exact-fight memory and never failure evidence',async()=>{
  const [store,enrich,service]=await Promise.all([read('server/home/raid-global-outlier-store-v1.mjs'),read('server/analysis/live/global-benchmark-enrichment-v1.mjs'),read('server/services/live-rl-diagnostic-service.mjs')]);
  assert.match(store,/exact-fight-not-proven-home/);assert.match(store,/listHomePullFactsSnapshotsV1/);assert.match(store,/globalComparisonIsDescriptiveNotFailure:true/);assert.match(store,/outlierDoesNotImplyBlame:true/);assert.match(store,/doesNotTrainGlobal:true/);assert.match(store,/neverClassifiedAsFailure:true/);
  assert.match(enrich,/globalPercentilesRequireFiveDeepReports:true/);assert.match(enrich,/globalOutlierIsNotFailure:true/);assert.match(enrich,/partialBenchmarkDoesNotSatisfyReadiness:true/);assert.match(enrich,/above-p95/);assert.match(enrich,/above-p90/);
  assert.match(service,/persistHomeGlobalComparisonFromDiagnosticV1/);assert.match(service,/homeMutationRequiresExactPersistedPullFacts:true/);assert.match(service,/noGlobalLearning:true/);
  assert.doesNotMatch(`${store}\n${enrich}`,BOSS_SPECIFIC,'HOME/global comparison machinery must stay boss agnostic');
});

test('CRITICAL Live selected pull owns the diagnostic and LIVE backfill is bounded',async()=>{
  const [query,engine,route,operational,safe]=await Promise.all([read('server/wcl/queries/live-rl-diagnostic.mjs'),read('server/engines/live-rl-diagnostic-v1.mjs'),read('server/services/live-rl-diagnostic-service.mjs'),read('server/services/operational-execution-service.mjs'),read('public/avoid-live-safe-fallback-v3912.js')]);
  for(const field of ['currentEnemyCasts','currentInterrupts','currentDispels','currentDebuffs','currentDeaths'])assert.match(query,new RegExp(`${field}:events\\([^\\n]+fightIDs:\\$fight[^\\n]+translate:false`));
  assert.match(engine,/selectedFightId/);assert.match(engine,/sameDifficultyOnly:true/);assert.match(engine,/killBenchmarkUsesPerPull:true/);assert.match(engine,/wipeBenchmarkUsesPerMinute:true/);
  assert.match(route,/fightId/);assert.match(route,/enrichLiveRlDiagnosticWithGlobalV1/);
  assert.match(operational,/oneMissingHomePullBackfilledPerCycle:true/);assert.match(operational,/find\(p=>Number\.isInteger/);assert.doesNotMatch(operational,/Promise\.all\([^\n]*missing/,'backfill must not fan out over every missing pull');
  assert.match(safe,/live-rl-diagnostic/);assert.match(safe,/selectedFightId/);assert.match(safe,/diagnosticCache/);assert.match(safe,/Everything in this block belongs to Pull/);
});

test('CRITICAL Live evidence drawer and Mechanics state survive active polling without timers',async()=>{
  const [stability,state,context,index]=await Promise.all([read('public/avoid-live-ui-stability-v3912.js'),read('public/avoid-mechanics-state-v3912.js'),read('public/avoid-mechanics-global-context-v3912.js'),read('index.html')]);
  assert.match(stability,/sessionStorage/);assert.match(stability,/aop-evidence-drawer/);assert.match(stability,/evidenceDrawerStatePersists:true/);assert.match(stability,/noPollingTimer:true/);assert.doesNotMatch(stability,/setInterval/);
  assert.match(state,/__AVOID_MECHANICS_RAID_EXECUTION__/);assert.doesNotMatch(state,/setInterval/);assert.doesNotMatch(state,/dispatchEvent\(new CustomEvent\('avoid:raid-execution'/,'active WCL polling must not synthesize Mechanics execution events');
  assert.match(context,/persistedGlobalTrend:true/);assert.match(context,/noPollingTimer:true/);assert.doesNotMatch(context,/setInterval/);
  assert.match(index,/avoid-live-ui-stability-v3912\.js\?v=3\.9\.12\.1/);assert.match(index,/avoid-mechanics-state-v3912\.js\?v=3\.9\.12\.3/);assert.match(index,/avoid-mechanics-global-context-v3912\.js\?v=3\.9\.12\.2/);
});

test('CRITICAL Raid Execution exposes partial GLOBAL context and persisted HOME comparison trend at zero WCL',async()=>{
  const [service,bridge,css]=await Promise.all([read('server/services/raid-execution-service.mjs'),read('public/avoid-mechanics-global-context-v3912.js'),read('public/raidops-v3912-mechanics-bridge.css')]);
  assert.match(service,/loadDescriptiveGlobalBenchmarkV1/);assert.match(service,/loadHomeGlobalComparisonsV1/);assert.match(service,/globalOutliers/);assert.match(service,/partialBenchmarkDoesNotSatisfyReadiness:true/);assert.match(service,/networkExecuted:false/);
  assert.match(bridge,/IRIS REFERENCE & GLOBAL TREND/);assert.match(bridge,/HOME COMPARED/);assert.match(bridge,/P\$\{esc\(h\.pullNumber/);assert.match(css,/nth-child\(4\)/);assert.match(css,/aop-global-trends/);
});

test('CRITICAL difficulty and knowledge boundaries remain explicit',async()=>{
  const [engine,scope,home]=await Promise.all([read('server/engines/operational-execution-v1.mjs'),read('server/knowledge/scopes.mjs'),read('server/home/raid-pull-facts-store-v1.mjs')]);
  assert.match(engine,/Cross-difficulty operational execution rejected/);assert.match(scope,/GLOBAL BOSS evidence is fail-closed/);assert.match(scope,/external-origin-unverified/);assert.match(home,/scopeIdentity:'encounter\+difficulty'/);assert.match(home,/crossDifficultyAggregationForbidden:true/);
});
