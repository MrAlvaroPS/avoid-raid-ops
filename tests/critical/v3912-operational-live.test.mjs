import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');
const BOSS_SPECIFIC=/Nek.?zali|3470|2888|The Venomous Abyss/i;

test('CRITICAL v3.9.12 OPERATIONAL REFERENCE: bounded floor is useful but cannot weaken accepted knowledge',async()=>{
  const [config,service,prepare]=await Promise.all([read('server/corpus/config.mjs'),read('server/corpus/service-v2.mjs'),read('scripts/iris-prepare-boss.mjs')]);
  assert.match(config,/CORPUS_OPERATIONAL_PROFILE/);assert.match(config,/targetPulls:\s*100/);assert.match(config,/deepTargetPulls:\s*20/);
  assert.match(service,/OPERATIONAL_REFERENCE_VERSION/);assert.match(service,/canonicalSourceSafety/);assert.match(service,/homeSourceSelectedReports/);assert.match(service,/selectedMissingSourceReports/);assert.match(service,/automaticPromotion:false/);
  assert.match(service,/global-observational-benchmark-v1/);assert.match(service,/canonical-deep-corpus/);assert.match(service,/descriptive occurrence means only/);assert.match(service,/killMeanPerPull/);assert.match(service,/wipeMeanPerPull/);
  assert.match(service,/difficulty is required/);assert.doesNotMatch(service,/difficulty\s*:\s*Number\(input\.difficulty\s*\|\|\s*5\)/);
  assert.match(service,/loadPublishedEncounterModelV2/);assert.match(service,/model\.status!=='published'/);
  assert.match(prepare,/public-evidence-available/);assert.match(prepare,/corpusProfile:'operational'/);assert.match(prepare,/recompileCorpusModelV2/);assert.match(prepare,/operationalDoesNotMeanPublished:true/);
  assert.doesNotMatch(`${config}\n${service}\n${prepare}`,BOSS_SPECIFIC,'generic operational preparation must not contain validation-boss constants');
});

test('CRITICAL v3.9.12 LIVE: operational execution is exact-difficulty, completed-pull based and HOME persistence is isolated',async()=>{
  const [engine,service,store]=await Promise.all([read('server/engines/operational-execution-v1.mjs'),read('server/services/operational-execution-service.mjs'),read('server/home/raid-execution-store-v1.mjs')]);
  assert.match(service,/encounter\+difficulty are required/);assert.match(engine,/Cross-difficulty operational execution rejected/);
  assert.match(engine,/waiting-for-first-combat/);assert.match(engine,/waiting-for-completed-pull/);assert.match(engine,/boss-reference-not-ready/);assert.match(engine,/noReferenceMeansNoFabricatedMechanicClassification:true/);
  assert.match(engine,/loadOperationalEncounterModelV2/);assert.match(engine,/getTelemetry/);assert.match(engine,/analyzeEncounterMechanics/);assert.match(engine,/findCurrentBlocker/);
  assert.match(engine,/observedMechanicsByFight/);assert.match(engine,/damageWindows/);assert.match(engine,/occurrences/);assert.match(engine,/rawEvents/);assert.match(engine,/observedMechanicDoesNotImplyFailure:true/);assert.match(engine,/observedCountsAreOccurrenceNormalized:true/);assert.match(engine,/nextPullCallsAreMechanicOnly:true/);
  assert.doesNotMatch(engine,/kind:'preserve-gain'/);assert.doesNotMatch(engine,/Preserve:\s*\$\{gain\.label\}/);
  assert.match(engine,/if\(homeRaidEligible\)/);assert.match(engine,/external-report-never-enters-home-execution/);
  assert.match(store,/longitudinalAcrossAllPersistedPulls:true/);assert.match(store,/singlePullCannotReplaceAggregate:true/);assert.match(store,/clearStateSeparateFromMechanicalMaturity:true/);assert.match(store,/progression:\{status:cleared\?'CLEARED'/);assert.match(store,/mechanicallyReadyIsNotOverallKillability:true/);
});

test('CRITICAL v3.9.12 OPERATIONAL STREAMS: runtime uses the same untranslated WCL spell identity contract as corpus and has a bounded parity probe',async()=>{
  const [intelligence,corpus,probe,pkg]=await Promise.all([read('server/wcl/queries/intelligence.mjs'),read('server/wcl/queries/corpus.mjs'),read('scripts/iris-operational-stream-probe.mjs'),read('package.json')]);
  assert.match(corpus,/friendDamage:events\(dataType:DamageTaken[^\n]+translate:false/);
  const operationalEventCalls=[...intelligence.matchAll(/events\([^\n]+\)/g)].map(m=>m[0]);
  assert.ok(operationalEventCalls.length>=9,'expected operational event queries and continuation queries');
  for(const call of operationalEventCalls)assert.match(call,/translate:false/,'operational WCL spell identity must not diverge from corpus translation semantics');
  assert.match(probe,/allDamage:events/);assert.match(probe,/filteredDamage:events/);assert.match(probe,/clientMatchedEvents/);assert.match(probe,/unfilteredComparisonIsDiagnosticOnly:true/);assert.match(probe,/doesNotTrain:true/);assert.match(probe,/doesNotPromote:true/);
  assert.match(pkg,/validate:operational-streams/);
  assert.doesNotMatch(probe,BOSS_SPECIFIC,'stream probe must remain boss-agnostic');
});

test('CRITICAL v3.9.12 HEADER: historical context is LOG then PULL, Active WCL stays independent and live scope rollover clears old boss data',async()=>{
  const [runtime,css,index]=await Promise.all([read('public/avoid-execution-context-v3911.js'),read('public/raidops-v3911-execution.css'),read('index.html')]);
  const logAt=runtime.indexOf('<small>LOG</small>'),pullAt=runtime.indexOf('<small>PULL</small>'),activeAt=runtime.indexOf('ACTIVE WCL');
  assert.ok(logAt>=0&&pullAt>logAt&&activeAt>pullAt,'header control order must be LOG → PULL → Active WCL');
  assert.match(runtime,/historyReportSelectionIsConsumerOptIn:true/);assert.match(runtime,/pullSelectionIsConsumerOptIn:true/);
  assert.match(runtime,/richExecutionClearedOnScopeChange:true/);assert.match(runtime,/lastActiveScopeKey/);assert.match(runtime,/scopeChanged/);
  assert.match(runtime,/window\.__AVOID_WCL__=state\.activeData\.report\|\|null/);assert.match(runtime,/window\.__AVOID_WCL_TELEMETRY__=state\.activeData\.telemetry\|\|null/);
  assert.match(runtime,/\/api\/wcl\/operational-execution/);assert.doesNotMatch(runtime,/new URL\(['"]\/api\/wcl\/history['"]/);
  assert.match(css,/b\[data-app-release\]\{font-size:0!important\}/);assert.match(css,/content:attr\(data-app-release\)/);
  assert.match(index,/avoid-execution-context-v3911\.js\?v=3\.9\.12\.2/);assert.match(index,/raidops-v3912-operational\.css\?v=3\.9\.12\.7/);assert.match(index,/raidops-v3912-mechanics-bridge\.css\?v=3\.9\.12\.0/);assert.match(index,/avoid-operational-observer-guard-v3912\.js\?v=3\.9\.12\.5/);assert.match(index,/avoid-operational-ui-v3912\.js\?v=3\.9\.12\.7/);
});

test('CRITICAL v3.9.12 RAID EXECUTION: raid count/single-pull score are replaced by report-independent longitudinal current mechanical state',async()=>{
  const [header,ui,bridge,css]=await Promise.all([read('public/iris-mechanics-header-v3910.js'),read('public/avoid-operational-ui-v3912.js'),read('public/raidops-v3912-mechanics-bridge.css'),read('public/raidops-v3912-operational.css')]);
  assert.match(header,/CURRENT MECHANICAL STATE/);assert.match(header,/Longitudinal AvoiD mechanic execution/);assert.doesNotMatch(header,/bossCount\(/);assert.doesNotMatch(header,/CURRENT RAID/);
  assert.match(ui,/MECHANIC EVOLUTION/);assert.match(ui,/ALL-TIME/);assert.match(ui,/RECENT/);assert.match(ui,/PREVIOUS/);assert.match(ui,/BOSS STATUS/);assert.match(ui,/MECHANICAL MODEL/);
  assert.match(bridge,/data-tab="execution"/);assert.match(bridge,/display:block!important/);assert.match(bridge,/data-tab="knowledge"/);
  assert.match(ui,/LIVE · WAITING/);assert.match(ui,/Boss reference not ready/);assert.match(ui,/OBSERVED MECHANICS · SELECTED PULL/);assert.match(ui,/CLASSIFIED FAILURES · SELECTED PULL/);assert.match(ui,/occurrences · descriptive GLOBAL reference/);assert.match(ui,/GLOBAL .* mean/);assert.match(ui,/Boss cleared/);assert.match(ui,/Progress, DPS and healing improvements never become mechanic instructions/);
  assert.match(css,/aop-observed-list/);assert.match(css,/aop-cleared/);
  assert.match(ui,/Pull Lab/);assert.match(ui,/REAL WCL PULLS/);assert.doesNotMatch(ui,/LIVE_PULLS_MOCK|goldenMocks/);
});
