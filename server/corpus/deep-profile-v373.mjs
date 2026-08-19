import { paginatorEvents,eventAbilityId,eventSourceId } from '../wcl/normalization/events.mjs';
import { fetchReportHeader } from './wide-profile.mjs';
import { normalizeDeepProfile } from './deep-profile.mjs';
import { fetchCompleteDeepEventData } from './deep-events-pagination.mjs';
import { classifyGlobalBossSourceProfile, sanitizeGlobalBossProfile } from '../knowledge/scopes.mjs';

const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const ts=e=>num(e?.timestamp);

function fightOf(e,fights=[]){
  const fid=num(e?.fight);
  if(fid!=null){const f=fights.find(x=>Number(x.id)===fid);if(f)return f;}
  const time=ts(e);
  return fights.find(f=>time!=null&&time>=Number(f.startTime)&&time<=Number(f.endTime))||null;
}

function ensureOrigin(map,id){
  const key=String(id);
  if(!map[key])map[key]={friendlySourceEvents:0,encounterOrUnknownSourceEvents:0,unknownSourceEvents:0,events:0,streams:{}};
  return map[key];
}

function recordStream(origin,streamName,events,fights){
  for(const e of events){
    const abilityId=num(eventAbilityId(e));if(abilityId==null)continue;
    const fight=fightOf(e,fights);if(!fight)continue;
    const sourceId=num(eventSourceId(e));const friendly=new Set((fight.friendlyPlayers||[]).map(Number).filter(Number.isFinite));
    const row=ensureOrigin(origin,abilityId);row.events++;row.streams[streamName]=(Number(row.streams[streamName])||0)+1;
    if(sourceId==null)row.unknownSourceEvents++;
    else if(friendly.has(sourceId))row.friendlySourceEvents++;
    else row.encounterOrUnknownSourceEvents++;
  }
}

export function attachOriginEvidenceV373(profile,data){
  if(!profile)return profile;
  const report=data?.reportData?.report||{},origin={};
  const streams={
    enemyCasts:paginatorEvents(report.enemyCasts),
    friendDamage:paginatorEvents(report.friendDamage),
    debuffs:paginatorEvents(report.debuffs),
    buffs:paginatorEvents(report.buffs),
    enemyBuffs:paginatorEvents(report.enemyBuffs),
    enemyDebuffs:paginatorEvents(report.enemyDebuffs),
  };
  for(const [name,events] of Object.entries(streams)){
    if(profile.completeness?.[name]!==true)continue;
    recordStream(origin,name,events,profile.fights||[]);
  }
  profile.originEvidence=origin;
  profile.schemaVersion=Math.max(4,Number(profile.schemaVersion)||0);
  profile.originEvidenceVersion='friendly-vs-encounter-or-unknown-v1';
  return profile;
}

export async function fetchDeepProfileV373({code,encounterId,difficulty=5,partition=0}){
  const header=await fetchReportHeader({code,encounterId,difficulty,partition});
  if(!header||!header.fights?.length)return null;
  // Deep acquisition is the most expensive evidence path. It is never attempted
  // unless WCL has already proven a concrete non-HOME guild identity.
  const sourceIsolation=classifyGlobalBossSourceProfile(header);
  if(sourceIsolation.eligible!==true)return null;
  const fightIDs=header.fights.map(f=>Number(f.id)).filter(Number.isFinite);if(!fightIDs.length)return null;
  const fetched=await fetchCompleteDeepEventData({code:String(code),fightIDs});
  const data=fetched.data;
  // Provenance needs transient friendly actor ids; sanitization happens only after
  // origin classification so no player-id list survives in the persisted boss profile.
  const normalized=normalizeDeepProfile(header,data,{encounterId,difficulty});
  if(normalized){
    normalized.partition=Number(partition||header.partition||0);
    normalized.deepStreamPagination=fetched.pagination;
    normalized.sourceIsolation=sourceIsolation;
  }
  const withOrigin=attachOriginEvidenceV373(normalized,data);
  return sanitizeGlobalBossProfile(withOrigin);
}
