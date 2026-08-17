import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { clusterRaidSessions } from '../../server/analysis/progression/raid-sessions.mjs';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('raid sessions expose deduplicated encounter progression pulls with stage depth', () => {
  const fights = [
    {id:1,encounterID:3182,name:'Boss',difficulty:5,startTime:0,endTime:60000,kill:false,fightPercentage:90,bossPercentage:90,inProgress:false,friendlyPlayers:[1,2],lastPhaseAsAbsoluteIndex:0,wipeCalledTime:0},
    {id:2,encounterID:3182,name:'Boss',difficulty:5,startTime:70000,endTime:150000,kill:false,fightPercentage:60,bossPercentage:60,inProgress:false,friendlyPlayers:[1,2],lastPhaseAsAbsoluteIndex:1,wipeCalledTime:0},
  ];
  const reports = [
    {code:'AAA',title:'Night',startTime:1_000_000,endTime:1_200_000,fights},
    {code:'BBB',title:'Duplicate upload',startTime:1_000_000,endTime:1_200_000,fights:fights.map(f=>({...f,id:f.id+100}))},
  ];
  const sessions = clusterRaidSessions(reports,{currentReportCode:'AAA'});
  assert.equal(sessions.length,1);
  assert.equal(sessions[0].pulls,2);
  assert.equal(sessions[0].progressionPulls.length,2);
  assert.equal(sessions[0].progressionPulls[1].stageCount,2);
  assert.deepEqual(new Set(sessions[0].progressionPulls[0].reportCodes),new Set(['AAA','BBB']));
});

test('Progress v3.7.9 remains as the first encounter-history implementation', async () => {
  const runtime = await read('public/progress-runtime-v379.js');
  assert.match(runtime, /window\.__AVOID_WCL_HISTORY__/);
  assert.match(runtime, /progressionPulls/);
  assert.match(runtime, /LAST 100/);
  assert.match(runtime, /LAST 50/);
  assert.match(runtime, /LAST 25/);
  assert.match(runtime, /extraWclRequests:0/);
  assert.doesNotMatch(runtime, /\bfetch\s*\(/);
  assert.doesNotMatch(runtime, /Between-pull RL brief/);
  assert.match(runtime, /Stage consistency matrix/);
  assert.match(runtime, /20-pull windows/);
});

test('v3.7.9 historical strategic metrics remain regression assets', async () => {
  const runtime = await read('public/progress-runtime-v379.js');
  for (const label of ['TOTAL PROG PULLS','BEST PULL','LAST 20 MEDIAN','DEEPEST STAGE REACH','PULLS SINCE PB']) {
    assert.match(runtime,new RegExp(label));
  }
  assert.match(runtime, /PROGRESSION HISTORY/);
  assert.match(runtime, /Live owns the current raid night/);
});

test('History endpoint retains the bounded WCL lookback and now canonicalizes the pull series', async () => {
  const history = await read('server/engines/history-engine.mjs');
  assert.match(history, /daysBefore=35/);
  assert.match(history, /progressionPulls/);
  assert.match(history, /canonical-deduped-from-history-reports/);
  assert.match(history, /buildProgressModel\(rawProgressionPulls\)/);
  assert.match(history, /progressModel/);
});

test('Progress and Live product boundary is documented', async () => {
  const doc = await read('docs/PROGRESS-SCOPE.md');
  assert.match(doc, /historical \/ strategic progression view/i);
  assert.match(doc, /A between-pull brief must not live in `Progress`/);
  assert.match(doc, /ALL/);
  assert.match(doc, /LAST 100/);
  assert.match(doc, /LAST 50/);
  assert.match(doc, /LAST 25/);
});

test('v3.7.9 assets stay available while v3.8.3 is the active Progress/Iris release', async () => {
  const index = await read('index.html');
  assert.match(index, /raidops-v379\.css\?v=3\.7\.9/);
  assert.match(index, /raidops-v3713\.css\?v=3\.8\.3/);
  assert.match(index, /progress-runtime-v3713\.js\?v=3\.8\.3/);
  assert.match(index, /iris-runtime-v3713\.js\?v=3\.8\.3/);
  assert.doesNotMatch(index, /progress-runtime-v379\.js\?v=3\.7\.9/);
  assert.doesNotMatch(index, /iris-runtime-v379\.js\?v=3\.7\.9/);
});