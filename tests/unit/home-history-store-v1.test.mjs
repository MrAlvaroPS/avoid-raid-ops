import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAvoidHistoryReportV1,avoidHistoryReportSummaryV1,persistAvoidHistoryReportV1,loadAvoidHistoryReportV1,persistAvoidHistoryIndexV1,loadAvoidHistoryIndexV1 } from '../../server/home/history-store-v1.mjs';

const raw={code:'Home1234',title:'Raid Night',startTime:1000,endTime:9000,revision:3,visibility:'public',guild:{id:111,name:'HOME'},zone:{id:53,name:'Synthetic Raid'},masterData:{actors:[{id:1,name:'Tank',type:'Player',subType:'Warrior'}]},fights:[
  {id:10,encounterID:8001,name:'Boss One',difficulty:3,startTime:1100,endTime:2100,kill:false,fightPercentage:62,inProgress:false,friendlyPlayers:[1],lastPhaseAsAbsoluteIndex:2,phaseTransitions:[{id:2,startTime:1600}]},
  {id:11,encounterID:8001,name:'Boss One',difficulty:4,startTime:3100,endTime:4100,kill:true,fightPercentage:0,inProgress:false,friendlyPlayers:[1],lastPhaseAsAbsoluteIndex:3},
  {id:12,encounterID:8002,name:'Boss Two',difficulty:4,startTime:5100,endTime:6100,kill:false,fightPercentage:88,inProgress:true,friendlyPlayers:[1]},
]};

test('HOME history stores exact fight difficulty and never collapses a report to one difficulty',()=>{
  const row=normalizeAvoidHistoryReportV1(raw,{guildId:111,zoneId:53,syncedAt:42});
  assert.equal(row.reportCode,'Home1234');assert.equal(row.syncedAt,42);assert.ok(row.fingerprint);
  assert.deepEqual(row.fights.map(f=>`${f.encounterID}:d${f.difficulty}`),['8001:d3','8001:d4','8002:d4']);
  const summary=avoidHistoryReportSummaryV1(row);
  assert.deepEqual(summary.scopes.map(s=>s.scopeKey),['8001:d3','8001:d4','8002:d4']);
  assert.equal(summary.scopes.find(s=>s.scopeKey==='8002:d4').inProgressPulls,1);
});

test('HOME history rejects reports that are not provably from configured HOME guild or current raid',()=>{
  assert.throws(()=>normalizeAvoidHistoryReportV1({...raw,guild:{id:222}},{guildId:111,zoneId:53}),/does not belong/);
  assert.throws(()=>normalizeAvoidHistoryReportV1({...raw,zone:{id:99}},{guildId:111,zoneId:53}),/outside current raid/);
});

test('HOME history report and index persistence are deterministic through storage adapters',async()=>{
  const memory=new Map(),get=async key=>memory.get(key)||null,set=async(key,value)=>{memory.set(key,value);return value;};
  const row=normalizeAvoidHistoryReportV1(raw,{guildId:111,zoneId:53,syncedAt:42});
  await persistAvoidHistoryReportV1(row,{guildId:111,zoneId:53,storageSet:set});
  const loaded=await loadAvoidHistoryReportV1({guildId:111,zoneId:53,reportCode:'Home1234',storageGet:get});
  assert.equal(loaded.fingerprint,row.fingerprint);
  const index={version:'avoid-history-store-v1',status:'ready',guildId:111,zone:{id:53,name:'Synthetic Raid'},reports:[avoidHistoryReportSummaryV1(row)]};
  await persistAvoidHistoryIndexV1(index,{guildId:111,zoneId:53,storageSet:set});
  assert.deepEqual(await loadAvoidHistoryIndexV1({guildId:111,zoneId:53,storageGet:get}),index);
});
