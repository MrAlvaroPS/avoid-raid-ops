import { jsonResponse } from '../api/http.mjs';
import { getPersistedAvoidHistoryIndexV1,getPersistedAvoidHistoryScopeV1,refreshPersistedAvoidHistoryV1 } from '../engines/home-history-engine-v1.mjs';

const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};

export default async req=>{
  const url=new URL(req.url);
  if(req.method==='GET'){
    try{
      const encounterId=positive(url.searchParams.get('encounter')),difficulty=positive(url.searchParams.get('difficulty')),zoneId=positive(url.searchParams.get('zone'));
      if(Boolean(encounterId)!==Boolean(difficulty))return jsonResponse(400,{ok:false,error:'encounter and difficulty must be supplied together; HOME history is difficulty-scoped'},'no-store');
      const result=encounterId?await getPersistedAvoidHistoryScopeV1({zoneId,encounterId,difficulty}):await getPersistedAvoidHistoryIndexV1({zoneId});
      return jsonResponse(200,result,'private, no-store');
    }catch(error){return jsonResponse(500,{ok:false,code:'HOME_HISTORY_READ_FAILED',error:error instanceof Error?error.message:String(error)},'no-store');}
  }
  if(req.method==='POST'){
    try{
      const body=await req.json();if(body?.action!=='refresh')return jsonResponse(400,{ok:false,error:'action must be refresh'},'no-store');
      if(body?.confirmExecution!==true)return jsonResponse(400,{ok:false,error:'confirmExecution:true is required because refresh performs WCL network calls'},'no-store');
      const result=await refreshPersistedAvoidHistoryV1({days:body.days,maxPages:body.maxPages,maxChangedReports:body.maxChangedReports,concurrency:body.concurrency});
      return jsonResponse(200,result,'private, no-store');
    }catch(error){return jsonResponse(500,{ok:false,code:'HOME_HISTORY_REFRESH_FAILED',error:error instanceof Error?error.message:String(error)},'no-store');}
  }
  return jsonResponse(405,{ok:false,error:'Method not allowed'},'no-store');
};
