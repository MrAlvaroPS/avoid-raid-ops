import { modelDiagnostics as baseDiagnostics } from './compiler.mjs';
import { discoverVariantFamilies, discoverRelationCandidates, importantSignals, resolvedAbilityIds, semanticCoverage } from './discovery.mjs';

const num=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=v=>Math.max(0,Math.min(1,num(v)));
const pct=v=>Math.round(clamp(v)*1000)/10;
const grade=s=>s>=95?'VERIFIED':s>=85?'MATURE':s>=70?'STRONG':s>=50?'PARTIAL':s>=25?'LEARNING':'DISCOVERY';
const primary=m=>{const x=Number(m?.generated?.primaryAbilityId??m?.primaryAbilityId);if(Number.isFinite(x))return x;for(const k of ['castIds','damageIds','failureDamageIds','failureAuraIds','auraIds']){const n=Number(m?.[k]?.[0]);if(Number.isFinite(n))return n;}return null;};
const mechanicWeight=m=>Math.max(.5,num(m?.generated?.semanticWeight)||1);

function familyIds(f){
  const memberIds=(f?.members||[]).map(m=>Number(m?.id)).filter(Number.isFinite);
  if(memberIds.length)return new Set(memberIds);
  return new Set(Object.values(f?.primary||{}).map(Number).filter(Number.isFinite));
}
function familySnapshots(families,dims){
  const supported=new Set((dims||[]).map(d=>d.tokenGroup));
  return families.slice(0,50).map(f=>({
    key:f.key,base:f.base,tokenGroup:f.tokenGroup,primary:f.primary,confidence:f.confidence,
    auraScore:f.auraScore,damageScore:f.damageScore,castScore:f.castScore,
    memberCount:familyIds(f).size,memberIds:[...familyIds(f)].slice(0,24),encounterSupported:supported.has(f.tokenGroup),
  }));
}
function effectiveFamilies(model,aggregate){
  const train=aggregate?.splits?.train;
  if(train?.abilities&&Object.keys(train.abilities).length)return discoverVariantFamilies(train);
  return (model?.discovery?.variantFamilies||[]).map(f=>({...f,members:(f.memberIds||Object.values(f.primary||{})).map(id=>({id:Number(id)}))}));
}
function familyForDimension(d,families){
  const direct=families.find(f=>f.tokenGroup===d.tokenGroup&&f.base===d.key);if(direct)return direct;
  const dIds=new Set(Object.values(d.values||{}).flatMap(v=>v?.ids||[]).map(Number));
  return families.find(f=>f.tokenGroup===d.tokenGroup&&[...familyIds(f)].some(id=>dIds.has(id)))||null;
}
function purity(d,families){const f=familyForDimension(d,families),a=f?num(f.auraScore):num(d?.evidence?.auraScore),active=f?Math.max(num(f.damageScore),num(f.castScore)):0;return clamp(a-.78*active);}

export function selectCanonicalStateDimensionsV372(model={},aggregate=null){
  const families=effectiveFamilies(model,aggregate),dims=model?.discovery?.stateDimensions||model?.pack?.stateDimensions||[],best=new Map();
  for(const d of dims){
    const siblings=families.filter(f=>f.tokenGroup===d.tokenGroup&&f.base!==d.key&&Math.max(num(f.damageScore),num(f.castScore))>=.12);
    const q=purity(d,families);if(siblings.length<2||q<.35||num(d.confidence)<.62)continue;
    const row={...d,originPolicy:'encounter-supported-canonical-state-v2',originEvidence:{siblingEncounterFamilies:siblings.length,statePurity:Math.round(q*1000)/1000}};
    const prev=best.get(d.tokenGroup),score=q*.78+clamp(d.confidence)*.22,prevScore=prev?purity(prev,families)*.78+clamp(prev.confidence)*.22:-1;
    if(!prev||score>prevScore)best.set(d.tokenGroup,row);
  }
  return[...best.values()];
}
function familyForAbility(id,families,tokenGroup){return families.find(f=>(!tokenGroup||f.tokenGroup===tokenGroup)&&familyIds(f).has(Number(id)))||null;}
function keepMechanic(m,dims,families){
  if(!m.requiredState)return{keep:true};
  const d=dims.find(x=>x.key===m.requiredState.dimension);if(!d)return{keep:false,reason:'state-dimension-filtered'};
  const f=familyForAbility(primary(m),families,d.tokenGroup);if(!f)return{keep:false,reason:'no-mirrored-encounter-family'};
  if(f.base===d.key)return{keep:false,reason:'state-aura-not-mechanic'};
  return{keep:true,familyKey:f.key,familyBase:f.base};
}

function castDamageRelations(aggregate,families){
  const rows=aggregate?.splits?.train?.relations?.castToDamage||{},out=[];
  for(const r of Object.values(rows)){
    const k=r.kill||{},w=r.wipe||{},kd=num(k.sourceOccurrences),wd=num(w.sourceOccurrences);if(kd+wd<8)continue;
    const kr=kd?num(k.linkedOccurrences)/kd:0,wr=wd?num(w.linkedOccurrences)/wd:0,assoc=Math.max(kr,wr);if(assoc<.08)continue;
    const linked=num(k.linkedOccurrences)+num(w.linkedOccurrences),f=families.find(x=>familyIds(x).has(Number(r.sourceId)));
    out.push({type:'cast-to-damage',sourceId:Number(r.sourceId),targetId:Number(r.targetId),familyKey:f?.key||null,tokenGroup:f?.tokenGroup||null,killRate:kr,wipeRate:wr,lift:wr-kr,meanDeltaMs:linked?(num(k.deltaTotalMs)+num(w.deltaTotalMs))/linked:null,evidenceN:kd+wd,confidence:clamp(.42+.30*clamp(assoc/.7)+.18*clamp((kd+wd)/60)+.10*clamp(Math.abs(wr-kr)/.35))});
  }
  return out.sort((a,b)=>b.confidence-a.confidence).slice(0,50);
}
function mechRelationScore(m){
  if(m.semanticInference==='enemy-aura-after-cast'||m.inference==='failure-aura-is-failure')return 1;
  if(m.inference==='wrong-state-impact')return 1;
  if(m.category==='interrupt'&&m.requiredState)return .88;
  if(m.category==='interrupt'||m.inference==='completed-cast-is-failure')return .82;
  if(m.inference==='failure-damage-by-occurrence')return .72;
  if(m.inference==='stateful-impact-observed')return .48;
  if(m.inference==='stateful-cast-observed')return .35;
  return null;
}
function relationUnderstanding(mechanics,candidates,damageRelations){
  let sum=0,weight=0;for(const m of mechanics){const s=mechRelationScore(m);if(s==null)continue;const w=mechanicWeight(m);sum+=s*w;weight+=w;}
  const accepted=new Set(mechanics.map(primary).filter(Number.isFinite));
  const bonusAura=Math.min(.10,(candidates||[]).filter(r=>num(r.confidence)>=.62).length*.025);
  const bonusDamage=Math.min(.10,(damageRelations||[]).filter(r=>r.confidence>=.58&&(accepted.has(r.sourceId)||accepted.has(r.targetId))).length*.0125);
  return clamp((weight?sum/weight:0)+bonusAura+bonusDamage);
}

function recalculatedSignalCoverage(train,mechanics,filtered,legacy){
  if(!train?.abilities)return{score:clamp(num(legacy?.scorePct??legacy?.score)/100),resolved:num(legacy?.resolved),total:num(legacy?.total),criticalUnresolved:legacy?.criticalUnresolved||[],signals:[]};
  const ignored=new Set((filtered||[]).map(x=>Number(x.primaryAbilityId)).filter(Number.isFinite));
  const signals=importantSignals(train).filter(s=>!ignored.has(Number(s.id)));
  if(!signals.length)return{score:1,resolved:0,total:0,criticalUnresolved:[],signals:[],ignored:[...ignored]};
  const resolved=resolvedAbilityIds(mechanics);let totalWeight=0,resolvedWeight=0;const unresolved=[];
  for(const s of signals){totalWeight+=s.importance;if(resolved.has(Number(s.id)))resolvedWeight+=s.importance;else unresolved.push(s);}
  return{score:clamp(totalWeight?resolvedWeight/totalWeight:1),resolved:signals.length-unresolved.length,total:signals.length,criticalUnresolved:unresolved.filter(x=>x.importance>=.48).slice(0,8),signals:signals.slice(0,40),ignored:[...ignored]};
}
function recalculatedValidation(mechanics,signal){
  const rows=mechanics.filter(m=>Number.isFinite(Number(m?.generated?.validationScore)));const weight=rows.reduce((s,m)=>s+mechanicWeight(m),0);
  const mean=weight?rows.reduce((s,m)=>s+num(m.generated.validationScore)*mechanicWeight(m),0)/weight:0;
  const breadth=signal.total?clamp(mechanics.reduce((s,m)=>s+mechanicWeight(m),0)/Math.max(4,signal.total*1.2)):1;
  return{mean,confidence:clamp(mean*(.68+.32*breadth)),breadth};
}
function deficits(model){
  const c=model.corpus||{},t=model?.validation?.thresholds||{},wide=num(c.killPulls)+num(c.wipePulls),deep=num(c.deepKillPulls)+num(c.deepWipePulls);
  return{widePulls:Math.max(0,num(t.minWidePulls)-wide),deepPulls:Math.max(0,num(t.minDeepPulls)-deep),wideReports:Math.max(0,num(t.minWideReports)-num(c.wideReports)),deepReports:Math.max(0,num(t.minDeepReports)-num(c.deepReports)),validationReports:Math.max(0,num(t.minValidationReports)-num(c.validationReports)),independentSources:Math.max(0,num(t.minIndependentSources)-num(c.independentSources)),validationSources:Math.max(0,num(t.minValidationSources)-num(c.validationSources))};
}
function plan(model,components){
  const d=deficits(model),c=model.corpus||{},rel=num(components.relationUnderstandingPct),data=num(components.dataDepthPct);
  const currentDeep=num(c.deepKillPulls)+num(c.deepWipePulls),avgDeep=num(c.deepReports)>0?currentDeep/num(c.deepReports):8;
  const deepForReportGate=Math.ceil(d.deepReports*Math.max(1,avgDeep)),targetedDeepPulls=Math.max(d.deepPulls,deepForReportGate);
  let priority='medium',mode='wide-and-deep',reason='Increase representative Wide and Deep evidence while preserving source diversity.';
  let addWide=d.widePulls,addDeep=d.deepPulls,addWideReports=d.wideReports,addDeepReports=d.deepReports;
  if(rel<65&&data>=42){priority='high';mode='targeted-deep';reason='Relationship understanding is the main bottleneck. Deep-profile existing Wide reports first; do not spend WCL on new Wide discovery yet.';addWide=0;addWideReports=0;addDeep=Math.max(20,targetedDeepPulls);}
  else if(d.independentSources||d.validationSources){priority='high';mode='diversity-first';reason='Independent-source coverage is below target. Add new raid groups before repeated pulls from represented sources.';}
  else if(d.wideReports||d.deepReports||d.validationReports){mode='reports-first';reason='Report breadth, not only pull volume, is limiting publication. Prefer distinct reports and isolated holdout evidence.';}
  else if(num(model?.learning?.scorePct)>=82){priority='low';mode='review-or-publish';reason='The model is mature enough for review. Enrich only against explicit remaining safety gates.';}
  return{priority,mode,reason,suggestedAdditionalWidePulls:Math.min(2000,Math.max(0,Math.ceil(addWide/100)*100)),suggestedAdditionalDeepPulls:Math.min(500,Math.max(0,Math.ceil(addDeep/10)*10)),suggestedAdditionalWideReports:addWideReports,suggestedAdditionalDeepReports:addDeepReports,suggestedAdditionalValidationReports:d.validationReports,suggestedAdditionalIndependentSources:d.independentSources,suggestedAdditionalValidationSources:d.validationSources,estimatedExistingWideReportsAvailableForDeep:Math.max(0,num(c.wideReports)-num(c.deepReports)),deficits:d};
}
function enrichmentFocus(model,mechanics){
  const ids=new Set();
  for(const r of [...(model.rejected||[])].sort((a,b)=>Math.max(num(b.validationScore),num(b.trainingConfidence))-Math.max(num(a.validationScore),num(a.trainingConfidence))).slice(0,6)){const id=Number(r.primaryAbilityId);if(Number.isFinite(id))ids.add(id);}
  for(const m of mechanics.filter(m=>m.requiredState).slice(0,20)){const id=primary(m);if(Number.isFinite(id))ids.add(id);}
  return[...ids].slice(0,24);
}
function highlights(dims,mechanics,candidates,damageRelations){
  const out=[];for(const d of dims)out.push({kind:'state',title:`${Object.keys(d.values||{}).join(' / ')} state system`,detail:`${d.key} · ${Math.round(num(d.confidence)*100)}% confidence`});
  const stateful=mechanics.filter(m=>m.requiredState),ints=mechanics.filter(m=>m.category==='interrupt'),causal=(candidates||[]).filter(r=>num(r.confidence)>=.62),seq=damageRelations.filter(r=>r.confidence>=.58);
  if(stateful.length)out.push({kind:'relationship',title:`${stateful.length} state-linked mechanics`,detail:'Encounter-family membership retained after origin filtering'});
  if(ints.length)out.push({kind:'interrupt',title:`${ints.length} interrupt windows`,detail:'Completion behaviour validates as execution-sensitive'});
  if(causal.length)out.push({kind:'causal',title:`${causal.length} causal aura relations`,detail:'Cast → enemy-aura evidence is now connected'});
  if(seq.length)out.push({kind:'sequence',title:`${seq.length} cast → damage sequences`,detail:'Deep temporal evidence connects casts with downstream impact'});
  return out.slice(0,4);
}
function needs(model,filtered,components,rec){
  const out=[],rejected=[...(model.rejected||[])].filter(r=>r.inference!=='encounter-origin-filter').sort((a,b)=>Math.max(num(b.validationScore),num(b.trainingConfidence))-Math.max(num(a.validationScore),num(a.trainingConfidence)));
  if(components.relationUnderstandingPct<65)out.push({kind:'relations',title:'Mechanic relationships',detail:'More Deep temporal and per-target evidence is needed before observed state links become fully understood.',confidencePct:Math.round(components.relationUnderstandingPct)});
  for(const r of rejected.slice(0,3))out.push({kind:'mechanic',title:r.name||r.key,detail:r.reason==='training-confidence'?'Training evidence is below the acceptance threshold.':'The pattern did not reproduce strongly enough in isolated holdout.',confidencePct:Math.round(Math.max(num(r.trainingConfidence),num(r.validationScore))*100)});
  if(filtered.length)out.push({kind:'filter',title:`${filtered.length} non-encounter signals excluded`,detail:'Unpaired player/item/talent-like polarity is outside the encounter model.'});
  if(rec.deficits.deepReports)out.push({kind:'data',title:`${rec.deficits.deepReports} Deep reports below gate`,detail:'Existing Wide reports can be upgraded before discovering new reports.'});
  return out.slice(0,5);
}

export function applyEncounterPolicyV372(input,aggregate=null){
  if(!input)return null;
  const model=structuredClone(input),train=aggregate?.splits?.train||null,families=effectiveFamilies(model,aggregate),dims=selectCanonicalStateDimensionsV372(model,aggregate),allowed=new Set(dims.map(d=>d.key));
  const mechanics=[],filtered=[];
  for(const m of model?.pack?.mechanics||[]){const verdict=keepMechanic(m,dims,families);if(verdict.keep)mechanics.push(verdict.familyKey?{...m,generated:{...(m.generated||{}),encounterFamilyKey:verdict.familyKey}}:m);else filtered.push({key:m.key,name:m.name,reason:verdict.reason,primaryAbilityId:primary(m)});}
  const relationCandidates=train?discoverRelationCandidates(train,families):(model?.discovery?.relationCandidates||[]),damageRelations=castDamageRelations(aggregate,families);
  const signal=recalculatedSignalCoverage(train,mechanics,filtered,model?.learning?.signalCoverage),validation=recalculatedValidation(mechanics,signal);
  const technical=train?semanticCoverage(train,mechanics,dims,families,relationCandidates):null,rel=relationUnderstanding(mechanics,relationCandidates,damageRelations);
  const old=model.learning?.components||{},components={signalDiscoveryPct:pct(signal.score),relationUnderstandingPct:pct(rel),validationConfidencePct:pct(validation.confidence),dataDepthPct:num(old.dataDepthPct),sourceDiversityPct:num(old.sourceDiversityPct||old.diversityPct)};
  Object.assign(components,{signalCoveragePct:components.signalDiscoveryPct,holdoutPct:components.validationConfidencePct,diversityPct:components.sourceDiversityPct,semanticResolutionPct:components.relationUnderstandingPct});
  let raw=(.25*components.signalDiscoveryPct+.25*components.relationUnderstandingPct+.20*components.validationConfidencePct+.20*components.dataDepthPct+.10*components.sourceDiversityPct)/100;const caps=[];
  if(components.relationUnderstandingPct<40){raw=Math.min(raw,.69);caps.push('relations-under-resolved');}else if(components.relationUnderstandingPct<55){raw=Math.min(raw,.79);caps.push('relations-partial');}
  if(signal.criticalUnresolved.length){raw=Math.min(raw,.79);caps.push('critical-unresolved-signals');}if(components.dataDepthPct<30){raw=Math.min(raw,.59);caps.push('data-depth-thin');}
  const scorePct=Math.round(clamp(raw)*1000)/10,bottleneck=Object.entries({signalDiscoveryPct:components.signalDiscoveryPct,relationUnderstandingPct:components.relationUnderstandingPct,validationConfidencePct:components.validationConfidencePct,dataDepthPct:components.dataDepthPct,sourceDiversityPct:components.sourceDiversityPct}).sort((a,b)=>a[1]-b[1])[0]?.[0]||'unknown';
  model.schemaVersion=Math.max(4,num(model.schemaVersion));model.engineVersion='3.7.2';model.policyVersion='encounter-origin-v2';model.status='candidate';
  model.discovery={...(model.discovery||{}),stateDimensions:dims,variantFamilies:familySnapshots(families,dims),relationCandidates:relationCandidates.slice(0,50),castDamageRelations:damageRelations,filteredStateDimensions:(model?.discovery?.stateDimensions||[]).filter(d=>!allowed.has(d.key)).map(d=>({key:d.key,tokenGroup:d.tokenGroup,reason:'encounter-origin-policy-v2'})),encounterOriginPolicy:{version:'v2',rule:'canonical aura state requires encounter-facing mirrored siblings; mechanics may use any observed member ID of a validated mirrored family'}};
  model.pack={...(model.pack||{}),stateDimensions:dims,mechanics};model.filtered={statefulMechanics:filtered,count:filtered.length};
  const previousRejected=(model.rejected||[]).filter(r=>r.inference!=='encounter-origin-filter');model.rejected=[...previousRejected,...filtered.map(r=>({...r,category:'filtered-signal',inference:'encounter-origin-filter',reason:'encounter-origin-policy-v2'}))];
  const rec=plan(model,components),focus=enrichmentFocus(model,mechanics),encounterFamilies=families.filter(f=>dims.some(d=>d.tokenGroup===f.tokenGroup));
  model.learning={...(model.learning||{}),meaning:'Evidence-weighted encounter-model maturity. It is not a literal percentage of every mechanic in the game.',scorePct,grade:grade(scorePct),components,bottleneck,caps,criticalUnresolvedSignals:signal.criticalUnresolved,signalCoverage:{resolved:signal.resolved,total:signal.total,ignoredNonEncounter:signal.ignored?.length||0},semantic:{resolvedNeeds:technical?.resolvedNeeds??0,totalNeeds:technical?.totalNeeds??0,stateDimensions:dims.length,variantFamilies:encounterFamilies.length,relationCandidates:relationCandidates.length},relationUnderstanding:{score:rel,scorePct:components.relationUnderstandingPct,stateDimensions:dims.length,candidateRelations:relationCandidates.length,castDamageRelations:damageRelations.length,meaning:'How well important encounter signals are connected into validated state, completion or temporal relationships.'},validationRecalculated:{meanScore:validation.mean,breadth:validation.breadth,confidenceScore:validation.confidence},learnedHighlights:highlights(dims,mechanics,relationCandidates,damageRelations),enrichmentRecommendation:rec,enrichmentFocusAbilityIds:focus};
  model.learning.needsEvidence=needs(model,filtered,components,rec);
  const thresholds={...(model?.validation?.thresholds||{}),minLearnedPct:82,minRelationUnderstanding:.60},checks={...(model?.validation?.publishChecks||{})};
  checks.acceptedMechanics=mechanics.length>0;checks.validationMean=validation.mean>=num(thresholds.minMeanScore||.66);checks.learningScore=scorePct>=82;checks.semanticCoverage=technical?technical.score>=num(thresholds.minSemanticCoverage||.70):Boolean(checks.semanticCoverage);checks.signalCoverage=signal.score>=num(thresholds.minSignalCoverage||.75);checks.criticalUnresolved=signal.criticalUnresolved.length<=num(thresholds.maxCriticalUnresolved||0);checks.relationUnderstanding=rel>=.60;checks.manualReviewHold=true;
  model.validation={...(model.validation||{}),acceptedMechanics:mechanics.length,rejectedMechanics:model.rejected.length,meanScore:validation.mean,publishChecks:checks,thresholds,publicationMode:'manual-review-hold-v3.7.2'};
  return model;
}

export function modelDiagnosticsV372(input,aggregate=null){
  const model=applyEncounterPolicyV372(input,aggregate);if(!model)return null;
  return{...baseDiagnostics(model),engineVersion:'3.7.2',learnedPct:model.learning.scorePct,learningGrade:model.learning.grade,learningComponents:model.learning.components,learningBottleneck:model.learning.bottleneck,relationUnderstanding:model.learning.relationUnderstanding,validationRecalculated:model.learning.validationRecalculated,learnedHighlights:model.learning.learnedHighlights,needsEvidence:model.learning.needsEvidence,enrichmentRecommendation:model.learning.enrichmentRecommendation,enrichmentFocusAbilityIds:model.learning.enrichmentFocusAbilityIds,filteredSignals:model.filtered,publishChecks:model.validation.publishChecks,thresholds:model.validation.thresholds,publicationMode:model.validation.publicationMode};
}
