import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { CORPUS_DEEP_EVENTS_QUERY } from '../wcl/queries/corpus.mjs';
import { paginatorEvents,eventAbilityId,eventSourceId } from '../wcl/normalization/events.mjs';
import { fetchReportHeader } from './wide-profile.mjs';
import { normalizeDeepProfile } from './deep-profile.mjs';

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

export async function fetchDeepProfileV373({code,encounterId,difficulty=5}){
  const header=await fetchReportHeader({code,encounterId,difficulty});
  if(!header||!header.fights?.length)return null;
  const fightIDs=header.fights.map(f=>Number(f.id)).filter(Number.isFinite);if(!fightIDs.length)return null;
  const data=await wclGraphql(CORPUS_DEEP_EVENTS_QUERY,{code:String(code),fightIDs});
  return attachOriginEvidenceV373(normalizeDeepProfile(header,data,{encounterId,difficulty}),data);
}
