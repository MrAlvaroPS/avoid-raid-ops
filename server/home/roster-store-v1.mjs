import { createHash } from 'node:crypto';
import { corpusGet,corpusSet } from '../corpus/storage.mjs';

export const HOME_ROSTER_STORE_VERSION='home-roster-store-v1';
export const HOME_ROSTER_SOURCE_DIRECTORY='wcl-guild-members-temporary';
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
    directory:{source:HOME_ROSTER_SOURCE_DIRECTORY,temporary:true,fetchedAt:Number(fetchedAt)||Date.now()},observed:null,
  };
}

function observedPayload(row={}){
  return{
    actorId:finite(row?.actorId),name:String(row?.name||'').trim(),className:String(row?.className||row?.class||'').trim()||null,spec:String(row?.spec||'').trim()||null,role:String(row?.role||'').trim().toUpperCase()||null,
    server:String(row?.server||row?.realm||'').trim()||null,region:String(row?.region||'').trim()||null,itemLevel:finite(row?.itemLevel),character:row?.character&&typeof row.character==='object'?row.character:null,reliability:row?.reliability||null,
  };
}

export function mergeObservedRosterV1(roster={},players=[],{observedAt=Date.now(),reportCode=null,fightId=null}={}){
  const current=Array.isArray(roster?.members)?roster.members:[],byName=new Map(current.map((row,i)=>[norm(row.name),i])),members=current.map(row=>({...row}));
  for(const raw of players||[]){
    const obs=observedPayload(raw);if(!obs.name)continue;const idx=byName.get(norm(obs.name));
    if(idx==null){
      const created={id:null,canonicalId:null,name:obs.name,classId:null,className:obs.className,classSlug:null,level:null,guildRank:null,hidden:false,server:{id:null,name:obs.server,slug:obs.server,normalizedName:obs.server,region:{id:null,name:obs.region,slug:obs.region,compactName:obs.region}},spec:obs.spec,role:obs.role,itemLevel:obs.itemLevel,actorId:obs.actorId,character:obs.character,reliability:obs.reliability,directory:null,observed:{source:HOME_ROSTER_SOURCE_OBSERVED,temporary:false,observedAt,reportCode,fightId}};
      byName.set(norm(obs.name),members.length);members.push(created);continue;
    }
    const base=members[idx],serverName=obs.server||base?.server?.name||null,regionName=obs.region||base?.server?.region?.compactName||base?.server?.region?.name||null;
    members[idx]={...base,name:obs.name||base.name,className:obs.className||base.className,spec:obs.spec||base.spec,role:obs.role||base.role,itemLevel:obs.itemLevel??base.itemLevel,actorId:obs.actorId??base.actorId,character:obs.character||base.character,reliability:obs.reliability||base.reliability,server:{...(base.server||{}),name:serverName,slug:base?.server?.slug||serverName,region:{...(base?.server?.region||{}),name:regionName,compactName:base?.server?.region?.compactName||regionName}},observed:{source:HOME_ROSTER_SOURCE_OBSERVED,temporary:false,observedAt:Number(observedAt)||Date.now(),reportCode:reportCode||null,fightId:finite(fightId)}};
  }
  const next={...roster,version:HOME_ROSTER_STORE_VERSION,members:members.sort((a,b)=>String(a.name).localeCompare(String(b.name))),updatedAt:Date.now()};
  next.fingerprint=fingerprint({guild:next.guild,members:next.members.map(row=>({key:identityKey(row),name:row.name,className:row.className,spec:row.spec,role:row.role,itemLevel:row.itemLevel,directory:row.directory,observed:row.observed}))});
  return next;
}

export function mergeDirectoryRosterV1(existing={},incoming={}){
  const oldByName=new Map((existing?.members||[]).map(row=>[norm(row.name),row])),members=(incoming?.members||[]).map(row=>{
    const old=oldByName.get(norm(row.name));if(!old?.observed)return row;
    return {...row,spec:old.spec||row.spec,role:old.role||row.role,itemLevel:old.itemLevel??row.itemLevel,actorId:old.actorId??row.actorId,character:old.character||row.character,reliability:old.reliability||row.reliability,observed:old.observed};
  });
  const incomingNames=new Set(members.map(row=>norm(row.name)));
  for(const old of existing?.members||[])if(old?.observed&&!incomingNames.has(norm(old.name)))members.push(old);
  const next={...incoming,members:members.sort((a,b)=>String(a.name).localeCompare(String(b.name))),updatedAt:Date.now()};
  next.fingerprint=fingerprint({guild:next.guild,members:next.members.map(row=>({key:identityKey(row),name:row.name,className:row.className,spec:row.spec,role:row.role,itemLevel:row.itemLevel,directory:row.directory,observed:row.observed}))});
  return next;
}

export async function loadHomeRosterV1({guildId,storageGet=corpusGet}={}){return storageGet(keyFor(guildId));}
export async function persistHomeRosterV1(roster,{guildId,storageSet=corpusSet}={}){const key=keyFor(guildId);await storageSet(key,roster);return{key,roster};}
export const homeRosterStorageKeyV1=keyFor;
