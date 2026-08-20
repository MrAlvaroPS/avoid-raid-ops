import { getOperationalExecutionV1 } from '../engines/operational-execution-v1.mjs';
import { getLiveRlDiagnosticV1 } from '../engines/live-rl-diagnostic-v1.mjs';
import { enrichLiveRlDiagnosticWithGlobalV1 } from '../analysis/live/global-benchmark-enrichment-v1.mjs';
import { persistHomeGlobalComparisonFromDiagnosticV1 } from '../home/raid-global-outlier-store-v1.mjs';
import { previewOperationalRehearsalV1 } from '../corpus/operational-readiness-v1.mjs';
import { getTelemetry } from '../engines/telemetry-engine.mjs';
import { jsonResponse } from '../api/http.mjs';

async function diagnosticFor({reportCode,scope,telemetry}){if(!telemetry)return{diagnostic:null,persistence:null};const raw=await getLiveRlDiagnosticV1({reportCode,...scope,telemetry}).catch(()=>null);if(!raw)return{diagnostic:null,persistence:null};const diagnostic=await enrichLiveRlDiagnosticWithGlobalV1(raw),persistence=await persistHomeGlobalComparisonFromDiagnosticV1(diagnostic).catch(error=>({persisted:false,reason:error instanceof Error?error.message:String(error)}));return{diagnostic,persistence};}
export default async req=>{
  if(req.method!=='GET')return jsonResponse(405,{ok:false,error:'Method not allowed'},'no-store');
  const u=new URL(req.url),reportCode=u.searchParams.get('report'),encounterId=u.searchParams.get('encounter'),difficulty=u.searchParams.get('difficulty');
  if(!reportCode)return jsonResponse(400,{ok:false,error:'report is required'},'no-store');
  if(!encounterId||!difficulty)return jsonResponse(400,{ok:false,error:'encounter+difficulty are required; operational execution never guesses a cross-difficulty scope'},'no-store');
  try{
    const scope={encounterId:Number(encounterId),difficulty:Number(difficulty)};
    const readiness=await previewOperationalRehearsalV1({...scope,partition:0}).catch(()=>null);
    if(readiness?.liveReady!==true){
      const telemetry=await getTelemetry({reportCode,...scope}).catch(()=>null),{diagnostic:rlDiagnostic,persistence}=await diagnosticFor({reportCode,scope,telemetry});
      return jsonResponse(200,{ok:true,version:'operational-execution-gate-v5',generatedAt:Date.now(),status:'boss-reference-not-ready',reason:'operational-rehearsal-required',telemetry,rlDiagnostic,homeGlobalComparison:persistence?{persisted:persistence.persisted===true,reused:persistence.reused===true,reason:persistence.reason||null}:null,mechanics:null,blocker:null,nextPullCalls:[],homeExecution:null,readiness:readiness?{status:readiness.status,dataReady:readiness.dataReady===true,mechanicCoverageReady:readiness.mechanicCoverageReady===true,liveReady:false,coverage:readiness.storedPrevious?.coverage||readiness.stored?.coverage||null,operationalExecutionContractVersion:readiness.operationalExecutionContractVersion||null}:null,evidenceContract:{dataReadyDoesNotImplyLiveReady:true,noUnrehearsedMechanicClassification:true,currentRehearsalFingerprintRequired:true,sameDifficultyOnly:true,safeTelemetryAllowedWhileMechanicsGated:true,safeRlDiagnosticAllowedWhileMechanicsGated:true,gatedTelemetryDoesNotPersistHomeMechanics:true,gatedRlDiagnosticIsObservedNotCausal:true,homeGlobalOutliersMayPersistWithExactHomePullProof:true}},'private, no-store');
    }
    const result=await getOperationalExecutionV1({reportCode,...scope});if(!result)return jsonResponse(404,{ok:false,error:'Report not found',reportCode},'no-store');
    const {diagnostic:rlDiagnostic,persistence}=await diagnosticFor({reportCode,scope,telemetry:result.telemetry});
    return jsonResponse(200,{ok:true,...result,rlDiagnostic,homeGlobalComparison:persistence?{persisted:persistence.persisted===true,reused:persistence.reused===true,reason:persistence.reason||null}:null,readiness:{status:readiness.status,liveReady:true,coverage:readiness.stored?.coverage||readiness.storedPrevious?.coverage||null,operationalExecutionContractVersion:readiness.operationalExecutionContractVersion||null}},'private, no-store');
  }catch(error){return jsonResponse(500,{ok:false,error:error instanceof Error?error.message:String(error),reportCode},'no-store');}
};
