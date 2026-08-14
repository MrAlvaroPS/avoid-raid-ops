import test from 'node:test';
import assert from 'node:assert/strict';
import { extractRankingRows, rankingHasMore } from '../../server/corpus/ranking-source.mjs';
import { createAggregate, mergeDeepProfile } from '../../server/corpus/aggregate.mjs';
import { compileEncounterModel } from '../../server/corpus/compiler.mjs';
import { detectLexicalStatePairs } from '../../server/corpus/deep-profile.mjs';
import { classifyPullForAnalysis } from '../../server/analysis/pulls/pull-eligibility.mjs';

function side(overrides={}){
  return {begins:0,casts:0,interrupts:0,damageHits:0,damageOccurrences:0,damageTargets:0,deathLinks:0,phaseBoundaryCasts:0,...overrides};
}
function ability(name,kill={},wipe={}){
  return {id:123,name,type:null,wide:{kill:{},wipe:{}},deep:{kill:side(kill),wipe:side(wipe)},stateAlignment:{}};
}
function compilerAggregate({wideReports=2500,deepReports=300,validationReports=500}={}){
  const trainReports=wideReports-validationReports;
  return {
    schemaVersion:1,encounterId:9999,difficulty:5,partition:0,resolvedPartition:7,encounter:{name:'Synthetic Boss'},validationFraction:.2,
    wideReports,deepReports,killPulls:wideReports*2,wipePulls:wideReports*5,
    splits:{
      train:{wideReports:trainReports,deepReports:Math.max(0,deepReports-60),killReports:trainReports,wipeReports:trainReports,killPulls:trainReports*2,wipePulls:trainReports*5,statePairs:{},completeness:{},abilities:{'123':ability('Must Interrupt',{begins:200,casts:4,interrupts:185},{begins:220,casts:60,interrupts:150})}},
      validation:{wideReports:validationReports,deepReports:Math.min(60,deepReports),killReports:validationReports,wipeReports:validationReports,killPulls:validationReports*2,wipePulls:validationReports*5,statePairs:{},completeness:{},abilities:{'123':ability('Must Interrupt',{begins:100,casts:1,interrupts:92},{begins:120,casts:35,interrupts:80})}}
    }
  };
}

test('ranking parser extracts unique report/fight rows and pagination hints',()=>{
  const raw={data:[{report:{code:'AbCdEfGh1234'},fightID:7,rank:4},{reportCode:'ZXCVBNmasdf1',fightId:9}],has_more_pages:true};
  const rows=extractRankingRows(raw);
  assert.deepEqual(rows.map(x=>[x.reportCode,x.fightId]),[['AbCdEfGh1234',7],['ZXCVBNmasdf1',9]]);
  assert.equal(rankingHasMore(raw,1,rows),true);
});

test('deep aggregation refuses to learn from truncated event streams',()=>{
  const aggregate=createAggregate({encounterId:1,difficulty:5});
  const profile={
    code:'Truncated1234',
    completeness:{enemyCasts:false,friendDamage:true,interrupts:true,debuffs:false,buffs:false,deaths:true},
    abilities:{'123':{id:123,name:'Example'}},
    abilityStats:{'123':{kill:side({begins:100,casts:50,interrupts:30,damageHits:40,damageOccurrences:10,damageTargets:20,deathLinks:3,phaseBoundaryCasts:9}),wipe:side(),stateAlignment:{'light-void:test':{required:'LIGHT',kill:{match:10,mismatch:2,unknown:0},wipe:{match:0,mismatch:0,unknown:0}}}}},
    statePairs:[{key:'light-void:test',dimension:'test',values:{LIGHT:1,VOID:2},tokens:['light','void'],applications:100,conflicts:0}]
  };
  mergeDeepProfile(aggregate,profile);
  const split=aggregate.splits.train.deepReports?aggregate.splits.train:aggregate.splits.validation;
  const row=split.abilities['123'].deep.kill;
  assert.equal(row.begins,0,'truncated cast stream must not contribute cast denominators');
  assert.equal(row.casts,0);
  assert.equal(row.interrupts,30,'complete interrupt stream can still contribute');
  assert.equal(row.damageOccurrences,10,'complete damage stream can still contribute');
  assert.equal(row.deathLinks,3,'complete damage + death streams can contribute causal links');
  assert.deepEqual(split.abilities['123'].stateAlignment,{},'state inference requires complete damage + aura streams');
  assert.deepEqual(split.statePairs,{},'state dimensions require complete aura streams');
});

test('compiler publishes only after thousands-scale corpus and holdout gates pass',()=>{
  const model=compileEncounterModel(compilerAggregate(),{});
  assert.equal(model.status,'published');
  assert.equal(model.resolvedPartition,7);
  assert.ok(model.pack.mechanics.some(x=>x.category==='interrupt'));
  assert.equal(model.validation.publishChecks.wideReports,true);
  assert.equal(model.validation.publishChecks.deepReports,true);
  assert.equal(model.validation.publishChecks.validationReports,true);
  assert.equal(model.validation.publishChecks.validationMean,true);
});

test('compiler keeps a good model as candidate when deep pull sample is not yet large enough',()=>{
  const model=compileEncounterModel(compilerAggregate({wideReports:1200,deepReports:180,validationReports:240}),{});
  assert.equal(model.status,'candidate');
  assert.equal(model.validation.publishChecks.wideReports,true);
  assert.equal(model.validation.publishChecks.deepReports,true);
  assert.equal(model.validation.publishChecks.validationReports,true);
  assert.equal(model.validation.publishChecks.deepPulls,false);
});

test('lexical state detector can discover mutually named state candidates generically',()=>{
  const pairs=detectLexicalStatePairs({
    '10':{id:10,name:'Light Feather'},
    '11':{id:11,name:'Void Feather'},
    '12':{id:12,name:'Unrelated Ability'}
  });
  assert.equal(pairs.length,1);
  assert.equal(pairs[0].dimension,'feather');
  assert.deepEqual(pairs[0].values,{LIGHT:10,VOID:11});
});

test('WCL wipeCalledTime=0 is treated as unset, not an early called wipe',()=>{
  const verdict=classifyPullForAnalysis({id:1,startTime:1000,endTime:181000,kill:false,wipeCalledTime:0,bossPercentage:70,fightPercentage:45,phaseTransitions:[{id:1,startTime:1000},{id:2,startTime:90000}]});
  assert.equal(verdict.eligible,true);
  assert.equal(verdict.classification,'analytical-pull');
  assert.equal(verdict.evidence.wipeCalledRelativeMs,null);
});
