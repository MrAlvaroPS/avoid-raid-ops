import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { corpusSplit, reportSourceKey } from '../../server/corpus/aggregate.mjs';
import { discoverStateDimensions, discoverVariantFamilies, discoverRelationCandidates } from '../../server/corpus/discovery.mjs';
import { compileEncounterModel } from '../../server/corpus/compiler.mjs';
import { CORPUS_DEEP_EVENTS_QUERY } from '../../server/wcl/queries/corpus.mjs';

const side=(o={})=>({begins:0,casts:0,interrupts:0,damageHits:0,damageOccurrences:0,damageTargets:0,deathLinks:0,phaseBoundaryCasts:0,enemyBuffApplications:0,enemyDebuffApplications:0,...o});
function wideKind(reportsWith,count=reportsWith){return{reportsWith,count,total:0,rows:reportsWith};}
function ability(id,name,{kill={},wipe={},deepKill={},deepWipe={},stateAlignment={}}={}){return{id,name,type:null,wide:{kill,wipe},deep:{kill:side(deepKill),wipe:side(deepWipe)},stateAlignment};}

function stateSplit(){
  return{
    wideReports:100,deepReports:20,killReports:40,wipeReports:60,killPulls:80,wipePulls:240,deepKillPulls:20,deepWipePulls:60,sourceReports:{},deepSourceReports:{},statePairs:{},relations:{castToEnemyAura:{},castToDamage:{}},completeness:{},
    abilities:{
      '10':ability(10,'Light Feather',{kill:{Buffs:wideKind(38)},wipe:{Buffs:wideKind(58)}}),
      '11':ability(11,'Void Feather',{kill:{Buffs:wideKind(38)},wipe:{Buffs:wideKind(58)}}),
      '20':ability(20,'Light Dive',{kill:{Damage:wideKind(35)},wipe:{Damage:wideKind(55)},deepKill:{damageOccurrences:20,damageTargets:90},deepWipe:{damageOccurrences:60,damageTargets:300}}),
      '21':ability(21,'Void Dive',{kill:{Damage:wideKind(35)},wipe:{Damage:wideKind(55)},deepKill:{damageOccurrences:20,damageTargets:90},deepWipe:{damageOccurrences:60,damageTargets:300}}),
    }
  };
}

test('v3.7 train/holdout split is isolated by guild/uploader source rather than report code',()=>{
  const a={code:'AAAAAAAAAAAAAAAA',guild:{id:42},owner:{id:1}};
  const b={code:'BBBBBBBBBBBBBBBB',guild:{id:42},owner:{id:2}};
  const c={code:'CCCCCCCCCCCCCCCC',guild:null,owner:{id:99}};
  assert.equal(reportSourceKey(a),'guild:42');
  assert.equal(corpusSplit(a,.2),corpusSplit(b,.2),'same guild must never leak across train and holdout');
  assert.equal(reportSourceKey(c),'user:99');
});

test('v3.7 discovers an opposite-state aura dimension and related mechanic families without boss-specific IDs',()=>{
  const split=stateSplit();
  const families=discoverVariantFamilies(split);
  const dims=discoverStateDimensions(split);
  assert.ok(families.some(f=>f.key==='light-void:feather'));
  assert.ok(families.some(f=>f.key==='light-void:dive'));
  const feather=dims.find(d=>d.tokenGroup==='light-void');
  assert.ok(feather,'mirrored Light/Void aura family should expose a state dimension');
  assert.equal(feather.source,'mirrored-aura-family');
  assert.deepEqual(new Set(Object.values(feather.values).flatMap(v=>v.ids)),new Set([10,11]));
});

test('v3.7 relation discovery finds a wipe-enriched enemy aura after upstream casts',()=>{
  const split=stateSplit();
  split.abilities['30']=ability(30,'Light Edict',{kill:{Casts:wideKind(30)},wipe:{Casts:wideKind(50)},deepKill:{begins:30,casts:30},deepWipe:{begins:50,casts:50}});
  split.abilities['31']=ability(31,'Void Edict',{kill:{Casts:wideKind(30)},wipe:{Casts:wideKind(50)},deepKill:{begins:30,casts:30},deepWipe:{begins:50,casts:50}});
  split.abilities['40']=ability(40,"Guardian's Edict",{deepKill:{enemyBuffApplications:1},deepWipe:{enemyBuffApplications:20}});
  split.relations.castToEnemyAura={
    '30>40':{sourceId:30,targetId:40,targetKind:'buff',kill:{sourceOccurrences:30,linkedOccurrences:1,deltaTotalMs:1200},wipe:{sourceOccurrences:50,linkedOccurrences:16,deltaTotalMs:20000}},
    '31>40':{sourceId:31,targetId:40,targetKind:'buff',kill:{sourceOccurrences:30,linkedOccurrences:0,deltaTotalMs:0},wipe:{sourceOccurrences:50,linkedOccurrences:14,deltaTotalMs:19000}},
  };
  const rel=discoverRelationCandidates(split,discoverVariantFamilies(split));
  assert.ok(rel.some(r=>r.targetId===40&&r.triggerCastIds.includes(30)&&r.triggerCastIds.includes(31)));
});

test('v3.7 model exposes a learned percentage with actionable component breakdown',()=>{
  const train=stateSplit(),validation=stateSplit();
  train.sourceReports=Object.fromEntries(Array.from({length:60},(_,i)=>[`guild:${i}`,1]));
  validation.sourceReports=Object.fromEntries(Array.from({length:20},(_,i)=>[`guild:${100+i}`,1]));
  const aggregate={schemaVersion:2,encounterId:999,difficulty:5,partition:4,resolvedPartition:4,encounter:{name:'State Boss'},validationFraction:.2,wideReports:300,deepReports:70,killPulls:700,wipePulls:1900,deepKillPulls:90,deepWipePulls:230,sourceReports:{...train.sourceReports,...validation.sourceReports},deepSourceReports:{},discoveredSourcePool:100,splits:{train,validation}};
  const model=compileEncounterModel(aggregate,{});
  assert.equal(model.engineVersion,'3.7.0');
  assert.ok(Number.isFinite(model.learning.scorePct));
  assert.ok(model.learning.scorePct>=0&&model.learning.scorePct<=100);
  assert.ok(model.learning.components.semanticResolutionPct>=0);
  assert.ok(model.learning.enrichmentRecommendation?.mode);
  assert.equal(model.corpus.splitPolicy,'source-isolated-train-holdout');
});

test('v3.7 deep corpus query captures enemy buffs/debuffs for generic failure-signal discovery',()=>{
  assert.match(CORPUS_DEEP_EVENTS_QUERY,/enemyBuffs:events\(dataType:Buffs/);
  assert.match(CORPUS_DEEP_EVENTS_QUERY,/enemyDebuffs:events\(dataType:Debuffs/);
  assert.match(CORPUS_DEEP_EVENTS_QUERY,/hostilityType:Enemies/);
});

test('v3.7 UI exposes learned score, no-cost recompile and live resumeAt countdown',async()=>{
  const runtime=await readFile(new URL('../../public/wcl-runtime.js',import.meta.url),'utf8');
  assert.match(runtime,/BOSS LEARNED/);
  assert.match(runtime,/RECOMPILE · 0 WCL/);
  assert.match(runtime,/learningComponents/);
  assert.match(runtime,/corpusCountdown\(status\.resumeAt\)/);
  const api=await readFile(new URL('../../routes/api/wcl/corpus.js',import.meta.url),'utf8');
  assert.match(api,/action === 'recompile'/);
  assert.match(api,/recompileCorpusModel/);
});

test('v3.7 compiler keeps mirrored state mechanics semantic instead of flattening them to generic raid damage',()=>{
  const train=stateSplit(),validation=stateSplit();
  train.sourceReports=Object.fromEntries(Array.from({length:60},(_,i)=>[`guild:${i}`,1]));
  validation.sourceReports=Object.fromEntries(Array.from({length:20},(_,i)=>[`guild:${100+i}`,1]));
  const aggregate={schemaVersion:2,encounterId:999,difficulty:5,partition:4,resolvedPartition:4,encounter:{name:'State Boss'},validationFraction:.2,wideReports:300,deepReports:70,killPulls:700,wipePulls:1900,deepKillPulls:90,deepWipePulls:230,sourceReports:{...train.sourceReports,...validation.sourceReports},deepSourceReports:{},discoveredSourcePool:100,splits:{train,validation}};
  const model=compileEncounterModel(aggregate,{});
  const light=model.pack.mechanics.find(m=>m.name==='Light Dive');
  const voidDive=model.pack.mechanics.find(m=>m.name==='Void Dive');
  assert.equal(light?.category,'assignment');
  assert.equal(light?.inference,'stateful-impact-observed');
  assert.equal(light?.requiredState?.value,'LIGHT');
  assert.equal(voidDive?.category,'assignment');
  assert.equal(voidDive?.requiredState?.value,'VOID');
  assert.notEqual(light?.category,'raid-damage');
});

test('v3.7 compiler promotes a validated cast-to-enemy-aura relation into a generic failure rule',()=>{
  const makeSplit=(offset=0)=>{
    const split=stateSplit();
    split.sourceReports=Object.fromEntries(Array.from({length:offset?20:60},(_,i)=>[`guild:${offset+i}`,1]));
    split.abilities['30']=ability(30,'Light Edict',{kill:{Casts:wideKind(30)},wipe:{Casts:wideKind(50)},deepKill:{begins:30,casts:30},deepWipe:{begins:50,casts:50}});
    split.abilities['31']=ability(31,'Void Edict',{kill:{Casts:wideKind(30)},wipe:{Casts:wideKind(50)},deepKill:{begins:30,casts:30},deepWipe:{begins:50,casts:50}});
    split.abilities['40']=ability(40,"Guardian's Edict",{deepKill:{enemyBuffApplications:1},deepWipe:{enemyBuffApplications:20}});
    split.relations.castToEnemyAura={
      '30>40':{sourceId:30,targetId:40,targetKind:'buff',kill:{sourceOccurrences:30,linkedOccurrences:1,deltaTotalMs:1200},wipe:{sourceOccurrences:50,linkedOccurrences:16,deltaTotalMs:20000}},
      '31>40':{sourceId:31,targetId:40,targetKind:'buff',kill:{sourceOccurrences:30,linkedOccurrences:0,deltaTotalMs:0},wipe:{sourceOccurrences:50,linkedOccurrences:14,deltaTotalMs:19000}},
    };
    return split;
  };
  const train=makeSplit(0),validation=makeSplit(100);
  const aggregate={schemaVersion:2,encounterId:999,difficulty:5,partition:4,resolvedPartition:4,encounter:{name:'Relation Boss'},validationFraction:.2,wideReports:300,deepReports:70,killPulls:700,wipePulls:1900,deepKillPulls:90,deepWipePulls:230,sourceReports:{...train.sourceReports,...validation.sourceReports},deepSourceReports:{},discoveredSourcePool:100,splits:{train,validation}};
  const model=compileEncounterModel(aggregate,{});
  const rule=model.pack.mechanics.find(m=>m.failureAuraIds?.includes(40));
  assert.ok(rule);
  assert.equal(rule.inference,'failure-aura-is-failure');
  assert.equal(rule.semanticInference,'enemy-aura-after-cast');
  assert.deepEqual(new Set(rule.opportunityCastIds),new Set([30,31]));
  assert.equal(rule.scoreable,true);
});
