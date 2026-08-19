import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');
const BOSS_SPECIFIC=/Nek.?zali|3470|2888|The Venomous Abyss/i;

test('CRITICAL OPERATIONAL REHEARSAL: DATA READY is separate from LIVE READY and rehearsal cannot train/promote',async()=>{
  const source=await read('server/corpus/operational-readiness-v1.mjs');
  assert.match(source,/dataReadyDoesNotImplyLiveReady:true/);
  assert.match(source,/reportSelectionUsesPerformance:false/);
  assert.match(source,/deterministicCanonicalReports:true/);
  assert.match(source,/externalReportsNeverEnterHomeExecution:true/);
  assert.match(source,/rehearsalDoesNotTrain:true/);
  assert.match(source,/rehearsalDoesNotPromote:true/);
  assert.match(source,/sameDifficultyOnly:true/);
  assert.match(source,/operationalModelFingerprint/);
  assert.match(source,/rehearsalFingerprint/);
  assert.match(source,/OPERATIONAL_EXECUTION_CONTRACT_VERSION/);
  assert.match(source,/executionContractVersionedReadiness:true/);
  assert.match(source,/legacyCoverageReviewInvalidatedOnStreamV2:true/);
  assert.match(source,/legacyLiveReadyCompatible/);
  assert.match(source,/staleCoverageReviewCannotBlockChangedModel:true/);
  assert.match(source,/packDiagnostics/);
  assert.match(source,/packDiagnosticsFromPersistedAggregate:true/);
  assert.match(source,/coverage-review/);
  assert.match(source,/live-ready/);
  assert.doesNotMatch(source,BOSS_SPECIFIC);
});

test('CRITICAL RAID PREP: current-raid preparation is generic, checkpointed, unattended-safe and never borrows another difficulty',async()=>{
  const source=await read('scripts/iris-prepare-raid.mjs');
  assert.match(source,/catalog\.currentRaid\.encounters/);
  assert.match(source,/availability\.status!=='public-evidence-available'/);
  assert.match(source,/corpusProfile:'operational'/);
  assert.match(source,/recompileCorpusModelV2/);
  assert.match(source,/previewOperationalRehearsalV1/);
  assert.match(source,/executeOperationalRehearsalV1/);
  assert.match(source,/--watch/);
  assert.match(source,/WATCH SLEEP/);
  assert.match(source,/resumeAt/);
  assert.match(source,/isRawWcl429/);
  assert.match(source,/rawWcl429IsTransientCheckpoint:true/);
  assert.match(source,/--force-rehearsal/);
  assert.match(source,/sameDifficultyOnly:true/);
  assert.match(source,/dataReadyDoesNotImplyLiveReady:true/);
  assert.match(source,/unchangedCoverageReviewIsNotRepeated:true/);
  assert.match(source,/legacyCoverageReviewRehearsedOnceAfterContractChange:true/);
  assert.doesNotMatch(source,BOSS_SPECIFIC);
});

test('CRITICAL OBSERVATIONAL COVERAGE: seeing a non-scoreable mechanic counts as coverage but never becomes a failure',async()=>{
  const source=await read('server/analysis/mechanics/encounter-rule-engine.mjs');
  assert.match(source,/pressure-window/);
  assert.match(source,/damage-distribution-only/);
  assert.match(source,/stateful-impact-observed/);
  assert.match(source,/agg\.observedIncidents\+=impacts\.length/);
  assert.match(source,/not converted into a player\/raid failure/);
});

test('CRITICAL PRODUCTION LIVE GATE: only the current rehearsal fingerprint can emit mechanic classification through the Live API',async()=>{
  const source=await read('server/services/operational-execution-service.mjs');
  assert.match(source,/previewOperationalRehearsalV1/);
  assert.match(source,/readiness\?\.liveReady!==true/);
  assert.match(source,/operational-rehearsal-required/);
  assert.match(source,/currentRehearsalFingerprintRequired:true/);
  assert.match(source,/noUnrehearsedMechanicClassification:true/);
  const gateAt=source.indexOf('readiness?.liveReady!==true'),engineAt=source.indexOf('getOperationalExecutionV1({');
  assert.ok(gateAt>=0&&engineAt>gateAt,'Live readiness must be checked before production Operational Execution');
});

test('CRITICAL SAFE LIVE DEGRADATION: mechanic gating keeps objective telemetry visible without repaint races or calls',async()=>{
  const [service,ui,index,observerGuard]=await Promise.all([read('server/services/operational-execution-service.mjs'),read('public/avoid-live-safe-fallback-v3912.js'),read('index.html'),read('public/avoid-operational-observer-guard-v3912.js')]);
  assert.match(service,/getTelemetry/);
  assert.match(service,/safeTelemetryAllowedWhileMechanicsGated:true/);
  assert.match(service,/mechanics:null,blocker:null,nextPullCalls:\[\],homeExecution:null/);
  assert.match(ui,/SAFE TELEMETRY/);
  assert.match(ui,/MECHANIC INTELLIGENCE/);
  assert.match(ui,/NO UNVERIFIED MECHANIC CALL/);
  assert.match(ui,/Objective pull telemetry above remains valid/);
  assert.match(ui,/queueMicrotask/);
  assert.match(ui,/unconditionalRepaint:false/);
  assert.match(ui,/data-safe-live-shell/);
  assert.doesNotMatch(ui,/setInterval\(\(\)=>\{if\(page\(\)==='live'\)render\(\);\},1000\)/);
  assert.match(observerGuard,/if\(page\(\)==='live'\)return/);
  assert.match(observerGuard,/liveUpdates:'explicit execution-context\/data events only'/);
  assert.match(index,/avoid-operational-observer-guard-v3912\.js\?v=3\.9\.12\.5/);
  assert.match(index,/avoid-live-safe-fallback-v3912\.js\?v=3\.9\.12\.5/);
  assert.doesNotMatch(ui,/classified failure.*actor/i);
  assert.doesNotMatch(ui,BOSS_SPECIFIC);
});

test('CRITICAL MULTI-BOSS LIVE: changing boss scope clears stale rich data before hydrating the new boss',async()=>{
  const source=await read('public/avoid-execution-context-v3911.js');
  assert.match(source,/lastActiveScopeKey/);
  assert.match(source,/scopeChanged/);
  assert.match(source,/activeData=\{report:null,telemetry:null,operationalExecution:null,raidExecution:null\}/);
  assert.match(source,/richExecutionClearedOnScopeChange:true/);
  assert.match(source,/force:forceHydration\|\|scopeChanged/);
  assert.match(source,/window\.__AVOID_WCL__=state\.activeData\.report\|\|null/);
  assert.match(source,/window\.__AVOID_WCL_TELEMETRY__=state\.activeData\.telemetry\|\|null/);
});

test('CRITICAL DIFFICULTY IDENTITY: operational loaders have no implicit Mythic fallback',async()=>{
  const source=await read('server/corpus/service-v2.mjs');
  assert.match(source,/difficulty is required/);
  assert.doesNotMatch(source,/input\.difficulty\s*\|\|\s*5/);
});

test('CRITICAL MECHANICS PUBLIC REFERENCE: canonical corpus evidence is visible without pretending it is accepted knowledge',async()=>{
  const [service,ui]=await Promise.all([read('server/services/global-raid-reference-service.mjs'),read('public/iris-mechanics-global-reference-v3910.js')]);
  assert.match(service,/canonicalCountsPreferredWhenOperationalReady:true/);
  assert.match(service,/wideSources/);assert.match(service,/deepSources/);assert.match(service,/candidateSources/);
  assert.match(ui,/PUBLIC CORPUS AVAILABLE/);assert.match(ui,/DATA READY/);assert.match(ui,/not accepted mechanic knowledge/i);
  assert.match(ui,/const maturity=String\(ref\?\.maturity/);
  assert.doesNotMatch(ui,/row=ref\?\.reference/);
});

test('CRITICAL IRIS CAPABILITIES: raid preparation and rehearsal are machine-readable instead of operator folklore',async()=>{
  const source=await read('server/iris/capability-contract-v3912.mjs');
  assert.match(source,/id:'boss\.operational-rehearsal'/);
  assert.match(source,/id:'raid\.prepare\.operational'/);
  assert.match(source,/DATA READY/);
  assert.match(source,/LIVE READY/);
  assert.match(source,/Rehearsal never trains or promotes/);
});
