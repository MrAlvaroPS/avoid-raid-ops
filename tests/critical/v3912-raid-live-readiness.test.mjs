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
  assert.match(source,/selectedWideCodes/);
  assert.match(source,/coverage-review/);
  assert.match(source,/live-ready/);
  assert.doesNotMatch(source,BOSS_SPECIFIC);
});

test('CRITICAL RAID PREP: current-raid preparation is generic, sequential/checkpointed and never borrows another difficulty',async()=>{
  const source=await read('scripts/iris-prepare-raid.mjs');
  assert.match(source,/catalog\.currentRaid\.encounters/);
  assert.match(source,/availability\.status!=='public-evidence-available'/);
  assert.match(source,/corpusProfile:'operational'/);
  assert.match(source,/recompileCorpusModelV2/);
  assert.match(source,/previewOperationalRehearsalV1/);
  assert.match(source,/executeOperationalRehearsalV1/);
  assert.match(source,/rate-limit reserve reached/);
  assert.match(source,/sameDifficultyOnly:true/);
  assert.match(source,/dataReadyDoesNotImplyLiveReady:true/);
  assert.doesNotMatch(source,BOSS_SPECIFIC);
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

test('CRITICAL IRIS CAPABILITIES: raid preparation and rehearsal are machine-readable instead of operator folklore',async()=>{
  const source=await read('server/iris/capability-contract-v3912.mjs');
  assert.match(source,/id:'boss\.operational-rehearsal'/);
  assert.match(source,/id:'raid\.prepare\.operational'/);
  assert.match(source,/DATA READY/);
  assert.match(source,/LIVE READY/);
  assert.match(source,/Rehearsal never trains or promotes/);
});
