import { createHash } from 'node:crypto';
import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { CORPUS_RATE_LIMIT_QUERY } from '../wcl/queries/corpus.mjs';
import { eventAbilityId, eventSourceId, eventTargetId } from '../wcl/normalization/events.mjs';
import { CORPUS_DEFAULTS } from './config.mjs';
import { corpusGet, corpusSet } from './storage.mjs';
import { corpusId } from './keys.mjs';
import { fetchSemanticEventBundle } from './semantic-probe-wcl-v1.mjs';
import { verifySemanticProbeEvidenceV1 } from './semantic-probe-verifier-v1.mjs';

export const SEMANTIC_PROBE_EXECUTOR_VERSION='semantic-surgical-probe-executor-v2';
export const SEMANTIC_PROBE_EXECUTION_PREVIEW_VERSION='semantic-probe-execution-preview-v2';
export const SEMANTIC_PROBE_STORAGE_VERSION='semantic-probe-storage-v2';

export const SEMANTIC_PROBE_EXECUTION_DEFAULTS=Object.freeze({
  maxWclCalls:30,
  maxAnchorContinuationRounds:2,
  maxContextContinuationRounds:1,
  maxAnchorOccurrencesPerSource:2,
  maxContextQueries:12,
  windowRadiiMs:[2500,5000],
  eventLimit:1000,
  minimumRateLimitReservePct:CORPUS_DEFAULTS.minimumRateLimitReservePct,
  minimumRateLimitReservePoints:CORPUS_DEFAULTS.minimumRateLimitReservePoints,
});

const now=()=>Date.now();
const ids=values=>[...new Set((values||[]).map(Number).filter(Number.isFinite))];

function stableValue(value){
  if(Array.isArray(value))return value.map(stableValue);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableValue(value[key])]));
  return value;
}
function stableStringify(value){return JSON.stringify(stableValue(value));}
function digest(value,length=32){return createHash('sha256').update(stableStringify(value)).digest('hex').slice(0,length);}

function executionConfig(input={}){
  const radii=ids(input.windowRadiiMs||SEMANTIC_PROBE_EXECUTION_DEFAULTS.windowRadiiMs)
    .filter(value=>value>=500&&value<=15000).sort((a,b)=>a-b).slice(0,3);
  return{
    maxWclCalls:Math.max(1,Math.min(60,Number(input.maxWclCalls)||SEMANTIC_PROBE_EXECUTION_DEFAULTS.maxWclCalls)),
    maxAnchorContinuationRounds:Math.max(0,Math.min(4,Number(input.maxAnchorContinuationRounds)??SEMANTIC_PROBE_EXECUTION_DEFAULTS.maxAnchorContinuationRounds)),
    maxContextContinuationRounds:Math.max(0,Math.min(2,Number(input.maxContextContinuationRounds)??SEMANTIC_PROBE_EXECUTION_DEFAULTS.maxContextContinuationRounds)),
    maxAnchorOccurrencesPerSource:Math.max(1,Math.min(4,Number(input.maxAnchorOccurrencesPerSource)||SEMANTIC_PROBE_EXECUTION_DEFAULTS.maxAnchorOccurrencesPerSource)),
    maxContextQueries:Math.max(1,Math.min(24,Number(input.maxContextQueries)||SEMANTIC_PROBE_EXECUTION_DEFAULTS.maxContextQueries)),
    windowRadiiMs:radii.length?radii:[...SEMANTIC_PROBE_EXECUTION_DEFAULTS.windowRadiiMs],
    eventLimit:Math.max(100,Math.min(2000,Number(input.eventLimit)||SEMANTIC_PROBE_EXECUTION_DEFAULTS.eventLimit)),
    minimumRateLimitReservePct:Math.max(0.05,Math.min(0.5,Number(input.minimumRateLimitReservePct)||SEMANTIC_PROBE_EXECUTION_DEFAULTS.minimumRateLimitReservePct)),
    minimumRateLimitReservePoints:Math.max(100,Number(input.minimumRateLimitReservePoints)||SEMANTIC_PROBE_EXECUTION_DEFAULTS.minimumRateLimitReservePoints),
  };
}

function fingerprintPayload(plan,config){
  return{
    executorVersion:SEMANTIC_PROBE_EXECUTOR_VERSION,
    planVersion:plan?.version||null,
    evidenceSelectionVersion:plan?.evidenceSelectionVersion||null,
    scope:plan?.scope||null,
    config,
    signals:(plan?.signals||[]).map(signal=>({
      id:Number(signal.id),missingEvidence:[...(signal.missingEvidence||[])].sort(),
      verificationContract:signal.verificationContract||null,
      anchors:(signal.anchorRequests||[]).map(row=>({
        reportCode:String(row.reportCode),source:String(row.source),fightIDs:ids(row.fightIDs).sort((a,b)=>a-b),abilityID:Number(row?.queryShape?.abilityID||signal.id),
        selectionTier:row?.selectionEvidence?.selectionTier||null,
      })),
    })),
  };
}

export function semanticProbeExecutionFingerprint(plan,configInput={}){
  return digest(fingerprintPayload(plan,executionConfig(configInput)),40);
}

function scopeFromPlan(plan){
  const scope=plan?.scope||{};
  return{encounterId:Number(scope.encounterId),difficulty:Number(scope.difficulty||5),partition:Number(scope.partition||0)};
}
function baseKey(plan){return`semantic-probes/${corpusId(scopeFromPlan(plan))}`;}
function anchorIdentity(signal,request){
  return{signalId:Number(signal.id),reportCode:String(request.reportCode),source:String(request.source),fightIDs:ids(request.fightIDs).sort((a,b)=>a-b),abilityID:Number(request?.queryShape?.abilityID||signal.id)};
}
export function semanticProbeAnchorEvidenceKey(plan,signal,request){
  return`${baseKey(plan)}/evidence/${Number(signal.id)}/anchor/${digest(anchorIdentity(signal,request),24)}.json`;
}
function contextIdentity(signal,request,anchor,windowMs){
  return{signalId:Number(signal.id),reportCode:String(request.reportCode),source:String(request.source),fightID:Number(anchor.fightID),anchorTimestamp:Number(anchor.timestamp),windowMs:Number(windowMs)};
}
function contextEvidenceKey(plan,signal,request,anchor,windowMs){
  return`${baseKey(plan)}/evidence/${Number(signal.id)}/context/${digest(contextIdentity(signal,request,anchor,windowMs),24)}.json`;
}
export function semanticProbeRunKey(plan,fingerprint){return`${baseKey(plan)}/runs/${String(fingerprint)}.json`;}
function verificationKey(plan,signalId,fingerprint){return`${baseKey(plan)}/verification/${Number(signalId)}/${String(fingerprint)}.json`;}

function evidenceEntries(cacheEntries=[]){
  return (cacheEntries||[]).map(row=>row&&typeof row==='object'&&'key' in row?row:{key:String(row),value:null});
}

export function buildSemanticProbeExecutionPreview({plan,cacheEntries=[],cacheKeys=[],config:configInput={}}={}){
  const config=executionConfig(configInput);
  const fingerprint=semanticProbeExecutionFingerprint(plan,config);
  const entries=evidenceEntries(cacheEntries);
  const completeKeys=new Set(entries.filter(row=>row?.value?.pagination?.complete===true).map(row=>String(row.key)));
  const partialKeys=new Set(entries.filter(row=>row?.value&&row?.value?.pagination?.complete!==true).map(row=>String(row.key)));
  const unknownLegacyKeys=new Set((cacheKeys||[]).map(String).filter(key=>!completeKeys.has(key)&&!partialKeys.has(key)));
  const anchors=(plan?.signals||[]).flatMap(signal=>(signal.anchorRequests||[]).map(request=>({signal,request,key:semanticProbeAnchorEvidenceKey(plan,signal,request)})));
  const anchorCacheHits=anchors.filter(row=>completeKeys.has(row.key)).length;
  const anchorCachePartial=anchors.filter(row=>partialKeys.has(row.key)).length;
  const anchorCacheUnknown=anchors.filter(row=>unknownLegacyKeys.has(row.key)).length;
  const anchorQueriesRemaining=Math.max(0,anchors.length-anchorCacheHits);

  const firstPassContextPotential=anchors.length*config.maxAnchorOccurrencesPerSource;
  const adaptiveContextPotential=(config.windowRadiiMs.length>1)
    ?(plan?.signals||[]).reduce((sum,signal)=>sum+new Set((signal.anchorRequests||[]).map(row=>String(row.source))).size*(config.windowRadiiMs.length-1),0)
    :0;
  const potentialContextWindows=Math.min(config.maxContextQueries,firstPassContextPotential+adaptiveContextPotential);
  const targetSignalIds=new Set((plan?.signals||[]).map(signal=>Number(signal.id)));
  const allowedRadii=new Set(config.windowRadiiMs.map(Number));
  const relevantContexts=entries.filter(row=>row?.value?.kind==='context'&&targetSignalIds.has(Number(row.value.signalId))&&allowedRadii.has(Number(row.value.windowMs)));
  const contextCacheHits=relevantContexts.filter(row=>row?.value?.pagination?.complete===true).length;
  const contextCachePartial=relevantContexts.filter(row=>row?.value?.pagination?.complete!==true).length;
  const contextQueriesRemaining=Math.max(0,potentialContextWindows-contextCacheHits);

  const workRemaining=anchorQueriesRemaining>0||contextQueriesRemaining>0;
  const theoreticalWorst=workRemaining?1
    +anchorQueriesRemaining*(1+config.maxAnchorContinuationRounds)
    +contextQueriesRemaining*(1+config.maxContextContinuationRounds):0;
  const initialUpperBound=workRemaining?1+anchorQueriesRemaining+contextQueriesRemaining:0;
  return{
    version:SEMANTIC_PROBE_EXECUTION_PREVIEW_VERSION,
    executorVersion:SEMANTIC_PROBE_EXECUTOR_VERSION,
    dryRun:true,executesWcl:false,wclCallsExecuted:0,
    fingerprint,
    scope:plan?.scope||null,
    targetSignals:Number(plan?.targetSignals||plan?.signals?.length||0),
    plannedAnchorRequests:anchors.length,
    anchorCacheHits,anchorCachePartial,anchorCacheUnknown,anchorQueriesRemaining,
    potentialContextWindows,contextCacheHits,contextCachePartial,contextQueriesRemaining,
    callBudget:{
      liveRateBudgetKnown:false,
      liveRateBudgetCheckRequiredBeforeFirstEvidenceQuery:workRemaining,
      wclPointCostEstimate:null,
      pointEstimateReason:'WCL returns authoritative point usage in rateLimitData; Iris does not fabricate a point estimate.',
      initialQueryUpperBound:initialUpperBound,
      theoreticalPaginationUpperBound:theoreticalWorst,
      hardWclCallCap:config.maxWclCalls,
      executionStopsAtHardCap:true,
      reservePct:config.minimumRateLimitReservePct,
      reservePoints:config.minimumRateLimitReservePoints,
    },
    cacheAccounting:{completeEvidenceOnly:true,partialEvidenceIsNotACacheHit:true,resumablePartialEvidence:true},
    executionPolicy:{
      manualConfirmationRequired:true,
      matchingPreviewFingerprintRequired:true,
      exactFightIDsOnly:true,
      wholeReportFallback:false,
      adaptiveWindowRadiiMs:config.windowRadiiMs,
      maxAnchorOccurrencesPerSource:config.maxAnchorOccurrencesPerSource,
      maxContextQueries:config.maxContextQueries,
      persistentCache:true,
      resumablePagination:true,
      countsTowardDeepReports:false,countsTowardDeepPulls:false,
      directScoreChange:false,automaticPromotion:false,
    },
    config,
  };
}

function rateState(rate,config){
  if(!rate)return null;
  const limit=Number(rate.limitPerHour)||0,spent=Number(rate.pointsSpentThisHour)||0;
  const remaining=Math.max(0,limit-spent);
  const reserve=Math.max(Number(config.minimumRateLimitReservePoints)||0,limit*(Number(config.minimumRateLimitReservePct)||0));
  return{limitPerHour:limit,pointsSpentThisHour:spent,pointsRemaining:remaining,pointsResetIn:Number(rate.pointsResetIn)||0,reservePoints:reserve,canContinue:!limit||remaining>reserve};
}

class SemanticProbeBudgetStop extends Error{
  constructor(message,reason,rate=null){super(message);this.name='SemanticProbeBudgetStop';this.reason=reason;this.rate=rate;}
}

function compactEvent(event,stream){
  const timestamp=Number(event?.timestamp);
  const fight=Number(event?.fight??event?.fightID);
  return{
    stream,
    timestamp:Number.isFinite(timestamp)?timestamp:null,
    fightID:Number.isFinite(fight)?fight:null,
    type:event?.type||null,
    abilityId:eventAbilityId(event),
    sourceID:eventSourceId(event),
    targetID:eventTargetId(event),
  };
}
function compactStreams(streams={}){
  return Object.fromEntries(Object.entries(streams).map(([key,events])=>[key,(events||[]).map(event=>compactEvent(event,key))]));
}

function fightForEvent(event,request,deepProfile){
  const direct=Number(event?.fightID??event?.fight);
  if(Number.isFinite(direct)&&ids(request.fightIDs).includes(direct))return direct;
  const timestamp=Number(event?.timestamp);
  if(Number.isFinite(timestamp)){
    const fight=(deepProfile?.fights||[]).find(row=>ids(request.fightIDs).includes(Number(row.id))&&timestamp>=Number(row.startTime)&&timestamp<=Number(row.endTime));
    if(fight)return Number(fight.id);
  }
  const selected=ids(request.fightIDs);
  return selected.length===1?selected[0]:null;
}

function anchorOccurrences(bundle,signal,request,deepProfile,maxPerSource){
  const rank=['enemyCasts','debuffs','enemyDebuffs','friendDamage','buffs','enemyBuffs','interrupts','deaths'];
  const rows=[];
  for(const stream of rank){
    for(const event of bundle?.streams?.[stream]||[]){
      if(Number(eventAbilityId(event))!==Number(signal.id))continue;
      const timestamp=Number(event?.timestamp);if(!Number.isFinite(timestamp))continue;
      const fightID=fightForEvent(event,request,deepProfile);if(!Number.isFinite(fightID))continue;
      rows.push({timestamp,fightID,stream,type:event?.type||null,sourceID:eventSourceId(event),targetID:eventTargetId(event)});
    }
  }
  rows.sort((a,b)=>Number(a.fightID)-Number(b.fightID)||Number(a.timestamp)-Number(b.timestamp)||rank.indexOf(a.stream)-rank.indexOf(b.stream));
  const dedup=[],seen=new Set();
  for(const row of rows){const key=`${row.fightID}:${Math.round(row.timestamp/10)}`;if(seen.has(key))continue;seen.add(key);dedup.push(row);}
  const chosen=[],usedFights=new Set();
  for(const row of dedup){if(usedFights.has(row.fightID))continue;chosen.push(row);usedFights.add(row.fightID);if(chosen.length>=maxPerSource)return chosen;}
  for(const row of dedup){if(chosen.length>=maxPerSource)break;if(chosen.includes(row))continue;chosen.push(row);}
  return chosen;
}

export async function executeSemanticProbePlanV1({
  plan,previewFingerprint,confirmExecution=false,config:configInput={},deepProfiles=[],
  fetcher=wclGraphql,storageGet=corpusGet,storageSet=corpusSet,clock=now,
}={}){
  if(!plan||!Array.isArray(plan.signals))throw new Error('Semantic probe execution requires a current plan');
  const config=executionConfig(configInput);
  const fingerprint=semanticProbeExecutionFingerprint(plan,config);
  if(confirmExecution!==true)throw new Error('Semantic probe execution is manual-only: confirmExecution:true is required');
  if(!previewFingerprint||String(previewFingerprint)!==fingerprint)throw new Error('Semantic probe preview fingerprint is missing or stale; regenerate preview before spending WCL');
  const runKey=semanticProbeRunKey(plan,fingerprint);
  const previous=await storageGet(runKey).catch(()=>null);
  if(previous?.status==='complete')return{...previous,reusedCompletedRun:true,wclCallsExecutedThisInvocation:0};

  const deepByCode=new Map((deepProfiles||[]).filter(row=>row?.code).map(row=>[String(row.code),row]));
  const completedSignals=new Map((previous?.signals||[]).map(row=>[Number(row.signalId),row]));
  const run={
    version:SEMANTIC_PROBE_EXECUTOR_VERSION,storageVersion:SEMANTIC_PROBE_STORAGE_VERSION,
    fingerprint,scope:plan.scope,status:'running',startedAt:previous?.startedAt||clock(),updatedAt:clock(),
    wclCallsExecuted:Number(previous?.wclCallsExecuted||0),wclCallsExecutedThisInvocation:0,
    rateLimit:previous?.rateLimit||null,lastQuery:previous?.lastQuery||null,
    config,
    evidenceClass:'diagnostic-semantic-surgical',canonicalCoverageContribution:{deepReports:0,deepPulls:0},
    scoreChange:{allowed:false,directDelta:0},automaticPromotion:false,
    signals:[...completedSignals.values()],
    progress:{
      resumed:Boolean(previous),signalsTotal:plan.signals.length,signalsComplete:completedSignals.size,currentSignalId:null,
      lastEvidence:previous?.progress?.lastEvidence||null,
    },
  };
  let rate=run.rateLimit;
  let liveRateChecked=false;
  let contextQueries=0;

  const checkpoint=async()=>{run.updatedAt=clock();await storageSet(runKey,run);};
  const ensureCallCapacity=()=>{
    if(run.wclCallsExecutedThisInvocation>=config.maxWclCalls)throw new SemanticProbeBudgetStop('Semantic probe hard WCL call cap reached','hard-call-cap',rate);
    if(rate&&!rate.canContinue)throw new SemanticProbeBudgetStop('Semantic probe paused to preserve the hourly WCL reserve','rate-reserve',rate);
  };
  const ensureLiveRate=async()=>{
    if(liveRateChecked)return;
    ensureCallCapacity();
    const data=await fetcher(CORPUS_RATE_LIMIT_QUERY,{});
    run.wclCallsExecuted++;run.wclCallsExecutedThisInvocation++;
    rate=rateState(data?.rateLimitData,config);run.rateLimit=rate;liveRateChecked=true;await checkpoint();
    if(rate&&!rate.canContinue)throw new SemanticProbeBudgetStop('Semantic probe did not start because the WCL hourly reserve is already protected','rate-reserve',rate);
  };
  const runQuery=async(query,variables,meta)=>{
    await ensureLiveRate();ensureCallCapacity();
    const data=await fetcher(query,variables);
    run.wclCallsExecuted++;run.wclCallsExecutedThisInvocation++;
    if(data?.rateLimitData)rate=rateState(data.rateLimitData,config);
    run.rateLimit=rate;run.lastQuery={...meta,at:clock()};await checkpoint();
    return data;
  };

  const anchorRecord=(bundle,signal,request)=>({
    version:SEMANTIC_PROBE_STORAGE_VERSION,kind:'anchor',signalId:Number(signal.id),source:String(request.source),reportCode:String(request.reportCode),
    fightIDs:ids(request.fightIDs),queryFingerprint:digest(anchorIdentity(signal,request),32),
    streams:compactStreams(bundle.streams),pagination:bundle.pagination,rateLimit:rate,createdAt:clock(),updatedAt:clock(),
    evidenceClass:'diagnostic-semantic-surgical',canonicalCoverageContribution:{deepReports:0,deepPulls:0},
  });
  const contextRecord=(bundle,signal,sourceRow,anchor,radius)=>({
    version:SEMANTIC_PROBE_STORAGE_VERSION,kind:'context',signalId:Number(signal.id),source:sourceRow.source,reportCode:sourceRow.reportCode,
    fightID:anchor.fightID,anchorTimestamp:anchor.timestamp,windowMs:radius,streams:compactStreams(bundle.streams),
    pagination:bundle.pagination,rateLimit:rate,createdAt:clock(),updatedAt:clock(),evidenceClass:'diagnostic-semantic-surgical',canonicalCoverageContribution:{deepReports:0,deepPulls:0},
  });

  try{
    for(const signal of plan.signals){
      if(completedSignals.has(Number(signal.id)))continue;
      run.progress.currentSignalId=Number(signal.id);await checkpoint();
      const sourceRows=[];
      for(const request of signal.anchorRequests||[]){
        const sourceRow={source:String(request.source),reportCode:String(request.reportCode),anchorOccurrences:[],contexts:[]};
        const key=semanticProbeAnchorEvidenceKey(plan,signal,request);
        let cached=await storageGet(key).catch(()=>null);
        if(!cached?.pagination?.complete){
          const persist=async bundle=>{
            cached=anchorRecord(bundle,signal,request);await storageSet(key,cached);
            run.progress.lastEvidence={kind:'anchor',signalId:Number(signal.id),source:sourceRow.source,reportCode:sourceRow.reportCode,complete:Boolean(bundle?.pagination?.complete),reason:bundle?.pagination?.reason||null,queryCount:Number(bundle?.pagination?.queryCount||0)};
            await checkpoint();
          };
          const bundle=await fetchSemanticEventBundle({
            code:request.reportCode,fightIDs:ids(request.fightIDs),abilityID:Number(signal.id),limit:config.eventLimit,
            maxContinuationRounds:config.maxAnchorContinuationRounds,runQuery,resumeBundle:cached,onProgress:persist,
          });
          cached=anchorRecord(bundle,signal,request);await storageSet(key,cached);
        }
        const deep=deepByCode.get(String(request.reportCode));
        sourceRow.anchorOccurrences=anchorOccurrences(cached,signal,request,deep,config.maxAnchorOccurrencesPerSource);
        sourceRows.push(sourceRow);
      }

      const firstRadius=config.windowRadiiMs[0];
      for(let i=0;i<sourceRows.length&&contextQueries<config.maxContextQueries;i++){
        const sourceRow=sourceRows[i];const request=(signal.anchorRequests||[]).find(row=>String(row.reportCode)===sourceRow.reportCode&&String(row.source)===sourceRow.source);
        if(!request)continue;
        for(const anchor of sourceRow.anchorOccurrences){
          if(contextQueries>=config.maxContextQueries)break;
          const key=contextEvidenceKey(plan,signal,request,anchor,firstRadius);
          let cached=await storageGet(key).catch(()=>null);
          if(!cached?.pagination?.complete){
            const persist=async bundle=>{
              cached=contextRecord(bundle,signal,sourceRow,anchor,firstRadius);await storageSet(key,cached);
              run.progress.lastEvidence={kind:'context',signalId:Number(signal.id),source:sourceRow.source,reportCode:sourceRow.reportCode,fightID:anchor.fightID,windowMs:firstRadius,complete:Boolean(bundle?.pagination?.complete),reason:bundle?.pagination?.reason||null,queryCount:Number(bundle?.pagination?.queryCount||0)};
              await checkpoint();
            };
            const bundle=await fetchSemanticEventBundle({
              code:request.reportCode,fightIDs:[anchor.fightID],abilityID:null,
              windowStart:Math.max(0,anchor.timestamp-firstRadius),windowEnd:anchor.timestamp+firstRadius,
              limit:config.eventLimit,maxContinuationRounds:config.maxContextContinuationRounds,runQuery,resumeBundle:cached,onProgress:persist,
            });
            cached=contextRecord(bundle,signal,sourceRow,anchor,firstRadius);await storageSet(key,cached);contextQueries++;
          }
          sourceRow.contexts.push({...cached,complete:cached?.pagination?.complete!==false});
        }
      }

      let verification=verifySemanticProbeEvidenceV1({
        signalId:signal.id,sourceEvidence:sourceRows,
        minimumIndependentSources:signal?.verificationContract?.minimumIndependentSources||3,
        minimumAnchorOccurrences:signal?.verificationContract?.minimumAnchorOccurrences||6,
      });

      // Adaptive expansion is conservative: one anchor per source per wider radius,
      // only while the structural pattern has not reproduced and the window cap remains.
      for(const radius of config.windowRadiiMs.slice(1)){
        if(verification.status==='reproduced'||contextQueries>=config.maxContextQueries)break;
        for(let i=0;i<sourceRows.length&&contextQueries<config.maxContextQueries;i++){
          const sourceRow=sourceRows[i],anchor=sourceRow.anchorOccurrences[0];
          if(!anchor)continue;
          const request=(signal.anchorRequests||[]).find(row=>String(row.reportCode)===sourceRow.reportCode&&String(row.source)===sourceRow.source);
          if(!request)continue;
          const key=contextEvidenceKey(plan,signal,request,anchor,radius);
          let cached=await storageGet(key).catch(()=>null);
          if(!cached?.pagination?.complete){
            const persist=async bundle=>{
              cached=contextRecord(bundle,signal,sourceRow,anchor,radius);await storageSet(key,cached);
              run.progress.lastEvidence={kind:'context',signalId:Number(signal.id),source:sourceRow.source,reportCode:sourceRow.reportCode,fightID:anchor.fightID,windowMs:radius,complete:Boolean(bundle?.pagination?.complete),reason:bundle?.pagination?.reason||null,queryCount:Number(bundle?.pagination?.queryCount||0)};
              await checkpoint();
            };
            const bundle=await fetchSemanticEventBundle({
              code:request.reportCode,fightIDs:[anchor.fightID],abilityID:null,
              windowStart:Math.max(0,anchor.timestamp-radius),windowEnd:anchor.timestamp+radius,
              limit:config.eventLimit,maxContinuationRounds:config.maxContextContinuationRounds,runQuery,resumeBundle:cached,onProgress:persist,
            });
            cached=contextRecord(bundle,signal,sourceRow,anchor,radius);await storageSet(key,cached);contextQueries++;
          }
          const identity=`${anchor.fightID}:${anchor.timestamp}`;
          sourceRow.contexts=sourceRow.contexts.filter(row=>`${row.fightID}:${row.anchorTimestamp}`!==identity);
          sourceRow.contexts.push({...cached,complete:cached?.pagination?.complete!==false});
        }
        verification=verifySemanticProbeEvidenceV1({
          signalId:signal.id,sourceEvidence:sourceRows,
          minimumIndependentSources:signal?.verificationContract?.minimumIndependentSources||3,
          minimumAnchorOccurrences:signal?.verificationContract?.minimumAnchorOccurrences||6,
        });
      }

      await storageSet(verificationKey(plan,signal.id,fingerprint),{...verification,createdAt:clock(),fingerprint});
      const result={
        signalId:Number(signal.id),sources:sourceRows.length,
        anchorOccurrences:sourceRows.reduce((sum,row)=>sum+row.anchorOccurrences.length,0),
        contextWindows:sourceRows.reduce((sum,row)=>sum+row.contexts.length,0),
        verification,
      };
      run.signals=run.signals.filter(row=>Number(row.signalId)!==Number(signal.id));run.signals.push(result);
      completedSignals.set(Number(signal.id),result);
      run.progress.signalsComplete=completedSignals.size;run.progress.currentSignalId=null;await checkpoint();
    }
    run.status='complete';run.completedAt=clock();run.updatedAt=clock();run.nextStep='Review diagnostic verification. Promotion remains a separate, unimplemented contract.';
    await storageSet(runKey,run);return run;
  }catch(error){
    if(error instanceof SemanticProbeBudgetStop){
      run.status=error.reason==='rate-reserve'?'rate-limited':'budget-capped';
      run.stopReason=error.reason;run.rateLimit=error.rate||rate;
      if(error.reason==='rate-reserve'&&rate?.pointsResetIn)run.resumeAt=clock()+Math.max(60,Number(rate.pointsResetIn))*1000;
      run.message=error.message;await checkpoint();return run;
    }
    run.status='failed';run.error=String(error?.message||error).slice(0,1000);await checkpoint();throw error;
  }
}
