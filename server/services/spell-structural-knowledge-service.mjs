import { buildSpellStructuralKnowledgePreviewV1,resolveSpellStructuralKnowledgeV1 } from '../knowledge/spell-structural-knowledge-v1.mjs';
import { loadLatestOfficialEncounterGraphByWclIdV1 } from '../knowledge/official-encounter-store-v1.mjs';
import { loadLatestSpellStructuralKnowledgeV1 } from '../knowledge/spell-structural-store-v1.mjs';
import { jsonResponse } from '../api/http.mjs';

function fromUrl(req){
  const url=new URL(req.url,'http://localhost');
  return{
    action:String(url.searchParams.get('action')||'preview').toLowerCase(),
    wclEncounterId:Number(url.searchParams.get('wclEncounterId')||url.searchParams.get('encounterId')||0),
    seedAbilityIds:String(url.searchParams.get('abilityIds')||url.searchParams.get('seedAbilityIds')||'').split(',').map(Number).filter(Number.isInteger),
    directions:url.searchParams.get('directions')||url.searchParams.get('direction')||'both',
  };
}

async function officialGraphFor(wclEncounterId){
  const graph=await loadLatestOfficialEncounterGraphByWclIdV1(wclEncounterId);
  if(!graph)throw Object.assign(new Error('Persisted official encounter graph is required before Wago structural resolution'),{httpStatus:404});
  return graph;
}

async function previewFor(input){
  const officialGraph=await officialGraphFor(input.wclEncounterId);
  return{preview:buildSpellStructuralKnowledgePreviewV1(input,officialGraph),officialGraph};
}

export default async req=>{
  try{
    if(req.method==='GET'){
      const input=fromUrl(req);
      if(input.action==='latest'){
        if(!input.wclEncounterId)return jsonResponse(400,{ok:false,error:'wclEncounterId is required for latest'});
        const result=await loadLatestSpellStructuralKnowledgeV1(input.wclEncounterId);
        return result
          ?jsonResponse(200,{ok:true,action:'latest',networkExecuted:false,wagoCallsExecuted:0,blizzardCallsExecuted:0,wclCallsExecuted:0,result},'private, no-store')
          :jsonResponse(404,{ok:false,action:'latest',networkExecuted:false,error:'No persisted spell structural knowledge found'},'private, no-store');
      }
      if(input.action!=='preview')return jsonResponse(400,{ok:false,error:'Unknown action',allowed:['preview','latest']});
      const {preview}=await previewFor(input);
      return jsonResponse(200,{ok:true,action:'preview',networkExecuted:false,preview},'private, no-store');
    }
    if(req.method!=='POST')return jsonResponse(405,{ok:false,error:'Method not allowed'});
    const body=await req.json().catch(()=>({}));
    const action=String(body.action||'preview').toLowerCase();
    const input={wclEncounterId:Number(body.wclEncounterId??body.encounterId??0),seedAbilityIds:body.seedAbilityIds??body.abilityIds??body.abilityId,directions:body.directions??body.direction??'both'};
    if(action==='latest'){
      if(!input.wclEncounterId)return jsonResponse(400,{ok:false,error:'wclEncounterId is required for latest'});
      const result=await loadLatestSpellStructuralKnowledgeV1(input.wclEncounterId);
      return result
        ?jsonResponse(200,{ok:true,action:'latest',networkExecuted:false,wagoCallsExecuted:0,blizzardCallsExecuted:0,wclCallsExecuted:0,result},'private, no-store')
        :jsonResponse(404,{ok:false,action:'latest',networkExecuted:false,error:'No persisted spell structural knowledge found'},'private, no-store');
    }
    const {preview,officialGraph}=await previewFor(input);
    if(action==='preview')return jsonResponse(200,{ok:true,action:'preview',networkExecuted:false,preview},'private, no-store');
    if(action!=='resolve')return jsonResponse(400,{ok:false,error:'Unknown action',allowed:['preview','latest','resolve']});
    if(body.confirmExecution!==true)return jsonResponse(409,{ok:false,error:'Wago DB2 network execution requires confirmExecution:true',preview},'private, no-store');
    if(String(body.previewFingerprint||'')!==preview.fingerprint)return jsonResponse(409,{ok:false,error:'Stale or missing previewFingerprint; preview the exact request again before execution',preview},'private, no-store');
    const result=await resolveSpellStructuralKnowledgeV1(input,{officialGraph});
    return jsonResponse(200,{ok:true,action:'resolve',networkExecuted:true,result},'private, no-store');
  }catch(error){
    const status=Number(error?.httpStatus)||(/required/i.test(String(error?.message||''))?400:500);
    return jsonResponse(status,{ok:false,code:'SPELL_STRUCTURAL_KNOWLEDGE_FAILED',error:error instanceof Error?error.message:String(error),negativeEvidence:false},'private, no-store');
  }
};
