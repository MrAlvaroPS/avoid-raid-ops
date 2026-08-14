import test from 'node:test';
import assert from 'node:assert/strict';
import { abilityBreakdown,compositionIndex } from '../../server/wcl/normalization/tables.mjs';
import { firstCastByAbility,countByActor } from '../../server/wcl/normalization/events.mjs';
import { normalizePlayers } from '../../server/wcl/normalization/players.mjs';
import { normalizeStages,stageStart,stageCount } from '../../server/wcl/normalization/fights.mjs';
import { analyzeDeaths } from '../../server/analysis/deaths/death-events.mjs';
import { combatantProfiles } from '../../server/wcl/normalization/player-profiles.mjs';
import { clusterRaidSessions } from '../../server/analysis/progression/raid-sessions.mjs';

test('damage taken mechanics only come from ability arrays',()=>{const table={data:{entries:[{id:6,name:'Mechavalec',total:999,abilities:[{guid:1241932,name:'Voidlight Convergence',total:100}]},{id:16,name:'Qea',total:888,abilities:[{guid:1241932,name:'Voidlight Convergence',total:50},{guid:1264650,name:'Burning Heart',total:80}]}]}};const names=abilityBreakdown(table).map(x=>x.name);assert.deepEqual(names.sort(),['Burning Heart','Voidlight Convergence'].sort());assert.ok(!names.includes('Mechavalec'));assert.ok(!names.includes('Qea'));});
test('numeric ability IDs are recognized in event payloads',()=>{const m=firstCastByAbility([{timestamp:1100,ability:1241932}],1000);assert.equal(m.get('1241932').ms,100);});
test('composition summary supplies roles',()=>{const idx=compositionIndex({data:{composition:[{id:1,name:'Tank',type:'Warrior',specs:[{spec:'Protection',role:'tank'}]},{id:2,name:'Heal',type:'Shaman',specs:[{spec:'Restoration',role:'healer'}]}]}});assert.equal(idx.get('id:1').role,'TANK');assert.equal(idx.get('id:2').role,'HEAL');});
test('event actor counters count rows rather than nonexistent table totals',()=>{assert.equal(countByActor([{sourceID:7},{sourceID:7},{sourceID:3}],{actor:'source'}).get(7),2);assert.equal(countByActor([{targetID:4},{targetID:4}],{actor:'target'}).get(4),2);});

test('Belo-ren repeated semantic phase 1 becomes absolute stage 3',()=>{const fight={startTime:100,endTime:1000,lastPhaseAsAbsoluteIndex:2,phaseTransitions:[{id:1,startTime:100},{id:2,startTime:400},{id:1,startTime:700}]};const stages=normalizeStages(fight);assert.equal(stageCount(fight),3);assert.deepEqual(stages.map(s=>s.semanticPhaseId),[1,2,1]);assert.equal(stageStart(fight,3),700);});

test('death analysis separates raw, wipe-cutoff and first-death scopes',()=>{const fights=[{id:1,startTime:0,endTime:1000},{id:2,startTime:2000,endTime:3000}];const raw=[{fight:1,timestamp:100,targetID:1},{fight:1,timestamp:200,targetID:2},{fight:2,timestamp:2200,targetID:2}];const meaningful=[{fight:1,timestamp:100,targetID:1},{fight:2,timestamp:2200,targetID:2}];const d=analyzeDeaths({events:raw,meaningfulEvents:meaningful,fights});assert.equal(d.rawCount,3);assert.equal(d.meaningfulCount,2);assert.equal(d.firstDeathCount,2);assert.equal(d.firstDeathByPlayer.get(1),1);assert.equal(d.firstDeathByPlayer.get(2),1);});

test('combatant info normalizes gear/talents without inventing equipped average',()=>{const profiles=combatantProfiles({combatantEvents:[{sourceID:7,gear:[{id:111,itemLevel:290,slot:1},{id:222,itemLevel:292,slot:5},{id:0,itemLevel:0,slot:17}],talentTree:[{entry:10,node_id:20,rank:1},{entry:11,node_id:21,spellId:12345,rank:2}]}]});const p=profiles.get(7);assert.equal(p.gearCount,2);assert.equal(p.powerGearCount,2);assert.equal(p.recordedItemLevelMean,291);assert.equal(p.gearAverageItemLevel,null);assert.equal(p.gear[0].slot,'Head');assert.equal(p.gear[0].wowhead.url,'https://www.wowhead.com/item=111');assert.equal(p.talentCount,2);assert.equal(p.talentPoints,3);assert.ok(p.buildFingerprint.startsWith('build-'));assert.equal(p.talents[0].entryId,10);assert.match(p.talents[0].wowhead.url,/wowhead\.com\/search/);assert.equal(p.talents[1].wowhead.url,'https://www.wowhead.com/spell=12345');});

test('Belo-ren regression shape: player scopes keep best-pull and encounter data separate',()=>{const report={masterData:{actors:[{id:6,name:'Mechavalec',subType:'Warrior'},{id:1,name:'Txerokee',subType:'Shaman'}]}};const fight={startTime:0,endTime:100000,friendlyPlayers:[6,1],friendlySpecs:['Protection','Restoration'],friendlyItemLevels:[290,291]};const summary={data:{composition:[{id:6,name:'Mechavalec',type:'Warrior',specs:[{spec:'Protection',role:'tank'}]},{id:1,name:'Txerokee',type:'Shaman',specs:[{spec:'Restoration',role:'healer'}]}]}};const table=(rows)=>({data:{entries:rows}});const deathAnalysis={rawByPlayer:new Map([[1,4]]),meaningfulByPlayer:new Map([[1,2]]),firstDeathByPlayer:new Map([[1,1]])};const players=normalizePlayers({report,fight,bestSummary:summary,bestDamageDone:table([{id:6,name:'Mechavalec',total:8000}]),bestHealing:table([{id:1,name:'Txerokee',total:20000}]),bestDamageTaken:table([{id:6,name:'Mechavalec',total:10000},{id:1,name:'Txerokee',total:7000}]),allCasts:table([{id:6,name:'Mechavalec',total:100}]),interruptEvents:[{sourceID:6}],dispelEvents:[{sourceID:1}],deathAnalysis,encounterPulls:14});assert.equal(players[0].role,'TANK');assert.equal(players[1].role,'HEAL');assert.equal(players[0].encounter.interrupts,1);assert.equal(players[1].encounter.dispels,1);assert.equal(players[1].encounter.deaths,4);assert.equal(players[1].encounter.meaningfulDeaths,2);assert.equal(players[1].encounter.firstDeaths,1);assert.equal(players[0].bestPull.damage,8000);});

test('overlapping logger reports become one raid session and duplicate pulls are deduped',()=>{const r1={code:'A',title:'Logger A',startTime:100000,endTime:200000,fights:[{id:1,encounterID:3182,name:'Boss',difficulty:5,startTime:1000,endTime:61000,fightPercentage:80,bossPercentage:60,lastPhaseAsAbsoluteIndex:1,kill:false,inProgress:false,friendlyPlayers:Array(20)}]};const r2={code:'B',title:'Logger B',startTime:100500,endTime:200500,fights:[{id:9,encounterID:3182,name:'Boss',difficulty:5,startTime:600,endTime:60600,fightPercentage:80.2,bossPercentage:60,lastPhaseAsAbsoluteIndex:1,kill:false,inProgress:false,friendlyPlayers:Array(20)}]};const sessions=clusterRaidSessions([r1,r2]);assert.equal(sessions.length,1);assert.equal(sessions[0].sourceReports,2);assert.equal(sessions[0].pulls,1);assert.equal(sessions[0].deduplicatedPulls,1);});

test('talent placeholder names such as Spell null are sanitized instead of rendered as facts',()=>{
  const profiles=combatantProfiles({combatantEvents:[{sourceID:3,talentTree:[
    {entry:101,node_id:201,rank:1,name:'Spell null'},
    {entry:102,node_id:202,rank:1,name:'Node 202'},
    {entry:103,node_id:203,rank:1,spellId:77777,name:'Spell null'},
    {entry:104,node_id:204,rank:1,spellId:88888,name:'Real Talent'}
  ]}]});
  const p=profiles.get(3);
  assert.equal(p.talents[0].name,null);
  assert.equal(p.talents[1].name,null);
  assert.equal(p.talents[2].name,null);
  assert.equal(p.talents[3].name,'Real Talent');
  assert.equal(p.talents[2].wowhead.url,'https://www.wowhead.com/spell=77777');
});
