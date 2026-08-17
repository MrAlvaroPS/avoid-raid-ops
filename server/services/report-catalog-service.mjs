import { getAvoidReportCatalog } from '../engines/report-catalog-engine.mjs';
import { runtimeConfig } from '../config/runtime.mjs';
import { jsonResponse } from '../api/http.mjs';

export default async req=>{
  if(req.method!=='GET')return jsonResponse(405,{ok:false,error:'Method not allowed'});
  const u=new URL(req.url);
  const reportCode=u.searchParams.get('report')||runtimeConfig.defaultReportCode;
  const guildId=Number(u.searchParams.get('guild')||runtimeConfig.guildId);
  const days=Number(u.searchParams.get('days')||120);
  const force=u.searchParams.get('force')==='1';
  try{
    const catalog=await getAvoidReportCatalog({
      reportCode,guildId,days,force,
      scopeReportCode:runtimeConfig.defaultReportCode,
      currentRaidZoneId:runtimeConfig.currentRaidZoneId,
    });
    if(!catalog)return jsonResponse(404,{ok:false,error:'Unable to resolve current raid zone',reportCode,guildId});
    return jsonResponse(200,{ok:true,...catalog},force?'private, no-store':'private, max-age=15');
  }catch(error){
    return jsonResponse(500,{ok:false,code:'REPORT_CATALOG_FAILED',error:error instanceof Error?error.message:String(error),reportCode,guildId});
  }
};
