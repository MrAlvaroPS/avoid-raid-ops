import { defineHandler } from 'nitro/h3';
import { loadAnyEncounterModel } from '../../../server/corpus/service.mjs';
import { aggregateKey,corpusId } from '../../../server/corpus/keys.mjs';
import { corpusGet,corpusList,corpusSet,corpusStorageErrorInfo } from '../../../server/corpus/storage.mjs';
import { applyBossSamplingPolicyV380 } from '../../../server/corpus/model-policy-v380.mjs';
import { buildSemanticSurgicalProbePlanV2 } from '../../../server/corpus/semantic-surgical-probe-planner-v2.mjs';
import { SEMANTIC_PROBE_EXECUTION_DEFAULTS } from '../../../server/corpus/semantic-surgical-probe-executor-v1.mjs';
import { buildStoredSemanticSourceEvidenceV2,buildStoredFlankBackgroundEvidenceV2 } from '../../../server/corpus/semantic-probe-stored-evidence-v2.mjs';
import { verifySemanticProbeEvidenceV32 } from '../../../server/corpus/semantic-probe-verifier-v3-2.mjs';
import { buildMechanicEpisodeGraphV1 } from '../../../server/corpus/mechanic-episode-graph-v1.mjs';
import { enrichMechanicEpisodeWithOfficialKnowledgeV1 } from '../../../server/corpus/mechanic-episode-official-reconciliation-v1.mjs';
import { loadLatestOfficialEncounterGraphByWclIdV1 } from '../../../server/knowledge/official-encounter-store-v1.mjs';

const API_VERSION='mechanic-episode-api-v1';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const bounded=(value,fallback,min,max)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};

async function persistedProfilesAt(prefix,args){
  const keys=await corpusList(`${prefix}/${corpusId(args)}/`),rows=[];
  for(const key of keys){const value=await corpusGet(key).catch(()=>null);if(value)rows.push(value);}
  return rows;
}

async function context(input){
  const raw=await loadAnyEncounterModel(input);
  if(!raw)throw new Error('No persisted canonical boss model is available for mechanic episodes');
  const args={
    encounterId:Number(raw.encounterId||input.encounterId),
    difficulty:Number(raw.difficulty||input.difficulty||5),
    partition:Number(raw.resolvedPartition??raw.partition??input.partition??0),
  };
  if(!args.encounterId||!args.difficulty||!args.partition)throw new Error('Resolved encounter/difficulty/partition is required');
  const aggregate=await corpusGet(aggregateKey(args));
  if(!aggregate)throw new Error('No canonical aggregate is available for mechanic episodes');
  const model=applyBossSamplingPolicyV380(raw,aggregate);
  const [wideProfiles,deepProfiles]=await Promise.all([persistedProfilesAt('profiles',args),persistedProfilesAt('deep',args)]);
  const plan=buildSemanticSurgicalProbePlanV2({
    model,aggregate,wideProfiles,deepProfiles,
    encounterId:args.encounterId,difficulty:args.difficulty,partition:args.partition,
    maxSignals:bounded(input.maxSignals,6,1,12),
    maxSourcesPerSignal:bounded(input.maxSourcesPerSignal,5,1,8),
    maxFightsPerSource:bounded(input.maxFightsPerSource,6,1,8),
    maxContextAbilityIds:bounded(input.maxContextAbilityIds,24,0,32),
  });
  return{args,model,plan};
}

async function actorProvenanceFor(args,signalId,input){
  if(input.actorProvenance)return{value:input.actorProvenance,source:'caller-supplied',fingerprint:input.actorProvenance?.previewFingerprint||null};
  const fingerprint=String(input.actorProvenanceFingerprint||'').trim();
  if(!fingerprint)return{value:null,source:'none',fingerprint:null};
  const key=`semantic-probes/${corpusId(args)}/actor-provenance/${Number(signalId)}/${fingerprint}.json`;
  const value=await corpusGet(key).catch(()=>null);
  return{value,source:value?'persisted-fingerprint':'persisted-fingerprint-missing',fingerprint};
}

async function officialGraphFor(encounterId,input){
  if(Object.prototype.hasOwnProperty.call(input,'officialGraph'))return{value:input.officialGraph||null,source:input.officialGraph?'caller-supplied':'caller-disabled'};
  try{
    const value=await loadLatestOfficialEncounterGraphByWclIdV1(encounterId);
    return{value,source:value?'persisted-wcl-alias':'not-cached'};
  }catch{
    return{value:null,source:'stored-read-unavailable'};
  }
}

const episodeStorageKey=(args,signalId,buildFingerprint)=>`mechanic-episodes/${corpusId(args)}/${Number(signalId)}/${String(buildFingerprint)}.json`;

async function buildEpisode(input,{persist=false}={}){
  const ctx=await context(input);
  const signalId=Number(input.signalId||0);
  if(!signalId)throw new Error('signalId is required');
  const signal=(ctx.plan.signals||[]).find(row=>Number(row?.id)===signalId);
  if(!signal)throw new Error('Requested signal is not in the current semantic probe plan');

  const keys=await corpusList(`semantic-probes/${corpusId(ctx.args)}/evidence/`);
  const evidenceRecords=(await Promise.all(keys.map(key=>corpusGet(key).catch(()=>null)))).filter(Boolean);
  const stored=buildStoredSemanticSourceEvidenceV2({signalId,evidenceRecords});
  const innerRadius=Math.min(...SEMANTIC_PROBE_EXECUTION_DEFAULTS.windowRadiiMs);
  const background=buildStoredFlankBackgroundEvidenceV2({signalId,evidenceRecords,innerRadiusMs:innerRadius});
  const actor=await actorProvenanceFor(ctx.args,signalId,input);
  const abilityKnowledge=input.abilityKnowledge||input.providerKnowledge||null;
  const official=await officialGraphFor(ctx.args.encounterId,input);

  const verification=verifySemanticProbeEvidenceV32({
    signalId,
    sourceEvidence:stored.sourceEvidence,
    backgroundEvidence:background.backgroundEvidence,
    abilityKnowledge,
    actorProvenance:actor.value,
    minimumIndependentSources:signal?.verificationContract?.minimumIndependentSources||3,
    minimumAnchorOccurrences:signal?.verificationContract?.minimumAnchorOccurrences||6,
  });

  const empiricalEpisode=buildMechanicEpisodeGraphV1({
    scope:ctx.args,
    signal,
    verification,
    abilityKnowledge,
    actorProvenance:actor.value,
    actorProvenanceFingerprint:actor.fingerprint,
  });
  const episode=enrichMechanicEpisodeWithOfficialKnowledgeV1(empiricalEpisode,official.value);

  const result={
    ...episode,
    sources:{
      semanticEvidence:'persisted-diagnostic-semantic-surgical',
      actorProvenance:actor.source,
      providerKnowledge:abilityKnowledge?'caller-supplied':'none',
      officialEncounterSemantics:official.source,
    },
    inputEvidence:{stored:stored.summary,background:background.summary},
  };
  if(persist)await corpusSet(episodeStorageKey(ctx.args,signalId,result.buildFingerprint),result);
  return result;
}

export default defineHandler(async event=>{
  const request=event.req;
  try{
    if(request.method!=='POST')return json({ok:false,error:'POST only'},405);
    const body=await request.json().catch(()=>({}));
    const input={
      ...body,
      encounterId:Number(body.encounterId||0),
      difficulty:Number(body.difficulty||5),
      partition:Number(body.partition||0),
      signalId:Number(body.signalId||0),
    };
    if(!input.encounterId||!input.signalId)return json({ok:false,error:'encounterId and signalId are required'},400);
    const action=String(body.action||'preview');

    if(action==='preview'){
      const result=await buildEpisode(input,{persist:false});
      return json({ok:true,apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,persisted:false,result});
    }
    if(action==='build'){
      const result=await buildEpisode(input,{persist:true});
      return json({ok:true,apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,persisted:true,result});
    }
    if(action==='result'){
      const buildFingerprint=String(body.buildFingerprint||'').trim();
      if(!buildFingerprint)return json({ok:false,error:'buildFingerprint is required for result'},400);
      const ctx=await context(input);
      const result=await corpusGet(episodeStorageKey(ctx.args,input.signalId,buildFingerprint));
      return json({ok:Boolean(result),apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,result},result?200:404);
    }
    return json({ok:false,error:`Unsupported action: ${action}`},400);
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    const storage=corpusStorageErrorInfo(error);
    return json({ok:false,error:message,...(storage?{storage}: {})},Number(error?.httpStatus)||500);
  }
});
