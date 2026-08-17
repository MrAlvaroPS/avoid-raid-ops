import { applyBossSamplingPolicyV378, modelDiagnosticsV378 } from './model-policy-v378.mjs';
import { importantSignals, resolvedAbilityIds } from './discovery.mjs';

export const SIGNAL_TRIAGE_POLICY_VERSION='signal-triage-v1';
export const DECISION_POLICY_VERSION='iris-decision-separation-v1';

const num=value=>Number.isFinite(Number(value))?Number(value):0;
const clamp=value=>Math.max(0,Math.min(1,num(value)));
const pct=value=>Math.round(clamp(value)*1000)/10;
const uniq=values=>[...new Set((values||[]).filter(x=>x!==null&&x!==undefined))];
const grade=score=>score>=95?'VERIFIED':score>=85?'MATURE':score>=70?'STRONG':score>=50?'PARTIAL':score>=25?'LEARNING':'DISCOVERY';
const mechanicPrimary=m=>{const x=Number(m?.generated?.primaryAbilityId??m?.primaryAbilityId);if(Number.isFinite(x))return x;for(const key of ['castIds','damageIds','failureDamageIds','failureAuraIds','auraIds']){const id=Number(m?.[key]?.[0]);if(Number.isFinite(id))return id;}return null;};

export function classifyOriginEvidenceV379(row={}){
  const friendly=num(row?.friendlySourceEvents);
  const encounter=num(row?.encounterOrUnknownSourceEvents);
  const unknown=num(row?.unknownSourceEvents);
  const known=friendly+encounter;
  const total=known+unknown;
  const reports=num(row?.reportsWithEvidence);
  const friendlyRate=known?friendly/known:null;
  const encounterRate=known?encounter/known:null;
  const unknownRate=total?unknown/total:null;
  let classification='unknown';
  let reason='Not enough independent persisted origin evidence to classify this signal.';
  if(known>=8&&reports>=2&&friendlyRate>=.8){
    classification='friendly-player';
    reason='At least 80% of source-resolved events come from friendly player actor IDs across multiple reports.';
  }else if(known>=8&&reports>=2&&encounterRate>=.8&&(unknownRate??1)<=.25){
    classification='encounter';
    reason='At least 80% of source-resolved events use non-friendly actor IDs, with bounded source-less evidence, across multiple reports.';
  }else if(known>=8&&reports>=2){
    classification='mixed';
    reason='Enough source-resolved evidence exists, but friendly and non-friendly origins are both materially present.';
  }
  return{
    classification,
    friendlySourceEvents:friendly,
    encounterOrEnvironmentSourceEvents:encounter,
    sourceLessEvents:unknown,
    reportsWithEvidence:reports,
    knownEvents:known,
    totalEvents:total,
    friendlyRate,
    encounterRate,
    unknownRate,
    evidenceVersion:'friendly-vs-nonfriendly-source-v2',
    reason,
  };
}

function fallbackTriage(model={}){
  const existing=model?.learning?.signalCoverage||{};
  const critical=(model?.learning?.criticalUnresolvedSignals||[]).map(row=>({
    ...row,
    resolved:false,
    eligibleForBossDenominator:true,
    critical:true,
    origin:classifyOriginEvidenceV379({}),
    action:'surgical-provenance-probe',
    actionReason:'Aggregate origin evidence is unavailable in this caller; keep the signal unresolved rather than fabricating classification.',
  }));
  const score=Number.isFinite(Number(existing.score))?clamp(existing.score):clamp(num(model?.learning?.components?.signalCoveragePct??model?.learning?.components?.signalDiscoveryPct)/100);
  return{
    policyVersion:SIGNAL_TRIAGE_POLICY_VERSION,
    score,
    scorePct:pct(score),
    rawSignals:num(existing.total),
    eligibleSignals:num(existing.total),
    resolvedSignals:num(existing.resolved),
    unresolvedSignals:Math.max(0,num(existing.total)-num(existing.resolved)),
    excludedFriendlySignals:0,
    criticalUnresolved:critical,
    criticalProbeQueue:critical,
    criticalLocalQueue:[],
    excludedFriendly:[],
    signals:critical,
    aggregateEvidenceAvailable:false,
    denominatorRule:'No aggregate ability/origin evidence was available, so v3.7.9 preserves the prior denominator and critical rows rather than assuming success.',
  };
}

export function triageSignalsV379(model={},aggregate={}){
  const split=aggregate?.splits?.train||{};
  if(!Object.keys(split?.abilities||{}).length)return fallbackTriage(model);
  const mechanics=model?.pack?.mechanics||[];
  const resolved=resolvedAbilityIds(mechanics);
  const rawSignals=importantSignals(split);
  const rows=rawSignals.map(signal=>{
    const origin=classifyOriginEvidenceV379(split?.originEvidence?.[String(signal.id)]||{});
    const isResolved=resolved.has(Number(signal.id));
    const eligibleForBossDenominator=origin.classification!=='friendly-player';
    const critical=eligibleForBossDenominator&&!isResolved&&num(signal.importance)>=.48;
    let action='none',actionReason='Signal is already represented by an accepted mechanic.';
    if(origin.classification==='friendly-player'){
      action='exclude-friendly-signal';
      actionReason='Friendly-player origin is sufficiently established; this signal must not block boss-mechanic coverage.';
    }else if(!isResolved&&origin.classification==='encounter'){
      action='local-mechanic-synthesis';
      actionReason='Encounter-side provenance is already strong enough. Inspect existing persisted mechanics/relations before buying more WCL.';
    }else if(!isResolved&&['mixed','unknown'].includes(origin.classification)){
      action='surgical-provenance-probe';
      actionReason='The signal is important but source provenance is not decisive; a narrow independent-source probe is the next external-evidence step.';
    }
    return{...signal,resolved:isResolved,eligibleForBossDenominator,critical,origin,action,actionReason};
  });
  const eligible=rows.filter(row=>row.eligibleForBossDenominator);
  const totalWeight=eligible.reduce((sum,row)=>sum+num(row.importance),0);
  const resolvedWeight=eligible.filter(row=>row.resolved).reduce((sum,row)=>sum+num(row.importance),0);
  const unresolved=eligible.filter(row=>!row.resolved);
  const critical=unresolved.filter(row=>row.critical).slice(0,12);
  const criticalProbeQueue=critical.filter(row=>row.action==='surgical-provenance-probe');
  const criticalLocalQueue=critical.filter(row=>row.action==='local-mechanic-synthesis');
  const excludedFriendly=rows.filter(row=>row.origin.classification==='friendly-player');
  return{
    policyVersion:SIGNAL_TRIAGE_POLICY_VERSION,
    score:totalWeight?resolvedWeight/totalWeight:1,
    scorePct:pct(totalWeight?resolvedWeight/totalWeight:1),
    rawSignals:rows.length,
    eligibleSignals:eligible.length,
    resolvedSignals:eligible.length-unresolved.length,
    unresolvedSignals:unresolved.length,
    excludedFriendlySignals:excludedFriendly.length,
    criticalUnresolved:critical,
    criticalProbeQueue,
    criticalLocalQueue,
    excludedFriendly:excludedFriendly.map(row=>({id:row.id,name:row.name,importance:row.importance,origin:row.origin})),
    signals:rows.slice(0,80),
    aggregateEvidenceAvailable:true,
    denominatorRule:'Signals with sufficiently established friendly-player origin are excluded from GLOBAL BOSS signal coverage. Mixed/unknown evidence stays in the denominator until resolved.',
  };
}

export function relationProvenanceSummaryV379(model={}){
  const verified=model?.discovery?.relationCandidates||[];
  const filtered=model?.discovery?.filteredRelationCandidates||[];
  const friendlyOrNoisy=filtered.filter(row=>['friendly-source-cast','friendly-target-aura'].includes(String(row?.originRejectReason||'')));
  const awaiting=filtered.filter(row=>['mixed-target-origin','origin-not-yet-verified'].includes(String(row?.originRejectReason||'')));
  const friendlySet=new Set(friendlyOrNoisy),awaitingSet=new Set(awaiting);
  const otherRejected=filtered.filter(row=>!friendlySet.has(row)&&!awaitingSet.has(row));
  return{
    verified:verified.length,
    friendlyOrNoisy:friendlyOrNoisy.length,
    awaitingOriginEvidence:awaiting.length,
    otherRejected:otherRejected.length,
    verifiedRows:verified,
    awaitingRows:awaiting,
    meaning:'Friendly/noisy relations are closed rejections, not outstanding provenance work. Only mixed/unknown origin rows remain in the external-evidence queue.',
  };
}

function relationAwaitingAbilityIds(summary={}){
  const ids=[];
  for(const row of summary.awaitingRows||[]){
    ids.push(Number(row?.targetId));
    for(const id of row?.triggerCastIds||[])ids.push(Number(id));
  }
  return uniq(ids.filter(id=>Number.isFinite(id)&&id>0));
}

function mechanicTouchesAbility(mechanic={},id){
  const n=Number(id);
  if(mechanicPrimary(mechanic)===n)return true;
  for(const key of ['castIds','damageIds','failureDamageIds','failureAuraIds','auraIds','triggerCastIds','stateValueIds'])if((mechanic?.[key]||[]).map(Number).includes(n))return true;
  return false;
}

export function localSignalReviewV379(model={},triage={}){
  const queue=triage?.criticalLocalQueue||[];
  const accepted=model?.pack?.mechanics||[];
  const rejected=model?.rejected||[];
  const relations=[...(model?.discovery?.relationCandidates||[]),...(model?.discovery?.filteredRelationCandidates||[])];
  const families=model?.discovery?.variantFamilies||[];
  return queue.map(signal=>{
    const id=Number(signal.id);
    const relationRows=relations.filter(row=>Number(row?.targetId)===id||(row?.triggerCastIds||[]).map(Number).includes(id));
    const familyRows=families.filter(row=>(row?.encounterMemberIds||row?.memberIds||row?.members?.map(x=>x.id)||[]).map(Number).includes(id));
    return{
      id,
      name:signal.name,
      importance:signal.importance,
      origin:signal.origin,
      acceptedMechanics:accepted.filter(row=>mechanicTouchesAbility(row,id)).map(row=>({key:row.key,name:row.name,category:row.category,inference:row.inference||row.semanticInference||null})),
      rejectedCandidates:rejected.filter(row=>mechanicTouchesAbility(row,id)||Number(row?.primaryAbilityId)===id).slice(0,8).map(row=>({key:row.key,name:row.name,reason:row.reason||null,inference:row.inference||null,validationScore:row.validationScore??row?.generated?.validationScore??null})),
      relationRows:relationRows.slice(0,8),
      variantFamilies:familyRows.slice(0,6).map(row=>({key:row.key,tokenGroup:row.tokenGroup,confidence:row.confidence,encounterSupported:row.encounterSupported})),
      wclCallsExecuted:0,
      next:'Inspect rejected candidates, relation rows and family/state context before authoring any new WCL query.',
    };
  });
}

function rescoreLearning(components={},critical=[]){
  let raw=(
    .25*num(components.signalDiscoveryPct)
    +.25*num(components.relationUnderstandingPct)
    +.20*num(components.validationConfidencePct)
    +.20*num(components.dataDepthPct)
    +.10*num(components.sourceDiversityPct)
  )/100;
  const caps=[];
  if(num(components.relationUnderstandingPct)<40){raw=Math.min(raw,.69);caps.push('relations-under-resolved');}
  else if(num(components.relationUnderstandingPct)<55){raw=Math.min(raw,.79);caps.push('relations-partial');}
  if(critical.length){raw=Math.min(raw,.79);caps.push('critical-unresolved-signals');}
  if(num(components.dataDepthPct)<30){raw=Math.min(raw,.59);caps.push('data-depth-thin');}
  return{scorePct:Math.round(raw*1000)/10,caps};
}

function learningNextV379(model,triage,relations){
  if(triage.criticalProbeQueue.length){
    return{
      purpose:'learning',priority:'high',mode:'surgical-probe-plan',execution:'dry-run-only',wclCallsExecuted:0,
      reason:`${triage.criticalProbeQueue.length} critical unresolved signal${triage.criticalProbeQueue.length===1?'':'s'} still have mixed/unknown provenance. Build a narrow exact-fight plan before any further broad acquisition.`,
      targetAbilityIds:triage.criticalProbeQueue.map(row=>Number(row.id)),
      dryRunAction:'probe-plan',
    };
  }
  if(triage.criticalLocalQueue.length){
    return{
      purpose:'learning',priority:'high',mode:'local-mechanic-synthesis',execution:'local-only',wclCallsExecuted:0,
      reason:`${triage.criticalLocalQueue.length} critical signal${triage.criticalLocalQueue.length===1?'':'s'} already have encounter-side provenance. Reuse persisted Deep relations and mechanic candidates before querying WCL again.`,
      targetAbilityIds:triage.criticalLocalQueue.map(row=>Number(row.id)),
    };
  }
  if(relations.awaitingOriginEvidence>0){
    return{
      purpose:'learning',priority:'medium',mode:'surgical-relation-probe-plan',execution:'dry-run-only',wclCallsExecuted:0,
      reason:`${relations.awaitingOriginEvidence} temporal relation hypothesis${relations.awaitingOriginEvidence===1?'':'es'} genuinely still need source provenance. Friendly/noisy rejected relations are excluded from this queue.`,
      targetAbilityIds:relationAwaitingAbilityIds(relations),dryRunAction:'probe-plan',
    };
  }
  if(triage.score<.75){
    return{purpose:'learning',priority:'medium',mode:'local-signal-review',execution:'local-only',wclCallsExecuted:0,reason:'Signal coverage remains below its publication threshold, but no critical mixed/unknown provenance item currently justifies broad WCL acquisition.'};
  }
  return{purpose:'learning',priority:'low',mode:'review',execution:'local-only',wclCallsExecuted:0,reason:'No high-priority signal-provenance task remains. Review accepted mechanics and technical semantic coverage before buying more evidence.'};
}

function publicationNextV379(model={}){
  const previous=model?.learning?.enrichmentRecommendation||{};
  return{
    ...previous,
    purpose:'publication-gates',
    reason:previous.reason||'Close explicit publication evidence gates while preserving the canonical sampling contract.',
  };
}

export function applySignalTriageOverlayV379(model,aggregate=null){
  if(!model)return null;
  const triage=triageSignalsV379(model,aggregate||{});
  const relations=relationProvenanceSummaryV379(model);
  const localReview=localSignalReviewV379(model,triage);
  const components={...(model?.learning?.components||{})};
  components.signalDiscoveryPct=triage.scorePct;
  components.signalCoveragePct=triage.scorePct;
  const hasTechnicalSemantic=Number.isFinite(Number(model?.learning?.semantic?.score));
  const technicalSemanticScore=hasTechnicalSemantic?clamp(model.learning.semantic.score):null;
  if(hasTechnicalSemantic)components.semanticCoverageTechnicalPct=pct(technicalSemanticScore);
  delete components.semanticResolutionPct;

  const score=rescoreLearning(components,triage.criticalUnresolved);
  const oldCaps=(model?.learning?.caps||[]).filter(cap=>!['critical-unresolved-signals','relations-under-resolved','relations-partial','data-depth-thin'].includes(cap));
  const thresholds={...(model?.validation?.thresholds||{})};
  thresholds.minSemanticCoverageTechnical=num(thresholds.minSemanticCoverage||.70);
  const checks={...(model?.validation?.publishChecks||{})};
  checks.signalCoverage=triage.score>=num(thresholds.minSignalCoverage||.75);
  checks.criticalUnresolved=triage.criticalUnresolved.length<=num(thresholds.maxCriticalUnresolved||0);
  if(hasTechnicalSemantic){
    checks.semanticCoverageTechnical=technicalSemanticScore>=thresholds.minSemanticCoverageTechnical;
    checks.semanticCoverage=checks.semanticCoverageTechnical;
  }
  checks.learningScore=score.scorePct>=num(thresholds.minLearnedPct||82);

  const priorNeeds=(model?.learning?.needsEvidence||[]).filter(row=>!['relations','relations-origin','signal-provenance','signal-local'].includes(row?.kind));
  const needs=[];
  if(triage.criticalProbeQueue.length)needs.push({kind:'signal-provenance',title:`${triage.criticalProbeQueue.length} critical signals need provenance`,detail:'Only mixed/unknown critical signals are queued for surgical external evidence. Friendly-player signals are excluded from the boss denominator.',confidencePct:Math.round(triage.scorePct)});
  if(triage.criticalLocalQueue.length)needs.push({kind:'signal-local',title:`${triage.criticalLocalQueue.length} encounter-origin critical signals need local synthesis`,detail:'Their provenance is already sufficient; inspect persisted mechanics/relations before spending WCL.',confidencePct:Math.round(triage.scorePct)});
  needs.push({kind:'relations-origin',title:'Relation provenance',detail:`${relations.verified} origin-verified · ${relations.friendlyOrNoisy} friendly/noisy closed · ${relations.awaitingOriginEvidence} awaiting origin evidence.`,confidencePct:Math.round(num(components.relationUnderstandingPct))});
  if(relations.awaitingOriginEvidence>0)needs.push({kind:'relations',title:`${relations.awaitingOriginEvidence} temporal relation hypotheses genuinely need provenance`,detail:'Only mixed/unknown origin hypotheses remain actionable; friendly/noisy rows are closed rejections.',confidencePct:Math.round(num(components.relationUnderstandingPct))});
  needs.push(...priorNeeds);

  const previousFocus=model?.learning?.enrichmentFocusAbilityIds||[];
  const friendlyIds=new Set(triage.excludedFriendly.map(row=>Number(row.id)));
  const focus=uniq([
    ...triage.criticalProbeQueue.map(row=>Number(row.id)),
    ...triage.criticalLocalQueue.map(row=>Number(row.id)),
    ...relationAwaitingAbilityIds(relations),
    ...previousFocus.map(Number),
  ]).filter(id=>Number.isFinite(id)&&id>0&&!friendlyIds.has(id)).slice(0,24);

  const publicationNext=publicationNextV379(model);
  const learningNext=learningNextV379(model,triage,relations);
  const lowest=Object.entries({
    signalDiscoveryPct:num(components.signalDiscoveryPct),
    relationUnderstandingPct:num(components.relationUnderstandingPct),
    validationConfidencePct:num(components.validationConfidencePct),
    dataDepthPct:num(components.dataDepthPct),
    sourceDiversityPct:num(components.sourceDiversityPct),
  }).sort((a,b)=>a[1]-b[1])[0]?.[0]||'unknown';

  model.engineVersion='3.7.9';
  model.policyVersion='signal-triage-v1+semantic-contract-v1+decision-separation-v1';
  model.learning={
    ...(model.learning||{}),
    scorePct:score.scorePct,
    grade:grade(score.scorePct),
    components,
    caps:uniq([...oldCaps,...score.caps]),
    bottleneck:lowest,
    lowestDimension:lowest,
    actionBottleneck:lowest,
    publicationActionBottleneck:publicationNext?.deficits?.wideReports||publicationNext?.deficits?.widePulls||publicationNext?.deficits?.validationReports?'dataDepthPct':null,
    criticalUnresolvedSignals:triage.criticalUnresolved,
    signalCoverage:{resolved:triage.resolvedSignals,total:triage.eligibleSignals,score:triage.score,excludedFriendly:triage.excludedFriendlySignals},
    signalTriage:triage,
    localSignalReview:localReview,
    relationProvenance:relations,
    enrichmentFocusAbilityIds:focus,
    ...(hasTechnicalSemantic?{semanticCoverageTechnical:{...(model.learning?.semantic||{}),score:technicalSemanticScore,scorePct:pct(technicalSemanticScore),metric:'semanticCoverageTechnical'}}:{}),
    metricSemantics:{
      signalCoverage:'How much important GLOBAL BOSS signal weight is represented by accepted mechanics after proven friendly-player signals are excluded.',
      relationUnderstanding:'How mature origin-verified temporal/structural encounter relationships are.',
      semanticCoverageTechnical:'Technical semantic-needs coverage produced by the semantic discovery subsystem. It is not an alias of relationUnderstanding.',
      legacySemanticResolutionAliasRemoved:true,
    },
    recommendations:{learningNext,publicationNext},
    learningRecommendation:learningNext,
    publicationRecommendation:publicationNext,
    enrichmentRecommendation:publicationNext,
    needsEvidence:needs.slice(0,8),
  };
  model.validation={
    ...(model.validation||{}),
    thresholds,
    publishChecks:checks,
    publicationMode:'manual-review-hold-v3.7.9-signal-triage',
  };
  model.evaluatedAt=Date.now();
  return model;
}

export function applyBossSamplingPolicyV379(input,aggregate=null){
  return applySignalTriageOverlayV379(applyBossSamplingPolicyV378(input,aggregate),aggregate);
}

export function modelDiagnosticsV379(input,aggregate=null){
  const base=modelDiagnosticsV378(input,aggregate)||{};
  const model=applyBossSamplingPolicyV379(input,aggregate);
  if(!model)return null;
  return{
    ...base,
    engineVersion:model.engineVersion,
    learnedPct:model.learning?.scorePct,
    learningGrade:model.learning?.grade,
    learningComponents:model.learning?.components,
    learningBottleneck:model.learning?.bottleneck,
    actionBottleneck:model.learning?.actionBottleneck,
    publicationActionBottleneck:model.learning?.publicationActionBottleneck,
    signalTriage:model.learning?.signalTriage,
    localSignalReview:model.learning?.localSignalReview,
    relationProvenance:model.learning?.relationProvenance,
    recommendations:model.learning?.recommendations,
    enrichmentFocusAbilityIds:model.learning?.enrichmentFocusAbilityIds||[],
    enrichmentRecommendation:model.learning?.enrichmentRecommendation||null,
    publishChecks:model.validation?.publishChecks||{},
    thresholds:model.validation?.thresholds||{},
    publicationMode:model.validation?.publicationMode,
    policyVersion:model.policyVersion,
    evaluatedAt:model.evaluatedAt,
  };
}
