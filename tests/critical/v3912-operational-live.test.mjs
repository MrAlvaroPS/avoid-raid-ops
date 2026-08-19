import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');
const BOSS_SPECIFIC=/Nek.?zali|3470|2888|The Venomous Abyss/i;

test('CRITICAL v3.9.12 OPERATIONAL REFERENCE: bounded floor is useful, HOME-isolated and exposes same-difficulty GLOBAL distributions',async()=>{
  const [config,service,prepare]=await Promise.all([read('server/corpus/config.mjs'),read('server/corpus/service-v2.mjs'),read('scripts/iris-prepare-boss.mjs')]);
  assert.match(config,/CORPUS_OPERATIONAL_PROFILE/);assert.match(config,/targetPulls:\s*100/);assert.match(config,/deepTargetPulls:\s*20/);
  assert.match(service,/OPERATIONAL_REFERENCE_VERSION/);assert.match(service,/canonicalSourceSafety/);assert.match(service,/homeSourceSelectedReports/);assert.match(service,/selectedMissingSourceReports/);assert.match(service,/automaticPromotion:false/);
  assert.match(service,/global-observational-benchmark-v2/);assert.match(service,/canonical-deep-corpus/);assert.match(service,/report-normalized distributions/);assert.match(service,/killPrimaryUnit:'per-pull'/);assert.match(service,/wipePrimaryUnit:'per-minute'/);assert.match(service,/damageHits/);assert.match(service,/p90/);assert.match(service,/selectedDeepCodes/);assert.match(service,/deepProfileKey/);
  assert.match(service,/difficulty is required/);assert.doesNotMatch(service,/difficulty\s*:\s*Number\(input\.difficulty\s*\|\|\s*5\)/);
  assert.match(service,/loadPublishedEncounterModelV2/);assert.match(service,/model\.status!=='published'/);
  assert.match(prepare,/public-evidence-available/);assert.match(prepare,/corpusProfile:'operational'/);assert.match(prepare,/recompileCorpusModelV2/);assert.match(prepare,/operationalDoesNotMeanPublished:true/);
  assert.doesNotMatch(`${config}\n${service}\n${prepare}`,BOSS_SPECIFIC,'generic operational preparation must not contain validation-boss constants');
});

test('CRITICAL v3.9.12 LIVE: operational execution is exact-difficulty, completed-pull based and HOME persistence is isolated',async()=>{
  const [engine,service,store,pulls,safe]=await Promise.all([read('server/engines/operational-execution-v1.mjs'),read('server/services/operational-execution-service.mjs'),read('server/home/raid-execution-store-v1.mjs'),read('server/analysis/pulls/pull-intelligence.mjs'),read('public/avoid-live-safe-fallback-v3912.js')]);
  assert.match(service,/encounter\+difficulty are required/);assert.match(engine,/Cross-difficulty operational execution rejected/);
  assert.match(engine,/waiting-for-first-combat/);assert.match(engine,/waiting-for-completed-pull/);assert.match(engine,/boss-reference-not-ready/);assert.match(engine,/noReferenceMeansNoFabricatedMechanicClassification:true/);
  assert.match(engine,/loadOperationalEncounterModelV2/);assert.match(engine,/getTelemetry/);assert.match(engine,/analyzeEncounterMechanics/);assert.match(engine,/findCurrentBlocker/);
  assert.match(engine,/observedMechanicsByFight/);assert.match(engine,/damageWindows/);assert.match(engine,/occurrences/);assert.match(engine,/rawEvents/);assert.match(engine,/observedMechanicDoesNotImplyFailure:true/);assert.match(engine,/observedCountsAreOccurrenceNormalized:true/);assert.match(engine,/nextPullCallsAreMechanicOnly:true/);
  assert.doesNotMatch(engine,/kind:'preserve-gain'/);assert.doesNotMatch(engine,/Preserve:\s*\$\{gain\.label\}/);
  assert.match(engine,/if\(homeRaidEligible\)/);assert.match(engine,/external-report-never-enters-home-execution/);
  assert.match(store,/longitudinalAcrossAllPersistedPulls:true/);assert.match(store,/singlePullCannotReplaceAggregate:true/);assert.match(store,/clearStateSeparateFromMechanicalMaturity:true/);assert.match(store,/progression:\{status:cleared\?'CLEARED'/);assert.match(store,/mechanicallyReadyIsNotOverallKillability:true/);
  assert.match(pulls,/rawDeathTimeline/);assert.match(pulls,/meaningfulDeathTimeline/);assert.match(pulls,/objective observations, not wipe-cause classification/);
  assert.match(service,/getLiveRlDiagnosticV1/);assert.match(service,/safeRlDiagnosticAllowedWhileMechanicsGated:true/);assert.match(service,/gatedRlDiagnosticIsObservedNotCausal:true/);
  assert.match(safe,/IRIS RL SUMMARY/);assert.match(safe,/RL BRIEF/);assert.match(safe,/Evidence details/);assert.match(safe,/selectedPullOwnsDiagnostic:true/);assert.match(safe,/globalBenchmark:true/);assert.match(safe,/\/api\/wcl\/live-rl-diagnostic/);
});

test('CRITICAL v3.9.12 RL DIAGNOSTIC: selected fight is synthesized against same-difficulty GLOBAL kills/wipes',async()=>{
  const [query,engine,service,route]=await Promise.all([read('server/wcl/queries/live-rl-diagnostic.mjs'),read('server/engines/live-rl-diagnostic-v1.mjs'),read('server/services/live-rl-diagnostic-service.mjs'),read('routes/api/wcl/live-rl-diagnostic.js')]);
  assert.match(query,/currentDamageTaken:table\(dataType:DamageTaken,fightIDs:\$fight\)/);assert.match(query,/currentDeaths:events\(dataType:Deaths/);assert.match(query,/fights\(killType:Encounters\)/);
  for(const field of ['currentEnemyCasts','currentInterrupts','currentDispels','currentDebuffs','currentDeaths'])assert.match(query,new RegExp(`${field}:events\\([^\\n]+fightIDs:\\$fight[^\\n]+translate:false`));
  assert.match(engine,/telemetryPull/);assert.match(engine,/reportPull/);assert.match(engine,/selectedFightId/);assert.match(engine,/loadOperationalEncounterModelV2/);assert.match(engine,/globalComparison/);assert.match(engine,/above-p90/);assert.match(engine,/wipeBenchmarkUsesPerMinute:true/);assert.match(engine,/killBenchmarkUsesPerPull:true/);assert.match(engine,/selectedPullDiagnosticDoesNotRequireFullTelemetry:true/);
  assert.match(engine,/rlSummary/);assert.match(engine,/priorities\.slice\(0,3\)/);assert.match(engine,/globalOutlierIsNotFailure:true/);assert.match(engine,/officialMappingIsSemanticContextNotCausality:true/);assert.match(engine,/noMechanicBlameWithoutClassifier:true/);assert.match(engine,/noMissedInterruptInference:true/);assert.match(engine,/noMissedDispelInference:true/);
  assert.match(service,/fight is required/);assert.match(service,/explicitSelectedFight:true/);assert.match(route,/live-rl-diagnostic-service/);
  assert.doesNotMatch(`${engine}\n${service}`,BOSS_SPECIFIC,'RL diagnostic must remain boss-agnostic');
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
  assert.match(index,/avoid-execution-context-v3911\.js\?v=3\.9\.12\.2/);assert.match(index,/raidops-v3912-operational\.css\?v=3\.9\.12\.8/);assert.match(index,/raidops-v3912-mechanics-bridge\.css\?v=3\.9\.12\.2/);assert.match(index,/avoid-operational-observer-guard-v3912\.js\?v=3\.9\.12\.5/);assert.match(index,/avoid-operational-ui-v3912\.js\?v=3\.9\.12\.7/);assert.match(index,/avoid-mechanics-state-v3912\.js\?v=3\.9\.12\.2/);assert.match(index,/avoid-mechanics-global-context-v3912\.js\?v=3\.9\.12\.1/);assert.match(index,/avoid-live-safe-fallback-v3912\.js\?v=3\.9\.12\.9/);assert.match(index,/avoid-live-rl-bridge-v3912\.js\?v=3\.9\.12\.3/);
});

test('CRITICAL v3.9.12 RAID EXECUTION: Mechanics owns stable HOME scope and shows GLOBAL context while sample is small',async()=>{
  const [header,ui,bridge,scopeIsolation,globalContext,service,css]=await Promise.all([read('public/iris-mechanics-header-v3910.js'),read('public/avoid-operational-ui-v3912.js'),read('public/raidops-v3912-mechanics-bridge.css'),read('public/avoid-mechanics-state-v3912.js'),read('public/avoid-mechanics-global-context-v3912.js'),read('server/services/raid-execution-service.mjs'),read('public/raidops-v3912-operational.css')]);
  assert.match(header,/CURRENT MECHANICAL STATE/);assert.match(header,/Longitudinal AvoiD mechanic execution/);assert.doesNotMatch(header,/bossCount\(/);assert.doesNotMatch(header,/CURRENT RAID/);
  assert.match(bridge,/data-tab="execution"/);assert.match(bridge,/display:block!important/);assert.match(bridge,/page-banner/);assert.match(bridge,/data-iris-mechanics-execution/);assert.match(bridge,/data-iris-mechanics-classified/);
  assert.match(scopeIsolation,/__AVOID_MECHANICS_RAID_EXECUTION__/);assert.match(scopeIsolation,/avoid:execution-context/);assert.match(scopeIsolation,/avoid:active-report-data/);assert.match(scopeIsolation,/irisMechanicsClassified/);
  assert.match(service,/loadOperationalEncounterModelV2/);assert.match(service,/globalContext/);assert.match(service,/referenceMode/);assert.match(service,/globalContextIsDescriptiveNotHomeEvidence:true/);
  assert.match(globalContext,/PRIMARY REFERENCE/);assert.match(globalContext,/GLOBAL WIDE/);assert.match(globalContext,/GLOBAL DEEP/);assert.match(globalContext,/MECHANIC EVOLUTION/);assert.match(globalContext,/MECHANICAL ACCURACY/);
  assert.match(ui,/Pull Lab/);assert.match(ui,/REAL WCL PULLS/);assert.doesNotMatch(ui,/LIVE_PULLS_MOCK|goldenMocks/);assert.match(css,/aop-rl-brief/);
});