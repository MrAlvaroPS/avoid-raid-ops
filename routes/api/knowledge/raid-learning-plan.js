import { defineHandler } from 'nitro/h3';
import { loadLatestRaidCatalogV1 } from '../../../server/knowledge/raid-catalog-store-v1.mjs';
import { buildRaidLearningPlanPreviewV1,resolveRaidLearningAvailabilityV1 } from '../../../server/knowledge/raid-learning-plan-v1.mjs';
import { loadLatestRaidLearningPlanV1,persistRaidLearningPlanV1 } from '../../../server/knowledge/raid-learning-plan-store-v1.mjs';
import { corpusStorageErrorInfo } from '../../../server/corpus/storage.mjs';

const API_VERSION='raid-learning-plan-api-v1';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});

export default defineHandler(async event=>{
  try{
    const request=event.req,catalog=await loadLatestRaidCatalogV1().catch(()=>null);
    if(!catalog?.currentRaid)return json({ok:false,apiVersion:API_VERSION,error:'No persisted current raid catalog. Refresh /api/knowledge/raid-catalog first.',networkExecuted:false,wclCombatEventCalls:0},409);
    if(request.method==='GET'){
      const latest=await loadLatestRaidLearningPlanV1(catalog.fingerprint).catch(()=>null);
      return json({ok:true,apiVersion:API_VERSION,networkExecuted:false,wclCombatEventCalls:0,catalogFingerprint:catalog.fingerprint,latest});
    }
    if(request.method!=='POST')return json({ok:false,error:'GET/POST only'},405);
    const body=await request.json().catch(()=>({})),action=String(body.action||'preview').toLowerCase(),preview=buildRaidLearningPlanPreviewV1(catalog);
    if(action==='preview')return json({ok:true,apiVersion:API_VERSION,action:'preview',networkExecuted:false,wclCombatEventCalls:0,preview});
    if(action!=='refresh')return json({ok:false,error:'Unsupported action',allowed:['preview','refresh']},400);
    if(body.confirmExecution!==true)return json({ok:false,error:'Raid learning availability refresh requires confirmExecution:true',preview},409);
    if(String(body.previewFingerprint||'')!==preview.fingerprint)return json({ok:false,error:'Stale or missing previewFingerprint',preview},409);
    const resolved=await resolveRaidLearningAvailabilityV1(catalog),stored=await persistRaidLearningPlanV1(resolved);
    return json({ok:true,apiVersion:API_VERSION,action:'refresh',networkExecuted:Number(stored.usage?.wclMetadataCalls||0)>0,wclCombatEventCalls:0,result:stored});
  }catch(error){const storage=corpusStorageErrorInfo(error);return json({ok:false,apiVersion:API_VERSION,error:error instanceof Error?error.message:String(error),wclCombatEventCalls:0,...(storage?{storage}: {})},Number(error?.httpStatus)||500);}
});
