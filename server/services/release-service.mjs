import { PRODUCT_RELEASE } from '@avoid/release';
import { jsonResponse } from '../api/http.mjs';

export default async req=>{
  if(req.method!=='GET')return jsonResponse(405,{ok:false,error:'Method not allowed'});
  return jsonResponse(200,{ok:true,release:PRODUCT_RELEASE},'public, max-age=60, stale-while-revalidate=300');
};
