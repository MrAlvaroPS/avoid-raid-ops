import {
  discoverVariantFamilies,discoverStateDimensions,stateDimensionForAbility,alignmentForDimension,
  discoverRelationCandidates,signalCoverage,semanticCoverage,wideReportPresence,deepAbilityMetric,clamp01,tokenInfoForAbility
} from './discovery.mjs';

const clamp=clamp01;
const ratio=(a,b)=>Number(b)>0?Number(a||0)/Number(b):null;
const slug=s=>String(s||'mechanic').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'mechanic';
const pct=x=>x==null?null:100*x;
const deepMetric=deepAbilityMetric;
const widePresence=wideReportPresence;

function perPull(split,ability,cohort,kind){const den=cohort==='kill'?split.killPulls:split.wipePulls;const n=ability?.wide?.[cohort]?.[kind]?.count||0;return den>0?n/den:null;}
function completionRate(ability,cohort){const begins=deepMetric(ability,cohort,'begins');return begins?deepMetric(ability,cohort,'casts')/begins:null;}
function interruptRate(ability,cohort){const begins=deepMetric(ability,cohort,'begins');return begins?deepMetric(ability,cohort,'interrupts')/begins:null;}
function averageTargets(ability,cohort){const occ=deepMetric(ability,cohort,'damageOccurrences');return occ?deepMetric(ability,cohort,'damageTargets')/occ:null;}
function phaseBoundaryRate(ability,cohort){const casts=deepMetric(ability,cohort,'casts');return casts?deepMetric(ability,cohort,'phaseBoundaryCasts')/casts:null;}
function validationAbility(validation,id){return validation?.abilities?.[String(id)]||null;}
function semanticWeight(m){if(m.semanticInference==='enemy-aura-after-cast'||m.inference==='wrong-state-impact')return 2;if(m.category==='interrupt'||m.inference==='completed-cast-is-failure')return 1.6;if(m.inference==='stateful-impact-observed'||m.inference==='stateful-cast-observed')return 1.2;if(m.category==='avoidable-damage')return 1.3;if(m.category==='raid-damage'||m.category==='phase-boundary')return .55;return 1;}

function relationValidationScore(mechanic,validation){
  const rows=validation?.relations?.castToEnemyAura||{};let kNum=0,kDen=0,wNum=0,wDen=0;
  for(const sourceId of mechanic.triggerCastIds||[]){const row=rows[`${sourceId}>${mechanic.primaryAbilityId}`];if(!row)continue;kNum+=Number(row.kill?.linkedOccurrences||0);kDen+=Number(row.kill?.sourceOccurrences||0);wNum+=Number(row.wipe?.linkedOccurrences||0);wDen+=Number(row.wipe?.sourceOccurrences||0);}
  if(kDen+wDen<6)return .5;const kr=kDen?kNum/kDen:0,wr=wDen?wNum/wDen:0;return clamp(.42+.34*clamp((wr-kr)/.25)+.24*clamp((wr-.05)/.45));
}

function valScoreFor(mechanic,validation){
  if(mechanic.semanticInference==='enemy-aura-after-cast'||mechanic.inference==='enemy-aura-after-cast')return relationValidationScore(mechanic,validation);
  const a=validationAbility(validation,mechanic.primaryAbilityId);if(!a||validation.wideReports<8)return 0.5;
  if(mechanic.inference==='wrong-state-impact'){
    const dim={tokenGroup:mechanic.stateTokenGroup,tokens:mechanic.stateTokens||[]};const r=alignmentForDimension(a,dim,'kill'),w=alignmentForDimension(a,dim,'wipe');if(!r||r.known<6)return 0.5;const killGood=1-clamp((r.mismatch??.2)/.18);const separation=w?.known?clamp(((w.mismatch??0)-(r.mismatch??0)+.04)/.2):.5;return .65*killGood+.35*separation;
  }
  if(mechanic.inference==='stateful-impact-observed'||mechanic.inference==='stateful-cast-observed'){
    const kd=widePresence(validation,a,'kill',mechanic.damageIds?'Damage':'Casts'),wd=widePresence(validation,a,'wipe',mechanic.damageIds?'Damage':'Casts');return clamp(.55+.25*Math.max(kd,wd)+.2*(1-Math.min(1,Math.abs(kd-wd))));
  }
  if(mechanic.category==='interrupt'){
    const cr=completionRate(a,'kill'),ir=interruptRate(a,'kill'),cw=completionRate(a,'wipe');if(cr==null&&ir==null)return .5;return .55*clamp(((ir??0)-.45)/.5)+.25*clamp((.25-(cr??.25))/.25)+.2*(cw==null?.5:clamp(((cw-(cr??0))+.03)/.2));
  }
  if(mechanic.category==='phase-boundary'){
    const kp=widePresence(validation,a,'kill','Casts'),pb=phaseBoundaryRate(a,'kill');return .55*clamp(((kp??0)-.45)/.5)+.45*(pb==null?.5:clamp((pb-.45)/.5));
  }
  if(mechanic.category==='raid-damage'){
    const kp=widePresence(validation,a,'kill','Damage'),targets=averageTargets(a,'kill');return .65*clamp(((kp??0)-.55)/.45)+.35*(targets==null?.5:clamp((targets-4)/12));
  }
  if(mechanic.inference==='completed-cast-is-failure'||mechanic.inference==='wipe-associated-cast'){
    const kp=widePresence(validation,a,'kill','Casts')??0,wp=widePresence(validation,a,'wipe','Casts')??0;const cr=completionRate(a,'kill'),cw=completionRate(a,'wipe');const presence=clamp(.45+1.8*(wp-kp));const completion=cr==null||cw==null?.5:clamp(.45+2*(cw-cr));return .6*presence+.4*completion;
  }
  if(mechanic.inference==='failure-damage-by-occurrence'||mechanic.inference==='damage-distribution-only'){
    const kp=widePresence(validation,a,'kill','Damage')??0,wp=widePresence(validation,a,'wipe','Damage')??0;return clamp(.45+1.8*(wp-kp));
  }
  return .6;
}

function stateDimensionIds(dim){return new Set(Object.values(dim?.values||{}).flatMap(v=>v?.ids||[]).map(Number));}
function inferStateMechanic(id,a,train,dimensions){
  const state=stateDimensionForAbility(a,dimensions);if(!state)return null;const dimIds=stateDimensionIds(state.dimension);if(dimIds.has(Number(id)))return null;
  const hasDamage=Math.max(widePresence(train,a,'kill','Damage'),widePresence(train,a,'wipe','Damage'))>.02||(deepMetric(a,'kill','damageOccurrences')+deepMetric(a,'wipe','damageOccurrences'))>0;
  const hasCast=Math.max(widePresence(train,a,'kill','Casts'),widePresence(train,a,'wipe','Casts'))>.02||(deepMetric(a,'kill','begins')+deepMetric(a,'wipe','begins'))>0;
  if(!hasDamage&&!hasCast)return null;
  const k=alignmentForDimension(a,state.dimension,'kill'),w=alignmentForDimension(a,state.dimension,'wipe');
  const base={key:slug(a.name),name:a.name,category:'assignment',severity:4,requiredState:{dimension:state.dimension.key,value:state.requiredValue},stateTokenGroup:state.dimension.tokenGroup,stateTokens:state.dimension.tokens,statePairKey:k?.pairKey||state.dimension.pairKey||null,stateValueIds:state.dimension.values?.[state.requiredValue]?.ids||[],confidence:state.dimension.confidence,primaryAbilityId:Number(id),expectedAction:`Resolve ${a.name} with the matching ${state.dimension.key} state.`};
  if(hasDamage&&k?.known>=12){const killMismatch=k.mismatch??1,wipeMismatch=w?.mismatch??killMismatch;const confidence=clamp(.48+.27*state.dimension.confidence+.17*clamp((.12-killMismatch)/.12)+.08*clamp((wipeMismatch-killMismatch+.03)/.16));if(killMismatch<=.14&&confidence>=.68)return{...base,scoreable:true,inference:'wrong-state-impact',damageIds:[Number(id)],confidence,expectedAction:`Only the matching ${state.dimension.key} state should take ${a.name}.`};}
  if(hasDamage)return{...base,scoreable:false,inference:'stateful-impact-observed',damageIds:[Number(id)],confidence:clamp(.55+.35*state.dimension.confidence),expectedAction:`${a.name} is linked to the ${state.requiredValue} side of the inferred ${state.dimension.key} state; player blame remains disabled until per-target alignment validates.`};
  if(hasCast)return{...base,scoreable:false,inference:'stateful-cast-observed',castIds:[Number(id)],confidence:clamp(.52+.35*state.dimension.confidence),expectedAction:`${a.name} belongs to the ${state.requiredValue} side of the inferred ${state.dimension.key} state.`};
  return null;
}

function inferAbility(id,a,train,dimensions){
  const kpCast=widePresence(train,a,'kill','Casts')??0,wpCast=widePresence(train,a,'wipe','Casts')??0,kpDamage=widePresence(train,a,'kill','Damage')??0,wpDamage=widePresence(train,a,'wipe','Damage')??0;
  const beginsK=deepMetric(a,'kill','begins'),beginsW=deepMetric(a,'wipe','begins'),irK=interruptRate(a,'kill'),crK=completionRate(a,'kill'),crW=completionRate(a,'wipe'),targetsK=averageTargets(a,'kill'),pbK=phaseBoundaryRate(a,'kill');
  const state=stateDimensionForAbility(a,dimensions);
  if(beginsK+beginsW>=16&&(irK??0)>=.55&&(crK??1)<=.28){
    const confidence=clamp(.52+.25*clamp(((irK??0)-.55)/.4)+.23*clamp(((crW??crK??0)-(crK??0)+.02)/.18));
    return[{key:slug(a.name),name:a.name,category:'interrupt',severity:5,scoreable:true,inference:'completed-cast-is-failure',castIds:[Number(id)],...(state?{requiredState:{dimension:state.dimension.key,value:state.requiredValue},stateTokenGroup:state.dimension.tokenGroup,stateTokens:state.dimension.tokens}:{}),confidence,primaryAbilityId:Number(id),expectedAction:`Interrupt ${a.name} before the cast completes.`}];
  }
  const stateMechanic=inferStateMechanic(id,a,train,dimensions);if(stateMechanic)return[stateMechanic];

  // Do not claim that every cast near a boundary *is* the transition. It is safe observational data.
  if(kpCast>=.65&&(pbK??0)>=.62){
    return[{key:slug(a.name),name:a.name,category:'phase-boundary',severity:1,scoreable:false,inference:'phase-boundary-observed',castIds:[Number(id)],confidence:clamp(.5+.22*kpCast+.28*(pbK??0)),primaryAbilityId:Number(id),expectedAction:'Observed consistently near an encounter phase boundary; not scored as a failure without stronger causal evidence.'}];
  }
  if(kpDamage>=.72&&(targetsK??0)>=6){
    return[{key:slug(a.name),name:a.name,category:'raid-damage',severity:2,scoreable:false,inference:'pressure-window',damageIds:[Number(id)],confidence:clamp(.48+.28*kpDamage+.24*clamp(((targetsK??0)-6)/14)),primaryAbilityId:Number(id),expectedAction:`Plan healing and defensive coverage for ${a.name}.`}];
  }

  const presenceLift=wpCast-kpCast,completionLift=(crW!=null&&crK!=null)?crW-crK:null;
  if(kpCast<=.16&&wpCast>=Math.max(.1,kpCast+.07)&&(perPull(train,a,'wipe','Casts')??0)>.025){
    const hasDeep=beginsK+beginsW>=10;const causal=hasDeep&&completionLift!=null&&completionLift>=.08&&crK<=.35;const confidence=clamp(.5+1.1*Math.max(0,presenceLift)+.25*(causal?clamp(completionLift/.3):0));
    return[{key:slug(a.name),name:a.name,category:causal?'dangerous-cast':'wipe-associated-cast',severity:causal?4:3,scoreable:Boolean(causal),inference:causal?'completed-cast-is-failure':'wipe-associated-cast',castIds:[Number(id)],confidence,primaryAbilityId:Number(id),expectedAction:causal?`Prevent ${a.name} from completing when the encounter allows it.`:`${a.name} is strongly enriched in wipes, but completion is not yet proven to be a failure.`}];
  }
  if(kpDamage<=.5&&wpDamage>=kpDamage+.1){
    const hasCast=(kpCast+wpCast)>0.03;const deaths=deepMetric(a,'wipe','deathLinks')+deepMetric(a,'kill','deathLinks');const confidence=clamp(.46+1.25*(wpDamage-kpDamage)+.12*clamp(deaths/8));return[{key:slug(a.name),name:a.name,category:'avoidable-damage',severity:4,scoreable:hasCast&&deaths>0,inference:hasCast&&deaths>0?'failure-damage-by-occurrence':'damage-distribution-only',castIds:hasCast&&deaths>0?[Number(id)]:undefined,failureDamageIds:hasCast&&deaths>0?[Number(id)]:undefined,damageIds:hasCast&&deaths>0?undefined:[Number(id)],confidence,primaryAbilityId:Number(id),expectedAction:`Avoid or correctly resolve ${a.name}; wipe reports show elevated exposure.`}];
  }
  return[];
}

function inferRelationMechanics(train,families){
  const out=[];for(const rel of discoverRelationCandidates(train,families)){
    if(rel.confidence<.62)continue;const target=train.abilities?.[String(rel.targetId)]||{name:`Ability ${rel.targetId}`};const family=families.find(f=>f.key===rel.familyKey);const familyName=family?.base||'upstream mechanic';out.push({key:slug(target.name),name:target.name,category:family?.tokenGroup?'assignment':'failure-signal',severity:5,scoreable:true,inference:'failure-aura-is-failure',semanticInference:'enemy-aura-after-cast',triggerCastIds:rel.triggerCastIds,opportunityCastIds:rel.triggerCastIds,failureAuraIds:[rel.targetId],confidence:rel.confidence,primaryAbilityId:rel.targetId,relation:{killRate:rel.killRate,wipeRate:rel.wipeRate,lift:rel.lift,meanDeltaMs:rel.edges?.map(e=>e.meanDeltaMs).filter(Number.isFinite).reduce((a,b,_,arr)=>a+b/arr.length,0)||null},expectedAction:`Resolve ${familyName} correctly; ${target.name} appears as a wipe-enriched enemy aura after failed executions.`});}
  return out;
}

function candidatePriority(m){if(m.semanticInference==='enemy-aura-after-cast'||m.inference==='enemy-aura-after-cast')return 6;if(m.inference==='wrong-state-impact')return 5.8;if(m.category==='interrupt')return 5.5;if(m.inference==='stateful-impact-observed'||m.inference==='stateful-cast-observed')return 4.5;if(m.inference==='completed-cast-is-failure')return 4;if(m.category==='avoidable-damage')return 3;if(m.category==='raid-damage')return 2;if(m.category==='phase-boundary')return 1;return 2.5;}
function dedupeCandidates(candidates){
  const sorted=[...candidates].sort((a,b)=>(candidatePriority(b)-candidatePriority(a))||((b.confidence||0)-(a.confidence||0)));const claimed=new Map(),out=[];
  for(const m of sorted){const id=Number(m.primaryAbilityId);const prev=claimed.get(id);if(prev&&candidatePriority(prev)>=candidatePriority(m)&&prev.inference!==m.inference)continue;claimed.set(id,m);out.push(m);}return out;
}

function buildStatePack(dimensions){return dimensions.filter(d=>d.confidence>=.62).map(d=>({key:d.key,tokenGroup:d.tokenGroup,values:d.values,confidence:d.confidence,source:d.source,evidence:d.evidence}));}
function gradeFor(score){if(score>=95)return'VERIFIED';if(score>=85)return'MATURE';if(score>=70)return'STRONG';if(score>=50)return'PARTIAL';if(score>=25)return'LEARNING';return'DISCOVERY';}
function capRatio(v,target){return clamp(Number(v||0)/Math.max(1,Number(target)||1));}

function buildLearning({aggregate,train,validation,mechanics,validationMean,dimensions,families,relations,thresholds}){
  const widePulls=Number(aggregate.killPulls||0)+Number(aggregate.wipePulls||0),explicitDeepPulls=Number(aggregate.deepKillPulls||0)+Number(aggregate.deepWipePulls||0),deepPulls=explicitDeepPulls>0?explicitDeepPulls:Number(aggregate.deepReports||0);const independentSources=Object.keys(aggregate.sourceReports||{}).length||Number(aggregate.independentSources||0)||Number(aggregate.wideReports||0);const validationSources=Object.keys(validation?.sourceReports||{}).length||Math.min(Number(validation?.wideReports||0),independentSources);
  const dataDepth=.26*capRatio(widePulls,thresholds.minWidePulls)+.22*capRatio(deepPulls,thresholds.minDeepPulls)+.20*capRatio(aggregate.wideReports,thresholds.minWideReports)+.16*capRatio(aggregate.deepReports,thresholds.minDeepReports)+.16*capRatio(validation?.wideReports||0,thresholds.minValidationReports);
  const diversity=.65*capRatio(independentSources,thresholds.minIndependentSources)+.35*capRatio(validationSources,thresholds.minValidationSources);
  const signal=signalCoverage(train,mechanics);const semantic=semanticCoverage(train,mechanics,dimensions,families,relations);const breadth=signal.total?clamp(mechanics.reduce((s,m)=>s+semanticWeight(m),0)/Math.max(4,signal.total*1.2)):1;const holdout=clamp(validationMean*(.68+.32*breadth));
  let raw=.22*dataDepth+.22*holdout+.24*signal.score+.22*semantic.score+.10*diversity;const caps=[];
  if(signal.criticalUnresolved.length){raw=Math.min(raw,.79);caps.push('critical-unresolved-signals');}
  const statefulFamilies=families.filter(f=>Math.max(f.damageScore,f.castScore)>=.12&&dimensions.some(d=>d.tokenGroup===f.tokenGroup));if(statefulFamilies.length&&!dimensions.some(d=>d.confidence>=.72)){raw=Math.min(raw,.69);caps.push('state-model-unresolved');}
  if(deepPulls<Math.min(100,thresholds.minDeepPulls)){raw=Math.min(raw,.74);caps.push('deep-evidence-thin');}
  const scorePct=Math.round(clamp(raw)*1000)/10;const components={dataDepthPct:Math.round(dataDepth*1000)/10,holdoutPct:Math.round(holdout*1000)/10,signalCoveragePct:Math.round(signal.score*1000)/10,semanticResolutionPct:Math.round(semantic.score*1000)/10,diversityPct:Math.round(diversity*1000)/10};const bottleneck=Object.entries(components).sort((a,b)=>a[1]-b[1])[0]?.[0]||'unknown';
  const wideDef=Math.max(0,thresholds.minWidePulls-widePulls),deepDef=Math.max(0,thresholds.minDeepPulls-deepPulls),reportDef=Math.max(0,thresholds.minWideReports-aggregate.wideReports),validationDef=Math.max(0,thresholds.minValidationReports-(validation?.wideReports||0));let recommendation;
  if(scorePct>=thresholds.minLearnedPct&&semantic.score>=thresholds.minSemanticCoverage&&signal.score>=thresholds.minSignalCoverage&&!signal.criticalUnresolved.length){recommendation={priority:'low',mode:'review-or-publish',suggestedAdditionalWidePulls:wideDef,suggestedAdditionalDeepPulls:deepDef,reason:'Model understanding is mature; enrich only to clear remaining statistical publication gates.'};}
  else if(semantic.score<.58&&dataDepth>=.45){recommendation={priority:'high',mode:'targeted-deep',suggestedAdditionalWidePulls:Math.min(500,wideDef),suggestedAdditionalDeepPulls:Math.max(100,Math.min(300,deepDef||150)),reason:'Semantics, not raw sample size, are the main bottleneck. Prefer deep event/state evidence over a large blind wide-corpus increase.'};}
  else if(diversity<.65){recommendation={priority:'high',mode:'diversity-first',suggestedAdditionalWidePulls:Math.max(500,Math.min(1500,wideDef||500)),suggestedAdditionalDeepPulls:Math.max(50,Math.min(200,deepDef||100)),reason:'Independent-source/holdout diversity is limiting confidence; enrich across more raid groups.'};}
  else {const addWide=Math.max(500,Math.min(1500,Math.ceil((wideDef||500)/500)*500));recommendation={priority:'medium',mode:'wide-and-deep',suggestedAdditionalWidePulls:addWide,suggestedAdditionalDeepPulls:Math.max(100,Math.min(250,deepDef||100)),reason:'More corpus depth should materially improve confidence and holdout coverage.'};}
  return{meaning:'Evidence-weighted encounter model maturity, not a literal percentage of every mechanic in the game.',scorePct,grade:gradeFor(scorePct),components,bottleneck,caps,criticalUnresolvedSignals:signal.criticalUnresolved,signalCoverage:{resolved:signal.resolved,total:signal.total},semantic:{resolvedNeeds:semantic.resolvedNeeds,totalNeeds:semantic.totalNeeds,stateDimensions:semantic.stateDimensions,variantFamilies:semantic.variantFamilies,relationCandidates:semantic.relationCandidates},enrichmentRecommendation:recommendation};
}

export function compileEncounterModel(aggregate,{minWideReports=100,minWideReportsToPublish=250,minDeepReportsToPublish=50,minValidationReportsToPublish=50,minWidePullsToPublish=2500,minDeepPullsToPublish=300,minIndependentSourcesToPublish=50,minValidationSourcesToPublish=12,minValidationMeanToPublish=.66,minLearnedPctToPublish=82,minSemanticCoverageToPublish=.70,minSignalCoverageToPublish=.75,maxCriticalUnresolvedToPublish=0}={}){
  const train=aggregate?.splits?.train,validation=aggregate?.splits?.validation;if(!train)throw new Error('Corpus aggregate has no training split');
  const families=discoverVariantFamilies(train),dimensions=discoverStateDimensions(train),relations=discoverRelationCandidates(train,families);const candidates=[];
  candidates.push(...inferRelationMechanics(train,families));
  for(const [id,a] of Object.entries(train.abilities||{}))candidates.push(...inferAbility(id,a,train,dimensions));
  const deduped=dedupeCandidates(candidates);const unique=[];const seen=new Set();
  for(const m of deduped.sort((a,b)=>(candidatePriority(b)-candidatePriority(a))||((b.confidence||0)-(a.confidence||0)))){let key=m.key;let i=2;while(seen.has(key))key=`${m.key}-${i++}`;seen.add(key);m.key=key;m.validationScore=valScoreFor(m,validation);const minConf=m.scoreable?.72:.64,minVal=m.scoreable?.62:.56;m.accepted=m.confidence>=minConf&&m.validationScore>=minVal;unique.push(m);}
  const mechanics=unique.filter(m=>m.accepted).map(m=>{const {accepted,validationScore,confidence,primaryAbilityId,statePairKey,stateTokenGroup,stateTokens,...rule}=m;return{...rule,generated:{trainingConfidence:confidence,validationScore,primaryAbilityId,statePairKey:statePairKey||null,stateTokenGroup:stateTokenGroup||null,stateTokens:stateTokens||null,semanticWeight:semanticWeight(m)}};});
  const rejected=unique.filter(m=>!m.accepted).map(m=>({key:m.key,name:m.name,category:m.category,inference:m.inference,primaryAbilityId:m.primaryAbilityId,trainingConfidence:m.confidence,validationScore:m.validationScore,reason:m.confidence<(m.scoreable?.72:.64)?'training-confidence':'holdout-validation'}));
  const accepted=unique.filter(m=>m.accepted);const valWeight=accepted.reduce((s,m)=>s+semanticWeight(m),0);const validationMean=valWeight?accepted.reduce((s,m)=>s+m.validationScore*semanticWeight(m),0)/valWeight:0;
  const compileReady=aggregate.wideReports>=minWideReports&&validation?.wideReports>=20;
  const widePulls=Number(aggregate.killPulls||0)+Number(aggregate.wipePulls||0),explicitDeepPulls=Number(aggregate.deepKillPulls||0)+Number(aggregate.deepWipePulls||0),deepPulls=explicitDeepPulls>0?explicitDeepPulls:Number(aggregate.deepReports||0);
  const sourceCount=Object.keys(aggregate.sourceReports||{}).length,independentSources=sourceCount||Number(aggregate.independentSources||0)||Number(aggregate.wideReports||0);const validationSourceCount=Object.keys(validation?.sourceReports||{}).length,validationSources=validationSourceCount||Math.min(Number(validation?.wideReports||0),independentSources);
  const thresholds={minWideReports:minWideReportsToPublish,minDeepReports:minDeepReportsToPublish,minWidePulls:minWidePullsToPublish,minDeepPulls:minDeepPullsToPublish,minIndependentSources:minIndependentSourcesToPublish,minValidationSources:minValidationSourcesToPublish,minValidationReports:minValidationReportsToPublish,minMeanScore:minValidationMeanToPublish,minLearnedPct:minLearnedPctToPublish,minSemanticCoverage:minSemanticCoverageToPublish,minSignalCoverage:minSignalCoverageToPublish,maxCriticalUnresolved:maxCriticalUnresolvedToPublish};
  const learning=buildLearning({aggregate,train,validation,mechanics,validationMean,dimensions,families,relations,thresholds});const signalScore=learning.components.signalCoveragePct/100,semanticScore=learning.components.semanticResolutionPct/100;
  const publishChecks={wideReports:aggregate.wideReports>=minWideReportsToPublish,deepReports:aggregate.deepReports>=minDeepReportsToPublish,widePulls:widePulls>=minWidePullsToPublish,deepPulls:deepPulls>=minDeepPullsToPublish,independentSources:independentSources>=minIndependentSourcesToPublish,validationSources:validationSources>=minValidationSourcesToPublish,validationReports:(validation?.wideReports||0)>=minValidationReportsToPublish,acceptedMechanics:mechanics.length>0,validationMean:validationMean>=minValidationMeanToPublish,learningScore:learning.scorePct>=minLearnedPctToPublish,semanticCoverage:semanticScore>=minSemanticCoverageToPublish,signalCoverage:signalScore>=minSignalCoverageToPublish,criticalUnresolved:learning.criticalUnresolvedSignals.length<=maxCriticalUnresolvedToPublish};
  const publishReady=compileReady&&Object.values(publishChecks).every(Boolean);const generatedAt=Date.now();
  return{schemaVersion:2,engineVersion:'3.7.0',status:publishReady?'published':'candidate',source:'generated-wcl-corpus',encounterId:aggregate.encounterId,difficulty:aggregate.difficulty,partition:aggregate.partition,resolvedPartition:aggregate.resolvedPartition??null,generatedAt,corpus:{wideReports:aggregate.wideReports,deepReports:aggregate.deepReports,killPulls:aggregate.killPulls,wipePulls:aggregate.wipePulls,deepKillPulls:aggregate.deepKillPulls||0,deepWipePulls:aggregate.deepWipePulls||0,independentSources,deepSources:Object.keys(aggregate.deepSourceReports||{}).length,discoveredSourcePool:Number(aggregate.discoveredSourcePool||0),trainingReports:train.wideReports,validationReports:validation?.wideReports||0,trainingSources:Object.keys(train.sourceReports||{}).length||train.wideReports,validationSources,validationFraction:aggregate.validationFraction,splitPolicy:'source-isolated-train-holdout'},validation:{acceptedMechanics:mechanics.length,rejectedMechanics:rejected.length,meanScore:validationMean,publishChecks,thresholds},learning,discovery:{stateDimensions:buildStatePack(dimensions),variantFamilies:families.slice(0,40).map(f=>({key:f.key,base:f.base,tokenGroup:f.tokenGroup,primary:f.primary,confidence:f.confidence,auraScore:f.auraScore,damageScore:f.damageScore,castScore:f.castScore})),relationCandidates:relations.slice(0,40)},pack:{id:aggregate.encounterId,slug:`generated-${aggregate.encounterId}`,name:aggregate.encounter?.name||`Encounter ${aggregate.encounterId}`,difficulty:aggregate.difficulty,partition:aggregate.partition,version:`generated-${generatedAt}`,source:'generated-wcl-corpus',stateDimensions:buildStatePack(dimensions),mechanics},rejected};
}

export function modelDiagnostics(model){return{status:model.status,engineVersion:model.engineVersion,wideReports:model.corpus.wideReports,deepReports:model.corpus.deepReports,killPulls:model.corpus.killPulls,wipePulls:model.corpus.wipePulls,deepKillPulls:model.corpus.deepKillPulls||0,deepWipePulls:model.corpus.deepWipePulls||0,independentSources:model.corpus.independentSources||0,deepSources:model.corpus.deepSources||0,validationSources:model.corpus.validationSources||0,acceptedMechanics:model.validation.acceptedMechanics,rejectedMechanics:model.validation.rejectedMechanics,validationScore:pct(model.validation.meanScore),learnedPct:Number(model.learning?.scorePct??0),learningGrade:model.learning?.grade||null,learningComponents:model.learning?.components||null,learningBottleneck:model.learning?.bottleneck||null,enrichmentRecommendation:model.learning?.enrichmentRecommendation||null,criticalUnresolvedSignals:model.learning?.criticalUnresolvedSignals||[],semantic:model.learning?.semantic||null,publishChecks:model.validation.publishChecks||null,thresholds:model.validation.thresholds||null};}
