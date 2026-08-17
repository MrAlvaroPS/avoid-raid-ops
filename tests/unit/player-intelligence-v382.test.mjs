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

test('history query carries actor identities needed to join attendance across reports',async()=>{
  const query=await read('server/wcl/queries/history.mjs');
  assert.match(query,/masterData\{actors\{id name type subType server\{name slug region\{name compactName slug\}\}\}\}/);
});

test('Players v3.8.2 runtime owns full-roster rendering and never treats performance as Reliability',async()=>{
  const runtime=await read('public/player-intelligence-v382.js');
  assert.match(runtime,/performanceDoesNotScore/);
  assert.match(runtime,/player-list-scroll/);
  assert.match(runtime,/reliability-table/);
  assert.match(runtime,/first indexed appearance/i);
  assert.match(runtime,/classified failures/i);
  assert.doesNotMatch(runtime,/itemLevel|talentImport|gearCount/);
});
