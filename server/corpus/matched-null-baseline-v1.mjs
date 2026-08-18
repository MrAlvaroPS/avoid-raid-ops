import { createHash } from 'node:crypto';
import { eventAbilityId } from '../wcl/normalization/events.mjs';

export const MATCHED_NULL_BASELINE_V1_VERSION='matched-null-baseline-v1';
export const MATCHED_NULL_BASELINE_PREVIEW_V1_VERSION='matched-null-baseline-preview-v1';
export const MATCHED_NULL_BASELINE_POLICY_V1_VERSION='matched-null-baseline-policy-v1';

export const MATCHED_NULL_BASELINE_DEFAULTS=Object.freeze({
  controlRadiusMs:2500,episodeGuardMs:2500,candidateOffsetMagnitudesMs:[12000,18000,24000,30000],maxControls:10,maxControlsPerSource:2,maxNormalizedFightDistance:0.20,
  minimumMatchedControls:6,minimumMatchedSources:3,minimumAnchorPrevalence:0.60,minimumSpecificityLift:1.75,minimumPrevalenceDelta:0.25,backgroundNoiseRatio:0.80,backgroundNoiseMaxDelta:0.15,
});

const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=(value,length=40)=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0,length);

function relativeBucket(delta){const abs=Math.abs(Number(delta)||0),distance=abs<=1000?'1s':abs<=2500?'2.5s':abs<=5000?'5s':'far';if(abs<=250)return`simultaneous-${distance}`;return`${delta<0?'before':'after'}-${distance}`;}
function patternKey(event,stream,referenceTimestamp){const abilityId=Number(eventAbilityId(event)),timestamp=finite(event?.timestamp);if(!Number.isFinite(abilityId)||timestamp==null)return null;return[relativeBucket(timestamp-Number(referenceTimestamp)),String(stream),abilityId,String(event?.type||'event')].join('|');}
function contextIdentity(row){return[row?.source,row?.reportCode,finite(row?.fightID)??'x',finite(row?.anchorTimestamp)??'x'].join('|');}
function semanticAnchorContexts(evidenceRecords=[],signalId,requiredRadiusMs=2500){
  const groups=new Map();
  for(const row of evidenceRecords||[]){
    if(row?.kind!=='context'||row?.pagination?.complete!==true||Number(row?.signalId)!==Number(signalId)||!Number.isFinite(Number(row?.anchorTimestamp))||!Number.isFinite(Number(row?.fightID)))continue;
    const key=contextIdentity(row);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
  }
  const anchors=[];let missingSufficientContext=0;
  for(const rows of groups.values()){
    const sufficient=rows.filter(row=>Number(row?.windowMs)>=Number(requiredRadiusMs)).sort((a,b)=>Number(a.windowMs)-Number(b.windowMs));
    if(!sufficient.length){missingSufficientContext++;continue;}
    const row=sufficient[0],reportCode=String(row.reportCode||'');if(!reportCode)continue;
    anchors.push({source:String(row.source||'unknown'),reportCode,fightID:Number(row.fightID),anchorTimestamp:Number(row.anchorTimestamp),anchorContextWindowMs:Number(row.windowMs),contextStreams:row.streams||{}});
  }
  return{anchors,totalAnchors:groups.size,missingSufficientContext};
}
function observedEpisodePatternKeys(anchor,wantedPatternKeys){
  const seen=new Set();
  for(const [stream,events] of Object.entries(anchor.contextStreams||{}))for(const event of events||[]){const key=patternKey(event,stream,anchor.anchorTimestamp);if(key&&wantedPatternKeys.has(key))seen.add(key);}
  return[...seen].sort();
}

function profileMap(profiles=[]){
  const out=new Map();
  for(const profile of profiles||[]){const code=String(profile?.code||'');if(!code)continue;const previous=out.get(code);if(!previous||String(profile?.kind)==='deep')out.set(code,profile);}
  return out;
}
function fightFor(profilesByCode,reportCode,fightID){return (profilesByCode.get(String(reportCode))?.fights||[]).find(row=>Number(row?.id)===Number(fightID))||null;}
function fightAt(profilesByCode,reportCode,timestamp){
  const time=finite(timestamp);if(time==null)return null;
  return (profilesByCode.get(String(reportCode))?.fights||[]).find(row=>time>=Number(row?.startTime)&&time<=Number(row?.endTime))||null;
}
function targetTimestamps(evidenceRecords=[],signalId,profilesByCode=new Map()){
  const map=new Map();
  const add=(reportCode,fightID,timestamp)=>{const t=finite(timestamp),fight=finite(fightID);if(t==null||fight==null||!reportCode)return;const key=`${String(reportCode)}|${fight}`;if(!map.has(key))map.set(key,new Set());map.get(key).add(t);};
  for(const row of evidenceRecords||[]){
    if(Number(row?.signalId)!==Number(signalId))continue;
    if(row?.kind==='context')add(row.reportCode,row.fightID,row.anchorTimestamp);
    if(row?.kind!=='anchor'||row?.pagination?.complete!==true)continue;
    for(const events of Object.values(row.streams||{}))for(const event of events||[]){
      if(Number(eventAbilityId(event))!==Number(signalId))continue;
      const direct=finite(event?.fightID??event?.fight);if(direct!=null){add(row.reportCode,direct,event?.timestamp);continue;}
      const inferred=fightAt(profilesByCode,row.reportCode,event?.timestamp);if(inferred){add(row.reportCode,inferred.id,event?.timestamp);continue;}
      const selected=(row?.fightIDs||[]).map(Number).filter(Number.isFinite);if(selected.length===1)add(row.reportCode,selected[0],event?.timestamp);
    }
  }
  return map;
}

function transitions(fight){return (fight?.phaseTransitions||[]).map(row=>({id:finite(row?.id),startTime:finite(row?.startTime)})).filter(row=>row.startTime!=null).sort((a,b)=>a.startTime-b.startTime);}
function phaseAt(fight,timestamp){const rows=transitions(fight);if(!rows.length)return null;let phase='initial';for(const row of rows){if(Number(row.startTime)>Number(timestamp))break;phase=row.id==null?`after:${row.startTime}`:`phase:${row.id}`;}return phase;}
function crossesTransition(fight,start,end){return transitions(fight).some(row=>row.startTime>=start&&row.startTime<=end);}
function episodeRadiusMs(episode){const values=(episode?.edges||[]).map(row=>finite(row?.temporalWindowMs)).filter(Number.isFinite);return Math.max(2500,...values);}
function normalizedFightTime(fight,timestamp){const start=finite(fight?.startTime),end=finite(fight?.endTime);if(start==null||end==null||!(end>start))return null;return(Math.max(start,Math.min(end,Number(timestamp)))-start)/(end-start);}

function roundRobinAnchors(anchors){
  const groups=new Map();for(const anchor of anchors){if(!groups.has(anchor.source))groups.set(anchor.source,[]);groups.get(anchor.source).push(anchor);}
  for(const rows of groups.values())rows.sort((a,b)=>a.reportCode.localeCompare(b.reportCode)||a.fightID-b.fightID||a.anchorTimestamp-b.anchorTimestamp);
  const sources=[...groups.keys()].sort(),out=[];let index=0;while(true){let added=false;for(const source of sources){const row=groups.get(source)?.[index];if(row){out.push(row);added=true;}}if(!added)break;index++;}return out;
}
function candidateOffsets(magnitudes,anchorIndex){const first=anchorIndex%2===0?1:-1,out=[];for(const magnitude of magnitudes){const value=Math.abs(Number(magnitude));out.push(first*value,-first*value);}return out;}
function rejectedCenterKey(reportCode,fightID,referenceTimestamp){return`${String(reportCode)}|${Number(fightID)}|${Number(referenceTimestamp)}`;}

function viableControl({anchor,anchorIndex,fight,knownTargets,selected,rejectedCenters,config,episodeRadius}){
  const start=finite(fight?.startTime),end=finite(fight?.endTime);if(start==null||end==null||!(end>start))return null;
  const anchorNorm=normalizedFightTime(fight,anchor.anchorTimestamp),anchorPhase=phaseAt(fight,anchor.anchorTimestamp),exclusionDistance=episodeRadius+config.controlRadiusMs+config.episodeGuardMs;
  for(const offset of candidateOffsets(config.candidateOffsetMagnitudesMs,anchorIndex)){
    const center=Number(anchor.anchorTimestamp)+offset,windowStart=center-config.controlRadiusMs,windowEnd=center+config.controlRadiusMs,contaminationWindowStart=center-exclusionDistance,contaminationWindowEnd=center+exclusionDistance;
    if(rejectedCenters.has(rejectedCenterKey(anchor.reportCode,anchor.fightID,center)))continue;
    if(contaminationWindowStart<start||contaminationWindowEnd>end)continue;
    const controlNorm=normalizedFightTime(fight,center);if(anchorNorm!=null&&controlNorm!=null&&Math.abs(controlNorm-anchorNorm)>config.maxNormalizedFightDistance)continue;
    const controlPhase=phaseAt(fight,center);if(anchorPhase!=null&&controlPhase!==anchorPhase)continue;
    if(crossesTransition(fight,windowStart,windowEnd))continue;
    if([...knownTargets].some(timestamp=>Math.abs(center-Number(timestamp))<=exclusionDistance))continue;
    if(selected.some(row=>row.reportCode===anchor.reportCode&&row.fightID===anchor.fightID&&Math.abs(Number(row.referenceTimestamp)-center)<=config.controlRadiusMs*2+1000))continue;
    return{source:anchor.source,reportCode:anchor.reportCode,fightID:anchor.fightID,referenceTimestamp:center,windowStart,windowEnd,windowMs:config.controlRadiusMs,anchorTimestamp:anchor.anchorTimestamp,anchorContextWindowMs:anchor.anchorContextWindowMs,anchorObservedPatternKeys:[...(anchor.anchorObservedPatternKeys||[])],anchorPatternFingerprint:anchor.anchorPatternFingerprint,
      contaminationGuardRadiusMs:exclusionDistance,contaminationWindowStart,contaminationWindowEnd,
      match:{sameFight:true,sameOutcome:true,phaseAvailable:anchorPhase!=null,phaseMatched:anchorPhase==null?null:controlPhase===anchorPhase,phase:anchorPhase,anchorNormalizedFightTime:anchorNorm,controlNormalizedFightTime:controlNorm,normalizedFightDistance:anchorNorm==null||controlNorm==null?null:Math.abs(controlNorm-anchorNorm),temporalDistanceMs:Math.abs(center-anchor.anchorTimestamp),episodeExclusionDistanceMs:exclusionDistance}};
  }
  return null;
}

function configFrom(input={}){
  const magnitudes=Array.isArray(input.candidateOffsetMagnitudesMs)?input.candidateOffsetMagnitudesMs.map(Number).filter(value=>Number.isFinite(value)&&Math.abs(value)>=5000&&Math.abs(value)<=120000):MATCHED_NULL_BASELINE_DEFAULTS.candidateOffsetMagnitudesMs;
  return{...MATCHED_NULL_BASELINE_DEFAULTS,...input,
    controlRadiusMs:Math.max(1000,Math.min(10000,Number(input.controlRadiusMs)||MATCHED_NULL_BASELINE_DEFAULTS.controlRadiusMs)),episodeGuardMs:Math.max(1000,Math.min(15000,Number(input.episodeGuardMs)||MATCHED_NULL_BASELINE_DEFAULTS.episodeGuardMs)),candidateOffsetMagnitudesMs:magnitudes.length?magnitudes:[...MATCHED_NULL_BASELINE_DEFAULTS.candidateOffsetMagnitudesMs],
    maxControls:Math.max(1,Math.min(24,Number(input.maxControls)||MATCHED_NULL_BASELINE_DEFAULTS.maxControls)),maxControlsPerSource:Math.max(1,Math.min(4,Number(input.maxControlsPerSource)||MATCHED_NULL_BASELINE_DEFAULTS.maxControlsPerSource)),maxNormalizedFightDistance:Math.max(.05,Math.min(.5,Number(input.maxNormalizedFightDistance)||MATCHED_NULL_BASELINE_DEFAULTS.maxNormalizedFightDistance)),minimumMatchedControls:Math.max(4,Math.min(20,Number(input.minimumMatchedControls)||MATCHED_NULL_BASELINE_DEFAULTS.minimumMatchedControls)),minimumMatchedSources:Math.max(2,Math.min(10,Number(input.minimumMatchedSources)||MATCHED_NULL_BASELINE_DEFAULTS.minimumMatchedSources))};
}

export function buildMatchedNullBaselinePlanV1({episode,evidenceRecords=[],profiles=[],rejectedControls=[],config:configInput={}}={}){
  if(!episode?.episodeId||!episode?.buildFingerprint)throw new Error('A persisted mechanic episode with buildFingerprint is required');
  const signalId=Number(episode?.anchor?.abilityId||0);if(!signalId)throw new Error('Episode anchor ability is required');
  const requestedConfig=configFrom(configInput),profilesByCode=profileMap(profiles),targets=targetTimestamps(evidenceRecords,signalId,profilesByCode),episodeRadius=episodeRadiusMs(episode),config={...requestedConfig,requestedControlRadiusMs:requestedConfig.controlRadiusMs,controlRadiusMs:Math.max(requestedConfig.controlRadiusMs,episodeRadius)},wantedPatternKeys=new Set((episode?.nodes||[]).filter(row=>row?.roleInEpisode!=='anchor'&&row?.patternKey).map(row=>String(row.patternKey))),anchorContexts=semanticAnchorContexts(evidenceRecords,signalId,episodeRadius),anchors=roundRobinAnchors(anchorContexts.anchors.map(anchor=>{const observed=observedEpisodePatternKeys(anchor,wantedPatternKeys);return{source:anchor.source,reportCode:anchor.reportCode,fightID:anchor.fightID,anchorTimestamp:anchor.anchorTimestamp,anchorContextWindowMs:anchor.anchorContextWindowMs,anchorObservedPatternKeys:observed,anchorPatternFingerprint:digest(observed,16)};}));
  const rejectedCenters=new Set((rejectedControls||[]).filter(row=>row?.validNull===false).map(row=>rejectedCenterKey(row.reportCode,row.fightID,row.referenceTimestamp)));
  const controls=[],sourceCounts=new Map(),deficits={missingFightProfile:0,missingSufficientAnchorContext:anchorContexts.missingSufficientContext,noViableSamePhaseWindow:0,sourceCap:0,previouslyContaminatedControls:rejectedCenters.size};
  for(let i=0;i<anchors.length&&controls.length<config.maxControls;i++){
    const anchor=anchors[i],count=Number(sourceCounts.get(anchor.source)||0);if(count>=config.maxControlsPerSource){deficits.sourceCap++;continue;}
    const fight=fightFor(profilesByCode,anchor.reportCode,anchor.fightID);if(!fight){deficits.missingFightProfile++;continue;}
    const knownTargets=targets.get(`${anchor.reportCode}|${anchor.fightID}`)||new Set([anchor.anchorTimestamp]);
    const control=viableControl({anchor,anchorIndex:i,fight,knownTargets,selected:controls,rejectedCenters,config,episodeRadius});if(!control){deficits.noViableSamePhaseWindow++;continue;}
    control.controlId=digest({episodeId:episode.episodeId,source:control.source,reportCode:control.reportCode,fightID:control.fightID,referenceTimestamp:control.referenceTimestamp,windowMs:control.windowMs,contaminationGuardRadiusMs:control.contaminationGuardRadiusMs,anchorPatternFingerprint:control.anchorPatternFingerprint},24);controls.push(control);sourceCounts.set(anchor.source,count+1);
  }
  const plannedSources=new Set(controls.map(row=>row.source));
  const planPayload={version:MATCHED_NULL_BASELINE_V1_VERSION,episodeId:episode.episodeId,episodeBuildFingerprint:episode.buildFingerprint,scope:episode.scope,signalId,config,controls:controls.map(row=>({controlId:row.controlId,source:row.source,reportCode:row.reportCode,fightID:row.fightID,referenceTimestamp:row.referenceTimestamp,windowMs:row.windowMs,contaminationGuardRadiusMs:row.contaminationGuardRadiusMs,anchorTimestamp:row.anchorTimestamp,anchorContextWindowMs:row.anchorContextWindowMs,anchorPatternFingerprint:row.anchorPatternFingerprint,anchorObservedPatternKeys:row.anchorObservedPatternKeys}))};
  return{version:MATCHED_NULL_BASELINE_V1_VERSION,policyVersion:MATCHED_NULL_BASELINE_POLICY_V1_VERSION,planFingerprint:digest(planPayload),episodeId:episode.episodeId,episodeBuildFingerprint:episode.buildFingerprint,scope:episode.scope,signalId,config,episodeRadiusMs:episodeRadius,
    anchorsKnown:anchorContexts.totalAnchors,anchorsAvailable:anchors.length,plannedControls:controls.length,plannedSources:plannedSources.size,sufficientByPlan:controls.length>=config.minimumMatchedControls&&plannedSources.size>=config.minimumMatchedSources,deficits,controls,
    evidenceContract:{sameFight:true,sameOutcome:true,phaseMatchedWhenAvailable:true,pairedAnchorComparison:true,anchorContextCoversEpisodeRadius:true,controlCoversEpisodeRadius:true,localFlankControlsUsed:false,episodeOverlapForbidden:true,exactFightIDsOnly:true,targetSignalContaminationMustBeRejected:true,targetSignalGuardRadiusValidated:true,innerControlEventsOnly:true,contaminatedControlsAreReplanned:true,canonicalDeepContribution:{reports:0,pulls:0},directScoreDelta:0,automaticPromotion:false}};
}

export function buildMatchedNullBaselinePreviewV1({plan,cacheRecords=[],maxWclCalls=20,maxContinuationRounds=1,eventLimit=1000,reservePct=.18,reservePoints=600}={}){
  if(!plan?.planFingerprint)throw new Error('Matched null plan is required');
  const compatibleCache=(cacheRecords||[]).filter(row=>row?.evidenceContract?.targetSignalGuardValidated===true&&row?.evidenceContract?.innerControlEventsOnly===true&&row?.evidenceContract?.pairedAnchorComparison===true),complete=new Set(compatibleCache.filter(row=>row?.pagination?.complete===true&&row?.validNull!==false).map(row=>String(row.controlId))),partial=new Set(compatibleCache.filter(row=>row&&row?.pagination?.complete!==true).map(row=>String(row.controlId))),pending=plan.controls.filter(row=>!complete.has(String(row.controlId)));
  const config={maxWclCalls:Math.max(1,Math.min(60,Number(maxWclCalls)||20)),maxContinuationRounds:Math.max(0,Math.min(3,Number(maxContinuationRounds)||1)),eventLimit:Math.max(100,Math.min(5000,Number(eventLimit)||1000)),reservePct:Math.max(.05,Math.min(.5,Number(reservePct)||.18)),reservePoints:Math.max(100,Number(reservePoints)||600)};
  return{version:MATCHED_NULL_BASELINE_PREVIEW_V1_VERSION,fingerprint:digest({previewVersion:MATCHED_NULL_BASELINE_PREVIEW_V1_VERSION,planFingerprint:plan.planFingerprint,config}),dryRun:true,executesWcl:false,wclCallsExecuted:0,
    episodeId:plan.episodeId,episodeBuildFingerprint:plan.episodeBuildFingerprint,scope:plan.scope,signalId:plan.signalId,anchorsKnown:plan.anchorsKnown,anchorsAvailable:plan.anchorsAvailable,plannedControls:plan.plannedControls,plannedSources:plan.plannedSources,
    completeCacheHits:plan.controls.filter(row=>complete.has(String(row.controlId))).length,partialCacheHits:plan.controls.filter(row=>partial.has(String(row.controlId))).length,controlsRemaining:pending.length,sufficientByPlan:plan.sufficientByPlan,deficits:plan.deficits,
    networkUpperBound:{preflightCalls:pending.length?1:0,initialControlCalls:pending.length,theoreticalContinuationCalls:pending.length*config.maxContinuationRounds,initialWclCalls:pending.length?1+pending.length:0,theoreticalWclCalls:pending.length?1+pending.length*(1+config.maxContinuationRounds):0,initialCombatEventCalls:pending.length,theoreticalCombatEventCalls:pending.length*(1+config.maxContinuationRounds)},
    executionPolicy:{manualConfirmationRequired:true,matchingFingerprintRequired:true,exactFightIDsOnly:true,wholeReportFallback:false,persistentCache:true,resumablePagination:true,pairedAnchorComparison:true,targetSignalGuardFetch:true,innerControlEventsOnly:true,controlCoversEpisodeRadius:true,hardWclCallCap:config.maxWclCalls,minimumRateLimitReservePct:config.reservePct,minimumRateLimitReservePoints:config.reservePoints,localFlankBaselineIsPromotionBaseline:false},evidenceContract:plan.evidenceContract,controls:plan.controls,config};
}

export function evaluateMatchedNullBaselineV1({episode,controlRecords=[],config:configInput={}}={}){
  if(!episode?.episodeId)throw new Error('Episode is required for matched baseline evaluation');
  const config=configFrom(configInput),allComplete=(controlRecords||[]).filter(row=>row?.pagination?.complete===true&&row?.kind==='matched-null-control'&&row?.evidenceContract?.targetSignalGuardValidated===true&&row?.evidenceContract?.innerControlEventsOnly===true&&row?.evidenceContract?.pairedAnchorComparison===true),complete=allComplete.filter(row=>row?.validNull!==false),sources=new Set(complete.map(row=>String(row.source))),patterns=(episode.nodes||[]).filter(row=>row?.roleInEpisode!=='anchor'&&row?.patternKey),hits=new Map(patterns.map(row=>[String(row.patternKey),0]));
  for(const control of complete){const seen=new Set();for(const [stream,events] of Object.entries(control.streams||{}))for(const event of events||[]){const key=patternKey(event,stream,control.referenceTimestamp);if(key&&hits.has(key))seen.add(key);}for(const key of seen)hits.set(key,Number(hits.get(key)||0)+1);}
  const baselineSufficient=complete.length>=config.minimumMatchedControls&&sources.size>=config.minimumMatchedSources;
  const rows=patterns.map(node=>{
    const key=String(node.patternKey),anchorHits=complete.filter(control=>Array.isArray(control?.anchorObservedPatternKeys)&&control.anchorObservedPatternKeys.includes(key)).length,anchorPrev=complete.length?anchorHits/complete.length:null,discoveryAnchorPrev=finite(node?.specificity?.anchorPrevalence),bgHits=Number(hits.get(key)||0),bgPrev=complete.length?bgHits/complete.length:null,smoothAnchor=complete.length?((anchorHits+.5)/(complete.length+1)):null,smoothBg=complete.length?((bgHits+.5)/(complete.length+1)):null,lift=smoothBg&&smoothBg>0?smoothAnchor/smoothBg:null,delta=anchorPrev==null||bgPrev==null?null:anchorPrev-bgPrev;
    let status='matched-baseline-insufficient';if(baselineSufficient){if(anchorPrev>=config.minimumAnchorPrevalence&&lift!=null&&lift>=config.minimumSpecificityLift&&delta>=config.minimumPrevalenceDelta)status='matched-specificity-supported';else if(bgPrev>=anchorPrev*config.backgroundNoiseRatio&&delta<=config.backgroundNoiseMaxDelta)status='matched-background-noise';else status='matched-specificity-partial';}
    return{patternKey:key,abilityId:Number(node.abilityId),displayName:node.displayName||null,disposition:node.disposition||null,matchedPairs:complete.length,anchorHits,anchorPrevalence:anchorPrev,discoveryAnchorPrevalence:discoveryAnchorPrev,matchedBackgroundHits:bgHits,matchedBackgroundPrevalence:bgPrev,lift,prevalenceDelta:delta,status};
  });
  return{version:MATCHED_NULL_BASELINE_V1_VERSION,policyVersion:MATCHED_NULL_BASELINE_POLICY_V1_VERSION,episodeId:episode.episodeId,episodeBuildFingerprint:episode.buildFingerprint,baselineSufficient,matchedPairs:complete.length,completeControls:complete.length,invalidControls:allComplete.length-complete.length,matchedSources:sources.size,minimumMatchedControls:config.minimumMatchedControls,minimumMatchedSources:config.minimumMatchedSources,patternAssessments:rows,
    summary:{supported:rows.filter(row=>row.status==='matched-specificity-supported').length,noise:rows.filter(row=>row.status==='matched-background-noise').length,partial:rows.filter(row=>row.status==='matched-specificity-partial').length,insufficient:rows.filter(row=>row.status==='matched-baseline-insufficient').length},
    promotionContribution:{matchedNullBaselineGate:baselineSufficient?'evidence-available':'insufficient',automaticPromotion:false,reason:baselineSufficient?'Paired matched-null evidence is available for later Promotion v3 evaluation; this module does not promote mechanics.':'Paired matched-null evidence does not yet meet the minimum coverage contract.'},
    evidenceContract:{sameFightControls:true,pairedAnchorComparison:true,anchorContextCoversEpisodeRadius:true,controlCoversEpisodeRadius:true,localFlankControlsUsed:false,targetSignalContaminationRejected:true,targetSignalGuardRadiusValidated:true,innerControlEventsOnly:true,sourceIndependenceNotYetClaimed:true,statisticalStabilityNotYetClaimed:true,holdoutNotYetClaimed:true,canonicalDeepContribution:{reports:0,pulls:0},directScoreDelta:0}};
}
