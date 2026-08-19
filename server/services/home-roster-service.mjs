import { jsonResponse } from '../api/http.mjs';
import { readHomeRosterV1,refreshHomeRosterV1,observeHomeRosterV1 } from '../engines/home-roster-engine.mjs';

const bodyJson=async req=>{try{return await req.json()}catch{return{}}};
export default async req=>{
  try{
    if(req.method==='GET'){
      const result=await readHomeRosterV1();return jsonResponse(200,{ok:true,...result},'private, no-store');
    }
    if(req.method==='POST'){
      const body=await bodyJson(req),action=String(body?.action||'').trim();
      if(action==='refresh'){const result=await refreshHomeRosterV1({limit:body?.limit||100});return jsonResponse(200,{ok:true,...result},'private, no-store');}
      if(action==='observe'){const result=await observeHomeRosterV1({players:Array.isArray(body?.players)?body.players:[],reportCode:body?.reportCode||null,fightId:body?.fightId||null,observedAt:body?.observedAt||Date.now()});return jsonResponse(200,{ok:true,...result},'private, no-store');}
      return jsonResponse(400,{ok:false,error:'action must be refresh or observe'},'no-store');
    }
    return jsonResponse(405,{ok:false,error:'Method not allowed'},'no-store');
  }catch(error){return jsonResponse(500,{ok:false,version:'home-roster-service-v1',error:error instanceof Error?error.message:String(error)},'no-store');}
};
