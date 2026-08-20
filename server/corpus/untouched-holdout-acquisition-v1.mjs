import { createHash } from 'node:crypto';
import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { CORPUS_RATE_LIMIT_QUERY,CORPUS_REPORT_HEADER_QUERY } from '../wcl/queries/corpus.mjs';
import { eventAbilityId } from '../wcl/normalization/events.mjs';
import { fetchSemanticEventBundle } from './semantic-probe-wcl-v1.mjs';
import { buildMatchedNullBaselinePlanV1 } from './matched-null-baseline-v1.mjs';
import { buildMatchedNullControlEvidenceRecordV1 } from './matched-null-baseline-executor-v1.mjs';
import { corpusGet,corpusSet } from './storage.mjs';
import { corpusId } from './keys.mjs';

export const UNTOUCHED_HOLDOUT_ACQUISITION_V1_VERSION='untouched-holdout-acquisition-v1';
export const UNTOUCHED_HOLDOUT_ACQUISITION_PREVIEW_V1_VERSION='untouched-holdout-acquisition-preview-v1';
export const UNTOUCHED_HOLDOUT_ACQUISITION_STORAGE_V1_VERSION='untouched-holdout-acquisition-storage-v1';
export const UNTOUCHED_HOLDOUT_ACQUISITION_DEFAULTS=Object.freeze({
  maxWclCalls:60,
  maxFightIDsPerSource:6,
  maxPairsPerSource:2,
  maxAnchorContinuationRounds:1,
  maxContextContinuationRounds:1,
  eventLimit:1000,
  minimumRateLimitReservePct:0.18,
  minimumRateLimitReservePoints:600,
});

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=(value,length=40)=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0,length);
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const sourceKey=value=>String(value||'').trim();
const boundedInt=(value,fallback,min,max)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.trunc(n))):fallback;};

function configFrom(input={}){
  return{
    maxWclCalls:boundedInt(input.maxWclCalls,UNTOUCHED_HOLDOUT_ACQUISITION_DEFAULTS.maxWclCalls,1,80),
    maxFightIDsPerSource:boundedInt(input.maxFightIDsPerSource,UNTOUCHED_HOLDOUT_ACQUISITION_DEFAULTS.maxFightIDsPerSource,1,12),
    maxPairsPerSource:boundedInt(input.maxPairsPerSource,UNTOUCHED_HOLDOUT_ACQUISITION_DEFAULTS.maxPairsPerSource,1,3),
    maxAnchorContinuationRounds:boundedInt(input.maxAnchorContinuationRounds,UNTOUCHED_HOLDOUT_ACQUISITION_DEFAULTS.maxAnchorContinuationRounds,0,3),
    maxContextContinuationRounds:boundedInt(input.maxContextContinuationRounds,UNTOUCHED_HOLDOUT_ACQUISITION_DEFAULTS.maxContextContinuationRounds,0,2),
    eventLimit:boundedInt(input.eventLimit,UNTOUCHED_HOLDOUT_ACQUISITION_DEFAULTS.eventLimit,100,3000),
    minimumRateLimitReservePct:Math.max(0.05,Math.min(0.5,Number(input.minimumRateLimitReservePct)||UNTOUCHED_HOLDOUT_ACQUISITION_DEFAULTS.minimumRateLimitReservePct)),
    minimumRateLimitReservePoints:Math.max(100,Number(input.minimumRateLimitReservePoints)||UNTOUCHED_HOLDOUT_ACQUISITION_DEFAULTS.minimumRateLimitReservePoints),
  };
}

function episodeRadiusMs(episode={}){const values=(episode.edges||[]).map(row=>finite(row?.temporalWindowMs)).filter(Number.isFinite);return Math.max(2500,...values);}
function relativeBucket(delta){const abs=Math.abs(Number(delta)||0),distance=abs<=1000?'1s':abs<=2500?'2.5s':abs<=5000?'5s':'far';if(abs<=250)return`simultaneous-${distance}`;return`${delta<0?'before':'after'}-${distance}`;}
function patternKey(event,stream,referenceTimestamp){const abilityId=Number(eventAbilityId(event)),timestamp=finite(event?.timestamp);if(!Number.isFinite(abilityId)||timestamp==null)return null;return[relativeBucket(timestamp-Number(referenceTimestamp)),String(stream),abilityId,String(event?.type||'event')].join('|');}
function containsPattern(streams,referenceTimestamp,wanted){for(const [stream,events] of Object.entries(streams||{}))for(const event of events||[])if(patternKey(event,stream,referenceTimestamp)===wanted)return true;return false;}

function compactEvent(event,stream){return{stream,timestamp:finite(event?.timestamp),fightID:finite(event?.fight??event?.fightID),type:event?.type||null,abilityId:eventAbilityId(event)};}
function compactBundle(bundle={}){return{streams:Object.fromEntries(Object.entries(bundle.streams||{}).map(([stream,events])=>[stream,(events||[]).map(event=>compactEvent(event,stream))])),pagination:bundle.pagination||null,rateLimit:bundle.rateLimit||null};}

function rateState(rate,config){if(!rate)return null;const limit=Number(rate.limitPerHour)||0,spent=Number(rate.pointsSpentThisHour)||0,remaining=Math.max(0,limit-spent),reserve=Math.max(Number(config.minimumRateLimitReservePoints)||0,limit*(Number(config.minimumRateLimitReservePct)||0));return{limitPerHour:limit,pointsSpentThisHour:spent,pointsRemaining:remaining,pointsResetIn:Number(rate.pointsResetIn)||0,reservePoints:reserve,canContinue:!limit||remaining>reserve};}
class HoldoutAcquisitionBudgetStop extends Error{constructor(message,reason){super(message);this.name='HoldoutAcquisitionBudgetStop';this.reason=reason;}}

function sourceStorageId(source){return digest(sourceKey(source),20);}
function baseKey(reservation,scope){return`untouched-holdout-acquisition/${corpusId(scope)}/${String(reservation.fingerprint)}`;}
export function untouchedHoldoutSourceEvidenceKeyV1(reservation,scope,source){return`${baseKey(reservation,scope)}/sources/${sourceStorageId(source)}.json`;}
export function untouchedHoldoutAcquisitionRunKeyV1(reservation,scope,previewFingerprint){return`${baseKey(reservation,scope)}/runs/${String(previewFingerprint)}.json`;}

function sourceComplete(row){return row?.version===UNTOUCHED_HOLDOUT_ACQUISITION_STORAGE_V1_VERSION&&row?.status==='complete'&&Array.isArray(row?.patterns);}
function sourceSettled(row){return sourceComplete(row)||(row?.version===UNTOUCHED_HOLDOUT_ACQUISITION_STORAGE_V1_VERSION&&String(row?.status||'').startsWith('inconclusive-'));}
export async function loadUntouchedHoldoutAcquisitionCacheV1({reservation,scope,storageGet=corpusGet}={}){const rows=[];for(const source of reservation?.reservedSources||[]){const value=await storageGet(untouchedHoldoutSourceEvidenceKeyV1(reservation,scope,source.source)).catch(()=>null);if(value)rows.push(value);}return rows;}

function fingerprintPayload(reservation,episode,config){return{version:UNTOUCHED_HOLDOUT_ACQUISITION_V1_VERSION,reservationFingerprint:reservation?.fingerprint||null,episodeId:episode?.episodeId||null,episodeBuildFingerprint:episode?.buildFingerprint||null,signalId:Number(episode?.anchor?.abilityId)||null,config,reservedSources:(reservation?.reservedSources||[]).map(row=>({source:sourceKey(row.source),seedReportCode:String(row.seedReportCode||'')})).sort((a,b)=>a.source.localeCompare(b.source)),frozenPatterns:(reservation?.frozenCandidatePatterns||[]).map(row=>String(row.patternKey||'')).sort()};}

export function buildUntouchedHoldoutAcquisitionPreviewV1({reservation,episode,cacheRecords=[],config:configInput={}}={}){
  const config=configFrom(configInput),ready=reservation?.status==='reservation-ready'&&reservation?.fingerprint&&episode?.episodeId&&Number(episode?.anchor?.abilityId)>0;
  const missingSeeds=(reservation?.reservedSources||[]).filter(row=>!String(row?.seedReportCode||'').trim()).map(row=>sourceKey(row.source));
  const complete=new Set((cacheRecords||[]).filter(sourceComplete).map(row=>sourceKey(row.source))),settled=new Set((cacheRecords||[]).filter(sourceSettled).map(row=>sourceKey(row.source))),pending=(reservation?.reservedSources||[]).filter(row=>!settled.has(sourceKey(row.source)));
  const minimumEvaluable=Math.max(3,Number(reservation?.config?.minimumEvaluableSources)||3);
  const executable=Boolean(ready&&missingSeeds.length===0&&pending.length>0);
  const status=!ready?'reservation-not-ready':missingSeeds.length?'reserved-source-seed-metadata-missing':pending.length===0?(complete.size>=minimumEvaluable?'complete-from-cache':'settled-insufficient-evaluable-sources'):'acquisition-ready';
  const perSourceUpperBound=1+(1+config.maxAnchorContinuationRounds)+config.maxPairsPerSource*(1+config.maxContextContinuationRounds)*2;
  const theoretical=executable?1+pending.length*perSourceUpperBound:0;
  const payload=fingerprintPayload(reservation,episode,config);
  return{
    version:UNTOUCHED_HOLDOUT_ACQUISITION_PREVIEW_V1_VERSION,executorVersion:UNTOUCHED_HOLDOUT_ACQUISITION_V1_VERSION,
    fingerprint:digest(payload),status,executable,dryRun:true,executesWcl:false,wclCallsExecuted:0,
    reservationFingerprint:reservation?.fingerprint||null,episodeId:episode?.episodeId||null,signalId:Number(episode?.anchor?.abilityId)||null,
    frozenCandidatePatterns:(reservation?.frozenCandidatePatterns||[]).map(row=>String(row.patternKey||'')),reservedSources:(reservation?.reservedSources||[]).map(row=>sourceKey(row.source)),missingSeedReportSources:missingSeeds,
    cache:{completeSources:complete.size,settledSources:settled.size,pendingSources:pending.length},
    callBudget:{initialRateLimitPreflight:executable?1:0,theoreticalWclCallUpperBound:Math.min(config.maxWclCalls,theoretical),hardWclCallCap:config.maxWclCalls,executionStopsAtHardCap:true,reservePct:config.minimumRateLimitReservePct,reservePoints:config.minimumRateLimitReservePoints},
    evidenceContract:{reservationRequired:true,candidateSetFrozen:true,sourceSetFrozen:true,seedReportFrozenBeforeCombatEvidence:true,sourceExpansionForbidden:true,newCandidateDiscoveryForbidden:true,newSourceDiscoveryForbidden:true,exactEncounterFightIDsOnly:true,pairedAnchorNullComparison:true,wholeReportCombatScanForbidden:true,fightSelectionUsesOutcomeMetrics:false,rawActorIdsPersisted:false,rawActorNamesPersisted:false,automaticPromotion:false},
    config,
  };
}

function chooseFightIds(fights,reservationFingerprint,source,maxCount){return(fights||[]).filter(row=>Number.isFinite(Number(row?.id))).map(row=>({id:Number(row.id),rank:digest(`${reservationFingerprint}|${source}|${Number(row.id)}`,16)})).sort((a,b)=>a.rank.localeCompare(b.rank)||a.id-b.id).slice(0,maxCount).map(row=>row.id);}
function compactFight(row){return{id:Number(row.id),startTime:Number(row.startTime),endTime:Number(row.endTime),phaseTransitions:(row.phaseTransitions||[]).map(item=>({id:finite(item?.id),startTime:finite(item?.startTime)})).filter(item=>item.startTime!=null)};}
function reportSourceKey(report={}){const guild=Number(report?.guild?.id);if(Number.isFinite(guild)&&guild>0)return`guild:${guild}`;const owner=Number(report?.owner?.id);if(Number.isFinite(owner)&&owner>0)return`user:${owner}`;return null;}
function eventFightId(event,fights){const direct=finite(event?.fight??event?.fightID);if(direct!=null)return direct;const time=finite(event?.timestamp);if(time==null)return null;return(fights||[]).find(row=>time>=Number(row.startTime)&&time<=Number(row.endTime))?.id??null;}
function anchorOccurrences(bundle,signalId,fights,maxCount){const order=['enemyCasts','debuffs','enemyDebuffs','friendDamage','buffs','enemyBuffs','interrupts','deaths'],rows=[];for(const stream of order)for(const event of bundle?.streams?.[stream]||[]){if(Number(eventAbilityId(event))!==Number(signalId))continue;const timestamp=finite(event?.timestamp),fightID=eventFightId(event,fights);if(timestamp==null||fightID==null)continue;rows.push({timestamp:Number(timestamp),fightID:Number(fightID),stream,type:event?.type||null});}rows.sort((a,b)=>a.fightID-b.fightID||a.timestamp-b.timestamp||order.indexOf(a.stream)-order.indexOf(b.stream));const unique=[],seen=new Set();for(const row of rows){const key=`${row.fightID}:${Math.round(row.timestamp/10)}`;if(seen.has(key))continue;seen.add(key);unique.push(row);}const chosen=[],usedFights=new Set();for(const row of unique){if(usedFights.has(row.fightID))continue;chosen.push(row);usedFights.add(row.fightID);if(chosen.length>=maxCount)return chosen;}for(const row of unique){if(chosen.length>=maxCount)break;if(!chosen.includes(row))chosen.push(row);}return chosen;}

async function fetchHeader(code,scope,runQuery){const data=await runQuery(CORPUS_REPORT_HEADER_QUERY,{code:String(code),encounter:Number(scope.encounterId),difficulty:Number(scope.difficulty)},{kind:'holdout-report-header',code:String(code)});const report=data?.reportData?.report;if(!report)return null;return{code:String(report.code||code),guild:report.guild||null,owner:report.owner||null,fights:(report.fights||[]).map(compactFight)};}
function pseudoAnchorRecord({source,reportCode,fightIDs,signalId,bundle}){return{kind:'anchor',signalId:Number(signalId),source:sourceKey(source),reportCode:String(reportCode),fightIDs:[...fightIDs],streams:compactBundle(bundle).streams,pagination:bundle?.pagination||null};}
function pseudoContextRecord({source,reportCode,signalId,anchor,radius,bundle}){return{kind:'context',signalId:Number(signalId),source:sourceKey(source),reportCode:String(reportCode),fightID:Number(anchor.fightID),anchorTimestamp:Number(anchor.timestamp),windowMs:Number(radius),streams:compactBundle(bundle).streams,pagination:bundle?.pagination||null};}
function sourcePatternSummary(reservation,pairs){return(reservation.frozenCandidatePatterns||[]).map(pattern=>{const key=String(pattern.patternKey||'');let matchedPairs=0,anchorHits=0,nullHits=0;for(const pair of pairs||[]){if(pair.valid!==true)continue;matchedPairs++;if(containsPattern(pair.anchorStreams,pair.anchorTimestamp,key))anchorHits++;if(containsPattern(pair.controlStreams,pair.controlTimestamp,key))nullHits++;}return{patternKey:key,abilityId:Number(pattern.abilityId)||null,matchedPairs,anchorHits,nullHits};});}
function evidenceFromRows(reservation,scope,rows,clock){const completeRows=(rows||[]).filter(sourceComplete);return{reservationFingerprint:reservation.fingerprint,collectedAt:Math.max(Number(reservation.reservedAt)||0,...completeRows.map(row=>Number(row.collectedAt)||0),clock()),scope,sources:completeRows.map(row=>({source:row.source,patterns:row.patterns}))};}

export async function executeUntouchedHoldoutAcquisitionV1({reservation,episode,scope,previewFingerprint,confirmExecution=false,config:configInput={},fetcher=wclGraphql,storageGet=corpusGet,storageSet=corpusSet,clock=()=>Date.now()}={}){
  if(!reservation?.fingerprint||reservation?.status!=='reservation-ready')throw new Error('Holdout combat acquisition requires a reservation-ready frozen plan');
  if(!episode?.episodeId||String(episode.episodeId)!==String(reservation.episodeId))throw new Error('Holdout combat acquisition requires the frozen Episode revision');
  if(!scope?.encounterId||!scope?.difficulty||!scope?.partition)throw new Error('Resolved GLOBAL BOSS scope is required');
  const cacheBefore=await loadUntouchedHoldoutAcquisitionCacheV1({reservation,scope,storageGet}),preview=buildUntouchedHoldoutAcquisitionPreviewV1({reservation,episode,cacheRecords:cacheBefore,config:configInput});
  if(confirmExecution!==true)throw new Error('Holdout combat acquisition requires confirmExecution:true');
  if(!previewFingerprint||String(previewFingerprint)!==String(preview.fingerprint))throw new Error('Holdout combat-acquisition preview fingerprint is missing or stale');
  if(preview.status==='complete-from-cache'||preview.status==='settled-insufficient-evaluable-sources')return{version:UNTOUCHED_HOLDOUT_ACQUISITION_V1_VERSION,status:preview.status==='complete-from-cache'?'complete':'evidence-incomplete',stopReason:preview.status==='complete-from-cache'?null:'insufficient-evaluable-sources',reusedSettledEvidence:true,wclCallsExecuted:0,holdoutEvidence:evidenceFromRows(reservation,scope,cacheBefore,clock),sourceRecords:cacheBefore};
  if(!preview.executable)throw new Error(`Holdout combat acquisition is not executable: ${preview.status}`);

  const config=preview.config,settled=new Map(cacheBefore.filter(sourceSettled).map(row=>[sourceKey(row.source),row]));
  let calls=0,rate=null,lastQuery=null,status='complete',stopReason=null;
  const runQuery=async(query,variables,meta)=>{if(calls>=config.maxWclCalls)throw new HoldoutAcquisitionBudgetStop('Holdout WCL hard call cap reached','hard-call-cap');if(rate&&rate.canContinue===false)throw new HoldoutAcquisitionBudgetStop('Holdout WCL reserve reached','rate-reserve');calls++;lastQuery=meta||null;const data=await fetcher(query,variables);if(data?.rateLimitData)rate=rateState(data.rateLimitData,config);return data;};

  try{
    const preflight=await runQuery(CORPUS_RATE_LIMIT_QUERY,{}, {kind:'holdout-rate-preflight'});if(preflight?.rateLimitData)rate=rateState(preflight.rateLimitData,config);if(rate&&rate.canContinue===false)throw new HoldoutAcquisitionBudgetStop('Holdout reserve would be violated before combat queries','rate-reserve');
    for(const reserved of reservation.reservedSources||[]){
      const source=sourceKey(reserved.source);if(settled.has(source))continue;
      const code=String(reserved.seedReportCode||'').trim();if(!code)continue;
      const key=untouchedHoldoutSourceEvidenceKeyV1(reservation,scope,source),existing=await storageGet(key).catch(()=>null);
      const report=existing?.header||await fetchHeader(code,scope,runQuery);
      if(!report){const row={version:UNTOUCHED_HOLDOUT_ACQUISITION_STORAGE_V1_VERSION,status:'inconclusive-report-unavailable',source,seedReportCode:code,reservationFingerprint:reservation.fingerprint,collectedAt:clock(),patterns:[]};await storageSet(key,row);settled.set(source,row);continue;}
      if(reportSourceKey(report)!==source){const row={version:UNTOUCHED_HOLDOUT_ACQUISITION_STORAGE_V1_VERSION,status:'inconclusive-seed-source-mismatch',source,seedReportCode:code,reservationFingerprint:reservation.fingerprint,collectedAt:clock(),patterns:[]};await storageSet(key,row);settled.set(source,row);continue;}
      if(!report.fights?.length){const row={version:UNTOUCHED_HOLDOUT_ACQUISITION_STORAGE_V1_VERSION,status:'inconclusive-no-eligible-fight',source,seedReportCode:code,reservationFingerprint:reservation.fingerprint,collectedAt:clock(),patterns:[]};await storageSet(key,row);settled.set(source,row);continue;}
      const selectedFightIDs=chooseFightIds(report.fights,reservation.fingerprint,source,config.maxFightIDsPerSource),selectedFights=report.fights.filter(row=>selectedFightIDs.includes(Number(row.id)));
      let anchorBundle=existing?.anchorBundle||null;
      anchorBundle=await fetchSemanticEventBundle({code,fightIDs:selectedFightIDs,abilityID:Number(episode.anchor.abilityId),limit:config.eventLimit,maxContinuationRounds:config.maxAnchorContinuationRounds,runQuery,resumeBundle:anchorBundle,onProgress:async progress=>{await storageSet(key,{version:UNTOUCHED_HOLDOUT_ACQUISITION_STORAGE_V1_VERSION,status:'partial-anchor',source,seedReportCode:code,reservationFingerprint:reservation.fingerprint,header:report,selectedFightIDs,anchorBundle:compactBundle(progress),updatedAt:clock()});}});
      const compactAnchor=compactBundle(anchorBundle);
      if(anchorBundle?.pagination?.complete!==true){await storageSet(key,{version:UNTOUCHED_HOLDOUT_ACQUISITION_STORAGE_V1_VERSION,status:'partial-anchor',source,seedReportCode:code,reservationFingerprint:reservation.fingerprint,header:report,selectedFightIDs,anchorBundle:compactAnchor,updatedAt:clock()});continue;}
      const anchors=anchorOccurrences(anchorBundle,episode.anchor.abilityId,selectedFights,config.maxPairsPerSource);
      if(!anchors.length){const row={version:UNTOUCHED_HOLDOUT_ACQUISITION_STORAGE_V1_VERSION,status:'inconclusive-no-anchor',source,seedReportCode:code,reservationFingerprint:reservation.fingerprint,collectedAt:clock(),header:report,selectedFightIDs,anchorBundle:compactAnchor,patterns:(reservation.frozenCandidatePatterns||[]).map(pattern=>({patternKey:pattern.patternKey,abilityId:pattern.abilityId,matchedPairs:0,anchorHits:0,nullHits:0}))};await storageSet(key,row);settled.set(source,row);continue;}
      const radius=episodeRadiusMs(episode),contexts=[];
      for(const anchor of anchors){
        const previousContext=(existing?.contexts||[]).find(row=>Number(row.anchorTimestamp)===Number(anchor.timestamp)&&Number(row.fightID)===Number(anchor.fightID))?.bundle||null;
        const bundle=await fetchSemanticEventBundle({code,fightIDs:[anchor.fightID],abilityID:null,windowStart:anchor.timestamp-radius,windowEnd:anchor.timestamp+radius,limit:config.eventLimit,maxContinuationRounds:config.maxContextContinuationRounds,runQuery,resumeBundle:previousContext});
        contexts.push({anchorTimestamp:anchor.timestamp,fightID:anchor.fightID,bundle:compactBundle(bundle)});
      }
      const evidenceRecords=[pseudoAnchorRecord({source,reportCode:code,fightIDs:selectedFightIDs,signalId:episode.anchor.abilityId,bundle:anchorBundle}),...contexts.map(row=>pseudoContextRecord({source,reportCode:code,signalId:episode.anchor.abilityId,anchor:{timestamp:row.anchorTimestamp,fightID:row.fightID},radius,bundle:row.bundle}))];
      const plan=buildMatchedNullBaselinePlanV1({episode,evidenceRecords,profiles:[{code,fights:selectedFights,kind:'holdout'}],config:{maxControls:config.maxPairsPerSource,maxControlsPerSource:config.maxPairsPerSource,minimumMatchedControls:4,minimumMatchedSources:2}});
      const pairs=[];
      for(const control of plan.controls||[]){
        const anchorContext=contexts.find(row=>Number(row.anchorTimestamp)===Number(control.anchorTimestamp)&&Number(row.fightID)===Number(control.fightID));
        if(!anchorContext||anchorContext.bundle?.pagination?.complete!==true)continue;
        const controlBundle=await fetchSemanticEventBundle({code,fightIDs:[control.fightID],abilityID:null,windowStart:control.contaminationWindowStart,windowEnd:control.contaminationWindowEnd,limit:config.eventLimit,maxContinuationRounds:config.maxContextContinuationRounds,runQuery});
        const controlRecord=buildMatchedNullControlEvidenceRecordV1(plan,control,controlBundle);
        const valid=controlBundle?.pagination?.complete===true&&controlRecord.validNull===true;
        pairs.push({controlId:control.controlId,anchorTimestamp:Number(control.anchorTimestamp),controlTimestamp:Number(control.referenceTimestamp),fightID:Number(control.fightID),valid,invalidReason:controlRecord.invalidReason||null,anchorStreams:anchorContext.bundle.streams||{},controlStreams:controlRecord.streams||{}});
      }
      const patterns=sourcePatternSummary(reservation,pairs),validPairs=pairs.filter(row=>row.valid).length;
      const row={version:UNTOUCHED_HOLDOUT_ACQUISITION_STORAGE_V1_VERSION,status:validPairs>0?'complete':'inconclusive-no-valid-pair',source,seedReportCode:code,reservationFingerprint:reservation.fingerprint,episodeId:episode.episodeId,signalId:Number(episode.anchor.abilityId),collectedAt:clock(),selectedFightIDs,pairs:pairs.map(item=>({controlId:item.controlId,anchorTimestamp:item.anchorTimestamp,controlTimestamp:item.controlTimestamp,fightID:item.fightID,valid:item.valid,invalidReason:item.invalidReason})),patterns,evidenceContract:{sourceWasReserved:true,seedReportWasFrozenBeforeCombatEvidence:true,sourceExpansionUsed:false,fightSelectionUsesOutcomeMetrics:false,pairedSameFightNull:true,rawActorIdsPersisted:false,rawActorNamesPersisted:false,newCandidateDiscovery:false,newSourceDiscovery:false,automaticPromotion:false}};
      await storageSet(key,row);if(sourceSettled(row))settled.set(source,row);
    }
  }catch(error){if(error instanceof HoldoutAcquisitionBudgetStop){status='budget-capped';stopReason=error.reason;}else throw error;}

  const cacheAfter=await loadUntouchedHoldoutAcquisitionCacheV1({reservation,scope,storageGet}),completeRows=cacheAfter.filter(sourceComplete),settledRows=cacheAfter.filter(sourceSettled),holdoutEvidence=evidenceFromRows(reservation,scope,cacheAfter,clock),minimumEvaluable=Math.max(3,Number(reservation.config?.minimumEvaluableSources)||3);
  if(status==='complete'&&settledRows.length>=(reservation.reservedSources||[]).length&&completeRows.length<minimumEvaluable){status='evidence-incomplete';stopReason='insufficient-evaluable-sources';}
  else if(status==='complete'&&settledRows.length<(reservation.reservedSources||[]).length){status='evidence-incomplete';stopReason='source-evidence-incomplete';}
  const result={version:UNTOUCHED_HOLDOUT_ACQUISITION_V1_VERSION,storageVersion:UNTOUCHED_HOLDOUT_ACQUISITION_STORAGE_V1_VERSION,previewFingerprint:preview.fingerprint,reservationFingerprint:reservation.fingerprint,episodeId:episode.episodeId,scope,signalId:Number(episode.anchor.abilityId),status,stopReason,wclCallsExecuted:calls,rateLimit:rate,lastQuery,completeSources:completeRows.length,settledSources:settledRows.length,reservedSources:(reservation.reservedSources||[]).length,holdoutEvidence,evidenceContract:{reservationFrozenBeforeCombat:true,onlyFrozenCandidatesQueried:true,onlyReservedSourcesQueried:true,onlyFrozenSeedReportsQueried:true,sourceExpansionForbidden:true,fightSelectionUsesOutcomeMetrics:false,pairedSameFightNull:true,rawActorIdsPersisted:false,rawActorNamesPersisted:false,canonicalDeepContribution:{reports:0,pulls:0},directScoreDelta:0,automaticPromotion:false}};
  await storageSet(untouchedHoldoutAcquisitionRunKeyV1(reservation,scope,preview.fingerprint),result);return result;
}
