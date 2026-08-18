import { buildOfficialEncounterKnowledgePreviewV1,resolveOfficialEncounterKnowledgeV1 } from '../knowledge/official-encounter-knowledge-v1.mjs';
import { jsonResponse } from '../api/http.mjs';

function fromUrl(req){
  const url=new URL(req.url,'http://localhost');
  return {
    encounterName:url.searchParams.get('encounterName')||url.searchParams.get('name'),
    journalEncounterId:url.searchParams.get('journalEncounterId'),
    wclEncounterId:url.searchParams.get('wclEncounterId')||url.searchParams.get('encounterId'),
    region:url.searchParams.get('region'),
    locale:url.searchParams.get('locale'),
  };
}

export default async req=>{
  try{
    if(req.method==='GET'){
      const preview=buildOfficialEncounterKnowledgePreviewV1(fromUrl(req));
      return jsonResponse(200,{ok:true,action:'preview',networkExecuted:false,preview},'private, no-store');
    }
    if(req.method!=='POST')return jsonResponse(405,{ok:false,error:'Method not allowed'});
    const body=await req.json().catch(()=>({}));
    const action=String(body.action||'preview').toLowerCase();
    const input={encounterName:body.encounterName??body.name,journalEncounterId:body.journalEncounterId,wclEncounterId:body.wclEncounterId??body.encounterId,region:body.region,locale:body.locale};
    const preview=buildOfficialEncounterKnowledgePreviewV1(input);
    if(action==='preview')return jsonResponse(200,{ok:true,action:'preview',networkExecuted:false,preview},'private, no-store');
    if(action!=='resolve')return jsonResponse(400,{ok:false,error:'Unknown action',allowed:['preview','resolve']});
    if(body.confirmExecution!==true)return jsonResponse(409,{ok:false,error:'Blizzard Game Data network execution requires confirmExecution:true',preview},'private, no-store');
    if(String(body.previewFingerprint||'')!==preview.fingerprint)return jsonResponse(409,{ok:false,error:'Stale or missing previewFingerprint; preview the exact request again before execution',preview},'private, no-store');
    const result=await resolveOfficialEncounterKnowledgeV1(input);
    return jsonResponse(200,{ok:true,action:'resolve',networkExecuted:true,result},'private, no-store');
  }catch(error){
    const status=error?.status===401||error?.status===403?502:error?.status===404?404:500;
    return jsonResponse(status,{ok:false,code:'OFFICIAL_ENCOUNTER_KNOWLEDGE_FAILED',error:error instanceof Error?error.message:String(error),provider:error?.provider||null,providerStatus:error?.classification?.status||null,negativeEvidence:error?.classification?.negativeEvidence??false},'private, no-store');
  }
};
