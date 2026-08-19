import { getOperationalExecutionV1 } from '../engines/operational-execution-v1.mjs';
import { previewOperationalRehearsalV1 } from '../corpus/operational-readiness-v1.mjs';
import { jsonResponse } from '../api/http.mjs';

export default async req=>{
  if(req.method!=='GET')return jsonResponse(405,{ok:false,error:'Method not allowed'},'no-store');
  const u=new URL(req.url),reportCode=u.searchParams.get('report'),encounterId=u.searchParams.get('encounter'),difficulty=u.searchParams.get('difficulty');
  if(!reportCode)return jsonResponse(400,{ok:false,error:'report is required'},'no-store');
  if(!encounterId||!difficulty)return jsonResponse(400,{ok:false,error:'encounter+difficulty are required; operational execution never guesses a cross-difficulty scope'},'no-store');
  try{
    const readiness=await previewOperationalRehearsalV1({encounterId:Number(encounterId),difficulty:Number(difficulty),partition:0}).catch(()=>null);
    if(readiness?.liveReady!==true)return jsonResponse(200,{ok:true,version:'operational-execution-gate-v2',generatedAt:Date.now(),status:'boss-reference-not-ready',reason:'operational-rehearsal-required',readiness:readiness?{status:readiness.status,dataReady:readiness.dataReady===true,mechanicCoverageReady:readiness.mechanicCoverageReady===true,liveReady:false,coverage:readiness.storedPrevious?.coverage||readiness.stored?.coverage||null,operationalExecutionContractVersion:readiness.operationalExecutionContractVersion||null}:null,evidenceContract:{dataReadyDoesNotImplyLiveReady:true,noUnrehearsedMechanicClassification:true,currentRehearsalFingerprintRequired:true,sameDifficultyOnly:true}},'private, no-store');
    const result=await getOperationalExecutionV1({reportCode,encounterId,difficulty});if(!result)return jsonResponse(404,{ok:false,error:'Report not found',reportCode},'no-store');return jsonResponse(200,{ok:true,...result,readiness:{status:readiness.status,liveReady:true,coverage:readiness.stored?.coverage||readiness.storedPrevious?.coverage||null,operationalExecutionContractVersion:readiness.operationalExecutionContractVersion||null}},'private, no-store');
  }
  catch(error){return jsonResponse(500,{ok:false,error:error instanceof Error?error.message:String(error),reportCode},'no-store');}
};
