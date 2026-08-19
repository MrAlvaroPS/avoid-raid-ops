import { loadHomeRaidExecutionV1 } from '../home/raid-execution-store-v1.mjs';
import { jsonResponse } from '../api/http.mjs';
const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
export default async req=>{
  if(req.method!=='GET')return jsonResponse(405,{ok:false,error:'Method not allowed'},'no-store');
  const u=new URL(req.url),encounterId=positive(u.searchParams.get('encounter')),difficulty=positive(u.searchParams.get('difficulty'));
  if(!encounterId||!difficulty)return jsonResponse(400,{ok:false,error:'encounter+difficulty are required'},'no-store');
  try{const result=await loadHomeRaidExecutionV1({encounterId,difficulty});return jsonResponse(200,{ok:true,...result},'private, no-store');}
  catch(error){return jsonResponse(500,{ok:false,error:error instanceof Error?error.message:String(error),networkExecuted:false,wclCallsExecuted:0},'no-store');}
};
