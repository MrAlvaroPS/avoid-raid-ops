import { buildOfficialEncounterKnowledgePreviewV1,resolveOfficialEncounterKnowledgeV1 } from '../knowledge/official-encounter-knowledge-v1.mjs';
import { loadLatestOfficialEncounterGraphV1,loadLatestOfficialEncounterGraphByWclIdV1 } from '../knowledge/official-encounter-store-v1.mjs';
import { jsonResponse } from '../api/http.mjs';

function fromUrl(req){
  const url=new URL(req.url,'http://localhost');
  return {
    action:String(url.searchParams.get('action')||'preview').toLowerCase(),
    encounterName:url.searchParams.get('encounterName')||url.searchParams.get('name'),
    journalEncounterId:url.searchParams.get('journalEncounterId'),
    wclEncounterId:url.searchParams.get('wclEncounterId')||url.searchParams.get('encounterId'),
    region:url.searchParams.get('region'),
    locale:url.searchParams.get('locale'),
  };
}

async function latest(input){
  const journalEncounterId=Number(input.journalEncounterId||0),wclEncounterId=Number(input.wclEncounterId||0);
  if(!journalEncounterId&&!wclEncounterId)throw new Error('journalEncounterId or wclEncounterId is required for latest');
  const result=journalEncounterId
    ?await loadLatestOfficialEncounterGraphV1(journalEncounterId)
    :await loadLatestOfficialEncounterGraphByWclIdV1(wclEncounterId);
  return result||null;
}

export default async req=>{
  try{
    if(req.method==='GET'){
      const input=fromUrl(req);
      if(input.action==='latest'){
        const result=await latest(input);
        return result
          ?jsonResponse(200,{ok:true,action:'latest',networkExecuted:false,wclCallsExecuted:0,providerCallsExecuted:0,result},'private, no-store')
          :jsonResponse(404,{ok:false,action:'latest',networkExecuted:false,error:'No persisted official encounter graph found'},'private, no-store');
      }
      if(input.action!=='preview')return jsonResponse(400,{ok:false,error:'Unknown action',allowed:['preview','latest']});
      const preview=buildOfficialEncounterKnowledgePreviewV1(input);
      return jsonResponse(200,{ok:true,action:'preview',networkExecuted:false,preview},'private, no-store');
    }
    if(req.method!=='POST')return jsonResponse(405,{ok:false,error:'Method not allowed'});
    const body=await req.json().catch(()=>({}));
    const action=String(body.action||'preview').toLowerCase();
    const input={encounterName:body.encounterName??body.name,journalEncounterId:body.journalEncounterId,wclEncounterId:body.wclEncounterId??body.encounterId,region:body.region,locale:body.locale};
    if(action==='latest'){
      const result=await latest(input);
      return result
        ?jsonResponse(200,{ok:true,action:'latest',networkExecuted:false,wclCallsExecuted:0,providerCallsExecuted:0,result},'private, no-store')
        :jsonResponse(404,{ok:false,action:'latest',networkExecuted:false,error:'No persisted official encounter graph found'},'private, no-store');
    }
    const preview=buildOfficialEncounterKnowledgePreviewV1(input);
    if(action==='preview')return jsonResponse(200,{ok:true,action:'preview',networkExecuted:false,preview},'private, no-store');
    if(action!=='resolve')return jsonResponse(400,{ok:false,error:'Unknown action',allowed:['preview','latest','resolve']});
    if(body.confirmExecution!==true)return jsonResponse(409,{ok:false,error:'Blizzard Game Data network execution requires confirmExecution:true',preview},'private, no-store');
    if(String(body.previewFingerprint||'')!==preview.fingerprint)return jsonResponse(409,{ok:false,error:'Stale or missing previewFingerprint; preview the exact request again before execution',preview},'private, no-store');
    const result=await resolveOfficialEncounterKnowledgeV1(input);
    return jsonResponse(200,{ok:true,action:'resolve',networkExecuted:true,result},'private, no-store');
  }catch(error){
    const status=error?.status===401||error?.status===403?502:error?.status===404?404:/required for latest/i.test(String(error?.message||''))?400:500;
    return jsonResponse(status,{ok:false,code:'OFFICIAL_ENCOUNTER_KNOWLEDGE_FAILED',error:error instanceof Error?error.message:String(error),provider:error?.provider||null,providerStatus:error?.classification?.status||null,negativeEvidence:error?.classification?.negativeEvidence??false},'private, no-store');
  }
};
