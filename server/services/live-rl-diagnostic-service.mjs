import { getLiveRlDiagnosticV1 } from '../engines/live-rl-diagnostic-v1.mjs';
import { enrichLiveRlDiagnosticWithGlobalV1 } from '../analysis/live/global-benchmark-enrichment-v1.mjs';
import { persistHomeGlobalComparisonFromDiagnosticV1 } from '../home/raid-global-outlier-store-v1.mjs';
import { jsonResponse } from '../api/http.mjs';

export default async req=>{
  if(req.method!=='GET')return jsonResponse(405,{ok:false,error:'Method not allowed'},'no-store');
  const u=new URL(req.url),reportCode=u.searchParams.get('report'),encounterId=Number(u.searchParams.get('encounter')),difficulty=Number(u.searchParams.get('difficulty')),fightId=Number(u.searchParams.get('fight'));
  if(!reportCode)return jsonResponse(400,{ok:false,error:'report is required'},'no-store');
  if(!Number.isInteger(encounterId)||encounterId<=0||!Number.isInteger(difficulty)||difficulty<=0)return jsonResponse(400,{ok:false,error:'encounter+difficulty are required'},'no-store');
  if(!Number.isInteger(fightId)||fightId<=0)return jsonResponse(400,{ok:false,error:'fight is required'},'no-store');
  try{
    const raw=await getLiveRlDiagnosticV1({reportCode,encounterId,difficulty,fightId});
    if(!raw)return jsonResponse(404,{ok:false,error:'Selected fight diagnostic is unavailable',reportCode,encounterId,difficulty,fightId},'no-store');
    const diagnostic=await enrichLiveRlDiagnosticWithGlobalV1(raw),homeGlobalComparison=await persistHomeGlobalComparisonFromDiagnosticV1(diagnostic).catch(error=>({persisted:false,reason:error instanceof Error?error.message:String(error)}));
    return jsonResponse(200,{ok:true,diagnostic,homeGlobalComparison:{persisted:homeGlobalComparison?.persisted===true,reused:homeGlobalComparison?.reused===true,reason:homeGlobalComparison?.reason||null},evidenceContract:{explicitSelectedFight:true,sameDifficultyOnly:true,homeMutationRequiresExactPersistedPullFacts:true,globalComparisonPersistsOnlyToHomeExecutionMemory:true,noGlobalLearning:true,outlierDoesNotImplyFailure:true}},'private, no-store');
  }catch(error){return jsonResponse(500,{ok:false,error:error instanceof Error?error.message:String(error),reportCode,encounterId,difficulty,fightId},'no-store');}
};
