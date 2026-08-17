import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPlayerAttendance } from '../../server/analysis/reliability/player-attendance-v1.mjs';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('attendance denominator starts at first indexed appearance instead of before the player existed',()=>{
  const sessions=[
    {sessionId:'n1',sessionIndex:1,startTime:100,progressionPulls:[
      {absoluteStartTime:100,rosterKeys:['a']},
      {absoluteStartTime:200,rosterKeys:['a','b']},
      {absoluteStartTime:300,rosterKeys:['a','b']}
    ]},
    {sessionId:'n2',sessionIndex:2,startTime:1000,progressionPulls:[
      {absoluteStartTime:1000,rosterKeys:['a','b']},
      {absoluteStartTime:1100,rosterKeys:['a']}
    ]}
  ];
  const model=buildPlayerAttendance(sessions,new Map([['b',{name:'Bravo'}]]));
  const b=model.players.find(p=>p.key==='b');
  assert.equal(b.name,'Bravo');
  assert.equal(b.firstIndexedAt,200);
  assert.equal(b.pullsEligible,4);
  assert.equal(b.pullsAttended,3);
  assert.equal(b.pullAttendancePct,75);
  assert.equal(b.sessionsEligible,2);
  assert.equal(b.sessionsAttended,2);
  assert.equal(b.denominatorBoundary,'first-indexed-appearance');
});

test('duplicate logger roster keys inside one canonical pull never double count attendance',()=>{
  const sessions=[{sessionId:'n1',sessionIndex:1,startTime:100,progressionPulls:[
    {absoluteStartTime:100,rosterKeys:['a','a','a']},
    {absoluteStartTime:200,rosterKeys:['a']}
  ]}];
  const [a]=buildPlayerAttendance(sessions).players;
  assert.equal(a.pullsAttended,2);
  assert.equal(a.pullsEligible,2);
  assert.equal(a.pullAttendancePct,100);
});

test('history query carries actor identities and separates encounter from raid attendance populations',async()=>{
  const [query,engine]=await Promise.all([
    read('server/wcl/queries/history.mjs'),
    read('server/engines/history-engine.mjs')
  ]);
  assert.match(query,/masterData\{actors\{id name type subType server\}\}/);
  assert.match(query,/encounterFights:fights\(encounterID:\$encounterId,difficulty:\$difficulty/);
  assert.match(query,/raidFights:fights\(killType:Encounters\)/);
  assert.match(engine,/const raidClustered=clusterRaidSessions\(raidReports/);
  assert.match(engine,/scope:'raid-zone-history-window'/);
  assert.match(engine,/not an inferred guild join date/);
});

test('meaningful deaths are pageable and only a complete stream unlocks Survival opportunities',async()=>{
  const [queries,engine]=await Promise.all([
    read('server/wcl/queries/intelligence.mjs'),
    read('server/engines/intelligence-engine.mjs')
  ]);
  assert.match(queries,/MEANINGFUL_DEATH_PAGE_QUERY/);
  assert.match(queries,/meaningfulDeaths:events\(dataType:Deaths,fightIDs:\$all,hostilityType:Friendlies,startTime:\$start,limit:10000,wipeCutoff:5/);
  assert.match(engine,/MEANINGFUL_DEATH_PAGE_QUERY/);
  assert.match(engine,/survivalSourceComplete:!deathPage\.truncated/);
  assert.match(engine,/meaningfulDeaths:\{events:meaningfulDeathEvents\.length,truncated:deathPage\.truncated,pages:deathPage\.pages,sourceComplete:!deathPage\.truncated\}/);
});

test('Players v3.8.2 runtime owns full-roster rendering and never treats performance as Reliability',async()=>{
  const runtime=await read('public/player-intelligence-v382.js');
  assert.match(runtime,/performanceDoesNotScore/);
  assert.match(runtime,/player-list-scroll/);
  assert.match(runtime,/reliability-table-v382/);
  assert.match(runtime,/first indexed appearance/i);
  assert.match(runtime,/classified failures/i);
  assert.doesNotMatch(runtime,/itemLevel|talentImport|gearCount/);
});
