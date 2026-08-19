import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeHistoryRosterV1,mergeDirectoryRosterV1 } from '../../server/home/roster-store-v1.mjs';

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

test('a later guild-directory refresh preserves raid participation markers',()=>{
  const history={guildId:7,guild:{id:7},raidRoster:{activeMembers:1,totalRaidPulls:4},members:[{name:'Raider',className:'Warrior',raidActivity:{confirmedFromHomeLogs:true,pulls:4},observed:null,directory:{temporary:true}}]};
  const incoming={guildId:7,guild:{id:7},members:[{name:'Raider',className:'Warrior',raidActivity:null,observed:null,directory:{temporary:true}},{name:'Alt',className:'Mage',raidActivity:null,observed:null,directory:{temporary:true}}]};
  const merged=mergeDirectoryRosterV1(history,incoming);
  assert.equal(merged.members.find(row=>row.name==='Raider').raidActivity.pulls,4);
  assert.equal(merged.members.find(row=>row.name==='Alt').raidActivity,null);
});
