import { previewRaidCorpusBootstrapV1,startRaidCorpusBootstrapV1 } from '../../../server/services/raid-corpus-bootstrap-service.mjs';

const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const parseNames=value=>Array.isArray(value)?value:String(value||'').split(',').map(x=>x.trim()).filter(Boolean);
export default async function handler(req){
  try{
    if(req.method==='GET'){const url=new URL(req.url),preview=await previewRaidCorpusBootstrapV1({difficultyNames:parseNames(url.searchParams.get('difficulties'))||undefined});return json(200,{ok:true,action:'preview',networkExecuted:false,wclCallsExecuted:0,wclCombatEventCallsExecuted:0,preview});}
    if(req.method!=='POST')return json(405,{ok:false,error:'Method not allowed'});
    const body=await req.json().catch(()=>({})),action=String(body.action||'preview'),difficultyNames=parseNames(body.difficulties||body.difficultyNames);
    if(action==='preview'){const preview=await previewRaidCorpusBootstrapV1({difficultyNames:difficultyNames.length?difficultyNames:undefined});return json(200,{ok:true,action,networkExecuted:false,wclCallsExecuted:0,wclCombatEventCallsExecuted:0,preview});}
    if(action==='start'){
      if(body.confirmExecution!==true)return json(400,{ok:false,error:'confirmExecution:true is required'});
      if(!body.previewFingerprint)return json(400,{ok:false,error:'previewFingerprint is required'});
      const result=await startRaidCorpusBootstrapV1({difficultyNames:difficultyNames.length?difficultyNames:undefined,confirmExecution:true,previewFingerprint:body.previewFingerprint,maxNewScopes:body.maxNewScopes});
      return json(200,{ok:true,action,networkExecuted:true,result});
    }
    return json(400,{ok:false,error:`Unknown action ${action}`});
  }catch(error){return json(500,{ok:false,error:error instanceof Error?error.message:String(error)});}
}
