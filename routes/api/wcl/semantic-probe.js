import { defineHandler } from 'nitro/h3';
import { loadAnyEncounterModel } from '../../../server/corpus/service.mjs';
import { aggregateKey, corpusId } from '../../../server/corpus/keys.mjs';
import { corpusGet, corpusList, corpusStorageErrorInfo } from '../../../server/corpus/storage.mjs';
import { applyBossSamplingPolicyV380 } from '../../../server/corpus/model-policy-v380.mjs';
import { buildSemanticSurgicalProbePlanV2 } from '../../../server/corpus/semantic-surgical-probe-planner-v2.mjs';
import {
  SEMANTIC_PROBE_EXECUTION_DEFAULTS,
  buildSemanticProbeExecutionPreview,
  executeSemanticProbePlanV1,
  semanticProbeRunKey,
} from '../../../server/corpus/semantic-surgical-probe-executor-v1.mjs';
import { verifySemanticProbeEvidenceV32 } from '../../../server/corpus/semantic-probe-verifier-v3-2.mjs';
import { buildStoredSemanticSourceEvidenceV2,buildStoredFlankBackgroundEvidenceV2 } from '../../../server/corpus/semantic-probe-stored-evidence-v2.mjs';

const API_VERSION='semantic-probe-api-v5';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

function inputFrom(request,body={}){
  const url=new URL(request.url);
  return{
    encounterId:Number(body.encounterId||url.searchParams.get('encounter')||0),
    difficulty:Number(body.difficulty||url.searchParams.get('difficulty')||5)||5,
    partition:Number(body.partition??url.searchParams.get('partition')??0)||0,
    fingerprint:body.fingerprint||body.previewFingerprint||url.searchParams.get('fingerprint')||null,
    ...body,
  };
}

function boundedNumber(value,fallback,min,max){
  const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
}
function executionConfig(input={}){
  return{
    maxWclCalls:boundedNumber(input.maxWclCalls,SEMANTIC_PROBE_EXECUTION_DEFAULTS.maxWclCalls,1,60),
    maxAnchorContinuationRounds:boundedNumber(input.maxAnchorContinuationRounds,SEMANTIC_PROBE_EXECUTION_DEFAULTS.maxAnchorContinuationRounds,0,4),
    maxContextContinuationRounds:boundedNumber(input.maxContextContinuationRounds,SEMANTIC_PROBE_EXECUTION_DEFAULTS.maxContextContinuationRounds,0,2),
    maxAnchorOccurrencesPerSource:boundedNumber(input.maxAnchorOccurrencesPerSource,SEMANTIC_PROBE_EXECUTION_DEFAULTS.maxAnchorOccurrencesPerSource,1,4),
    maxContextQueries:boundedNumber(input.maxContextQueries,SEMANTIC_PROBE_EXECUTION_DEFAULTS.maxContextQueries,1,24),
    windowRadiiMs:Array.isArray(input.windowRadiiMs)&&input.windowRadiiMs.length?input.windowRadiiMs:SEMANTIC_PROBE_EXECUTION_DEFAULTS.windowRadiiMs,
    eventLimit:boundedNumber(input.eventLimit,SEMANTIC_PROBE_EXECUTION_DEFAULTS.eventLimit,100,2000),
    minimumRateLimitReservePct:boundedNumber(input.minimumRateLimitReservePct,SEMANTIC_PROBE_EXECUTION_DEFAULTS.minimumRateLimitReservePct,0.05,0.5),
    minimumRateLimitReservePoints:boundedNumber(input.minimumRateLimitReservePoints,SEMANTIC_PROBE_EXECUTION_DEFAULTS.minimumRateLimitReservePoints,100,100000),
  };
}

async function persistedProfilesAt(prefix,args){
  const keys=await corpusList(`${prefix}/${corpusId(args)}/`);
  const rows=[];
  for(const key of keys){const value=await corpusGet(key);if(value)rows.push(value);}
  return rows;
}

async function context(input){
  const raw=await loadAnyEncounterModel(input);
  if(!raw)throw new Error('No persisted canonical boss model is available for semantic probes');
  const partition=Number(raw.resolvedPartition??raw.partition??input.partition??0);
  const args={encounterId:Number(raw.encounterId||input.encounterId),difficulty:Number(raw.difficulty||input.difficulty||5),partition};
  if(!args.encounterId||!args.partition)throw new Error('Semantic probe scope requires resolved encounter, difficulty and partition');
  const aggregate=await corpusGet(aggregateKey(args));
  if(!aggregate)throw new Error('No canonical aggregate is available for semantic probes');
  const model=applyBossSamplingPolicyV380(raw,aggregate);
  const [wideProfiles,deepProfiles]=await Promise.all([persistedProfilesAt('profiles',args),persistedProfilesAt('deep',args)]);
  const plan=buildSemanticSurgicalProbePlanV2({
    model,aggregate,wideProfiles,deepProfiles,
    encounterId:args.encounterId,difficulty:args.difficulty,partition:args.partition,
    maxSignals:boundedNumber(input.maxSignals,3,1,6),
    maxSourcesPerSignal:boundedNumber(input.maxSourcesPerSignal,5,1,8),
    maxFightsPerSource:boundedNumber(input.maxFightsPerSource,6,1,8),
    maxContextAbilityIds:boundedNumber(input.maxContextAbilityIds,12,0,24),
  });
  return{args,model,aggregate,deepProfiles,plan};
}

async function preview(input){
  const ctx=await context(input);
  const cacheKeys=await corpusList(`semantic-probes/${corpusId(ctx.args)}/evidence/`);
  const cacheEntries=(await Promise.all(cacheKeys.map(async key=>({key,value:await corpusGet(key).catch(()=>null)})))).filter(row=>row.value);
  const anchorEntries=cacheEntries.filter(row=>row.value?.kind==='anchor');
  const observedContextComplete=cacheEntries.filter(row=>row.value?.kind==='context'&&row.value?.pagination?.complete===true).length;
  const observedContextPartial=cacheEntries.filter(row=>row.value?.kind==='context'&&row.value?.pagination?.complete!==true).length;
  const config=executionConfig(input);
  const base=buildSemanticProbeExecutionPreview({plan:ctx.plan,cacheEntries:anchorEntries,config});
  const probePreview={
    ...base,
    contextCacheHitsObserved:observedContextComplete,
    contextCachePartialObserved:observedContextPartial,
    cacheAccounting:{
      ...base.cacheAccounting,
      contextEvidenceObservedSeparately:true,
      contextEvidenceSubtractedFromCallBudget:false,
      contextBudgetReason:'Context cache is reported for reuse visibility but is not subtracted from the bounded call budget unless exact current-plan identity is proven.',
    },
  };
  return{...ctx,config,preview:probePreview};
}

const actorProvenanceKey=(args,signalId,fingerprint)=>`semantic-probes/${corpusId(args)}/actor-provenance/${Number(signalId)}/${String(fingerprint)}.json`;
async function resolvedActorProvenance(input,args,signalId){
  if(input.actorProvenance)return{value:input.actorProvenance,source:'caller-supplied'};
  const fingerprint=String(input.actorProvenanceFingerprint||'').trim();
  if(!fingerprint)return{value:null,source:'none'};
  const value=await corpusGet(actorProvenanceKey(args,signalId,fingerprint)).catch(()=>null);
  return{value,source:value?'persisted-fingerprint':'persisted-fingerprint-missing'};
}

async function reverifyStored(input){
  const ctx=await context(input);
  const keys=await corpusList(`semantic-probes/${corpusId(ctx.args)}/evidence/`);
  const evidenceRecords=(await Promise.all(keys.map(key=>corpusGet(key).catch(()=>null)))).filter(Boolean);
  const requestedId=Number(input.signalId||0);
  const signals=(ctx.plan.signals||[]).filter(signal=>!requestedId||Number(signal.id)===requestedId);
  if(!signals.length)throw new Error(requestedId?'Requested signal is not in the current semantic probe plan':'Current semantic probe plan has no signals');
  const abilityKnowledge=input.abilityKnowledge||input.providerKnowledge||null;
  const results=[];
  for(const signal of signals){
    const stored=buildStoredSemanticSourceEvidenceV2({signalId:signal.id,evidenceRecords});
    const innerRadius=Math.min(...SEMANTIC_PROBE_EXECUTION_DEFAULTS.windowRadiiMs);
    const background=buildStoredFlankBackgroundEvidenceV2({signalId:signal.id,evidenceRecords,innerRadiusMs:innerRadius});
    const actor=await resolvedActorProvenance(input,ctx.args,signal.id);
    const verification=verifySemanticProbeEvidenceV32({
      signalId:signal.id,sourceEvidence:stored.sourceEvidence,backgroundEvidence:background.backgroundEvidence,abilityKnowledge,actorProvenance:actor.value,
      minimumIndependentSources:signal?.verificationContract?.minimumIndependentSources||3,
      minimumAnchorOccurrences:signal?.verificationContract?.minimumAnchorOccurrences||6,
    });
    results.push({signalId:Number(signal.id),stored:stored.summary,background:background.summary,actorProvenanceSource:actor.source,verification});
  }
  return{
    version:'semantic-stored-reverification-v4',scope:ctx.args,wclCallsExecuted:0,providerNetworkCallsExecuted:0,
    evidenceSource:'persisted-diagnostic-semantic-surgical',providerKnowledgeSource:abilityKnowledge?'caller-supplied':'none',
    actorProvenanceSource:results.length===1?results[0].actorProvenanceSource:'per-signal',
    results,
    safety:{canonicalDeepContribution:{reports:0,pulls:0},directScoreDelta:0,automaticPromotion:false,actorProvenanceNetworkCalls:0,providerCannotOverrideActorOrigin:true},
  };
}

export default defineHandler(async event=>{
  const request=event.req;
  const url=new URL(request.url);
  const queryAction=String(url.searchParams.get('action')||'preview');
  try{
    if(request.method==='GET'){
      const input=inputFrom(request);
      if(!input.encounterId)return json({ok:false,error:'encounter is required'},400);
      if(queryAction==='preview'){
        const row=await preview(input);
        return json({ok:true,apiVersion:API_VERSION,wclCallsExecuted:0,preview:row.preview});
      }
      if(queryAction==='result'){
        if(!input.fingerprint)return json({ok:false,error:'fingerprint is required'},400);
        const row=await context(input);
        const result=await corpusGet(semanticProbeRunKey(row.plan,String(input.fingerprint)));
        return json({ok:Boolean(result),apiVersion:API_VERSION,wclCallsExecuted:0,result},result?200:404);
      }
      return json({ok:false,error:'GET supports only preview or result. Semantic probe execution and stored re-verification are POST-only.'},405);
    }

    if(request.method!=='POST')return json({ok:false,error:'Method not allowed'},405);
    const body=await request.json().catch(()=>({}));
    const input=inputFrom(request,body);
    const action=String(body.action||queryAction||'preview');
    if(!input.encounterId)return json({ok:false,error:'encounterId is required'},400);
    if(action==='preview'){
      const row=await preview(input);
      return json({ok:true,apiVersion:API_VERSION,wclCallsExecuted:0,preview:row.preview});
    }
    if(action==='reverify'){
      const result=await reverifyStored(input);
      return json({ok:true,apiVersion:API_VERSION,wclCallsExecuted:0,providerNetworkCallsExecuted:0,result});
    }
    if(action!=='execute')return json({ok:false,error:`Unsupported semantic probe action: ${action}`},400);
    if(body.confirmExecution!==true)return json({ok:false,error:'confirmExecution:true is required; no WCL call was made',wclCallsExecuted:0},400);

    const row=await preview(input);
    const supplied=String(body.previewFingerprint||body.fingerprint||'');
    if(!supplied||supplied!==row.preview.fingerprint){
      return json({ok:false,error:'Preview fingerprint is missing or stale; regenerate preview before execution',wclCallsExecuted:0,currentPreview:row.preview},409);
    }
    const result=await executeSemanticProbePlanV1({
      plan:row.plan,previewFingerprint:supplied,confirmExecution:true,config:row.config,deepProfiles:row.deepProfiles,
    });
    return json({ok:true,apiVersion:API_VERSION,wclCallsExecuted:Number(result.wclCallsExecutedThisInvocation||0),result});
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    const storage=corpusStorageErrorInfo(error);
    return json({ok:false,error:message,...(storage?{storage}: {})},Number(error?.httpStatus)||500);
  }
});