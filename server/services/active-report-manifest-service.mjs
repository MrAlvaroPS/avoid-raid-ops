import { jsonResponse } from '../api/http.mjs';
import { getActiveReportManifestV1 } from '../engines/active-report-manifest-engine.mjs';
import { normalizeWclReportReferenceV1 } from '../execution/execution-context-v1.mjs';
import { isHomeSourceProfile,homeGuildId } from '../knowledge/scopes.mjs';
import { buildHomePullFactsSnapshotV1,persistHomePullFactsSnapshotV1 } from '../home/raid-pull-facts-store-v1.mjs';

const liveValue=value=>['1','true','yes','live'].includes(String(value||'').toLowerCase());
const fightValue=value=>String(value||'').toLowerCase()==='last'?'last':Number(value)>0?Number(value):null;

async function captureHomePullFacts(manifest){
  const homeEligible=isHomeSourceProfile({guild:manifest?.report?.guild||null,owner:manifest?.report?.owner||null});
  if(!homeEligible)return{eligible:false,persistedScopes:0,persistedPulls:0,reason:'active-report-is-not-proven-home'};
  let persistedScopes=0,persistedPulls=0;
  for(const scope of manifest.scopes||[]){
    if(Number(scope.completedPulls||0)<=0)continue;
    const snapshot=buildHomePullFactsSnapshotV1({manifest,scope,guildId:homeGuildId()});
    if(!snapshot)continue;
    await persistHomePullFactsSnapshotV1(snapshot);persistedScopes++;persistedPulls+=snapshot.pulls.length;
  }
  return{eligible:true,persistedScopes,persistedPulls,scopeIdentity:'encounter+difficulty',combatEventCalls:0,mechanicClassificationRequired:false};
}

export default async req=>{
  if(req.method!=='GET')return jsonResponse(405,{ok:false,error:'Method not allowed'});
  const url=new URL(req.url),reference=normalizeWclReportReferenceV1(url.searchParams.get('report'));
  if(!reference)return jsonResponse(400,{ok:false,error:'A valid Warcraft Logs report URL or report code is required'});
  const live=liveValue(url.searchParams.get('live'));
  const requestedFight=fightValue(url.searchParams.get('fight'))??reference.requestedFight??null;
  try{
    const manifest=await getActiveReportManifestV1({reportCode:reference.reportCode,live,requestedFight});
    if(!manifest)return jsonResponse(404,{ok:false,error:'Warcraft Logs report not found',reportCode:reference.reportCode},'no-store');
    const homeCapture=await captureHomePullFacts(manifest).catch(error=>({eligible:false,persistedScopes:0,persistedPulls:0,error:error instanceof Error?error.message:String(error)}));
    return jsonResponse(200,{ok:true,...manifest,homeCapture,evidenceContract:{...(manifest.evidenceContract||{}),activeReportDoesNotMutateHomeHistory:true,homePullFactsMayPersistForProvenHomeReport:true,homePullFactsDoNotRequireMechanicReadiness:true}},'private, no-store');
  }catch(error){
    return jsonResponse(500,{ok:false,code:'ACTIVE_REPORT_MANIFEST_FAILED',error:error instanceof Error?error.message:String(error),reportCode:reference.reportCode},'no-store');
  }
};
