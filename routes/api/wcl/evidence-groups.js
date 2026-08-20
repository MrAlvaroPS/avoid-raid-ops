import { defineHandler } from 'nitro/h3';
import { loadAnyEncounterModel } from '../../../server/corpus/service.mjs';
import { corpusId } from '../../../server/corpus/keys.mjs';
import { corpusGet,corpusList,corpusSet,corpusStorageErrorInfo } from '../../../server/corpus/storage.mjs';
import { evaluateMatchedNullBaselineV1 } from '../../../server/corpus/matched-null-baseline-v1.mjs';
import { buildIndependentEvidenceGroupsV1 } from '../../../server/corpus/independent-evidence-groups-v1.mjs';

const API_VERSION='independent-evidence-groups-api-v1';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const episodeKey=(args,signalId,buildFingerprint)=>`mechanic-episodes/${corpusId(args)}/${Number(signalId)}/${String(buildFingerprint)}.json`;
const empiricalFingerprint=episode=>String(episode?.empiricalBuildFingerprint||episode?.matchedNullEvidenceFingerprint||episode?.buildFingerprint||'');
const controlsPrefix=(args,signalId,fingerprint)=>`matched-null-baselines/${corpusId(args)}/${Number(signalId)}/${String(fingerprint)}/evidence/`;
const groupBase=(args,signalId,episodeBuildFingerprint)=>`independent-evidence-groups/${corpusId(args)}/${Number(signalId)}/${String(episodeBuildFingerprint)}`;
const groupRevisionKey=(args,signalId,episodeBuildFingerprint,fingerprint)=>`${groupBase(args,signalId,episodeBuildFingerprint)}/revisions/${String(fingerprint)}.json`;
const groupLatestKey=(args,signalId,episodeBuildFingerprint)=>`${groupBase(args,signalId,episodeBuildFingerprint)}/latest.json`;

async function persistedAt(prefix){const keys=await corpusList(prefix),rows=[];for(const key of keys){const value=await corpusGet(key).catch(()=>null);if(value)rows.push(value);}return rows;}
async function scope(input){const raw=await loadAnyEncounterModel(input);if(!raw)throw new Error('No persisted canonical boss model is available for Independent Evidence Groups');const args={encounterId:Number(raw.encounterId||input.encounterId),difficulty:Number(raw.difficulty||input.difficulty||5),partition:Number(raw.resolvedPartition??raw.partition??input.partition??0)};if(!args.encounterId||!args.difficulty||!args.partition)throw new Error('Resolved encounter/difficulty/partition is required');return args;}

async function context(input){
  const args=await scope(input),signalId=Number(input.signalId||0),episodeBuildFingerprint=String(input.episodeBuildFingerprint||input.buildFingerprint||'').trim();
  if(!signalId||!episodeBuildFingerprint)throw new Error('signalId and episodeBuildFingerprint are required');
  const episode=await corpusGet(episodeKey(args,signalId,episodeBuildFingerprint));
  if(!episode)throw new Error('Persisted mechanic episode not found for the supplied build fingerprint');
  const evidenceFingerprint=empiricalFingerprint(episode);if(!evidenceFingerprint)throw new Error('Episode has no empirical evidence fingerprint');
  const controls=await persistedAt(controlsPrefix(args,signalId,evidenceFingerprint));
  const matchedNullEvaluation=evaluateMatchedNullBaselineV1({episode,controlRecords:controls,config:{
    minimumMatchedControls:input.minimumMatchedControls,
    minimumMatchedSources:input.minimumMatchedSources,
    minimumAnchorPrevalence:input.minimumAnchorPrevalence,
    minimumSpecificityLift:input.minimumSpecificityLift,
    minimumPrevalenceDelta:input.minimumPrevalenceDelta,
  }});
  const groups=buildIndependentEvidenceGroupsV1({episode,matchedNullEvaluation,controlRecords:controls,config:{
    minimumIndependentGroups:input.minimumIndependentGroups,
    minimumPairsPerGroup:input.minimumPairsPerGroup,
  }});
  return{args,signalId,episode,controls,matchedNullEvaluation,groups,evidenceFingerprint};
}

export default defineHandler(async event=>{
  const request=event.req;
  try{
    if(request.method!=='POST')return json({ok:false,error:'POST only'},405);
    const body=await request.json().catch(()=>({}));
    const action=String(body.action||'preview');
    const input={...body,encounterId:Number(body.encounterId||0),difficulty:Number(body.difficulty||5),partition:Number(body.partition||0),signalId:Number(body.signalId||0)};
    if(!input.encounterId||!input.signalId)return json({ok:false,error:'encounterId and signalId are required'},400);

    if(action==='latest'){
      const args=await scope(input),episodeBuildFingerprint=String(input.episodeBuildFingerprint||input.buildFingerprint||'').trim();
      if(!episodeBuildFingerprint)return json({ok:false,error:'episodeBuildFingerprint is required for latest'},400);
      const result=await corpusGet(groupLatestKey(args,input.signalId,episodeBuildFingerprint));
      return json({ok:Boolean(result),apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,result},result?200:404);
    }

    if(action==='result'){
      const args=await scope(input),episodeBuildFingerprint=String(input.episodeBuildFingerprint||input.buildFingerprint||'').trim(),fingerprint=String(body.fingerprint||'').trim();
      if(!episodeBuildFingerprint||!fingerprint)return json({ok:false,error:'episodeBuildFingerprint and fingerprint are required for result'},400);
      const result=await corpusGet(groupRevisionKey(args,input.signalId,episodeBuildFingerprint,fingerprint));
      return json({ok:Boolean(result),apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,result},result?200:404);
    }

    const ctx=await context(input);
    if(action==='preview')return json({ok:true,apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,persisted:false,result:ctx.groups});
    if(action==='build'){
      const result={...ctx.groups,storage:{kind:'independent-evidence-groups-revision',revisionKey:groupRevisionKey(ctx.args,ctx.signalId,ctx.episode.buildFingerprint,ctx.groups.fingerprint),latestKey:groupLatestKey(ctx.args,ctx.signalId,ctx.episode.buildFingerprint)}};
      await corpusSet(result.storage.revisionKey,result);await corpusSet(result.storage.latestKey,result);
      return json({ok:true,apiVersion:API_VERSION,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,persisted:true,result});
    }
    return json({ok:false,error:`Unsupported action: ${action}`},400);
  }catch(error){const message=error instanceof Error?error.message:String(error),storage=corpusStorageErrorInfo(error);return json({ok:false,error:message,...(storage?{storage}: {})},Number(error?.httpStatus)||500);}
});
