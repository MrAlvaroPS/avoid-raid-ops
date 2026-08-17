import { buildAbilityKnowledgePreviewV1,resolveAbilityKnowledgeV1 } from '../knowledge/ability-knowledge-v1.mjs';
import { jsonResponse } from '../api/http.mjs';

const providerConfig=value=>({
  lorrgs:value?.lorrgs===undefined?true:value.lorrgs,
  parseWowhead:value?.parseWowhead===undefined?false:value.parseWowhead,
  wcl:value?.wcl===undefined?false:value.wcl,
});

function fromUrl(req){
  const url=new URL(req.url,'http://localhost');
  const ids=(url.searchParams.get('abilityIds')||url.searchParams.get('abilityId')||'').split(',').map(x=>x.trim()).filter(Boolean);
  return {
    abilityIds:ids,
    encounterId:url.searchParams.get('encounterId'),
    bossSlug:url.searchParams.get('bossSlug'),
    providers:{
      lorrgs:url.searchParams.get('lorrgs')??true,
      parseWowhead:url.searchParams.get('parseWowhead')??false,
      wcl:url.searchParams.get('wcl')??false,
    },
  };
}

export default async req=>{
  try{
    if(req.method==='GET'){
      const preview=buildAbilityKnowledgePreviewV1(fromUrl(req));
      return jsonResponse(200,{ok:true,action:'preview',networkExecuted:false,preview},'private, no-store');
    }
    if(req.method!=='POST')return jsonResponse(405,{ok:false,error:'Method not allowed'});
    const body=await req.json().catch(()=>({}));
    const action=String(body.action||'').toLowerCase();
    const input={abilityIds:body.abilityIds??body.abilityId,encounterId:body.encounterId,bossSlug:body.bossSlug,providers:providerConfig(body.providers)};
    const preview=buildAbilityKnowledgePreviewV1(input);
    if(action==='preview')return jsonResponse(200,{ok:true,action:'preview',networkExecuted:false,preview},'private, no-store');
    if(action!=='resolve')return jsonResponse(400,{ok:false,error:'Unknown action',allowed:['preview','resolve']});
    if(body.confirmExecution!==true)return jsonResponse(409,{ok:false,error:'Provider network execution requires confirmExecution:true',preview},'private, no-store');
    if(String(body.previewFingerprint||'')!==preview.fingerprint)return jsonResponse(409,{ok:false,error:'Stale or missing previewFingerprint; preview the exact provider request again before execution',preview},'private, no-store');
    if(preview.request.providers.wcl&&body.confirmWcl!==true)return jsonResponse(409,{ok:false,error:'WCL static metadata consumes WCL budget; confirmWcl:true is required',preview},'private, no-store');
    if(preview.request.providers.parseWowhead&&body.confirmParseCredits!==true)return jsonResponse(409,{ok:false,error:'Parse Wowhead calls consume Parse credits; confirmParseCredits:true is required',preview},'private, no-store');
    const result=await resolveAbilityKnowledgeV1(input);
    return jsonResponse(200,{ok:true,action:'resolve',result},'private, no-store');
  }catch(error){
    return jsonResponse(500,{ok:false,code:'ABILITY_KNOWLEDGE_FAILED',error:error instanceof Error?error.message:String(error)},'private, no-store');
  }
};
