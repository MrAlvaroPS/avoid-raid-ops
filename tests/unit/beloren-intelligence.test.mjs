import test from 'node:test';
import assert from 'node:assert/strict';
import { BELOREN,BELOREN_FILTERS } from '../../server/rule-packs/encounters/beloren/index.mjs';
import { analyzeEncounterMechanics,buildColorTimeline,colorAt } from '../../server/analysis/mechanics/encounter-rule-engine.mjs';
import { buildDeathChains,findCurrentBlocker } from '../../server/analysis/root-cause/death-chains.mjs';

test('Belo-ren pack covers the major known mythic mechanics',()=>{
 const keys=new Set(BELOREN.mechanics.map(m=>m.key));
 for(const key of ['voidlight-convergence','light-dive','void-dive','radiant-echoes','guardian-edict','light-eruption','void-eruption','ember-rebirth','incubation-light','incubation-void','ashen-benediction'])assert.ok(keys.has(key),key);
 assert.ok(BELOREN_FILTERS.damage.includes(1243866));assert.ok(BELOREN_FILTERS.casts.includes(1243852));assert.ok(BELOREN_FILTERS.friendlyAuras.includes(1241162));
});

test('color timeline resolves repeated feather assignments',()=>{
 const t=buildColorTimeline([{timestamp:100,type:'applybuff',targetID:7,ability:1241162},{timestamp:500,type:'removebuff',targetID:7,ability:1241162},{timestamp:600,type:'applybuff',targetID:7,ability:1241163}],BELOREN);
 assert.equal(colorAt(t,7,200),'LIGHT');assert.equal(colorAt(t,7,550),null);assert.equal(colorAt(t,7,700),'VOID');
});

test('opposing-colour periodic Flames aura becomes a mechanic failure while the direct hit alone does not',()=>{
 const fights=[{id:1,startTime:0,endTime:20000}];
 const r=analyzeEncounterMechanics({pack:BELOREN,fights,friendlyAuraEvents:[{fight:1,timestamp:100,type:'applydebuff',targetID:5,ability:1241163}],damageEvents:[{fight:1,timestamp:5000,targetID:5,ability:1242803},{fight:1,timestamp:6000,targetID:5,ability:1242803},{fight:1,timestamp:7000,targetID:5,ability:1242803}],castEvents:[{fight:1,timestamp:4500,type:'begincast',sourceID:90,ability:1242792}],enemyBuffEvents:[]});
 const f=r.failures.find(x=>x.mechanicKey==='incubation-light'&&x.actorId===5);
 assert.ok(f);assert.equal(f.evidence.signal,'periodic-aura');
});

test('Voidlight Rupture is a high-confidence Radiant Echoes failure proxy',()=>{
 const fights=[{id:1,startTime:0,endTime:10000}];
 const r=analyzeEncounterMechanics({pack:BELOREN,fights,damageEvents:[{fight:1,timestamp:4000,targetID:2,ability:1243866}],castEvents:[],enemyBuffEvents:[],friendlyAuraEvents:[]});
 const f=r.failures.find(x=>x.mechanicKey==='radiant-echoes');assert.ok(f);assert.equal(f.confidence,'high');
});

test('Guardian Edict empowerment aura is a confirmed failed execution signal',()=>{
 const fights=[{id:1,startTime:0,endTime:10000}];
 const r=analyzeEncounterMechanics({pack:BELOREN,fights,damageEvents:[],castEvents:[{fight:1,timestamp:3000,type:'begincast',sourceID:90,ability:1261217}],enemyBuffEvents:[{fight:1,timestamp:3500,type:'applybuff',sourceID:90,ability:1260826}],friendlyAuraEvents:[]});
 const f=r.failures.find(x=>x.mechanicKey==='guardian-edict');assert.ok(f);assert.equal(f.confidence,'confirmed');
 const m=r.mechanics.find(x=>x.key==='guardian-edict');assert.equal(m.scoreable,true);assert.equal(m.failedOccurrences,1);
});

test('death chain prefers severe recent player-linked mechanic evidence',()=>{
 const deathAnalysis={meaningfulByFight:{1:[{fightId:1,actorId:5,player:'P',timestampReportMs:10000,fightRelativeMs:10000,killingBlow:'Burning Heart'}]}};
 const failures=[{fightId:1,actorId:5,timestampReportMs:7000,mechanicKey:'incubation-light',mechanicName:'Light Flames',reason:'wrong color',severity:5,confidence:'high'},{fightId:1,actorId:null,timestampReportMs:2000,mechanicKey:'guardian-edict',mechanicName:"Guardian's Edict",reason:'buff',severity:5,confidence:'confirmed'}];
 const d=buildDeathChains({deathAnalysis,mechanicFailures:failures,windowMs:10000});assert.equal(d.chains[0].probableCause.mechanicKey,'incubation-light');
});

test('blocker ranking rewards recurrence and linked deaths using occurrence-normalized counts',()=>{
 const mechanicsAnalysis={
   mechanics:[{key:'A',name:'A',severity:5,scoreable:true,failedOccurrences:2,opportunities:4,denominatorStatus:'normalized'},{key:'B',name:'B',severity:3,scoreable:true,failedOccurrences:1,opportunities:4,denominatorStatus:'normalized'}],
   failures:[{fightId:1,mechanicKey:'A',occurrenceKey:'a1'},{fightId:2,mechanicKey:'A',occurrenceKey:'a2'},{fightId:3,mechanicKey:'B',occurrenceKey:'b1'}]
 };
 const deathChains={chains:[{probableCause:{mechanicKey:'A'}},{probableCause:{mechanicKey:'A'}}]};
 const r=findCurrentBlocker({mechanicsAnalysis,deathChains,recentFightIds:[1,2,3]});assert.equal(r.blocker.key,'A');assert.equal(r.confidence,'high');
});

test('Belo-ren boss Rebirth is observational and never counted as Ember Rebirth',()=>{
 const ember=BELOREN.mechanics.find(m=>m.key==='ember-rebirth');
 const boss=BELOREN.mechanics.find(m=>m.key==='boss-rebirth');
 assert.deepEqual(ember.castIds,[1263412]);
 assert.ok(!ember.castIds.includes(1241313));
 assert.ok(boss.castIds.includes(1241313));
 assert.equal(boss.scoreable,false);
 const fights=[{id:1,startTime:0,endTime:60000}];
 const r=analyzeEncounterMechanics({pack:BELOREN,fights,damageEvents:[],friendlyAuraEvents:[],enemyBuffEvents:[],castEvents:[
   {fight:1,timestamp:10000,type:'begincast',sourceID:90,ability:1241313},
   {fight:1,timestamp:15000,type:'cast',sourceID:90,ability:1241313},
   {fight:1,timestamp:30000,type:'begincast',sourceID:91,ability:1263412},
   {fight:1,timestamp:35000,type:'cast',sourceID:91,ability:1263412}
 ]});
 assert.equal(r.failures.filter(f=>f.mechanicKey==='boss-rebirth').length,0);
 assert.equal(r.mechanics.find(m=>m.key==='ember-rebirth').failedOccurrences,1);
});

test('one Dive execution with several wrong-colour players is one failed execution but several exposures',()=>{
 const fights=[{id:1,startTime:0,endTime:20000}];
 const auras=[1,2,3,4,5].map(id=>({fight:1,timestamp:100,type:'applybuff',targetID:id,ability:1241163}));
 const hits=[1,2,3,4,5].map(id=>({fight:1,timestamp:5000,targetID:id,ability:1241291}));
 const r=analyzeEncounterMechanics({pack:BELOREN,fights,friendlyAuraEvents:auras,damageEvents:hits,castEvents:[{fight:1,timestamp:4500,type:'begincast',sourceID:90,ability:1241292}],enemyBuffEvents:[]});
 const m=r.mechanics.find(x=>x.key==='light-dive');
 assert.equal(m.opportunities,1);
 assert.equal(m.failedOccurrences,1);
 assert.equal(m.playerExposures,5);
 assert.equal(m.executionSuccessPct,0);
});

test('Mythic Quill splash is observed without assigning individual player failures',()=>{
 const fights=[{id:1,startTime:0,endTime:20000}];
 const r=analyzeEncounterMechanics({pack:BELOREN,fights,friendlyAuraEvents:[],enemyBuffEvents:[],castEvents:[{fight:1,timestamp:4000,type:'begincast',sourceID:90,ability:1241992}],damageEvents:[
   {fight:1,timestamp:5000,targetID:1,ability:1242093},
   {fight:1,timestamp:5001,targetID:2,ability:1242093},
   {fight:1,timestamp:5002,targetID:3,ability:1242093}
 ]});
 const m=r.mechanics.find(x=>x.key==='infused-quills-light');
 assert.equal(m.scoreable,false);
 assert.equal(m.observedIncidents,1);
 assert.equal(m.maxAffectedPlayers,3);
 assert.equal(r.failures.filter(f=>f.mechanicKey==='infused-quills-light').length,0);
});

test('duplicate Guardian empowerment aura rows collapse into one failed Edict occurrence',()=>{
 const fights=[{id:1,startTime:0,endTime:20000}];
 const r=analyzeEncounterMechanics({pack:BELOREN,fights,damageEvents:[],friendlyAuraEvents:[],castEvents:[{fight:1,timestamp:4000,type:'begincast',sourceID:90,ability:1261217}],enemyBuffEvents:[
   {fight:1,timestamp:4500,type:'applybuff',sourceID:90,ability:1260826},
   {fight:1,timestamp:4500,type:'applybuffstack',sourceID:90,ability:1260826},
   {fight:1,timestamp:4501,type:'refreshbuff',sourceID:90,ability:1260826}
 ]});
 const m=r.mechanics.find(x=>x.key==='guardian-edict');
 assert.equal(m.opportunities,1);
 assert.equal(m.failedOccurrences,1);
 assert.equal(r.failures.filter(f=>f.mechanicKey==='guardian-edict').length,1);
});

test('mechanical accuracy is based on failed mechanic executions, not player exposure rows',()=>{
 const fights=[{id:1,startTime:0,endTime:20000}];
 const auras=[1,2,3,4,5].map(id=>({fight:1,timestamp:100,type:'applybuff',targetID:id,ability:1241163}));
 const hits=[1,2,3,4,5].map(id=>({fight:1,timestamp:5000,targetID:id,ability:1241291}));
 const r=analyzeEncounterMechanics({pack:{...BELOREN,mechanics:[BELOREN.mechanics.find(m=>m.key==='light-dive')]},fights,friendlyAuraEvents:auras,damageEvents:hits,castEvents:[{fight:1,timestamp:4500,type:'begincast',sourceID:90,ability:1241292}],enemyBuffEvents:[]});
 assert.equal(r.summary.opportunities,1);
 assert.equal(r.summary.failedOccurrences,1);
 assert.equal(r.summary.playerExposures,5);
 assert.equal(r.summary.mechanicalAccuracy,0);
});
