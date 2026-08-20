import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeHistoryRosterV1,mergeDirectoryRosterV1 } from '../../server/home/roster-store-v1.mjs';
import { normalizeAvoidHistoryReportV1,AVOID_HISTORY_STORE_VERSION } from '../../server/home/history-store-v1.mjs';

test('HOME history promotes only actual raid participants into raidActivity without deleting directory identities',()=>{
  const base={guildId:7,guild:{id:7,name:'AvoiD'},members:[
    {name:'Raider',className:'Warrior',directory:{temporary:true},raidActivity:null,observed:null},
    {name:'Social',className:'Mage',directory:{temporary:true},raidActivity:null,observed:null},
  ]};
  const reports=[{reportCode:'AAA',startTime:100000,masterData:{actors:[
    {id:1,name:'Raider',type:'Player',subType:'Warrior'},
    {id:2,name:'Social',type:'Player',subType:'Mage'},
    {id:3,name:'Guest',type:'Player',subType:'Druid'},
  ]},fights:[
    {id:10,encounterID:3470,difficulty:3,startTime:1000,friendlyPlayers:[1,3]},
    {id:11,encounterID:3470,difficulty:3,startTime:2000,friendlyPlayers:[1]},
  ]}];
  const merged=mergeHistoryRosterV1(base,reports,{syncedAt:123456});
  assert.equal(merged.raidRoster.activeMembers,2);
  assert.equal(merged.raidRoster.totalRaidPulls,2);
  const raider=merged.members.find(row=>row.name==='Raider'),social=merged.members.find(row=>row.name==='Social'),guest=merged.members.find(row=>row.name==='Guest');
  assert.equal(raider.raidActivity.confirmedFromHomeLogs,true);
  assert.equal(raider.raidActivity.pulls,2);
  assert.equal(raider.raidActivity.attendancePct,100);
  assert.equal(social.raidActivity,null);
  assert.equal(guest.className,'Druid');
  assert.equal(guest.raidActivity.pulls,1);
  assert.equal(guest.raidActivity.attendancePct,50);
});

test('friendlySpecs and friendlyItemLevels from synced WCL logs resolve the latest raid spec without another WCL call',()=>{
  const base={guildId:7,guild:{id:7,name:'AvoiD'},members:[{name:'Raider',className:'Warrior',directory:{temporary:true},raidActivity:null,observed:null,spec:null,role:null,itemLevel:null}]};
  const reports=[{reportCode:'AAA',startTime:100000,masterData:{actors:[{id:1,name:'Raider',type:'Player',subType:'Warrior'}]},fights:[
    {id:10,encounterID:3470,difficulty:3,startTime:1000,friendlyPlayers:[1],friendlySpecs:[73],friendlyItemLevels:[282]},
    {id:11,encounterID:3470,difficulty:3,startTime:2000,friendlyPlayers:[1],friendlySpecs:[71],friendlyItemLevels:[286]},
  ]}];
  const specDirectory=[{id:71,name:'Arms',slug:'arms',classId:1,className:'Warrior'},{id:73,name:'Protection',slug:'protection',classId:1,className:'Warrior'}];
  const merged=mergeHistoryRosterV1(base,reports,{syncedAt:123456,specDirectory}),raider=merged.members.find(row=>row.name==='Raider');
  assert.equal(raider.spec,'Arms');
  assert.equal(raider.specId,71);
  assert.equal(raider.role,'DPS');
  assert.equal(raider.itemLevel,286);
  assert.equal(raider.raidActivity.spec,'Arms');
  assert.equal(raider.raidActivity.latestProfileAt,102000);
});

test('WCL string friendlySpecs survive HOME normalization and resolve spec plus role directly',()=>{
  const raw={code:'ABC',title:'Raid',startTime:100000,endTime:120000,revision:2,guild:{id:7,name:'AvoiD'},zone:{id:53,name:'The Venomous Abyss'},masterData:{actors:[{id:1,name:'Moonkin',type:'Player',subType:'Druid'}]},fights:[{id:1,encounterID:3470,name:"Nek'zali the Soulcoiler",difficulty:3,startTime:1000,endTime:2000,friendlyPlayers:[1],friendlySpecs:['Balance Druid'],friendlyItemLevels:[295]}]};
  const report=normalizeAvoidHistoryReportV1(raw,{guildId:7,zoneId:53,syncedAt:123456});
  assert.equal(report.version,AVOID_HISTORY_STORE_VERSION);
  assert.deepEqual(report.fights[0].friendlySpecs,['Balance Druid']);
  const base={guildId:7,guild:{id:7,name:'AvoiD'},members:[{name:'Moonkin',className:'Druid',directory:{temporary:true},raidActivity:null,observed:null,spec:null,role:null,itemLevel:null}]};
  const merged=mergeHistoryRosterV1(base,[report],{syncedAt:123456}),raider=merged.members.find(row=>row.name==='Moonkin');
  assert.equal(raider.spec,'Balance Druid');
  assert.equal(raider.role,'DPS');
  assert.equal(raider.itemLevel,295);
  assert.equal(raider.raidActivity.spec,'Balance Druid');
});

test('WCL string tank and healer specs resolve role without a spec-id directory',()=>{
  const base={guildId:7,guild:{id:7,name:'AvoiD'},members:[]};
  const reports=[{reportCode:'AAA',startTime:100000,masterData:{actors:[{id:1,name:'Tank',type:'Player',subType:'Warrior'},{id:2,name:'Heal',type:'Player',subType:'Shaman'}]},fights:[{id:10,encounterID:3470,difficulty:3,startTime:1000,friendlyPlayers:[1,2],friendlySpecs:['Protection Warrior','Restoration Shaman'],friendlyItemLevels:[290,291]}]}];
  const merged=mergeHistoryRosterV1(base,reports,{syncedAt:123456});
  assert.equal(merged.members.find(row=>row.name==='Tank').role,'TANK');
  assert.equal(merged.members.find(row=>row.name==='Heal').role,'HEALER');
});

test('current-raid rebuild clears stale raidActivity for characters absent from current reports',()=>{
  const previous={guildId:7,guild:{id:7},members:[
    {name:'OldRaider',className:'Mage',directory:{temporary:true},raidActivity:{confirmedFromHomeLogs:true,pulls:99},observed:{source:'wcl-combatant-info-observed'}},
    {name:'CurrentRaider',className:'Warrior',directory:{temporary:true},raidActivity:{confirmedFromHomeLogs:true,pulls:99},observed:null},
  ]};
  const reports=[{reportCode:'NEW',startTime:200000,masterData:{actors:[{id:1,name:'CurrentRaider',type:'Player',subType:'Warrior'}]},fights:[{id:1,encounterID:3470,difficulty:3,startTime:1000,friendlyPlayers:[1]}]}];
  const merged=mergeHistoryRosterV1(previous,reports,{syncedAt:222222});
  assert.equal(merged.members.find(row=>row.name==='OldRaider').raidActivity,null);
  assert.ok(merged.members.find(row=>row.name==='OldRaider').observed);
  assert.equal(merged.members.find(row=>row.name==='CurrentRaider').raidActivity.pulls,1);
});

test('a later guild-directory refresh preserves raid participation markers',()=>{
  const history={guildId:7,guild:{id:7},raidRoster:{activeMembers:1,totalRaidPulls:4},members:[{name:'Raider',className:'Warrior',raidActivity:{confirmedFromHomeLogs:true,pulls:4},observed:null,directory:{temporary:true}}]};
  const incoming={guildId:7,guild:{id:7},members:[{name:'Raider',className:'Warrior',raidActivity:null,observed:null,directory:{temporary:true}},{name:'Alt',className:'Mage',raidActivity:null,observed:null,directory:{temporary:true}}]};
  const merged=mergeDirectoryRosterV1(history,incoming);
  assert.equal(merged.members.find(row=>row.name==='Raider').raidActivity.pulls,4);
  assert.equal(merged.members.find(row=>row.name==='Alt').raidActivity,null);
});
