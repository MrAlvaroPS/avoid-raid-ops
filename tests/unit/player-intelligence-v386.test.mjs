import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildIndexedRaidAttendance } from '../../server/analysis/reliability/attendance-history-v1.mjs';
import { dedupeSessionPulls } from '../../server/analysis/progression/raid-sessions.mjs';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');
const identity=name=>({key:`unknown:${name.toLowerCase()}`,name,server:null,className:'Mage'});

test('attendance denominator begins at each player first indexed appearance',()=>{
  const sessions=[
    {sessionId:'s1',startTime:100,endTime:200,progressionPulls:[{rosterIdentities:[identity('Alpha')]}]},
    {sessionId:'s2',startTime:300,endTime:400,progressionPulls:[{rosterIdentities:[identity('Beta')]}]},
    {sessionId:'s3',startTime:500,endTime:600,progressionPulls:[{rosterIdentities:[identity('Alpha'),identity('Beta')]},{rosterIdentities:[identity('Alpha')]}]}
  ];
  const model=buildIndexedRaidAttendance(sessions);
  const alpha=model.players.find(x=>x.identity.name==='Alpha');
  const beta=model.players.find(x=>x.identity.name==='Beta');
  assert.equal(alpha.sessionsAttended,2);
  assert.equal(alpha.eligibleSessions,3);
  assert.equal(alpha.pullsAttended,3);
  assert.equal(alpha.eligiblePulls,4);
  assert.equal(beta.sessionsAttended,2);
  assert.equal(beta.eligibleSessions,2);
  assert.equal(beta.pullsAttended,2);
  assert.equal(beta.eligiblePulls,3);
  assert.match(model.semantics,/not a guild-membership/i);
});

test('overlapping logger reports keep one pull and union player identities',()=>{
  const actorsA=[{id:1,name:'Alpha',type:'Player',subType:'Mage'}];
  const actorsB=[{id:2,name:'Beta',type:'Player',subType:'Priest'}];
  const fight={id:1,encounterID:3182,name:"Belo'ren",difficulty:5,startTime:1000,endTime:61000,kill:false,fightPercentage:75,bossPercentage:75,inProgress:false,lastPhaseAsAbsoluteIndex:2,wipeCalledTime:null};
  const reports=[
    {code:'A',startTime:100000,masterData:{actors:actorsA},fights:[{...fight,friendlyPlayers:[1]}]},
    {code:'B',startTime:100002,masterData:{actors:actorsB},fights:[{...fight,id:9,friendlyPlayers:[2]}]}
  ];
  const pulls=dedupeSessionPulls(reports);
  assert.equal(pulls.length,1);
  assert.deepEqual(pulls[0].rosterIdentities.map(x=>x.name).sort(),['Alpha','Beta']);
});

test('v3.8.8 Players remains historical while v3.9.2 owns the active dossier and Reliability presentation under v3.9.3',async()=>{
  const [historical,active,legacyCss,releaseCss,hotfixCss,index,pkg]=await Promise.all([
    read('public/player-intelligence-v386.js'),read('public/player-intelligence-v392.js'),read('public/raidops-v386.css'),read('public/raidops-v390.css'),read('public/raidops-v392.css'),read('index.html'),read('package.json')
  ]);
  assert.match(historical,/const VERSION='3\.8\.8'/);
  assert.match(active,/const VERSION='3\.9\.2'/);
  assert.match(active,/typeof telemetry!=='undefined'\?telemetry:null/);
  assert.match(active,/s\.t\?\.players/);
  assert.match(active,/playerAttendance/);
  assert.match(active,/Raid attendance/);
  assert.match(active,/output is deliberately separate from Reliability/);
  assert.doesNotMatch(active,/gear|talent|itemLevel/i);
  assert.doesNotMatch(active,/MutationObserver/);
  assert.doesNotMatch(active,/\.division b/);
  assert.doesNotMatch(active,/patchVersion/);
  assert.match(active,/setInterval\(\(\)=>render\(\),750\)/);
  assert.match(active,/publication\?\.publishable===true/);
  assert.match(active,/function syncRosterHeight\(\)/);
  assert.match(legacyCss,/player-list-v386\{[^}]*overflow-y:auto/);
  assert.match(releaseCss,/\.layout-player>\.player-list\{[^}]*max-height:none!important[^}]*overflow:visible!important/s);
  assert.match(hotfixCss,/--players-roster-max-height/);
  assert.match(hotfixCss,/data-reliability-owned/);
  assert.doesNotMatch(index,/player-intelligence-v386\.js\?v=3\.8\.9\.1/);
  assert.match(index,/player-intelligence-v392\.js\?v=3\.9\.2/);
  assert.match(index,/raidops-v386\.css\?v=3\.8\.6/);
  assert.match(index,/raidops-v390\.css\?v=3\.9\.0/);
  assert.match(index,/raidops-v392\.css\?v=3\.9\.2/);
  assert.equal(JSON.parse(pkg).version,'0.3.9-3-vercel.0');
});