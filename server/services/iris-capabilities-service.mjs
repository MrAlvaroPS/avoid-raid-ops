import { getIrisCapabilityContractV3912 } from '../iris/capability-contract-v3912.mjs';
import { jsonResponse } from '../api/http.mjs';

export default async req=>{
  if(req.method!=='GET')return jsonResponse(405,{ok:false,error:'Method not allowed'});
  return jsonResponse(200,{ok:true,...getIrisCapabilityContractV3912()},'private, max-age=60');
};
