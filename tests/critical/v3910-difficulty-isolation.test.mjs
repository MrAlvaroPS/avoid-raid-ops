import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { corpusId } from '../../server/corpus/keys.mjs';
import { selectEncounter } from '../../server/wcl/normalization/fights.mjs';

const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL v3.9.10 DIFFICULTY: persistent GLOBAL BOSS scopes differ across Normal Heroic and Mythic',()=>{
  const base={encounterId:7777,partition:9};
  assert.notEqual(corpusId({...base,difficulty:3}),corpusId({...base,difficulty:4}));
  assert.notEqual(corpusId({...base,difficulty:4}),corpusId({...base,difficulty:5}));
  assert.match(corpusId({...base,difficulty:5}),/\/d5\//);
});

test('CRITICAL v3.9.10 DIFFICULTY: fight selection never mixes the same boss across difficulties',()=>{
  const fights=[{id:1,encounterID:7777,difficulty:3,startTime:100,endTime:200},{id:2,encounterID:7777,difficulty:4,startTime:300,endTime:400},{id:3,encounterID:7777,difficulty:5,startTime:500,endTime:600},{id:4,encounterID:7777,difficulty:4,startTime:700,endTime:800}];
  assert.deepEqual(selectEncounter(fights,7777,3).map(x=>x.id),[1]);
  assert.deepEqual(selectEncounter(fights,7777,4).map(x=>x.id),[2,4]);
  assert.deepEqual(selectEncounter(fights,7777,5).map(x=>x.id),[3]);
  assert.deepEqual(selectEncounter(fights,7777).map(x=>x.id),[2,4]);
});

test('CRITICAL v3.9.10 DIFFICULTY: report telemetry history intelligence and live status all propagate explicit difficulty',async()=>{
  const files=await Promise.all([read('server/services/report-service.mjs'),read('server/engines/report-engine.mjs'),read('server/services/telemetry-service.mjs'),read('server/engines/telemetry-engine.mjs'),read('server/services/history-service.mjs'),read('server/engines/history-engine.mjs'),read('server/services/intelligence-service.mjs'),read('server/engines/intelligence-engine.mjs'),read('server/services/live-status-service.mjs'),read('server/engines/status-engine.mjs')]);
  for(const text of files)assert.match(text,/difficulty/);
  for(const text of [files[1],files[3],files[5],files[7],files[9]])assert.match(text,/selectEncounter\([^\n]+difficulty/);
  assert.match(files[5],/REPORT_HISTORY_FIGHTS_QUERY[^\n]+difficulty:/);
  assert.match(files[7],/getTelemetry\([^\n]+difficulty:selectedDifficulty/);
});

test('CRITICAL v3.9.10 DIFFICULTY: official applicability maps WCL difficulty to encounter-scoped DB2 Difficulty IDs before filtering',async()=>{
  const [provider,compiler,bootstrap,route,catalog]=await Promise.all([read('server/knowledge/providers/wago-db2-journal-difficulty-v1.mjs'),read('server/knowledge/official-encounter-difficulty-v1.mjs'),read('server/knowledge/raid-official-bootstrap-v1.mjs'),read('routes/api/wcl/mechanic-knowledge.js'),read('server/knowledge/raid-catalog-v1.mjs')]);
  assert.match(provider,/JournalSectionXDifficulty/);
  assert.match(provider,/JournalEncounterXDifficulty/);
  assert.match(provider,/fetchTable\('Difficulty'/);
  assert.match(provider,/wclDifficultyIdsAreNotDb2DifficultyIds:true/);
  assert.match(provider,/observedCombat:false/);
  assert.match(compiler,/resolveDb2Difficulty/);
  assert.match(compiler,/wclAndDb2DifficultyIdsDistinct:true/);
  assert.match(compiler,/difficulty-applicability-unresolved/);
  assert.match(compiler,/crossDifficultyEmpiricalReuse:false/);
  assert.match(bootstrap,/compileOfficialEncounterDifficultyViewV1/);
  assert.match(bootstrap,/wclCombatEventCalls:0/);
  assert.match(route,/if\(!input\.difficulty\)/);
  assert.match(catalog,/normalHeroicCannotCountAsMythicEvidence:true/);
  assert.doesNotMatch(catalog,/zoneId\s*===\s*54|\bzone\s*:\s*54\b/);
});

test('CRITICAL v3.9.10 DIFFICULTY: corpus API has no silent Mythic fallback and browser report endpoints inherit explicit URL difficulty',async()=>{
  const [corpus,bootstrap,runtime,index]=await Promise.all([read('routes/api/wcl/corpus.js'),read('public/wcl-bootstrap-v389.js'),read('public/iris-mechanics-knowledge-v3910.js'),read('index.html')]);
  assert.match(corpus,/difficulty: Number\(body\.difficulty \?\? url\.searchParams\.get\('difficulty'\) \?\? 0\) \|\| 0/);
  assert.match(corpus,/difficulty is required; Normal, Heroic and Mythic are independent corpora/);
  assert.doesNotMatch(corpus,/searchParams\.get\('difficulty'\) \|\| 5/);
  assert.match(bootstrap,/DIFFICULTY_SCOPED_PATHS/);
  assert.match(bootstrap,/locationDifficulty/);
  assert.match(bootstrap,/url\.searchParams\.set\('difficulty'/);
  assert.match(runtime,/LOAD THIS EXECUTION SCOPE/);
  assert.match(runtime,/url\.searchParams\.set\('encounter'/);
  assert.match(runtime,/url\.searchParams\.set\('difficulty'/);
  assert.match(index,/wcl-bootstrap-v389\.js\?v=3\.8\.9\.2/);
  assert.match(index,/iris-mechanics-knowledge-v3910\.js\?v=3\.9\.10\.3/);
});
