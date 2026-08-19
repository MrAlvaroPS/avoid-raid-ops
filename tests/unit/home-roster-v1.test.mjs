import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGuildRosterMemberV1,mergeObservedRosterV1,mergeDirectoryRosterV1 } from '../../server/home/roster-store-v1.mjs';

test('temporary guild member is enriched by observed CombatantInfo without losing directory identity',()=>{
  const classes=new Map([[10,{name:'Monk',slug:'monk'}]]),member=normalizeGuildRosterMemberV1({id:1,canonicalID:99,name:'Pandokie',classID:10,level:90,guildRank:2,server:{id:3,name:'Sanguino',slug:'sanguino',region:{compactName:'EU',slug:'eu'}}},classes,{fetchedAt:100});
  const roster={guildId:788166,guild:{id:788166},members:[member]},merged=mergeObservedRosterV1(roster,[{name:'Pandokie',className:'Monk',spec:'Mistweaver',role:'HEALER',itemLevel:280,character:{gear:[{id:123,slot:'Head'}]}}],{observedAt:200,reportCode:'ABC',fightId:1});
  assert.equal(merged.members.length,1);assert.equal(merged.members[0].canonicalId,99);assert.equal(merged.members[0].directory.temporary,true);assert.equal(merged.members[0].observed.temporary,false);assert.equal(merged.members[0].spec,'Mistweaver');assert.equal(merged.members[0].role,'HEALER');assert.equal(merged.members[0].character.gear.length,1);
});

test('directory refresh preserves stronger observed fields',()=>{
  const old={guildId:788166,members:[{name:'Pandokie',canonicalId:99,spec:'Mistweaver',role:'HEALER',itemLevel:280,character:{gear:[{id:123}]},directory:{temporary:true},observed:{source:'wcl-combatant-info-observed',observedAt:200}}]},incoming={guildId:788166,members:[{name:'Pandokie',canonicalId:99,spec:null,role:null,itemLevel:null,character:null,directory:{temporary:true,fetchedAt:300},observed:null}]};
  const merged=mergeDirectoryRosterV1(old,incoming);assert.equal(merged.members[0].spec,'Mistweaver');assert.equal(merged.members[0].itemLevel,280);assert.ok(merged.members[0].observed);
});
