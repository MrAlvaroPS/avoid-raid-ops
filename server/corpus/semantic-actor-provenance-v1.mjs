import { createHash } from 'node:crypto';
import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { CORPUS_RATE_LIMIT_QUERY } from '../wcl/queries/corpus.mjs';
import { SEMANTIC_ACTOR_PROVENANCE_QUERY } from '../wcl/queries/semantic-actor-provenance.mjs';
import { eventAbilityId,eventSourceId,eventTargetId } from '../wcl/normalization/events.mjs';

export const SEMANTIC_ACTOR_PROVENANCE_VERSION='semantic-actor-provenance-v2';
export const SEMANTIC_ACTOR_PROVENANCE_PREVIEW_VERSION='semantic-actor-provenance-preview-v2';

const uniqInts=value=>[...new Set((Array.isArray(value)?value:[value]).map(Number).filter(Number.isInteger).filter(n=>n>0))];
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const fingerprint=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0,40);
const finite=value=>Number.isFinite(Number(value))?Number(value):null;

function signalRecords(evidenceRecords,signalId){
  return (evidenceRecords||[]).filter(Boolean).filter(row=>Number(row.signalId)===Number(signalId));
}

function reportCodesFor(records){
  return [...new Set(records.map(row=>String(row.reportCode||'').trim()).filter(Boolean))].sort();
}

export function buildSemanticActorProvenancePreview({signalId,abilityIds=[],evidenceRecords=[],maxReports=8}={}){
  const ids=uniqInts(abilityIds);
  if(!Number.isInteger(Number(signalId))||Number(signalId)<=0)throw new Error('signalId is required');
  if(!ids.length)throw new Error('At least one abilityId is required for actor provenance');
  const records=signalRecords(evidenceRecords,signalId);
  const reportCodes=reportCodesFor(records).slice(0,Math.max(1,Math.min(8,Number(maxReports)||8)));
  if(!reportCodes.length)throw new Error('No persisted semantic evidence reports are available for actor provenance');
  const payload={version:SEMANTIC_ACTOR_PROVENANCE_VERSION,signalId:Number(signalId),abilityIds:ids.sort((a,b)=>a-b),reportCodes,maxReports:Number(maxReports)||8};
  return{
    version:SEMANTIC_ACTOR_PROVENANCE_PREVIEW_VERSION,
    fingerprint:fingerprint(payload),
    signalId:Number(signalId),abilityIds:payload.abilityIds,
    reports:reportCodes.length,
    networkUpperBound:{wclCalls:1+reportCodes.length,preflightCalls:1,reportMetadataCalls:reportCodes.length,combatEventCalls:0},
    safety:{
      manualConfirmationRequired:true,
      matchingFingerprintRequired:true,
      combatEventsFetched:false,
      canonicalDeepContribution:{reports:0,pulls:0},
      directScoreDelta:0,
      automaticPromotion:false,
      rawActorIdsPersisted:false,
      patternScopedDerivedRolesPersisted:true,
    },
    _execution:{reportCodes},
  };
}

function roleForActor(actor,actorsById){
  if(!actor)return'unknown';
  const type=String(actor.type||'').toLowerCase(),subType=String(actor.subType||'').toLowerCase();
  if(type==='player')return'friendly-player';
  const ownerId=Number(actor.petOwner);
  if(Number.isFinite(ownerId)&&ownerId>0){
    const owner=actorsById.get(ownerId);
    if(String(owner?.type||'').toLowerCase()==='player')return'friendly-pet';
    return'owned-actor';
  }
  if(type==='pet')return'pet-unknown-owner';
  if(type==='npc'&&subType==='boss')return'encounter-boss';
  if(type==='npc')return'encounter-npc';
  return'unknown';
}

function actorRoleMap(actors=[]){
  const byId=new Map((actors||[]).map(actor=>[Number(actor?.id),actor]).filter(([id])=>Number.isFinite(id)));
  const roles=new Map();
  for(const [id,actor] of byId)roles.set(id,roleForActor(actor,byId));
  return roles;
}

function increment(obj,key,amount=1){obj[key]=(Number(obj[key])||0)+amount;}
function dominant(counts={}){
  const rows=Object.entries(counts).sort((a,b)=>Number(b[1])-Number(a[1])||String(a[0]).localeCompare(String(b[0])));
  const total=rows.reduce((n,[,v])=>n+Number(v||0),0),best=rows[0]||[null,0];
  return{role:best[0],count:Number(best[1]||0),share:total?Number(best[1]||0)/total:0,total};
}

function relativeBucket(delta){
  const abs=Math.abs(Number(delta)||0);
  const distance=abs<=1000?'1s':abs<=2500?'2.5s':abs<=5000?'5s':'far';
  if(abs<=250)return`simultaneous-${distance}`;
  return`${delta<0?'before':'after'}-${distance}`;
}

function patternIdentity({abilityId,stream,eventType,relation}){
  return{
    key:[relation,String(stream),Number(abilityId),String(eventType)].join('|'),
    abilityId:Number(abilityId),stream:String(stream),eventType:String(eventType),relation:String(relation),
  };
}

function emptyAggregate(identity={}){
  return{...identity,events:0,reports:new Set(),windows:new Set(),sourceRoles:{},targetRoles:{}};
}

function addEvent(row,{reportCode,windowKey,sourceRole,targetRole}){
  row.events++;row.reports.add(reportCode);row.windows.add(windowKey);increment(row.sourceRoles,sourceRole);increment(row.targetRoles,targetRole);
}

function summarizeAggregate(row){
  return{
    ...(row.key?{key:row.key}:{}),abilityId:Number(row.abilityId),
    ...(row.relation?{relation:row.relation}:{}),...(row.stream?{stream:row.stream}:{}),...(row.eventType?{eventType:row.eventType}:{}),
    events:row.events,reports:row.reports.size,windows:row.windows.size,
    sourceRoles:row.sourceRoles,targetRoles:row.targetRoles,
    dominantSource:dominant(row.sourceRoles),dominantTarget:dominant(row.targetRoles),
  };
}

function aggregateEvidence({records,abilityIds,roleMaps}){
  const wanted=new Set(abilityIds.map(Number));
  const abilities=new Map(abilityIds.map(id=>[Number(id),emptyAggregate({abilityId:Number(id)})]));
  const patterns=new Map();
  for(const record of records){
    if(record?.kind!=='context'||record?.pagination?.complete!==true)continue;
    const reportCode=String(record.reportCode||''),roles=roleMaps.get(reportCode);if(!roles)continue;
    const reference=finite(record.anchorTimestamp??record.referenceTimestamp);if(reference==null)continue;
    const windowKey=[reportCode,record.fightID,record.anchorTimestamp,record.windowMs].join(':');
    for(const [stream,events] of Object.entries(record.streams||{}))for(const event of events||[]){
      const abilityId=Number(eventAbilityId(event));if(!wanted.has(abilityId))continue;
      const timestamp=finite(event?.timestamp);if(timestamp==null)continue;
      const eventType=String(event?.type||'event'),relation=relativeBucket(timestamp-reference);
      const identity=patternIdentity({abilityId,stream,eventType,relation});
      const sourceId=Number(eventSourceId(event)),targetId=Number(eventTargetId(event));
      const sourceRole=Number.isFinite(sourceId)?(roles.get(sourceId)||'unknown'):'none';
      const targetRole=Number.isFinite(targetId)?(roles.get(targetId)||'unknown'):'none';
      addEvent(abilities.get(abilityId),{reportCode,windowKey,sourceRole,targetRole});
      const patternRow=patterns.get(identity.key)||emptyAggregate(identity);
      addEvent(patternRow,{reportCode,windowKey,sourceRole,targetRole});patterns.set(identity.key,patternRow);
    }
  }
  return{
    abilities:[...abilities.values()].map(summarizeAggregate),
    patterns:[...patterns.values()].map(summarizeAggregate).sort((a,b)=>a.abilityId-b.abilityId||String(a.relation).localeCompare(String(b.relation))||String(a.stream).localeCompare(String(b.stream))||String(a.eventType).localeCompare(String(b.eventType))),
  };
}

function rateState(rate,{reservePct=.18,reservePoints=600}={}){
  if(!rate)return null;const limit=Number(rate.limitPerHour)||0,spent=Number(rate.pointsSpentThisHour)||0,remaining=Math.max(0,limit-spent),reserve=Math.max(Number(reservePoints)||0,limit*(Number(reservePct)||0));
  return{limitPerHour:limit,pointsSpentThisHour:spent,pointsRemaining:remaining,pointsResetIn:Number(rate.pointsResetIn)||0,reservePoints:reserve,canContinue:!limit||remaining>reserve};
}

export async function executeSemanticActorProvenance({signalId,abilityIds=[],evidenceRecords=[],previewFingerprint,confirmExecution=false,maxReports=8,fetcher=wclGraphql,reservePct=.18,reservePoints=600}={}){
  const preview=buildSemanticActorProvenancePreview({signalId,abilityIds,evidenceRecords,maxReports});
  if(confirmExecution!==true)throw new Error('Actor provenance execution is manual-only: confirmExecution:true is required');
  if(!previewFingerprint||String(previewFingerprint)!==preview.fingerprint)throw new Error('Actor provenance preview fingerprint is missing or stale');
  let calls=0;
  const preflight=await fetcher(CORPUS_RATE_LIMIT_QUERY,{});calls++;
  let rate=rateState(preflight?.rateLimitData,{reservePct,reservePoints});
  if(rate&&rate.canContinue===false)throw new Error('WCL reserve would be violated; actor provenance stopped before report metadata queries');
  const roleMaps=new Map(),errors=[];
  for(const code of preview._execution.reportCodes){
    try{
      const data=await fetcher(SEMANTIC_ACTOR_PROVENANCE_QUERY,{code});calls++;
      if(data?.rateLimitData)rate=rateState(data.rateLimitData,{reservePct,reservePoints});
      const actors=data?.reportData?.report?.masterData?.actors||[];
      roleMaps.set(code,actorRoleMap(actors));
      if(rate&&rate.canContinue===false)break;
    }catch(error){calls++;errors.push({scope:'report-actor-metadata',error:error instanceof Error?error.message:String(error)});}
  }
  const records=signalRecords(evidenceRecords,signalId);
  const aggregated=aggregateEvidence({records,abilityIds:preview.abilityIds,roleMaps});
  return{
    version:SEMANTIC_ACTOR_PROVENANCE_VERSION,previewFingerprint:preview.fingerprint,signalId:Number(signalId),
    reportsRequested:preview.reports,reportsResolved:roleMaps.size,wclCallsExecuted:calls,rateLimit:rate,
    abilities:aggregated.abilities,patterns:aggregated.patterns,errors,
    evidenceContract:{combatEventsFetched:false,classificationSource:'WCL ReportMasterData actors + already-persisted semantic event actor IDs',aggregationScope:'pattern-signature-v1',patternKey:'relation|stream|abilityId|eventType',rawActorIdsPersisted:false,rawActorNamesPersisted:false,canonicalDeepContribution:{reports:0,pulls:0},directScoreDelta:0,automaticPromotion:false},
  };
}
