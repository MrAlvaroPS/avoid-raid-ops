import { buildBundledKnowledge,summarizeKnowledge } from '../knowledge/game-knowledge-v1.mjs';
import { readKnowledgeState,stageKnowledgeCandidate,activateKnowledgeCandidate } from '../knowledge/knowledge-store-v1.mjs';
import { jsonResponse } from '../api/http.mjs';

const publicState=state=>({
  persistence:state.persistence,
  active:summarizeKnowledge(state.active),
  candidate:summarizeKnowledge(state.candidate),
  activation:state.activation||null,
});

export default async req=>{
  try{
    if(req.method==='GET')return jsonResponse(200,{ok:true,modelVersion:'game-knowledge-v1',...(publicState(await readKnowledgeState()))},'private, no-store');
    if(req.method!=='POST')return jsonResponse(405,{ok:false,error:'Method not allowed'});
    const body=await req.json().catch(()=>({}));
    const action=String(body?.action||'').toLowerCase();
    if(action==='refresh'){
      const candidate=buildBundledKnowledge({patch:body.patch||'unknown',season:body.season||'unknown',build:body.build||'unknown'});
      const state=await stageKnowledgeCandidate(candidate);
      return jsonResponse(200,{ok:true,action:'refresh',note:'Candidate staged. Wowhead is reference enrichment; WCL/raw facts remain canonical.',...(publicState(state))},'private, no-store');
    }
    if(action==='activate'){
      const state=await activateKnowledgeCandidate();
      return jsonResponse(200,{ok:true,action:'activate',reindex:{required:true,policy:'invalidate derived products and rederive against active revision; never rewrite raw WCL evidence'},...(publicState(state))},'private, no-store');
    }
    return jsonResponse(400,{ok:false,error:'Unknown knowledge action',allowed:['refresh','activate']});
  }catch(error){
    return jsonResponse(500,{ok:false,code:'KNOWLEDGE_ACTION_FAILED',error:error instanceof Error?error.message:String(error)});
  }
};
