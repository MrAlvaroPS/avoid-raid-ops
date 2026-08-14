import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeEncounterMechanics } from '../../server/analysis/mechanics/encounter-rule-engine.mjs';

const fight={id:1,startTime:0,endTime:120000};
const base=(overrides={})=>({fight:1,timestamp:10000,type:'damage',sourceID:100,targetID:1,ability:999,...overrides});

test('periodic failure damage is collapsed into one player incident',()=>{
  const pack={version:'t',auras:{},mechanics:[{key:'r',name:'R',category:'orb',severity:5,scoreable:true,castIds:[500],failureDamageIds:[999],inference:'failure-damage-by-occurrence',expectedAction:'x'}]};
  const damage=[0,1000,2000,3000].map((d,i)=>base({timestamp:10000+d,targetID:7,ability:999}));
  const out=analyzeEncounterMechanics({pack,fights:[fight],damageEvents:damage,castEvents:[],enemyBuffEvents:[],friendlyAuraEvents:[]});
  assert.equal(out.failures.length,1);
  assert.equal(out.failures[0].actorId,7);
  assert.equal(out.failures[0].evidence.hitCount,4);
});

test('raid-wide interrupt failure fan-out is one failure, not one per target',()=>{
  const pack={version:'t',auras:{},mechanics:[{key:'e',name:'Eruption',category:'interrupt',severity:5,scoreable:true,castIds:[777],damageIds:[777],inference:'completed-damage-is-failure',expectedAction:'interrupt'}]};
  const damage=Array.from({length:20},(_,i)=>base({timestamp:20000+(i%3),targetID:i+1,ability:777}));
  const casts=[{fight:1,timestamp:18000,type:'begincast',sourceID:900,ability:777}];
  const out=analyzeEncounterMechanics({pack,fights:[fight],damageEvents:damage,castEvents:casts,enemyBuffEvents:[],friendlyAuraEvents:[]});
  assert.equal(out.failures.length,1);
  assert.equal(out.failures[0].actorId,null);
  assert.equal(out.failures[0].evidence.affectedPlayers,20);
});

test('begin-cast is an opportunity, only cast completion is a failure',()=>{
  const pack={version:'t',auras:{},mechanics:[{key:'egg',name:'Rebirth',category:'add',severity:5,scoreable:true,castIds:[123],inference:'completed-cast-is-failure',expectedAction:'kill egg'}]};
  const casts=[
    {fight:1,timestamp:30000,type:'begincast',sourceID:700,ability:123},
    {fight:1,timestamp:34000,type:'cast',sourceID:700,ability:123}
  ];
  const out=analyzeEncounterMechanics({pack,fights:[fight],damageEvents:[],castEvents:casts,enemyBuffEvents:[],friendlyAuraEvents:[]});
  assert.equal(out.mechanics[0].opportunities,1);
  assert.equal(out.failures.length,1);
  assert.equal(out.failures[0].evidence.eventType,'cast');
});
