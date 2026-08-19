import { createHash } from 'node:crypto';
import { corpusGet,corpusSet } from '../corpus/storage.mjs';

export const HOME_ROSTER_STORE_VERSION='home-roster-store-v1.1';
export const HOME_ROSTER_SOURCE_DIRECTORY='wcl-guild-members-temporary';
export const HOME_ROSTER_SOURCE_HISTORY='wcl-home-history-participant';
export const HOME_ROSTER_SOURCE_OBSERVED='wcl-combatant-info-observed';
const keyFor=guildId=>`home/roster/v1/guild/${Number(guildId)}/roster.json`;
const norm=v=>String(v||'').trim().toLowerCase();
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const fingerprint=value=>createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');
const identityKey=row=>finite(row?.canonicalId)?`canonical:${finite(row.canonicalId)}`:`name:${norm(row?.name)}@${norm(row?.server?.slug||row?.server?.name)}`;

export function normalizeGuildRosterMemberV1(row={},classMap=new Map(),{fetchedAt=Date.now()}={}){
  const server=row?.server||{},region=server?.region||{},classId=finite(row?.classID??row?.classId),classRow=classMap.get(classId)||null;
  return{
    id:finite(row?.id),canonicalId:finite(row?.canonicalID??row?.canonicalId),name:String(row?.name||'').trim(),classId,className:classRow?.name||row?.className||null,classSlug:classRow?.slug||row?.classSlug||null,
    level:finite(row?.level),guildRank:finite(row?.guildRank),hidden:Boolean(row?.hidden),
    server:{id:finite(server?.id),name:server?.name||null,slug:server?.slug||null,normalizedName:server?.normalizedName||null,region:{id:finite(region?.id),name:region?.name||null,slug:region?.slug||null,compactName:region?.compactName||null}},
    spec:null,role:null,itemLevel:null,actorId:null,character:null,reliability:null,
    directory:{source:HOME_ROSTER_SOURCE_DIRECTORY,temporary:true,fetchedAt:Number(fetchedAt)||Date.now()},raidActivity:null,observed:null,
  };
}

function observedPayload(row={}){
  return {
    actorId:finite(row?.actorId),name:String(row?.name||'').trim(),className:String(row?.className||row?.class||'').trim()||null,spec:String(row?.spec||'').trim()||null,role:String(row?.role||'').trim().toUpperCase()||null,
    server:String(row?.server||row?.realm||'').trim()||null,region:String(row?.region||'').trim()||null,itemLevel:finite(row?.itemLevel),character:row?.character&&typeof row.character==='object'?row.character:null,reliability:row?.reliability||null,
  };
}

function blankHistoryMember(activity={}){
  return{id:null,canonicalId:null,name:activity.name,classId:null,className:activity.className||null,classSlug:null,level:null,guildRank:null,hidden:false,server:{id:null,name:null,slug:null,normalizedName:null,region:{id:null,name:null,slug:null,compactName:null}},spec:null,role:null,itemLevel:null,actorId:null,character:null,reliability:null,directory:null,raidActivity:null,observed:null};
}

export function mergeHistoryRosterV1(roster={},reports=[],{syncedAt=Date.now()}={}){
  const activities=new Map();let totalRaidPulls=0;
  for(const report of reports||[]){
    const actors=new Map((report?.masterData?.actors||[]).map(actor=>[Number(actor.id),actor]));
    for(const fight of report?.fights||[]){
      if(!(Number(fight?.encounterID)>0&&Number(fight?.difficulty)>0))continue;totalRaidPulls++;
      const at=Number(report?.startTime||0)+Number(fight?.startTime||0),pullKey=`${report.reportCode}:${Number(fight.id)}`;
      for(const actorId of new Set((fight?.friendlyPlayers||[]).map(Number).filter(Number.isFinite))){
        const actor=actors.get(actorId);if(!actor?.name)continue;if(actor.type&&String(actor.type).toLowerCase()!=='player')continue;
        const key=norm(actor.name),row=activities.get(key)||{name:String(actor.name),className:actor.subType||null,pullKeys:new Set(),reportCodes:new Set(),firstSeenAt:null,lastSeenAt:null};
        row.className=row.className||actor.subType||null;row.pullKeys.add(pullKey);row.reportCodes.add(String(report.reportCode));row.firstSeenAt=row.firstSeenAt==null?at:Math.min(row.firstSeenAt,at);row.lastSeenAt=row.lastSeenAt==null?at:Math.max(row.lastSeenAt,at);activities.set(key,row);
      }
    }
  }
  // raidActivity is intentionally rebuilt from the persisted reports of the CURRENT raid.
  // Directory identity, observed gear/spec and reliability survive a tier change; raid membership does not.
  const members=(roster?.members||[]).map(row=>({...row,raidActivity:null})),byName=new Map(members.map((row,i)=>[norm(row.name),i]));
  for(const [key,activity] of activities){let idx=byName.get(key);if(idx==null){idx=members.length;byName.set(key,idx);members.push(blankHistoryMember(activity));}
    const base=members[idx],pulls=activity.pullKeys.size,reportsCount=activity.reportCodes.size;
    members[idx]={...base,name:activity.name||base.name,className:base.className||activity.className||null,raidActivity:{source:HOME_ROSTER_SOURCE_HISTORY,temporary:true,confirmedFromHomeLogs:true,pulls,reports:reportsCount,reportCodes:[...activity.reportCodes].sort(),firstSeenAt:activity.firstSeenAt,lastSeenAt:activity.lastSeenAt,totalRaidPulls,attendancePct:totalRaidPulls>0?100*pulls/totalRaidPulls:null,syncedAt:Number(syncedAt)||Date.now()}};
  }
  const next={...roster,version:HOME_ROSTER_STORE_VERSION,members:members.sort((a,b)=>String(a.name).localeCompare(String(b.name))),raidRoster:{source:HOME_ROSTER_SOURCE_HISTORY,temporary:true,totalRaidPulls,activeMembers:activities.size,syncedAt:Number(syncedAt)||Date.now()},updatedAt:Date.now()};
  next.fingerprint=fingerprint({guild:next.guild,raidRoster:next.raidRoster,members:next.members.map(row=>({key:identityKey(row),name:row.name,className:row.className,spec:row.spec,role:row.role,itemLevel:row.itemLevel,directory:row.directory,raidActivity:row.raidActivity,observed:row.observed}))});return next;
}

export function mergeObservedRosterV1(roster={},players=[],{observedAt=Date.now(),reportCode=null,fightId=null}={}){
  const current=Array.isArray(roster?.members)?roster.members:[],byName=new Map(current.map((row,i)=>[norm(row.name),i])),members=current.map(row=>({...row}));
  for(const raw of players||[]){
    const obs=observedPayload(raw);if(!obs.name)continue;const idx=byName.get(norm(obs.name));
    if(idx==null){
      const created={id:null,canonicalId:null,name:obs.name,classId:null,className:obs.className,classSlug:null,level:null,guildRank:null,hidden:false,server:{id:null,name:obs.server,slug:obs.server,normalizedName:obs.server,region:{id:null,name:obs.region,slug:obs.region,compactName:obs.region}},spec:obs.spec,role:obs.role,itemLevel:obs.itemLevel,actorId:obs.actorId,character:obs.character,reliability:obs.reliability,directory:null,raidActivity:null,observed:{source:HOME_ROSTER_SOURCE_OBSERVED,temporary:false,observedAt,reportCode,fightId}};
      byName.set(norm(obs.name),members.length);members.push(created);continue;
    }
    const base=members[idx],serverName=obs.server||base?.server?.name||null,regionName=obs.region||base?.server?.region?.compactName||base?.server?.region?.name||null;
    members[idx]={...base,name:obs.name||base.name,className:obs.className||base.className,spec:obs.spec||base.spec,role:obs.role||base.role,itemLevel:obs.itemLevel??base.itemLevel,actorId:obs.actorId??base.actorId,character:obs.character||base.character,reliability:obs.reliability||base.reliability,server:{...(base.server||{}),name:serverName,slug:base?.server?.slug||serverName,region:{...(base?.server?.region||{}),name:regionName,compactName:base?.server?.region?.compactName||regionName}},observed:{source:HOME_ROSTER_SOURCE_OBSERVED,temporary:false,observedAt:Number(observedAt)||Date.now(),reportCode:reportCode||null,fightId:finite(fightId)}};
  }
  const next={...roster,version:HOME_ROSTER_STORE_VERSION,members:members.sort((a,b)=>String(a.name).localeCompare(String(b.name))),updatedAt:Date.now()};
  next.fingerprint=fingerprint({guild:next.guild,raidRoster:next.raidRoster,members:next.members.map(row=>({key:identityKey(row),name:row.name,className:row.className,spec:row.spec,role:row.role,itemLevel:row.itemLevel,directory:row.directory,raidActivity:row.raidActivity,observed:row.observed}))});
  return next;
}

export function mergeDirectoryRosterV1(existing={},incoming={}){
  const oldByName=new Map((existing?.members||[]).map(row=>[norm(row.name),row])),members=(incoming?.members||[]).map(row=>{
    const old=oldByName.get(norm(row.name));if(!old)return row;
    return {...row,spec:old.spec||row.spec,role:old.role||row.role,itemLevel:old.itemLevel??row.itemLevel,actorId:old.actorId??row.actorId,character:old.character||row.character,reliability:old.reliability||row.reliability,raidActivity:old.raidActivity||row.raidActivity,observed:old.observed||row.observed};
  });
  const incomingNames=new Set(members.map(row=>norm(row.name)));
  for(const old of existing?.members||[])if((old?.observed||old?.raidActivity)&&!incomingNames.has(norm(old.name)))members.push(old);
  const next={...incoming,version:HOME_ROSTER_STORE_VERSION,raidRoster:existing?.raidRoster||incoming?.raidRoster||null,members:members.sort((a,b)=>String(a.name).localeCompare(String(b.name))),updatedAt:Date.now()};
  next.fingerprint=fingerprint({guild:next.guild,raidRoster:next.raidRoster,members:next.members.map(row=>({key:identityKey(row),name:row.name,className:row.className,spec:row.spec,role:row.role,itemLevel:row.itemLevel,directory:row.directory,raidActivity:row.raidActivity,observed:row.observed}))});
  return next;
}

export async function loadHomeRosterV1({guildId,storageGet=corpusGet}={}){return storageGet(keyFor(guildId));}
export async function persistHomeRosterV1(roster,{guildId,storageSet=corpusSet}={}){const key=keyFor(guildId);await storageSet(key,roster);return{key,roster};}
export const homeRosterStorageKeyV1=keyFor;
