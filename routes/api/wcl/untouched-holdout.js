import { defineHandler } from 'nitro/h3';
import { loadAnyEncounterModel } from '../../../server/corpus/service.mjs';
import { corpusId } from '../../../server/corpus/keys.mjs';
import { corpusGet,corpusSet,corpusStorageErrorInfo } from '../../../server/corpus/storage.mjs';
import { buildUntouchedHoldoutReservationV1,evaluateUntouchedHoldoutV1 } from '../../../server/corpus/untouched-holdout-v1.mjs';

const API_VERSION='untouched-holdout-api-v1';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const stabilityBase=(args,signalId,episodeBuildFingerprint)=>`statistical-stability/${corpusId(args)}/${Number(signalId)}/${String(episodeBuildFingerprint)}`;
const stabilityLatestKey=(args,signalId,episodeBuildFingerprint)=>`${stabilityBase(args,signalId,episodeBuildFingerprint)}/latest.json`;
const stabilityRevisionKey=(args,signalId,episodeBuildFingerprint,fingerprint)=>`${stabilityBase(args,signalId,episodeBuildFingerprint)}/revisions/${String(fingerprint)}.json`;
const holdoutBase=(args,signalId,episodeBuildFingerprint)=>`untouched-holdout/${corpusId(args)}/${Number(signalId)}/${String(episodeBuildFingerprint)}`;
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
      const [reservation,result]=await Promise.all([
        corpusGet(reservationLatestKey(args,input.signalId,episodeBuildFingerprint)).catch(()=>null),
        corpusGet(resultLatestKey(args,input.signalId,episodeBuildFingerprint)).catch(()=>null),
      ]);
      return json({ok:Boolean(reservation||result),apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,reservation,result},reservation||result?200:404);
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
    const reservation=buildUntouchedHoldoutReservationV1({
      stability:loaded.stability,
      sourceCandidates:Array.isArray(body.sourceCandidates)?body.sourceCandidates:[],
      config:body.config||{},
      reservedAt:body.reservedAt,
    });
    if(action==='preview')return json({ok:true,apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,persisted:false,stabilityKey:loaded.key,reservation});
    if(action==='reserve'){
      const stored={...reservation,scope:args,signalId:input.signalId,episodeBuildFingerprint,storage:{kind:'untouched-holdout-reservation',stabilityKey:loaded.key,revisionKey:reservation.fingerprint?reservationRevisionKey(args,input.signalId,episodeBuildFingerprint,reservation.fingerprint):null,latestKey:reservationLatestKey(args,input.signalId,episodeBuildFingerprint)}};
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
