import { defineHandler } from 'nitro/h3';
import { loadAnyEncounterModel } from '../../../server/corpus/service.mjs';
import { corpusId,aggregateKey,jobKey } from '../../../server/corpus/keys.mjs';
import { corpusGet,corpusSet,corpusStorageErrorInfo } from '../../../server/corpus/storage.mjs';
import { buildUntouchedHoldoutReservationV1,evaluateUntouchedHoldoutV1 } from '../../../server/corpus/untouched-holdout-v1.mjs';
import { buildGlobalBossLearningSourceLineageV1,reservationCandidatesFromSourcePoolV1 } from '../../../server/corpus/untouched-holdout-source-pool-v1.mjs';
import { buildUntouchedHoldoutSourceDiscoveryPreviewV1,executeUntouchedHoldoutSourceDiscoveryV1 } from '../../../server/corpus/untouched-holdout-source-discovery-v1.mjs';

const API_VERSION='untouched-holdout-api-v1';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const stabilityBase=(args,signalId,episodeBuildFingerprint)=>`statistical-stability/${corpusId(args)}/${Number(signalId)}/${String(episodeBuildFingerprint)}`;
const stabilityLatestKey=(args,signalId,episodeBuildFingerprint)=>`${stabilityBase(args,signalId,episodeBuildFingerprint)}/latest.json`;
const stabilityRevisionKey=(args,signalId,episodeBuildFingerprint,fingerprint)=>`${stabilityBase(args,signalId,episodeBuildFingerprint)}/revisions/${String(fingerprint)}.json`;
const holdoutBase=(args,signalId,episodeBuildFingerprint)=>`untouched-holdout/${corpusId(args)}/${Number(signalId)}/${String(episodeBuildFingerprint)}`;
const sourcePoolLatestKey=(args,signalId,episodeBuildFingerprint)=>`${holdoutBase(args,signalId,episodeBuildFingerprint)}/source-pool-latest.json`;
const sourcePoolRevisionKey=(args,signalId,episodeBuildFingerprint,fingerprint)=>`${holdoutBase(args,signalId,episodeBuildFingerprint)}/source-pools/${String(fingerprint)}.json`;
const reservationLatestKey=(args,signalId,episodeBuildFingerprint)=>`${holdoutBase(args,signalId,episodeBuildFingerprint)}/reservation-latest.json`;
const reservationRevisionKey=(args,signalId,episodeBuildFingerprint,fingerprint)=>`${holdoutBase(args,signalId,episodeBuildFingerprint)}/reservations/${String(fingerprint)}.json`;
const resultLatestKey=(args,signalId,episodeBuildFingerprint)=>`${holdoutBase(args,signalId,episodeBuildFingerprint)}/result-latest.json`;
const resultRevisionKey=(args,signalId,episodeBuildFingerprint,fingerprint)=>`${holdoutBase(args,signalId,episodeBuildFingerprint)}/results/${String(fingerprint)}.json`;

async function scope(input){
  const raw=await loadAnyEncounterModel(input);
  if(!raw)throw new Error('No persisted canonical boss model is available for Untouched Holdout');
  const args={encounterId:Number(raw.encounterId||input.encounterId),difficulty:Number(raw.difficulty||input.difficulty||5),partition:Number(raw.resolvedPartition??raw.partition??input.partition??0)};
  if(!args.encounterId||!args.difficulty||!args.partition)throw new Error('Resolved encounter/difficulty/partition is required');
  return args;
}

async function loadStability(args,input){
  const episodeBuildFingerprint=String(input.episodeBuildFingerprint||input.buildFingerprint||'').trim();
  if(!episodeBuildFingerprint)throw new Error('episodeBuildFingerprint is required');
  const requested=String(input.stabilityFingerprint||'').trim();
  const key=requested?stabilityRevisionKey(args,input.signalId,episodeBuildFingerprint,requested):stabilityLatestKey(args,input.signalId,episodeBuildFingerprint);
  const value=await corpusGet(key);
  if(!value)throw new Error(requested?'Persisted Statistical Stability revision not found':'No latest Statistical Stability product is available for this Episode');
  if(requested&&String(value.fingerprint)!==requested)throw new Error('Statistical Stability fingerprint mismatch');
  return{episodeBuildFingerprint,stability:value,key};
}

async function loadLineage(args,stability){
  const [aggregate,job]=await Promise.all([corpusGet(aggregateKey(args)).catch(()=>null),corpusGet(jobKey(args)).catch(()=>null)]);
  const lineage=buildGlobalBossLearningSourceLineageV1({aggregate,job,stability,lineageComplete:Boolean(aggregate&&job)});
  return{aggregate,job,lineage};
}

async function loadCompatibleSourcePool(args,input,loaded,lineage){
  const sourcePool=await corpusGet(sourcePoolLatestKey(args,input.signalId,loaded.episodeBuildFingerprint)).catch(()=>null);
  if(!sourcePool)return null;
  if(String(sourcePool.stabilityFingerprint)!==String(loaded.stability.fingerprint))return null;
  if(String(sourcePool.lineageFingerprint)!==String(lineage.fingerprint))return null;
  return sourcePool;
}

export default defineHandler(async event=>{
  const request=event.req;
  try{
    if(request.method!=='POST')return json({ok:false,error:'POST only'},405);
    const body=await request.json().catch(()=>({})),action=String(body.action||'preview');
    const input={...body,encounterId:Number(body.encounterId||0),difficulty:Number(body.difficulty||5),partition:Number(body.partition||0),signalId:Number(body.signalId||0)};
    if(!input.encounterId||!input.signalId)return json({ok:false,error:'encounterId and signalId are required'},400);
    const args=await scope(input),episodeBuildFingerprint=String(input.episodeBuildFingerprint||input.buildFingerprint||'').trim();
    if(!episodeBuildFingerprint)return json({ok:false,error:'episodeBuildFingerprint is required'},400);

    if(action==='latest'){
      const [sourcePool,reservation,result]=await Promise.all([
        corpusGet(sourcePoolLatestKey(args,input.signalId,episodeBuildFingerprint)).catch(()=>null),
        corpusGet(reservationLatestKey(args,input.signalId,episodeBuildFingerprint)).catch(()=>null),
        corpusGet(resultLatestKey(args,input.signalId,episodeBuildFingerprint)).catch(()=>null),
      ]);
      return json({ok:Boolean(sourcePool||reservation||result),apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,sourcePool,reservation,result},sourcePool||reservation||result?200:404);
    }

    if(action==='evaluate'){
      const reservationFingerprint=String(body.reservationFingerprint||'').trim();
      if(!reservationFingerprint)return json({ok:false,error:'reservationFingerprint is required for evaluate'},400);
      const reservation=await corpusGet(reservationRevisionKey(args,input.signalId,episodeBuildFingerprint,reservationFingerprint));
      if(!reservation)return json({ok:false,error:'Persisted Untouched Holdout reservation not found'},404);
      const result=evaluateUntouchedHoldoutV1({reservation,holdoutEvidence:body.holdoutEvidence});
      const stored={...result,scope:args,signalId:input.signalId,storage:{kind:'untouched-holdout-result',reservationKey:reservationRevisionKey(args,input.signalId,episodeBuildFingerprint,reservationFingerprint),revisionKey:resultRevisionKey(args,input.signalId,episodeBuildFingerprint,result.fingerprint),latestKey:resultLatestKey(args,input.signalId,episodeBuildFingerprint)}};
      await corpusSet(stored.storage.revisionKey,stored);await corpusSet(stored.storage.latestKey,stored);
      return json({ok:true,apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,persisted:true,result:stored});
    }

    const loaded=await loadStability(args,input);
    const lineageState=await loadLineage(args,loaded.stability);

    if(action==='discover-sources-preview'||action==='discover-sources'){
      const discoveryConfig={...(body.discoveryConfig||{}),startRankingPage:Number(body?.discoveryConfig?.startRankingPage||lineageState.job?.rankingPage||1)};
      const preview=buildUntouchedHoldoutSourceDiscoveryPreviewV1({scope:args,stability:loaded.stability,lineage:lineageState.lineage,config:discoveryConfig});
      if(action==='discover-sources-preview')return json({ok:true,apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,persisted:false,stabilityKey:loaded.key,lineage:lineageState.lineage,preview});
      if(body.confirmExecution!==true)return json({ok:false,error:'confirmExecution:true is required for Holdout source discovery',preview},409);
      if(String(body.previewFingerprint||'')!==String(preview.fingerprint))return json({ok:false,error:'Holdout source-discovery preview fingerprint is stale; preview again before execution',preview},409);
      const discovery=await executeUntouchedHoldoutSourceDiscoveryV1({scope:args,stability:loaded.stability,lineage:lineageState.lineage,preview});
      const sourcePool={...discovery.sourcePool,discovery:{version:discovery.version,status:discovery.status,previewFingerprint:preview.fingerprint,usage:discovery.usage,discovery:discovery.discovery||null},storage:{kind:'untouched-holdout-source-pool',revisionKey:sourcePoolRevisionKey(args,input.signalId,episodeBuildFingerprint,discovery.sourcePool.fingerprint),latestKey:sourcePoolLatestKey(args,input.signalId,episodeBuildFingerprint)}};
      await corpusSet(sourcePool.storage.revisionKey,sourcePool);await corpusSet(sourcePool.storage.latestKey,sourcePool);
      return json({ok:true,apiVersion:API_VERSION,networkExecuted:Number(discovery.usage?.wclCalls||0)>0,wclCallsExecuted:Number(discovery.usage?.wclCalls||0),wclCombatEventCallsExecuted:0,providerNetworkCallsExecuted:0,persisted:true,sourcePool,discovery:{status:discovery.status,usage:discovery.usage,rateLimit:discovery.rateLimit||null}});
    }

    const sourcePool=await loadCompatibleSourcePool(args,input,loaded,lineageState.lineage);
    const sourceCandidates=sourcePool?reservationCandidatesFromSourcePoolV1(sourcePool):[];
    const reservation=buildUntouchedHoldoutReservationV1({stability:loaded.stability,sourceCandidates,config:body.config||{},reservedAt:body.reservedAt});
    const sourcePoolState=sourcePool?'compatible-persisted-source-pool':reservation.status==='not-eligible-no-stability-supported-pattern'?'not-required':'source-discovery-required';
    if(action==='preview')return json({ok:true,apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,persisted:false,stabilityKey:loaded.key,lineage:lineageState.lineage,sourcePoolState,sourcePoolFingerprint:sourcePool?.fingerprint||null,reservation});
    if(action==='reserve'){
      if(reservation.status!=='not-eligible-no-stability-supported-pattern'&&!sourcePool)return json({ok:false,error:'Automatic Holdout source discovery must complete before reservation',sourcePoolState,reservation},409);
      const stored={...reservation,scope:args,signalId:input.signalId,episodeBuildFingerprint,sourcePoolFingerprint:sourcePool?.fingerprint||null,storage:{kind:'untouched-holdout-reservation',stabilityKey:loaded.key,sourcePoolKey:sourcePool?.storage?.revisionKey||null,revisionKey:reservation.fingerprint?reservationRevisionKey(args,input.signalId,episodeBuildFingerprint,reservation.fingerprint):null,latestKey:reservationLatestKey(args,input.signalId,episodeBuildFingerprint)}};
      if(stored.fingerprint)await corpusSet(stored.storage.revisionKey,stored);
      await corpusSet(stored.storage.latestKey,stored);
      return json({ok:true,apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,persisted:true,reservation:stored});
    }
    return json({ok:false,error:`Unsupported action: ${action}`},400);
  }catch(error){
    const message=error instanceof Error?error.message:String(error),storage=corpusStorageErrorInfo(error);
    return json({ok:false,error:message,...(storage?{storage}: {})},Number(error?.httpStatus)||500);
  }
});
