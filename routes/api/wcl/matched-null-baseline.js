import { defineHandler } from 'nitro/h3';
import { loadAnyEncounterModel } from '../../../server/corpus/service.mjs';
import { corpusId } from '../../../server/corpus/keys.mjs';
import { corpusGet,corpusList,corpusStorageErrorInfo } from '../../../server/corpus/storage.mjs';
import { buildMatchedNullBaselinePlanV1,buildMatchedNullBaselinePreviewV1,evaluateMatchedNullBaselineV1 } from '../../../server/corpus/matched-null-baseline-v1.mjs';
import { executeMatchedNullBaselineV1,loadMatchedNullCacheV1,matchedNullRunKey } from '../../../server/corpus/matched-null-baseline-executor-v1.mjs';

const API_VERSION='matched-null-baseline-api-v1';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const bounded=(value,fallback,min,max)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};

async function persistedAt(prefix){const keys=await corpusList(prefix),rows=[];for(const key of keys){const value=await corpusGet(key).catch(()=>null);if(value)rows.push(value);}return rows;}
async function scope(input){const raw=await loadAnyEncounterModel(input);if(!raw)throw new Error('No persisted canonical boss model is available for matched null baseline');const args={encounterId:Number(raw.encounterId||input.encounterId),difficulty:Number(raw.difficulty||input.difficulty||5),partition:Number(raw.resolvedPartition??raw.partition??input.partition??0)};if(!args.encounterId||!args.difficulty||!args.partition)throw new Error('Resolved encounter/difficulty/partition is required');return args;}
const episodeKey=(args,signalId,buildFingerprint)=>`mechanic-episodes/${corpusId(args)}/${Number(signalId)}/${String(buildFingerprint)}.json`;
const baselineEvidencePrefix=(args,signalId,buildFingerprint)=>`matched-null-baselines/${corpusId(args)}/${Number(signalId)}/${String(buildFingerprint)}/evidence/`;

async function context(input){
  const args=await scope(input),signalId=Number(input.signalId||0),episodeBuildFingerprint=String(input.episodeBuildFingerprint||input.buildFingerprint||'').trim();if(!signalId||!episodeBuildFingerprint)throw new Error('signalId and episodeBuildFingerprint are required');
  const episode=await corpusGet(episodeKey(args,signalId,episodeBuildFingerprint));if(!episode)throw new Error('Persisted mechanic episode not found for the supplied build fingerprint');
  const [evidenceRecords,wideProfiles,deepProfiles,previousControls]=await Promise.all([persistedAt(`semantic-probes/${corpusId(args)}/evidence/`),persistedAt(`profiles/${corpusId(args)}/`),persistedAt(`deep/${corpusId(args)}/`),persistedAt(baselineEvidencePrefix(args,signalId,episodeBuildFingerprint))]);
  const plan=buildMatchedNullBaselinePlanV1({episode,evidenceRecords,profiles:[...wideProfiles,...deepProfiles],rejectedControls:previousControls,config:{controlRadiusMs:input.controlRadiusMs,episodeGuardMs:input.episodeGuardMs,candidateOffsetMagnitudesMs:input.candidateOffsetMagnitudesMs,maxControls:input.maxControls,maxControlsPerSource:input.maxControlsPerSource,maxNormalizedFightDistance:input.maxNormalizedFightDistance,minimumMatchedControls:input.minimumMatchedControls,minimumMatchedSources:input.minimumMatchedSources}});
  return{args,signalId,episode,evidenceRecords,plan};
}
async function previewFor(ctx,input){const cacheRecords=await loadMatchedNullCacheV1({plan:ctx.plan});return buildMatchedNullBaselinePreviewV1({plan:ctx.plan,cacheRecords,maxWclCalls:bounded(input.maxWclCalls,20,1,60),maxContinuationRounds:bounded(input.maxContinuationRounds,1,0,3),eventLimit:bounded(input.eventLimit,1000,100,5000),reservePct:input.minimumRateLimitReservePct,reservePoints:input.minimumRateLimitReservePoints});}

export default defineHandler(async event=>{
  const request=event.req;
  try{
    if(request.method!=='POST')return json({ok:false,error:'POST only'},405);
    const body=await request.json().catch(()=>({})),action=String(body.action||'preview'),input={...body,encounterId:Number(body.encounterId||0),difficulty:Number(body.difficulty||5),partition:Number(body.partition||0),signalId:Number(body.signalId||0)};if(!input.encounterId||!input.signalId)return json({ok:false,error:'encounterId and signalId are required'},400);
    const ctx=await context(input);
    if(action==='preview'){const preview=await previewFor(ctx,input);return json({ok:true,apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,preview});}
    if(action==='evaluate'){const cacheRecords=await loadMatchedNullCacheV1({plan:ctx.plan}),evaluation=evaluateMatchedNullBaselineV1({episode:ctx.episode,controlRecords:cacheRecords,config:ctx.plan.config});return json({ok:true,apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,evaluation});}
    if(action==='result'){const previewFingerprint=String(body.previewFingerprint||body.fingerprint||'').trim();if(!previewFingerprint)return json({ok:false,error:'previewFingerprint is required for result'},400);const result=await corpusGet(matchedNullRunKey(ctx.plan,previewFingerprint));return json({ok:Boolean(result),apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,result},result?200:404);}
    if(action!=='execute')return json({ok:false,error:`Unsupported action: ${action}`},400);
    if(body.confirmExecution!==true)return json({ok:false,error:'confirmExecution:true is required; no WCL call was made',wclCallsExecuted:0},400);
    const preview=await previewFor(ctx,input),supplied=String(body.previewFingerprint||body.fingerprint||'');
    if(!preview.sufficientByPlan)return json({ok:false,error:'Matched null plan cannot satisfy the minimum control/source gate; adjust the zero-WCL plan before execution',wclCallsExecuted:0,currentPreview:preview},409);
    if(!supplied||supplied!==preview.fingerprint)return json({ok:false,error:'Preview fingerprint is missing or stale; regenerate preview before execution',wclCallsExecuted:0,currentPreview:preview},409);
    const result=await executeMatchedNullBaselineV1({plan:ctx.plan,episode:ctx.episode,previewFingerprint:supplied,confirmExecution:true,maxWclCalls:bounded(input.maxWclCalls,20,1,60),maxContinuationRounds:bounded(input.maxContinuationRounds,1,0,3),eventLimit:bounded(input.eventLimit,1000,100,5000),reservePct:input.minimumRateLimitReservePct,reservePoints:input.minimumRateLimitReservePoints});
    return json({ok:true,apiVersion:API_VERSION,networkExecuted:Number(result.wclCallsExecuted||0)>0,wclCallsExecuted:Number(result.wclCallsExecuted||0),result});
  }catch(error){const message=error instanceof Error?error.message:String(error),storage=corpusStorageErrorInfo(error);return json({ok:false,error:message,...(storage?{storage}: {})},Number(error?.httpStatus)||500);}
});
