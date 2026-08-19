import { defineHandler } from 'nitro/h3';
import { loadMechanicKnowledgeViewV1 } from '../../../server/services/mechanic-knowledge-view-service.mjs';
import { corpusStorageErrorInfo } from '../../../server/corpus/storage.mjs';

const API_VERSION='iris-mechanic-knowledge-api-v1';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});

export default defineHandler(async event=>{
  const request=event.req;
  try{
    if(request.method!=='GET')return json({ok:false,error:'GET only'},405);
    const url=new URL(request.url,'http://raidops.local');
    const input={
      encounterId:Number(url.searchParams.get('encounter')||url.searchParams.get('encounterId')||0),
      difficulty:Number(url.searchParams.get('difficulty')||5),
      partition:Number(url.searchParams.get('partition')||0),
    };
    if(!input.encounterId)return json({ok:false,error:'encounter is required'},400);
    const result=await loadMechanicKnowledgeViewV1(input);
    if(!result)return json({ok:false,apiVersion:API_VERSION,error:'No persisted GLOBAL BOSS model is available for this encounter',networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0},404);
    return json({ok:true,apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,result});
  }catch(error){
    const storage=corpusStorageErrorInfo(error);
    return json({ok:false,apiVersion:API_VERSION,error:error instanceof Error?error.message:String(error),networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,...(storage?{storage}: {})},Number(error?.httpStatus)||500);
  }
});
