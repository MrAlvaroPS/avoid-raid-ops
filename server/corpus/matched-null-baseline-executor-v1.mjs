import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { CORPUS_RATE_LIMIT_QUERY } from '../wcl/queries/corpus.mjs';
import { eventAbilityId } from '../wcl/normalization/events.mjs';
import { fetchSemanticEventBundle } from './semantic-probe-wcl-v1.mjs';
import { corpusGet,corpusSet } from './storage.mjs';
import { corpusId } from './keys.mjs';
import { buildMatchedNullBaselinePreviewV1,evaluateMatchedNullBaselineV1 } from './matched-null-baseline-v1.mjs';

export const MATCHED_NULL_BASELINE_EXECUTOR_V1_VERSION='matched-null-baseline-executor-v1';
export const MATCHED_NULL_BASELINE_STORAGE_V1_VERSION='matched-null-baseline-storage-v2';

const finite=value=>Number.isFinite(Number(value))?Number(value):null;
function baseKey(plan){return`matched-null-baselines/${corpusId(plan.scope)}/${Number(plan.signalId)}/${String(plan.episodeBuildFingerprint)}`;}
export function matchedNullControlEvidenceKey(plan,control){return`${baseKey(plan)}/evidence/${String(control.controlId)}.json`;}
export function matchedNullRunKey(plan,previewFingerprint){return`${baseKey(plan)}/runs/${String(previewFingerprint)}.json`;}

function rateState(rate,{reservePct=.18,reservePoints=600}={}){if(!rate)return null;const limit=Number(rate.limitPerHour)||0,spent=Number(rate.pointsSpentThisHour)||0,remaining=Math.max(0,limit-spent),reserve=Math.max(Number(reservePoints)||0,limit*(Number(reservePct)||0));return{limitPerHour:limit,pointsSpentThisHour:spent,pointsRemaining:remaining,pointsResetIn:Number(rate.pointsResetIn)||0,reservePoints:reserve,canContinue:!limit||remaining>reserve};}
class MatchedNullBudgetStop extends Error{constructor(message,reason){super(message);this.name='MatchedNullBudgetStop';this.reason=reason;}}
function compactEvent(event,stream){return{stream,timestamp:finite(event?.timestamp),fightID:finite(event?.fight??event?.fightID),type:event?.type||null,abilityId:eventAbilityId(event)};}
function compactStreams(streams={},windowStart=null,windowEnd=null){
  const start=finite(windowStart),end=finite(windowEnd);
  return Object.fromEntries(Object.entries(streams).map(([stream,events])=>[stream,(events||[]).filter(event=>{const timestamp=finite(event?.timestamp);return timestamp!=null&&(start==null||timestamp>=start)&&(end==null||timestamp<=end);}).map(event=>compactEvent(event,stream))]));
}
function containsSignal(streams,signalId){for(const events of Object.values(streams||{}))for(const event of events||[])if(Number(eventAbilityId(event))===Number(signalId))return true;return false;}
function compatibleEvidence(row){return row?.evidenceContract?.targetSignalGuardValidated===true&&row?.evidenceContract?.innerControlEventsOnly===true;}

export function buildMatchedNullControlEvidenceRecordV1(plan,control,bundle,{priorTargetSignalObserved=false}={}){
  const targetSignalObserved=Boolean(priorTargetSignalObserved)||containsSignal(bundle?.streams||{},plan.signalId),compact=compactStreams(bundle?.streams||{},control.windowStart,control.windowEnd);
  return{version:MATCHED_NULL_BASELINE_STORAGE_V1_VERSION,kind:'matched-null-control',signalId:Number(plan.signalId),episodeId:plan.episodeId,episodeBuildFingerprint:plan.episodeBuildFingerprint,controlId:String(control.controlId),source:String(control.source),reportCode:String(control.reportCode),fightID:Number(control.fightID),referenceTimestamp:Number(control.referenceTimestamp),windowMs:Number(control.windowMs),windowStart:Number(control.windowStart),windowEnd:Number(control.windowEnd),anchorTimestamp:Number(control.anchorTimestamp),contaminationWindowStart:Number(control.contaminationWindowStart),contaminationWindowEnd:Number(control.contaminationWindowEnd),contaminationGuardRadiusMs:Number(control.contaminationGuardRadiusMs),match:control.match,
    streams:compact,pagination:bundle?.pagination||null,rateLimit:bundle?.rateLimit||null,contamination:{targetSignalObserved,guardRadiusMs:Number(control.contaminationGuardRadiusMs)},validNull:!targetSignalObserved,invalidReason:targetSignalObserved?'target-signal-observed-inside-episode-guard':null,
    evidenceContract:{actorIdsPersisted:false,actorNamesPersisted:false,targetSignalGuardValidated:true,innerControlEventsOnly:true,combatEventsQueriedWithinEpisodeGuard:true,patternEventsPersistedWithinExactControlWindow:true,canonicalDeepContribution:{reports:0,pulls:0},directScoreDelta:0,automaticPromotion:false}};
}

export async function loadMatchedNullCacheV1({plan,storageGet=corpusGet}={}){const rows=[];for(const control of plan?.controls||[]){const value=await storageGet(matchedNullControlEvidenceKey(plan,control)).catch(()=>null);if(value)rows.push(value);}return rows;}

export async function executeMatchedNullBaselineV1({plan,episode,previewFingerprint,confirmExecution=false,maxWclCalls=20,maxContinuationRounds=1,eventLimit=1000,reservePct=.18,reservePoints=600,fetcher=wclGraphql,storageGet=corpusGet,storageSet=corpusSet}={}){
  if(!plan?.planFingerprint||!episode?.episodeId)throw new Error('Matched null execution requires plan and episode');
  const initialCache=await loadMatchedNullCacheV1({plan,storageGet}),preview=buildMatchedNullBaselinePreviewV1({plan,cacheRecords:initialCache,maxWclCalls,maxContinuationRounds,eventLimit,reservePct,reservePoints});
  if(confirmExecution!==true)throw new Error('Matched null baseline execution is manual-only: confirmExecution:true is required');
  if(!previewFingerprint||String(previewFingerprint)!==preview.fingerprint)throw new Error('Matched null baseline preview fingerprint is missing or stale');

  const compatibleCache=initialCache.filter(compatibleEvidence),completeById=new Map(compatibleCache.filter(row=>row?.pagination?.complete===true).map(row=>[String(row.controlId),row])),partialById=new Map(compatibleCache.filter(row=>row&&row?.pagination?.complete!==true).map(row=>[String(row.controlId),row])),pending=plan.controls.filter(control=>!completeById.has(String(control.controlId)));
  let calls=0,rate=null,lastQuery=null,status='complete',stopReason=null;
  const runQuery=async(query,variables,meta)=>{
    if(calls>=preview.config.maxWclCalls)throw new MatchedNullBudgetStop('Matched null hard WCL call cap reached','hard-call-cap');
    if(rate&&rate.canContinue===false)throw new MatchedNullBudgetStop('Matched null WCL reserve reached','rate-reserve');
    calls++;lastQuery=meta||null;const data=await fetcher(query,variables);if(data?.rateLimitData)rate=rateState(data.rateLimitData,{reservePct:preview.config.reservePct,reservePoints:preview.config.reservePoints});return data;
  };

  if(pending.length){
    try{
      const preflight=await runQuery(CORPUS_RATE_LIMIT_QUERY,{}, {kind:'matched-null-rate-preflight'});if(preflight?.rateLimitData)rate=rateState(preflight.rateLimitData,{reservePct:preview.config.reservePct,reservePoints:preview.config.reservePoints});if(rate&&rate.canContinue===false)throw new MatchedNullBudgetStop('Matched null reserve would be violated before evidence queries','rate-reserve');
      for(const control of pending){
        const key=matchedNullControlEvidenceKey(plan,control),partial=partialById.get(String(control.controlId));
        let targetSignalObserved=Boolean(partial?.contamination?.targetSignalObserved);
        const resumeBundle=partial?{streams:partial.streams,pagination:partial.pagination,rateLimit:partial.rateLimit}:null;
        const persistProgress=async progress=>{const record=buildMatchedNullControlEvidenceRecordV1(plan,control,progress,{priorTargetSignalObserved:targetSignalObserved});targetSignalObserved=record.contamination.targetSignalObserved;await storageSet(key,record);if(progress?.pagination?.complete===true)completeById.set(String(control.controlId),record);else partialById.set(String(control.controlId),record);};
        const bundle=await fetchSemanticEventBundle({code:control.reportCode,fightIDs:[control.fightID],abilityID:null,windowStart:control.contaminationWindowStart,windowEnd:control.contaminationWindowEnd,limit:preview.config.eventLimit,maxContinuationRounds:preview.config.maxContinuationRounds,runQuery,resumeBundle,onProgress:persistProgress});
        const finalRecord=buildMatchedNullControlEvidenceRecordV1(plan,control,bundle,{priorTargetSignalObserved:targetSignalObserved});await storageSet(key,finalRecord);if(bundle?.pagination?.complete===true){completeById.set(String(control.controlId),finalRecord);partialById.delete(String(control.controlId));}else partialById.set(String(control.controlId),finalRecord);
      }
    }catch(error){if(error instanceof MatchedNullBudgetStop){status='budget-capped';stopReason=error.reason;}else throw error;}
  }

  const cache=await loadMatchedNullCacheV1({plan,storageGet}),evaluation=evaluateMatchedNullBaselineV1({episode,controlRecords:cache,config:plan.config}),compatible=cache.filter(compatibleEvidence),completeControls=compatible.filter(row=>row?.pagination?.complete===true).length,validCompleteControls=compatible.filter(row=>row?.pagination?.complete===true&&row?.validNull!==false).length,invalidControls=compatible.filter(row=>row?.pagination?.complete===true&&row?.validNull===false).length,partialControls=compatible.filter(row=>row?.pagination?.complete!==true).length;
  if(status==='complete'&&partialControls>0){status='evidence-incomplete';stopReason='pagination-incomplete';}
  const result={version:MATCHED_NULL_BASELINE_EXECUTOR_V1_VERSION,storageVersion:MATCHED_NULL_BASELINE_STORAGE_V1_VERSION,previewFingerprint:preview.fingerprint,planFingerprint:plan.planFingerprint,episodeId:plan.episodeId,episodeBuildFingerprint:plan.episodeBuildFingerprint,scope:plan.scope,signalId:Number(plan.signalId),status,stopReason,wclCallsExecuted:calls,rateLimit:rate,lastQuery,
    plannedControls:plan.plannedControls,completeControls,validCompleteControls,invalidControls,partialControls,evaluation,
    evidenceContract:{matchedSameFightControls:true,targetSignalContaminationRejected:true,targetSignalGuardRadiusValidated:true,innerControlEventsOnly:true,localFlankControlsUsed:false,rawActorIdsPersisted:false,rawActorNamesPersisted:false,canonicalDeepContribution:{reports:0,pulls:0},directScoreDelta:0,automaticPromotion:false,sourceIndependenceNotYetClaimed:true,holdoutNotYetClaimed:true}};
  await storageSet(matchedNullRunKey(plan,preview.fingerprint),result);return result;
}
