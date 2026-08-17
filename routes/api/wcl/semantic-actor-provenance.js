import { defineHandler } from 'nitro/h3';
import { loadAnyEncounterModel } from '../../../server/corpus/service.mjs';
import { corpusId } from '../../../server/corpus/keys.mjs';
import { corpusGet,corpusList,corpusSet,corpusStorageErrorInfo } from '../../../server/corpus/storage.mjs';
import { buildSemanticActorProvenancePreview,executeSemanticActorProvenance } from '../../../server/corpus/semantic-actor-provenance-v1.mjs';

const API_VERSION='semantic-actor-provenance-api-v1';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const ids=value=>[...new Set((Array.isArray(value)?value:String(value||'').split(',')).map(Number).filter(Number.isInteger).filter(n=>n>0))];

async function scope(input){
  const raw=await loadAnyEncounterModel(input);if(!raw)throw new Error('No persisted canonical boss model is available');
  const args={encounterId:Number(raw.encounterId||input.encounterId),difficulty:Number(raw.difficulty||input.difficulty||5),partition:Number(raw.resolvedPartition??raw.partition??input.partition??0)};
  if(!args.encounterId||!args.partition)throw new Error('Resolved encounter/difficulty/partition is required');
  return args;
}
async function evidence(args,signalId){
  const keys=await corpusList(`semantic-probes/${corpusId(args)}/evidence/${Number(signalId)}/`);
  return (await Promise.all(keys.map(key=>corpusGet(key).catch(()=>null)))).filter(Boolean);
}
const storageKey=(args,signalId,fingerprint)=>`semantic-probes/${corpusId(args)}/actor-provenance/${Number(signalId)}/${String(fingerprint)}.json`;

export default defineHandler(async event=>{
  const request=event.req;
  try{
    if(request.method!=='POST')return json({ok:false,error:'POST only'},405);
    const body=await request.json().catch(()=>({}));
    const input={encounterId:Number(body.encounterId||0),difficulty:Number(body.difficulty||5),partition:Number(body.partition||0)};
    const signalId=Number(body.signalId||0),abilityIds=ids(body.abilityIds),action=String(body.action||'preview');
    if(!input.encounterId||!signalId||!abilityIds.length)return json({ok:false,error:'encounterId, signalId and abilityIds are required'},400);
    const args=await scope(input),records=await evidence(args,signalId);
    const preview=buildSemanticActorProvenancePreview({signalId,abilityIds,evidenceRecords:records,maxReports:body.maxReports});
    if(action==='preview')return json({ok:true,apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,scope:args,preview:{...preview,_execution:undefined}});
    if(action==='result'){
      const fp=String(body.previewFingerprint||body.fingerprint||'');if(!fp)return json({ok:false,error:'fingerprint is required'},400);
      const result=await corpusGet(storageKey(args,signalId,fp));return json({ok:Boolean(result),apiVersion:API_VERSION,wclCallsExecuted:0,result},result?200:404);
    }
    if(action!=='execute')return json({ok:false,error:`Unsupported action: ${action}`},400);
    if(body.confirmExecution!==true)return json({ok:false,error:'confirmExecution:true is required; no WCL call was made',wclCallsExecuted:0},400);
    const supplied=String(body.previewFingerprint||body.fingerprint||'');
    if(!supplied||supplied!==preview.fingerprint)return json({ok:false,error:'Preview fingerprint is missing or stale; regenerate preview before execution',wclCallsExecuted:0,currentPreview:{...preview,_execution:undefined}},409);
    const result=await executeSemanticActorProvenance({signalId,abilityIds,evidenceRecords:records,previewFingerprint:supplied,confirmExecution:true,maxReports:body.maxReports,reservePct:body.minimumRateLimitReservePct,reservePoints:body.minimumRateLimitReservePoints});
    await corpusSet(storageKey(args,signalId,preview.fingerprint),result);
    return json({ok:true,apiVersion:API_VERSION,wclCallsExecuted:Number(result.wclCallsExecuted||0),result});
  }catch(error){
    const message=error instanceof Error?error.message:String(error),storage=corpusStorageErrorInfo(error);
    return json({ok:false,error:message,...(storage?{storage}: {})},Number(error?.httpStatus)||500);
  }
});
