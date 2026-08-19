import { getGlobalRaidReferenceV1 } from '../../../server/services/global-raid-reference-service.mjs';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export default async function handler(req){
  try{
    if(req.method!=='GET')return json(405,{ok:false,error:'Method not allowed'});
    const url=new URL(req.url),encounterId=Number(url.searchParams.get('encounter')||url.searchParams.get('encounterId')||0),difficulty=Number(url.searchParams.get('difficulty')||0),partition=Number(url.searchParams.get('partition')||0);
    if(!encounterId)return json(400,{ok:false,error:'encounter is required'});if(!difficulty)return json(400,{ok:false,error:'difficulty is required; GLOBAL reference is difficulty-scoped'});
    const reference=await getGlobalRaidReferenceV1({encounterId,difficulty,partition});
    return json(200,{ok:true,networkExecuted:false,wclCallsExecuted:0,providerCallsExecuted:0,reference});
  }catch(error){return json(500,{ok:false,error:error instanceof Error?error.message:String(error)});}
}
