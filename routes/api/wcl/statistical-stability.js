import { defineHandler } from 'nitro/h3';
import { loadAnyEncounterModel } from '../../../server/corpus/service.mjs';
import { corpusId } from '../../../server/corpus/keys.mjs';
import { corpusGet,corpusSet,corpusStorageErrorInfo } from '../../../server/corpus/storage.mjs';
import { buildStatisticalStabilityV1 } from '../../../server/corpus/statistical-stability-v1.mjs';

const API_VERSION='statistical-stability-api-v1';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const evidenceGroupsBase=(args,signalId,episodeBuildFingerprint)=>`independent-evidence-groups/${corpusId(args)}/${Number(signalId)}/${String(episodeBuildFingerprint)}`;
const evidenceGroupsLatestKey=(args,signalId,episodeBuildFingerprint)=>`${evidenceGroupsBase(args,signalId,episodeBuildFingerprint)}/latest.json`;
const evidenceGroupsRevisionKey=(args,signalId,episodeBuildFingerprint,fingerprint)=>`${evidenceGroupsBase(args,signalId,episodeBuildFingerprint)}/revisions/${String(fingerprint)}.json`;
const stabilityBase=(args,signalId,episodeBuildFingerprint)=>`statistical-stability/${corpusId(args)}/${Number(signalId)}/${String(episodeBuildFingerprint)}`;
const stabilityLatestKey=(args,signalId,episodeBuildFingerprint)=>`${stabilityBase(args,signalId,episodeBuildFingerprint)}/latest.json`;
const stabilityRevisionKey=(args,signalId,episodeBuildFingerprint,fingerprint)=>`${stabilityBase(args,signalId,episodeBuildFingerprint)}/revisions/${String(fingerprint)}.json`;

async function scope(input){const raw=await loadAnyEncounterModel(input);if(!raw)throw new Error('No persisted canonical boss model is available for Statistical Stability');const args={encounterId:Number(raw.encounterId||input.encounterId),difficulty:Number(raw.difficulty||input.difficulty||5),partition:Number(raw.resolvedPartition??raw.partition??input.partition??0)};if(!args.encounterId||!args.difficulty||!args.partition)throw new Error('Resolved encounter/difficulty/partition is required');return args;}

async function loadEvidenceGroups(args,input){
  const episodeBuildFingerprint=String(input.episodeBuildFingerprint||input.buildFingerprint||'').trim();
  if(!episodeBuildFingerprint)throw new Error('episodeBuildFingerprint is required');
  const requested=String(input.evidenceGroupsFingerprint||'').trim();
  const key=requested?evidenceGroupsRevisionKey(args,input.signalId,episodeBuildFingerprint,requested):evidenceGroupsLatestKey(args,input.signalId,episodeBuildFingerprint);
  const value=await corpusGet(key);
  if(!value)throw new Error(requested?'Persisted Independent Evidence Groups revision not found':'No latest Independent Evidence Groups product is available for this Episode');
  if(requested&&String(value.fingerprint)!==requested)throw new Error('Independent Evidence Groups fingerprint mismatch');
  return{episodeBuildFingerprint,evidenceGroups:value,key};
}

export default defineHandler(async event=>{
  const request=event.req;
  try{
    if(request.method!=='POST')return json({ok:false,error:'POST only'},405);
    const body=await request.json().catch(()=>({})),action=String(body.action||'preview');
    const input={...body,encounterId:Number(body.encounterId||0),difficulty:Number(body.difficulty||5),partition:Number(body.partition||0),signalId:Number(body.signalId||0)};
    if(!input.encounterId||!input.signalId)return json({ok:false,error:'encounterId and signalId are required'},400);
    const args=await scope(input),episodeBuildFingerprint=String(input.episodeBuildFingerprint||input.buildFingerprint||'').trim();
    if(!episodeBuildFingerprint)return json({ok:false,error:'episodeBuildFingerprint is required'},400);

    if(action==='latest'){
      const result=await corpusGet(stabilityLatestKey(args,input.signalId,episodeBuildFingerprint));
      return json({ok:Boolean(result),apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,result},result?200:404);
    }
    if(action==='result'){
      const fingerprint=String(body.fingerprint||'').trim();if(!fingerprint)return json({ok:false,error:'fingerprint is required for result'},400);
      const result=await corpusGet(stabilityRevisionKey(args,input.signalId,episodeBuildFingerprint,fingerprint));
      return json({ok:Boolean(result),apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,result},result?200:404);
    }

    const loaded=await loadEvidenceGroups(args,input);
    const result=buildStatisticalStabilityV1({evidenceGroups:loaded.evidenceGroups,config:{
      minimumEligibleGroups:input.minimumEligibleGroups,
      minimumSupportiveGroupShare:input.minimumSupportiveGroupShare,
      maximumContradictoryGroupShare:input.maximumContradictoryGroupShare,
      minimumMedianPrevalenceDelta:input.minimumMedianPrevalenceDelta,
      maximumDeltaMad:input.maximumDeltaMad,
    }});
    if(action==='preview')return json({ok:true,apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,persisted:false,evidenceGroupsKey:loaded.key,result});
    if(action==='build'){
      const stored={...result,storage:{kind:'statistical-stability-revision',evidenceGroupsKey:loaded.key,revisionKey:stabilityRevisionKey(args,input.signalId,episodeBuildFingerprint,result.fingerprint),latestKey:stabilityLatestKey(args,input.signalId,episodeBuildFingerprint)}};
      await corpusSet(stored.storage.revisionKey,stored);await corpusSet(stored.storage.latestKey,stored);
      return json({ok:true,apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,persisted:true,result:stored});
    }
    return json({ok:false,error:`Unsupported action: ${action}`},400);
  }catch(error){const message=error instanceof Error?error.message:String(error),storage=corpusStorageErrorInfo(error);return json({ok:false,error:message,...(storage?{storage}: {})},Number(error?.httpStatus)||500);}
});
