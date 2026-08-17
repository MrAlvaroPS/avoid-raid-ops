import { getIrisSourceRegistry,findIrisSource } from '../iris/external-source-registry-v390.mjs';
import { jsonResponse } from '../api/http.mjs';

export default async req=>{
  if(req.method!=='GET')return jsonResponse(405,{ok:false,error:'Method not allowed'});
  const url=new URL(req.url,'http://localhost');
  const id=String(url.searchParams.get('id')||'').trim().toLowerCase();
  if(id){
    const source=findIrisSource(id);
    if(!source)return jsonResponse(404,{ok:false,error:'Unknown Iris external source',id});
    return jsonResponse(200,{ok:true,version:getIrisSourceRegistry().version,reviewedAt:getIrisSourceRegistry().reviewedAt,source},'private, max-age=300');
  }
  return jsonResponse(200,{ok:true,...getIrisSourceRegistry()},'private, max-age=300');
};
