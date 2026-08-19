import { getLiveRlDiagnosticV1 } from '../engines/live-rl-diagnostic-v1.mjs';
import { jsonResponse } from '../api/http.mjs';

export default async req=>{
  if(req.method!=='GET')return jsonResponse(405,{ok:false,error:'Method not allowed'},'no-store');
  const u=new URL(req.url),reportCode=u.searchParams.get('report'),encounterId=Number(u.searchParams.get('encounter')),difficulty=Number(u.searchParams.get('difficulty')),fightId=Number(u.searchParams.get('fight'));
  if(!reportCode)return jsonResponse(400,{ok:false,error:'report is required'},'no-store');
  if(!Number.isInteger(encounterId)||encounterId<=0||!Number.isInteger(difficulty)||difficulty<=0)return jsonResponse(400,{ok:false,error:'encounter+difficulty are required'},'no-store');
  if(!Number.isInteger(fightId)||fightId<=0)return jsonResponse(400,{ok:false,error:'fight is required'},'no-store');
  try{
    const diagnostic=await getLiveRlDiagnosticV1({reportCode,encounterId,difficulty,fightId});
    if(!diagnostic)return jsonResponse(404,{ok:false,error:'Selected fight diagnostic is unavailable',reportCode,encounterId,difficulty,fightId},'no-store');
    return jsonResponse(200,{ok:true,diagnostic,evidenceContract:{explicitSelectedFight:true,sameDifficultyOnly:true,noHomeHistoryMutation:true,noGlobalLearning:true}},'private, no-store');
  }catch(error){return jsonResponse(500,{ok:false,error:error instanceof Error?error.message:String(error),reportCode,encounterId,difficulty,fightId},'no-store');}
};
