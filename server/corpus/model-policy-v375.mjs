import { applyEncounterPolicyV374 } from './model-policy-v374.mjs';
import { importantSignals, resolvedAbilityIds } from './discovery.mjs';

const num=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=v=>Math.max(0,Math.min(1,num(v)));
const pct=v=>Math.round(clamp(v)*1000)/10;
const grade=s=>s>=95?'VERIFIED':s>=85?'MATURE':s>=70?'STRONG':s>=50?'PARTIAL':s>=25?'LEARNING':'DISCOVERY';
const uniq=a=>[...new Set((a||[]).filter(x=>x!==null&&x!==undefined))];
const primary=m=>{const x=Number(m?.generated?.primaryAbilityId??m?.primaryAbilityId);if(Number.isFinite(x))return x;for(const k of ['failureAuraIds','castIds','damageIds','failureDamageIds','auraIds']){const n=Number(m?.[k]?.[0]);if(Number.isFinite(n))return n;}return null;};
const mechanicWeight=m=>Math.max(.5,num(m?.generated?.semanticWeight)||1);

export function isRelationDerivedMechanicV375(m={}){
  return m.semanticInference==='enemy-aura-after-cast'||m.inference==='failure-aura-is-failure'||m.inference==='enemy-aura-after-cast';
}
function relationSupportsMechanic(m,relations=[]){
  const target=primary(m),triggers=new Set((m.triggerCastIds||m.opportunityCastIds||[]).map(Number).filter(Number.isFinite));
  if(!Number.isFinite(target))return false;
  return relations.some(r=>{
    if(Number(r?.targetId)!==target)return false;
    if(!triggers.size)return true;
    return (r?.triggerCastIds||r?.edges?.map(e=>e.sourceId)||[]).map(Number).some(id=>triggers.has(id));
  });
}
export function filterRelationDerivedMechanicsV375(mechanics=[],verifiedRelations=[]){
  const kept=[],filtered=[];
  for(const m of mechanics||[]){
    if(!isRelationDerivedMechanicV375(m)||relationSupportsMechanic(m,verifiedRelations)){kept.push(m);continue;}
    filtered.push({key:m.key,name:m.name,primaryAbilityId:primary(m),triggerCastIds:m.triggerCastIds||[],category:'filtered-signal',inference:'relation-origin-filter',reason:'relation-origin-unverified-v1',scoreable:false});
  }
  return{kept,filtered};
}
function encounterExcludedIds(model){
  const out=new Set();
  for(const r of model?.rejected||[]){
    const reason=String(r?.reason||''),inf=String(r?.inference||'');
    if(reason.includes('encounter-origin')||inf.startsWith('encounter-origin-filter')){const id=Number(r.primaryAbilityId);if(Number.isFinite(id))out.add(id);}
  }
  for(const f of model?.discovery?.variantFamilies||[])for(const id of f?.excludedMemberIds||[])out.add(Number(id));
  return out;
}
function signalCoverage(train,mechanics,model){
  if(!train?.abilities)return{score:clamp(num(model?.learning?.components?.signalDiscoveryPct)/100),resolved:0,total:0,critical:[]};
  const excluded=encounterExcludedIds(model),signals=importantSignals(train).filter(s=>!excluded.has(Number(s.id))),resolved=resolvedAbilityIds(mechanics);
  let totalWeight=0,resolvedWeight=0;const unresolved=[];
  for(const s of signals){totalWeight+=num(s.importance);if(resolved.has(Number(s.id)))resolvedWeight+=num(s.importance);else unresolved.push(s);}
  return{score:clamp(totalWeight?resolvedWeight/totalWeight:1),resolved:signals.length-unresolved.length,total:signals.length,critical:unresolved.filter(x=>num(x.importance)>=.48).slice(0,8),signals:signals.slice(0,40)};
}
function validationConfidence(mechanics,signal){
  const rows=(mechanics||[]).filter(m=>Number.isFinite(Number(m?.generated?.validationScore))),weight=rows.reduce((s,m)=>s+mechanicWeight(m),0);
  const mean=weight?rows.reduce((s,m)=>s+num(m.generated.validationScore)*mechanicWeight(m),0)/weight:0;
  const breadth=signal.total?clamp((mechanics||[]).reduce((s,m)=>s+mechanicWeight(m),0)/Math.max(4,signal.total*1.2)):1;
  return{mean,breadth,confidence:clamp(mean*(.68+.32*breadth))};
}
function mechanicRelationScore(m){
  if(isRelationDerivedMechanicV375(m))return 1;
  if(m.inference==='wrong-state-impact')return .92;
  if(m.category==='interrupt'&&m.requiredState)return .88;
  if(m.category==='interrupt'||m.inference==='completed-cast-is-failure')return .82;
  if(m.inference==='failure-damage-by-occurrence')return .72;
  if(m.inference==='stateful-impact-observed')return .48;
  if(m.inference==='stateful-cast-observed')return .35;
  return null;
}
function relationUnderstanding(mechanics,verifiedRelations,damageRelations){
  let sum=0,weight=0;
  for(const m of mechanics||[]){const s=mechanicRelationScore(m);if(s==null)continue;const w=mechanicWeight(m);sum+=s*w;weight+=w;}
  let score=weight?sum/weight:0;
  const accepted=new Set((mechanics||[]).map(primary).filter(Number.isFinite));
  const verifiedAura=(verifiedRelations||[]).filter(r=>num(r.confidence)>=.62);
  const verifiedDamage=(damageRelations||[]).filter(r=>num(r.confidence)>=.58&&(accepted.has(Number(r.sourceId))||accepted.has(Number(r.targetId))));
  score+=Math.min(.10,verifiedAura.length*.025)+Math.min(.08,verifiedDamage.length*.0125);
  const temporalCount=verifiedAura.length+verifiedDamage.length;
  // State alignment and cast-completion evidence can establish partial structure, but without
  // a single origin-verified temporal edge the model cannot claim near-complete semantics.
  if(temporalCount===0)score=Math.min(score,.68);
  else if(temporalCount<3)score=Math.min(score,.78);
  return{score:clamp(score),verifiedAura:verifiedAura.length,verifiedDamage:verifiedDamage.length,temporalCount};
}
function deficits(model){const c=model.corpus||{},t=model?.validation?.thresholds||{},wide=num(c.killPulls)+num(c.wipePulls),deep=num(c.deepKillPulls)+num(c.deepWipePulls);return{widePulls:Math.max(0,num(t.minWidePulls)-wide),deepPulls:Math.max(0,num(t.minDeepPulls)-deep),wideReports:Math.max(0,num(t.minWideReports)-num(c.wideReports)),deepReports:Math.max(0,num(t.minDeepReports)-num(c.deepReports)),validationReports:Math.max(0,num(t.minValidationReports)-num(c.validationReports)),independentSources:Math.max(0,num(t.minIndependentSources)-num(c.independentSources)),validationSources:Math.max(0,num(t.minValidationSources)-num(c.validationSources))};}
function plan(model,components){
  const d=deficits(model),c=model.corpus||{},rel=num(components.relationUnderstandingPct),data=num(components.dataDepthPct),currentDeep=num(c.deepKillPulls)+num(c.deepWipePulls),avg=num(c.deepReports)>0?currentDeep/num(c.deepReports):8;
  const deepForReports=Math.ceil(d.deepReports*Math.max(1,avg)),targetedDeep=Math.max(d.deepPulls,deepForReports);
  let priority='medium',mode='wide-and-deep',reason='Increase representative Wide and Deep evidence while preserving source diversity.',addWide=d.widePulls,addDeep=d.deepPulls,addWideReports=d.wideReports;
  if(rel<65&&data>=42){priority='high';mode='targeted-deep';reason='Origin-verified relationship evidence is the next bottleneck. Deep-profile persisted Wide reports before discovering more Wide pulls.';addWide=0;addWideReports=0;addDeep=Math.max(80,targetedDeep);}
  else if(d.independentSources||d.validationSources){priority='high';mode='diversity-first';reason='Independent-source coverage is limiting confidence.';}
  else if(d.wideReports||d.deepReports||d.validationReports){mode='reports-first';reason='Distinct report breadth is the next publication gate.';}
  else if(num(model?.learning?.scorePct)>=82){priority='low';mode='review-or-publish';reason='The model is mature enough for review.';}
  return{priority,mode,reason,suggestedAdditionalWidePulls:Math.min(2000,Math.max(0,Math.ceil(addWide/100)*100)),suggestedAdditionalDeepPulls:Math.min(500,Math.max(0,Math.ceil(addDeep/10)*10)),suggestedAdditionalWideReports:addWideReports,suggestedAdditionalDeepReports:d.deepReports,suggestedAdditionalValidationReports:d.validationReports,suggestedAdditionalIndependentSources:d.independentSources,suggestedAdditionalValidationSources:d.validationSources,estimatedExistingWideReportsAvailableForDeep:Math.max(0,num(c.wideReports)-num(c.deepReports)),deficits:d};
}
function scoreModel(c,critical=[]){
  let raw=(.25*num(c.signalDiscoveryPct)+.25*num(c.relationUnderstandingPct)+.20*num(c.validationConfidencePct)+.20*num(c.dataDepthPct)+.10*num(c.sourceDiversityPct))/100,caps=[];
  if(num(c.relationUnderstandingPct)<40){raw=Math.min(raw,.69);caps.push('relations-under-resolved');}
  else if(num(c.relationUnderstandingPct)<55){raw=Math.min(raw,.79);caps.push('relations-partial');}
  if(critical.length){raw=Math.min(raw,.79);caps.push('critical-unresolved-signals');}
  if(num(c.dataDepthPct)<30){raw=Math.min(raw,.59);caps.push('data-depth-thin');}
  return{scorePct:Math.round(raw*1000)/10,caps};
}

export function applyEncounterPolicyV375(input,aggregate=null){
  if(!input)return null;
  const model=applyEncounterPolicyV374(input,aggregate),verified=model?.discovery?.relationCandidates||[],raw=model?.discovery?.rawRelationCandidates||[],damage=model?.discovery?.castDamageRelations||[];
  const filteredRelations=filterRelationDerivedMechanicsV375(model?.pack?.mechanics||[],verified),mechanics=filteredRelations.kept;
  const train=aggregate?.splits?.train||null,signal=signalCoverage(train,mechanics,model),validation=validationConfidence(mechanics,signal),rel=relationUnderstanding(mechanics,verified,damage);
  const old=model?.learning?.components||{},components={signalDiscoveryPct:pct(signal.score),relationUnderstandingPct:pct(rel.score),validationConfidencePct:pct(validation.confidence),dataDepthPct:num(old.dataDepthPct),sourceDiversityPct:num(old.sourceDiversityPct||old.diversityPct)};
  Object.assign(components,{signalCoveragePct:components.signalDiscoveryPct,holdoutPct:components.validationConfidencePct,diversityPct:components.sourceDiversityPct,semanticResolutionPct:components.relationUnderstandingPct});
  const scored=scoreModel(components,signal.critical),scorePct=scored.scorePct,rec=plan(model,components);
  const lowest=Object.entries({signalDiscoveryPct:components.signalDiscoveryPct,relationUnderstandingPct:components.relationUnderstandingPct,validationConfidencePct:components.validationConfidencePct,dataDepthPct:components.dataDepthPct,sourceDiversityPct:components.sourceDiversityPct}).sort((a,b)=>a[1]-b[1])[0]?.[0]||'unknown';
  const action=rec.mode==='targeted-deep'?'relationUnderstandingPct':rec.mode==='diversity-first'?'sourceDiversityPct':rec.mode==='reports-first'||rec.mode==='wide-and-deep'?'dataDepthPct':lowest;
  const rejected=[...(model.rejected||[])];for(const r of filteredRelations.filtered)if(!rejected.some(x=>Number(x.primaryAbilityId)===Number(r.primaryAbilityId)&&x.reason===r.reason))rejected.push(r);
  const thresholds={...(model?.validation?.thresholds||{}),minLearnedPct:82,minRelationUnderstanding:.60};
  const checks={...(model?.validation?.publishChecks||{}),validationMean:validation.mean>=num(thresholds.minMeanScore||.66),learningScore:scorePct>=num(thresholds.minLearnedPct||82),signalCoverage:signal.score>=num(thresholds.minSignalCoverage||.75),semanticCoverage:rel.score>=num(thresholds.minSemanticCoverage||.70),criticalUnresolved:signal.critical.length<=num(thresholds.maxCriticalUnresolved||0),relationUnderstanding:rel.score>=num(thresholds.minRelationUnderstanding||.60),acceptedMechanics:mechanics.length>=8,manualReviewHold:true};
  const previousNeeds=(model?.learning?.needsEvidence||[]).filter(x=>x?.kind!=='relations').slice(0,3),needs=[];
  if(raw.length>verified.length)needs.push({kind:'relations',title:`${raw.length-verified.length} temporal relation hypotheses need provenance`,detail:'They remain diagnostic only and cannot raise Boss Learned until Deep source origin confirms the encounter side.',confidencePct:Math.round(components.relationUnderstandingPct)});
  if(filteredRelations.filtered.length)needs.push({kind:'filter',title:`${filteredRelations.filtered.length} unverified relation mechanics excluded`,detail:'Cast→aura coincidences no longer become accepted mechanics without origin-verified evidence.'});
  needs.push(...previousNeeds);
  const highlights=(model?.learning?.learnedHighlights||[]).filter(h=>h?.kind!=='causal');
  if(verified.length)highlights.push({kind:'causal',title:`${verified.length} origin-verified temporal relations`,detail:'Only encounter-side cast → aura evidence contributes to relationship maturity'});

  model.engineVersion='3.7.5';model.schemaVersion=Math.max(6,num(model.schemaVersion));model.policyVersion='relation-provenance-v2';model.status='candidate';
  model.pack={...(model.pack||{}),mechanics};
  model.filtered={...(model.filtered||{}),relationMechanics:filteredRelations.filtered,relationMechanicCount:filteredRelations.filtered.length};
  model.rejected=rejected;
  model.validation={...(model.validation||{}),acceptedMechanics:mechanics.length,rejectedMechanics:rejected.length,meanScore:validation.mean,validationRecalculated:{meanScore:validation.mean,breadth:validation.breadth,confidenceScore:validation.confidence},thresholds,publishChecks:checks,publicationMode:'manual-review-hold-v3.7.5'};
  model.learning={...(model.learning||{}),scorePct,grade:grade(scorePct),components,bottleneck:lowest,lowestDimension:lowest,actionBottleneck:action,caps:uniq([...(model?.learning?.caps||[]),...scored.caps]),criticalUnresolvedSignals:signal.critical,signalCoverage:{resolved:signal.resolved,total:signal.total,score:signal.score},relationUnderstanding:{score:rel.score,scorePct:components.relationUnderstandingPct,stateDimensions:(model?.discovery?.stateDimensions||[]).length,candidateRelations:verified.length,rawCandidateRelations:raw.length,unverifiedRelations:Math.max(0,raw.length-verified.length),castDamageRelations:damage.length,verifiedTemporalRelations:rel.temporalCount,meaning:'Relationship maturity is capped unless temporal edges are origin-verified from Deep encounter evidence.'},validationRecalculated:{meanScore:validation.mean,breadth:validation.breadth,confidenceScore:validation.confidence},enrichmentRecommendation:rec,needsEvidence:needs.slice(0,5),learnedHighlights:highlights.slice(0,5)};
  model.evaluatedAt=Date.now();
  return model;
}

export function modelDiagnosticsV375(input,aggregate=null){
  const model=applyEncounterPolicyV375(input,aggregate);if(!model)return null;
  return{engineVersion:'3.7.5',schemaVersion:model.schemaVersion,status:model.status,learnedPct:model.learning.scorePct,learningGrade:model.learning.grade,learningComponents:model.learning.components,lowestDimension:model.learning.lowestDimension,actionBottleneck:model.learning.actionBottleneck,relationUnderstanding:model.learning.relationUnderstanding,enrichmentRecommendation:model.learning.enrichmentRecommendation,enrichmentFocusAbilityIds:model.learning.enrichmentFocusAbilityIds||[],originEvidence:model.learning.originEvidence||{},acceptedMechanics:model.validation.acceptedMechanics,rejectedMechanics:model.validation.rejectedMechanics,validationMean:model.validation.meanScore,publishChecks:model.validation.publishChecks,thresholds:model.validation.thresholds,publicationMode:model.validation.publicationMode,filteredSignals:model.filtered||{},learningBottleneck:model.learning.bottleneck,liveCorpus:model.corpus,evaluatedAt:model.evaluatedAt};
}
