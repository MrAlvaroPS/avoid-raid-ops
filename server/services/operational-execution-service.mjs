import { getOperationalExecutionV1 } from '../engines/operational-execution-v1.mjs';
import { observeHomeRosterV1 } from '../engines/home-roster-engine.mjs';
import { jsonResponse } from '../api/http.mjs';

export default async req=>{
  if(req.method!=='GET')return jsonResponse(405,{ok:false,error:'Method not allowed'},'no-store');
  const u=new URL(req.url),reportCode=u.searchParams.get('report'),encounterId=u.searchParams.get('encounter'),difficulty=u.searchParams.get('difficulty');
  if(!reportCode)return jsonResponse(400,{ok:false,error:'report is required'},'no-store');
  if(!encounterId||!difficulty)return jsonResponse(400,{ok:false,error:'encounter+difficulty are required; operational execution never guesses a cross-difficulty scope'},'no-store');
  try{
    const result=await getOperationalExecutionV1({reportCode,encounterId,difficulty});if(!result)return jsonResponse(404,{ok:false,error:'Report not found',reportCode},'no-store');
    if(result?.raidKnowledge?.homeRaidEligible&&Array.isArray(result?.telemetry?.players)&&result.telemetry.players.length){
      try{const fightId=result?.telemetry?.pulls?.at?.(-1)?.fightId||result?.encounter?.latestFightId||null,observed=await observeHomeRosterV1({players:result.telemetry.players,reportCode,fightId,observedAt:Date.now()});result.homeRoster={updated:true,observedPlayers:observed.observedPlayers,networkExecuted:false};}
      catch(error){result.homeRoster={updated:false,error:error instanceof Error?error.message:String(error),networkExecuted:false};}
    }
    return jsonResponse(200,{ok:true,...result},'private, no-store');
  }
  catch(error){return jsonResponse(500,{ok:false,error:error instanceof Error?error.message:String(error),reportCode},'no-store');}
};
