import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEncounterPolicyV371, selectCanonicalStateDimensions } from '../../server/corpus/model-policy-v371.mjs';

const family=(key,base,tokenGroup,primary,{aura=0,damage=0,cast=0,confidence=1}={})=>({key,base,tokenGroup,primary,confidence,auraScore:aura,damageScore:damage,castScore:cast});
const dim=(key,tokenGroup,values,confidence=1)=>({key,tokenGroup,values,confidence,source:'mirrored-aura-family',evidence:{auraScore:1,balance:1}});
const mechanic=(id,name,requiredState,inference='stateful-impact-observed')=>({key:name.toLowerCase().replace(/\s+/g,'-'),name,category:'assignment',severity:4,requiredState,scoreable:false,inference,damageIds:[id],generated:{primaryAbilityId:id,semanticWeight:1.2,trainingConfidence:.9,validationScore:.9}});

function fixture(){
  const families=[
    family('light-void:feather','feather','light-void',{LIGHT:1241162,VOID:1241163},{aura:1}),
    family('light-void:dive','dive','light-void',{LIGHT:1241291,VOID:1241340},{damage:1,cast:1}),
    family('light-void:edict','edict','light-void',{LIGHT:1241646,VOID:1241676},{damage:1}),
    family('light-void:flames','flames','light-void',{LIGHT:1242803,VOID:1242815},{aura:.9,damage:1}),
    family('solar-lunar:eclipse','eclipse','solar-lunar',{SOLAR:48517,LUNAR:48518},{aura:.65}),
    family('red-blue:iridescence','iridescence','red-blue',{RED:386353,BLUE:386399},{aura:.08}),
  ];
  const dimensions=[
    dim('feather','light-void',{LIGHT:{ids:[1241162]},VOID:{ids:[1241163]}}),
    dim('flames','light-void',{LIGHT:{ids:[1242803]},VOID:{ids:[1242815]}},.98),
    dim('eclipse','solar-lunar',{SOLAR:{ids:[48517]},LUNAR:{ids:[48518]}},.91),
  ];
  const mechanics=[
    mechanic(1241291,'Light Dive',{dimension:'feather',value:'LIGHT'}),
    mechanic(1241340,'Void Dive',{dimension:'feather',value:'VOID'}),
    mechanic(448005,'Light of the Martyr',{dimension:'feather',value:'LIGHT'}),
    mechanic(386353,'Iridescence Red',{dimension:'iridescence',value:'RED'}),
    {key:'rebirth',name:'Rebirth',category:'dangerous-cast',severity:4,scoreable:true,inference:'completed-cast-is-failure',castIds:[1263412],generated:{primaryAbilityId:1263412,semanticWeight:1.6,trainingConfidence:1,validationScore:.9}},
  ];
  return {
    schemaVersion:2,engineVersion:'3.7.0',status:'candidate',encounterId:3182,difficulty:5,generatedAt:1,
    corpus:{wideReports:136,deepReports:26,killPulls:139,wipePulls:870,deepKillPulls:28,deepWipePulls:175,independentSources:136,validationSources:34,validationReports:34},
    validation:{acceptedMechanics:mechanics.length,rejectedMechanics:0,meanScore:.9,publishChecks:{},thresholds:{minWideReports:250,minDeepReports:50,minWidePulls:2500,minDeepPulls:300,minIndependentSources:50,minValidationSources:12,minValidationReports:50,minLearnedPct:82}},
    learning:{scorePct:79.8,grade:'STRONG',components:{dataDepthPct:55.5,holdoutPct:83.3,signalCoveragePct:72.2,semanticResolutionPct:100,diversityPct:100},criticalUnresolvedSignals:[]},
    discovery:{stateDimensions:dimensions,variantFamilies:families,relationCandidates:[]},
    pack:{id:3182,name:"Belo'ren",stateDimensions:dimensions,mechanics},rejected:[]
  };
}

test('v3.7.1 chooses an aura-dominant canonical encounter state and filters class-only polarity',()=>{
  const selected=selectCanonicalStateDimensions(fixture());
  assert.deepEqual(selected.map(x=>x.key),['feather']);
});

test('v3.7.1 filters singleton player/item-like state assignments while preserving mirrored encounter mechanics',()=>{
  const model=applyEncounterPolicyV371(fixture());
  const names=model.pack.mechanics.map(m=>m.name);
  assert.ok(names.includes('Light Dive'));
  assert.ok(names.includes('Void Dive'));
  assert.ok(names.includes('Rebirth'));
  assert.ok(!names.includes('Light of the Martyr'));
  assert.ok(!names.includes('Iridescence Red'));
  assert.equal(model.discovery.stateDimensions.length,1);
  assert.equal(model.discovery.stateDimensions[0].key,'feather');
  assert.equal(model.engineVersion,'3.7.1');
});

test('Boss Learned v2 exposes relation understanding and report-aware enrichment deficits',()=>{
  const model=applyEncounterPolicyV371(fixture());
  assert.ok(Number.isFinite(model.learning.components.relationUnderstandingPct));
  assert.ok(model.learning.components.relationUnderstandingPct < 100);
  assert.equal(model.learning.components.signalDiscoveryPct,72.2);
  assert.equal(model.learning.enrichmentRecommendation.suggestedAdditionalWideReports,114);
  assert.equal(model.learning.enrichmentRecommendation.suggestedAdditionalDeepReports,24);
  assert.equal(model.learning.enrichmentRecommendation.suggestedAdditionalValidationReports,16);
  assert.equal(model.validation.publishChecks.manualReviewHold,false);
});
