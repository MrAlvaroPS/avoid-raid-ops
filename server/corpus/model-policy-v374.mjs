import { applyEncounterPolicyV373, modelDiagnosticsV373 } from './model-policy-v373.mjs';
import { aggregateSummary } from './aggregate.mjs';

const num=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=v=>Math.max(0,Math.min(1,num(v)));
const pct=v=>Math.round(clamp(v)*1000)/10;
const grade=s=>s>=95?'VERIFIED':s>=85?'MATURE':s>=70?'STRONG':s>=50?'PARTIAL':s>=25?'LEARNING':'DISCOVERY';
const capRatio=(v,target)=>clamp(num(v)/Math.max(1,num(target)||1));
const primary=m=>{const x=Number(m?.generated?.primaryAbilityId??m?.primaryAbilityId);if(Number.isFinite(x))return x;for(const k of ['castIds','damageIds','failureDamageIds','failureAuraIds','auraIds']){const n=Number(m?.[k]?.[0]);if(Number.isFinite(n))return n;}return null;};
const mechanicWeight=m=>Math.max(.5,num(m?.generated?.semanticWeight)||1);

export function liveCorpusSnapshotV374(aggregate,fallback={}){
  if(!aggregate)return{...(fallback||{})};
  const s=aggregateSummary(aggregate);
  return{
    ...(fallback||{}),
    wideReports:num(s.wideReports),deepReports:num(s.deepReports),killPulls:num(s.killPulls),wipePulls:num(s.wipePulls),deepKillPulls:num(s.deepKillPulls),deepWipePulls:num(s.deepWipePulls),
    independentSources:num(s.independentSources),deepSources:num(s.deepSources),discoveredSourcePool:num(s.discoveredSourcePool),
    trainingReports:num(s.train?.wideReports),validationReports:num(s.validation?.wideReports),trainingSources:num(s.train?.independentSources),validationSources:num(s.validation?.independentSources),
    validationFraction:num(aggregate.validationFraction||fallback?.validationFraction||.2),splitPolicy:'source-isolated-train-holdout',
  };
}

function originRow(split,id){
  const row=split?.originEvidence?.[String(id)]||{};
  const friendly=num(row.friendlySourceEvents),encounter=num(row.encounterOrUnknownSourceEvents),unknown=num(row.unknownSourceEvents),known=friendly+encounter;
  const friendlyRate=known?friendly/known:null,encounterRate=known?encounter/known:null;
  let classification='unknown';
  if(known>=8&&friendlyRate>=.8)classification='friendly-player';
  else if(known>=8&&encounterRate>=.7)classification='encounter-or-environment';
  else if(known>=8)classification='mixed';
  return{friendlySourceEvents:friendly,encounterOrUnknownSourceEvents:encounter,unknownSourceEvents:unknown,knownEvents:known,reportsWithEvidence:num(row.reportsWithEvidence),friendlyRate,encounterRate,classification};
}

export function filterOriginVerifiedRelationsV374(relations=[],aggregate=null){
  const split=aggregate?.splits?.train||{};const accepted=[],rejected=[],unverified=[];
  for(const rel of relations||[]){
    const target=originRow(split,rel.targetId);const triggers=(rel.triggerCastIds||[]).map(id=>({id:Number(id),origin:originRow(split,id)}));
    const sourceFriendly=triggers.some(x=>x.origin.classification==='friendly-player');
    const sourceEncounter=triggers.some(x=>x.origin.classification==='encounter-or-environment');
    const decorated={...rel,originEvidence:{target,triggers:triggers.slice(0,12),sourceEncounterVerified:sourceEncounter}};
    if(sourceFriendly){rejected.push({...decorated,originRejectReason:'friendly-source-cast'});continue;}
    if(target.classification==='friendly-player'){rejected.push({...decorated,originRejectReason:'friendly-target-aura'});continue;}
    if(target.classification==='encounter-or-environment'&&sourceEncounter){accepted.push({...decorated,originPolicy:'origin-verified-relation-v1'});continue;}
    unverified.push({...decorated,originRejectReason:target.classification==='mixed'?'mixed-target-origin':'origin-not-yet-verified'});
  }
  return{accepted,rejected,unverified};
}

function relationScoreForMechanic(m){
  if(m.semanticInference==='enemy-aura-after-cast'||m.inference==='failure-aura-is-failure'||m.inference==='wrong-state-impact')return 1;
  if(m.category==='interrupt'&&m.requiredState)return .88;
  if(m.category==='interrupt'||m.inference==='completed-cast-is-failure')return .82;
  if(m.inference==='failure-damage-by-occurrence')return .72;
  if(m.inference==='stateful-impact-observed')return .48;
  if(m.inference==='stateful-cast-observed')return .35;
  return null;
}
function relationUnderstanding(mechanics,relations,damageRelations){
  let sum=0,weight=0;for(const m of mechanics||[]){const score=relationScoreForMechanic(m);if(score==null)continue;const w=mechanicWeight(m);sum+=score*w;weight+=w;}
  const acceptedIds=new Set((mechanics||[]).map(primary).filter(Number.isFinite));
  const auraBonus=Math.min(.10,(relations||[]).filter(r=>num(r.confidence)>=.62).length*.025);
  const damageBonus=Math.min(.10,(damageRelations||[]).filter(r=>num(r.confidence)>=.58&&(acceptedIds.has(Number(r.sourceId))||acceptedIds.has(Number(r.targetId)))).length*.0125);
  return clamp((weight?sum/weight:0)+auraBonus+damageBonus);
}

export function dataDepthPctV374(corpus={},thresholds={}){
  const widePulls=num(corpus.killPulls)+num(corpus.wipePulls),deepPulls=num(corpus.deepKillPulls)+num(corpus.deepWipePulls);
  const score=.26*capRatio(widePulls,thresholds.minWidePulls)+.22*capRatio(deepPulls,thresholds.minDeepPulls)+.20*capRatio(corpus.wideReports,thresholds.minWideReports)+.16*capRatio(corpus.deepReports,thresholds.minDeepReports)+.16*capRatio(corpus.validationReports,thresholds.minValidationReports);
  return pct(score);
}
function diversityPct(corpus={},thresholds={}){return pct(.65*capRatio(corpus.independentSources,thresholds.minIndependentSources)+.35*capRatio(corpus.validationSources,thresholds.minValidationSources));}
function deficits(model){const c=model.corpus||{},t=model.validation?.thresholds||{},wide=num(c.killPulls)+num(c.wipePulls),deep=num(c.deepKillPulls)+num(c.deepWipePulls);return{widePulls:Math.max(0,num(t.minWidePulls)-wide),deepPulls:Math.max(0,num(t.minDeepPulls)-deep),wideReports:Math.max(0,num(t.minWideReports)-num(c.wideReports)),deepReports:Math.max(0,num(t.minDeepReports)-num(c.deepReports)),validationReports:Math.max(0,num(t.minValidationReports)-num(c.validationReports)),independentSources:Math.max(0,num(t.minIndependentSources)-num(c.independentSources)),validationSources:Math.max(0,num(t.minValidationSources)-num(c.validationSources))};}
function plan(model,components){
  const d=deficits(model),c=model.corpus||{},rel=num(components.relationUnderstandingPct),available=Math.max(0,num(c.wideReports)-num(c.deepReports)),currentDeep=num(c.deepKillPulls)+num(c.deepWipePulls),avg=num(c.deepReports)>0?currentDeep/num(c.deepReports):8;
  let priority='medium',mode='wide-and-deep',reason='Increase representative Wide and Deep evidence while preserving source diversity.',wide=d.widePulls,deep=d.deepPulls,wideReports=d.wideReports,deepReports=d.deepReports;
  if(rel<65&&available>0){priority='high';mode='targeted-deep';reason='Relationship evidence is still the best next investment. Upgrade persisted Wide reports before discovering new pulls.';wide=0;wideReports=0;deepReports=Math.min(available,Math.max(d.deepReports,12));deep=Math.max(d.deepPulls,Math.ceil(Math.max(1,avg)*deepReports));}
  else if(d.independentSources||d.validationSources){priority='high';mode='diversity-first';reason='Independent-source coverage is limiting confidence.';}
  else if(d.wideReports||d.deepReports||d.validationReports){mode='reports-first';reason='Distinct report breadth is the next publication gate.';}
  else if(num(model.learning?.scorePct)>=82){priority='low';mode='review-or-publish';reason='The model is mature enough for review.';}
  return{priority,mode,reason,suggestedAdditionalWidePulls:Math.min(2000,Math.max(0,Math.ceil(wide/100)*100)),suggestedAdditionalDeepPulls:Math.min(500,Math.max(0,Math.ceil(deep/10)*10)),suggestedAdditionalWideReports:wideReports,suggestedAdditionalDeepReports:deepReports,suggestedAdditionalValidationReports:d.validationReports,suggestedAdditionalIndependentSources:d.independentSources,suggestedAdditionalValidationSources:d.validationSources,estimatedExistingWideReportsAvailableForDeep:available,deficits:d};
}
function actionBottleneck(rec,lowest){if(rec.mode==='targeted-deep')return'relationUnderstandingPct';if(rec.mode==='diversity-first')return'sourceDiversityPct';if(rec.mode==='reports-first'||rec.mode==='wide-and-deep')return'dataDepthPct';return lowest;}
function scoreModel(components,critical=[]){let raw=(.25*num(components.signalDiscoveryPct)+.25*num(components.relationUnderstandingPct)+.20*num(components.validationConfidencePct)+.20*num(components.dataDepthPct)+.10*num(components.sourceDiversityPct))/100,caps=[];if(num(components.relationUnderstandingPct)<40){raw=Math.min(raw,.69);caps.push('relations-under-resolved');}else if(num(components.relationUnderstandingPct)<55){raw=Math.min(raw,.79);caps.push('relations-partial');}if(critical.length){raw=Math.min(raw,.79);caps.push('critical-unresolved-signals');}if(num(components.dataDepthPct)<30){raw=Math.min(raw,.59);caps.push('data-depth-thin');}return{scorePct:Math.round(raw*1000)/10,caps};}

export function applyEncounterPolicyV374(input,aggregate=null){
  if(!input)return null;const model=applyEncounterPolicyV373(input,aggregate);if(!model)return null;
  model.schemaVersion=Math.max(6,num(model.schemaVersion));model.engineVersion='3.7.4';model.policyVersion='encounter-origin-v4';model.evaluatedAt=Date.now();
  model.corpus=liveCorpusSnapshotV374(aggregate,model.corpus||{});
  const rawRelations=[...(model.discovery?.relationCandidates||[])],filtered=filterOriginVerifiedRelationsV374(rawRelations,aggregate),damageRelations=model.discovery?.castDamageRelations||[];
  model.discovery={...(model.discovery||{}),rawRelationCandidates:rawRelations,relationCandidates:filtered.accepted,filteredRelationCandidates:[...filtered.rejected,...filtered.unverified],relationOriginPolicy:{version:'v1',rule:'relation understanding only counts cast→aura candidates whose target aura and at least one trigger cast have encounter-side origin evidence'}};
  const mechanics=model.pack?.mechanics||[],rel=relationUnderstanding(mechanics,filtered.accepted,damageRelations),thresholds={...(model.validation?.thresholds||{}),minRelationUnderstanding:.60,minLearnedPct:82},components={...(model.learning?.components||{})};
  components.relationUnderstandingPct=pct(rel);components.dataDepthPct=dataDepthPctV374(model.corpus,thresholds);components.sourceDiversityPct=diversityPct(model.corpus,thresholds);components.semanticResolutionPct=components.relationUnderstandingPct;components.diversityPct=components.sourceDiversityPct;
  const critical=model.learning?.criticalUnresolvedSignals||[],scored=scoreModel(components,critical),lowest=Object.entries({signalDiscoveryPct:num(components.signalDiscoveryPct),relationUnderstandingPct:num(components.relationUnderstandingPct),validationConfidencePct:num(components.validationConfidencePct),dataDepthPct:num(components.dataDepthPct),sourceDiversityPct:num(components.sourceDiversityPct)}).sort((a,b)=>a[1]-b[1])[0]?.[0]||'unknown';
  model.learning={...(model.learning||{}),scorePct:scored.scorePct,grade:grade(scored.scorePct),components,caps:[...new Set([...(model.learning?.caps||[]),...scored.caps])],relationUnderstanding:{score:rel,scorePct:components.relationUnderstandingPct,stateDimensions:(model.discovery?.stateDimensions||[]).length,candidateRelations:filtered.accepted.length,rawCandidateRelations:rawRelations.length,filteredFriendlyRelations:filtered.rejected.length,unverifiedRelations:filtered.unverified.length,castDamageRelations:damageRelations.length,meaning:'Only origin-verified encounter relationships contribute to this score.'}};
  const rec=plan(model,components),action=actionBottleneck(rec,lowest);model.learning.enrichmentRecommendation=rec;model.learning.lowestDimension=lowest;model.learning.actionBottleneck=action;model.learning.bottleneck=action;
  const priorNeeds=(model.learning.needsEvidence||[]).filter(x=>x.kind!=='data'&&x.kind!=='relations-origin');if(filtered.rejected.length||filtered.unverified.length)priorNeeds.unshift({kind:'relations-origin',title:'Relation provenance',detail:`${filtered.accepted.length} origin-verified · ${filtered.rejected.length} friendly/noisy · ${filtered.unverified.length} awaiting origin evidence.`,confidencePct:Math.round(components.relationUnderstandingPct)});if(rec.deficits.deepReports)priorNeeds.push({kind:'data',title:`${rec.deficits.deepReports} Deep reports below gate`,detail:'Existing Wide reports can be upgraded before discovering new reports.'});model.learning.needsEvidence=priorNeeds.slice(0,6);
  model.learning.semantic={...(model.learning.semantic||{}),relationCandidates:filtered.accepted.length};
  const c=model.corpus,checks={...(model.validation?.publishChecks||{})};checks.wideReports=num(c.wideReports)>=num(thresholds.minWideReports);checks.deepReports=num(c.deepReports)>=num(thresholds.minDeepReports);checks.widePulls=num(c.killPulls)+num(c.wipePulls)>=num(thresholds.minWidePulls);checks.deepPulls=num(c.deepKillPulls)+num(c.deepWipePulls)>=num(thresholds.minDeepPulls);checks.independentSources=num(c.independentSources)>=num(thresholds.minIndependentSources);checks.validationSources=num(c.validationSources)>=num(thresholds.minValidationSources);checks.validationReports=num(c.validationReports)>=num(thresholds.minValidationReports);checks.learningScore=scored.scorePct>=num(thresholds.minLearnedPct);checks.relationUnderstanding=rel>=num(thresholds.minRelationUnderstanding);checks.manualReviewHold=true;
  model.validation={...(model.validation||{}),thresholds,publishChecks:checks,publicationMode:'manual-review-hold-v3.7.4'};
  return model;
}

export function modelDiagnosticsV374(input,aggregate=null){
  const model=applyEncounterPolicyV374(input,aggregate);if(!model)return null;const base=modelDiagnosticsV373(input,aggregate)||{};
  return{...base,engineVersion:'3.7.4',learnedPct:model.learning.scorePct,learningGrade:model.learning.grade,learningComponents:model.learning.components,learningBottleneck:model.learning.bottleneck,relationUnderstanding:model.learning.relationUnderstanding,enrichmentRecommendation:model.learning.enrichmentRecommendation,publishChecks:model.validation.publishChecks,publicationMode:model.validation.publicationMode,liveCorpus:model.corpus,evaluatedAt:model.evaluatedAt};
}
