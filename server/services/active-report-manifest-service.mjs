import { jsonResponse } from '../api/http.mjs';
import { getActiveReportManifestV1 } from '../engines/active-report-manifest-engine.mjs';
import { normalizeWclReportReferenceV1 } from '../execution/execution-context-v1.mjs';

const liveValue=value=>['1','true','yes','live'].includes(String(value||'').toLowerCase());
const fightValue=value=>String(value||'').toLowerCase()==='last'?'last':Number(value)>0?Number(value):null;

export default async req=>{
  if(req.method!=='GET')return jsonResponse(405,{ok:false,error:'Method not allowed'});
  const url=new URL(req.url),reference=normalizeWclReportReferenceV1(url.searchParams.get('report'));
  if(!reference)return jsonResponse(400,{ok:false,error:'A valid Warcraft Logs report URL or report code is required'});
  const live=liveValue(url.searchParams.get('live'));
  const requestedFight=fightValue(url.searchParams.get('fight'))??reference.requestedFight??null;
  try{
    const manifest=await getActiveReportManifestV1({reportCode:reference.reportCode,live,requestedFight});
    if(!manifest)return jsonResponse(404,{ok:false,error:'Warcraft Logs report not found',reportCode:reference.reportCode},'no-store');
    return jsonResponse(200,{ok:true,...manifest},'private, no-store');
  }catch(error){
    return jsonResponse(500,{ok:false,code:'ACTIVE_REPORT_MANIFEST_FAILED',error:error instanceof Error?error.message:String(error),reportCode:reference.reportCode},'no-store');
  }
};
