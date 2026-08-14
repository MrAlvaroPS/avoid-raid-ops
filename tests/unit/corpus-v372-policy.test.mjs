import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEncounterPolicyV372, selectCanonicalStateDimensionsV372 } from '../../server/corpus/model-policy-v372.mjs';
import { prioritizeWideProfilesForDeep } from '../../server/corpus/targeted-deep-v372.mjs';

const metric=(reportsWith=0)=>({reportsWith,count:reportsWith,total:reportsWith});
function ability(id,name,{aura=0,damage=0,cast=0}={}){
  const cohort={Casts:metric(cast),Damage:metric(damage),Buffs:metric(aura),Debuffs:metric(aura)};
  return{id,name,wide:{kill:structuredClone(cohort),wipe:structuredClone(cohort)},deep:{kill:{},wipe:{}}};
}
const dim=(key,tokenGroup,values,confidence=1)=>({key,tokenGroup,values,confidence,source:'mirrored-aura-family',evidence:{auraScore:1,balance:1}});
const mechanic=(id,name,value,validation=.9)=>({key:`m-${id}`,name,category:'assignment',severity:4,requiredState:{dimension:'feather',value},stateValueIds:[value==='LIGHT'?1241162:1241163],scoreable:false,inference:'stateful-impact-observed',damageIds:[id],generated:{primaryAbilityId:id,semanticWeight:1.2,trainingConfidence:.9,validationScore:validation}});

function fixture(){
  const abilities={};
  const add=(id,name,activity)=>abilities[String(id)]=ability(id,name,activity);
  add(1241162,'Light Feather',{aura:90});add(1241163,'Void Feather',{aura:88});
  add(1241291,'Light Dive',{damage:80,cast:80});add(1241340,'Void Dive',{damage:78,cast:78});
  add(1241646,'Light Edict',{damage:75});add(1241676,'Void Edict',{damage:75});
  add(1261217,'Light Edict',{damage:30});add(1261218,'Void Edict',{damage:30});
  add(1244348,'Light Burn',{damage:70,aura:65});add(1266404,'Void Burn',{damage:68,aura:63});
  add(448005,'Light of the Martyr',{damage:60,aura:60});
  add(1287955,'Rune of Void-Tainted Shell',{aura:50});
  add(48517,'Solar Eclipse',{aura:60});add(48518,'Lunar Eclipse',{aura:60});
  add(386353,'Red Iridescence',{aura:10});add(386399,'Blue Iridescence',{aura:10});
  add(1263412,'Rebirth',{cast:55});
  const train={killReports:40,wipeReports:62,killPulls:100,wipePulls:600,deepKillPulls:20,deepWipePulls:120,abilities,statePairs:{},relations:{castToEnemyAura:{},castToDamage:{}},sourceReports:{}};
  const dimensions=[
    dim('feather','light-void',{LIGHT:{ids:[1241162]},VOID:{ids:[1241163]}}),
    dim('burn','light-void',{LIGHT:{ids:[1244348]},VOID:{ids:[1266404]}},.98),
    dim('eclipse','solar-lunar',{SOLAR:{ids:[48517]},LUNAR:{ids:[48518]}},.91),
  ];
  const mechanics=[
    mechanic(1241291,'Light Dive','LIGHT',.86),mechanic(1241340,'Void Dive','VOID',.84),
    mechanic(1241646,'Light Edict','LIGHT',.88),mechanic(1241676,'Void Edict','VOID',.87),
    mechanic(1261217,'Light Edict','LIGHT',.72),mechanic(1261218,'Void Edict','VOID',.71),
    mechanic(1244348,'Light Burn','LIGHT',.9),mechanic(1266404,'Void Burn','VOID',.9),
    mechanic(448005,'Light of the Martyr','LIGHT',.99),mechanic(1287955,'Rune of Void-Tainted Shell','VOID',.99),
    {key:'rebirth',name:'Rebirth',category:'dangerous-cast',severity:4,scoreable:true,inference:'completed-cast-is-failure',castIds:[1263412],generated:{primaryAbilityId:1263412,semanticWeight:1.6,trainingConfidence:1,validationScore:.81}},
  ];
  return{
    model:{schemaVersion:3,engineVersion:'3.7.1',status:'candidate',encounterId:3182,difficulty:5,partition:4,resolvedPartition:4,generatedAt:1,
      corpus:{wideReports:136,deepReports:26,killPulls:139,wipePulls:870,deepKillPulls:28,deepWipePulls:175,independentSources:136,validationSources:34,validationReports:34},
      validation:{acceptedMechanics:mechanics.length,rejectedMechanics:0,meanScore:.99,publishChecks:{},thresholds:{minWideReports:250,minDeepReports:50,minWidePulls:2500,minDeepPulls:300,minIndependentSources:50,minValidationSources:12,minValidationReports:50,minMeanScore:.66,minLearnedPct:82,minSemanticCoverage:.70,minSignalCoverage:.75,maxCriticalUnresolved:0}},
      learning:{scorePct:79.8,grade:'STRONG',components:{dataDepthPct:55.5,holdoutPct:83.3,signalCoveragePct:99,semanticResolutionPct:100,diversityPct:100},criticalUnresolvedSignals:[],signalCoverage:{resolved:99,total:100},semantic:{stateDimensions:5}},
      discovery:{stateDimensions:dimensions,variantFamilies:[],relationCandidates:[]},pack:{id:3182,name:"Belo'ren",stateDimensions:dimensions,mechanics},rejected:[]},
    aggregate:{wideReports:136,deepReports:26,killPulls:139,wipePulls:870,deepKillPulls:28,deepWipePulls:175,splits:{train,validation:{...train,wideReports:34}},sourceReports:{}}
  };
}

test('v3.7.2 keeps the canonical Feather state and rejects class-only polarity',()=>{
  const {model,aggregate}=fixture();const dims=selectCanonicalStateDimensionsV372(model,aggregate);assert.deepEqual(dims.map(x=>x.key),['feather']);
});

test('v3.7.2 recognizes secondary IDs as members of a real mirrored encounter family',()=>{
  const {model,aggregate}=fixture();const out=applyEncounterPolicyV372(model,aggregate),names=out.pack.mechanics.map(m=>`${m.name}:${m.generated?.primaryAbilityId}`);
  assert.ok(names.includes('Light Edict:1261217'));assert.ok(names.includes('Void Edict:1261218'));
  assert.ok(!out.pack.mechanics.some(m=>m.name==='Light of the Martyr'));assert.ok(!out.pack.mechanics.some(m=>m.name==='Rune of Void-Tainted Shell'));
  assert.equal(out.discovery.stateDimensions.length,1);assert.equal(out.policyVersion,'encounter-origin-v2');
});

test('v3.7.2 recalculates signal and validation metrics after filtering and removes stale semantics',()=>{
  const {model,aggregate}=fixture();const out=applyEncounterPolicyV372(model,aggregate);
  assert.notEqual(out.learning.components.signalDiscoveryPct,99);assert.notEqual(out.validation.meanScore,.99);
  assert.equal(out.learning.semantic.stateDimensions,1);assert.equal(out.learning.semantic.relationCandidates,0);
  assert.equal(out.validation.publishChecks.manualReviewHold,true);assert.equal(out.engineVersion,'3.7.2');
});

test('targeted-deep planning spends zero new Wide pulls when relationships are the bottleneck',()=>{
  const {model,aggregate}=fixture();const out=applyEncounterPolicyV372(model,aggregate),rec=out.learning.enrichmentRecommendation;
  assert.equal(rec.mode,'targeted-deep');assert.equal(rec.suggestedAdditionalWidePulls,0);assert.equal(rec.suggestedAdditionalWideReports,0);
  assert.equal(rec.suggestedAdditionalDeepReports,24);assert.ok(rec.suggestedAdditionalDeepPulls>=180);assert.equal(rec.estimatedExistingWideReportsAvailableForDeep,110);
});

test('targeted Deep prioritizes persisted Wide reports containing focus abilities and keeps source diversity',()=>{
  const p=(code,guild,focus,best)=>({code,guild:{id:guild},kills:0,wipes:3,fights:[{fightPercentage:best}],tables:{wipeDamage:focus?{'1260826':{count:3}}:{}}});
  const rows=prioritizeWideProfilesForDeep([p('A',1,false,30),p('B',2,true,60),p('C',3,true,20),p('D',2,true,10)],[],[1260826]);
  assert.equal(rows[0].__focus,1);assert.ok(new Set(rows.slice(0,3).map(x=>x.__source)).size>=2);assert.ok(rows.some(x=>x.code==='A'));
});
