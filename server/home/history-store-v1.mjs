import { createHash } from 'node:crypto';
import { corpusGet,corpusSet,corpusList } from '../corpus/storage.mjs';

export const AVOID_HISTORY_STORE_VERSION='avoid-history-store-v1.1';
const root=(guildId,zoneId)=>`home/history/v1/guild/${Number(guildId)}/zone/${Number(zoneId)}`;
export const avoidHistoryIndexKeyV1=({guildId,zoneId})=>`${root(guildId,zoneId)}/index.json`;
export const avoidHistoryReportKeyV1=({guildId,zoneId,reportCode})=>`${root(guildId,zoneId)}/reports/${String(reportCode)}.json`;

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const fingerprint=value=>createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');
const num=value=>{const n=Number(value);return Number.isFinite(n)?n:null;};

export function normalizeAvoidHistoryReportV1(report,{guildId,zoneId,syncedAt=Date.now()}={}){
  if(!report?.code)throw new Error('HOME history report code is required');
  if(Number(report?.guild?.id)!==Number(guildId))throw new Error(`HOME history report ${report.code} does not belong to configured guild ${guildId}`);
  if(Number(report?.zone?.id)!==Number(zoneId))throw new Error(`HOME history report ${report.code} is outside current raid zone ${zoneId}`);
  const fights=(report.fights||[]).filter(row=>Number(row?.encounterID)>0&&Number(row?.difficulty)>0).map(row=>({
    id:Number(row.id),encounterID:Number(row.encounterID),name:row.name||`Encounter ${row.encounterID}`,difficulty:Number(row.difficulty),
    startTime:Number(row.startTime)||0,endTime:Number(row.endTime)||0,kill:Boolean(row.kill),fightPercentage:num(row.fightPercentage),bossPercentage:num(row.bossPercentage),inProgress:Boolean(row.inProgress),
    friendlyPlayers:(row.friendlyPlayers||[]).map(Number).filter(Number.isFinite),
    friendlySpecs:(row.friendlySpecs||[]).map(value=>num(value)),
    friendlyItemLevels:(row.friendlyItemLevels||[]).map(value=>num(value)),
    lastPhaseAsAbsoluteIndex:num(row.lastPhaseAsAbsoluteIndex),wipeCalledTime:num(row.wipeCalledTime),
    phaseTransitions:(row.phaseTransitions||[]).map(p=>({id:num(p.id),startTime:num(p.startTime)})).filter(p=>p.id!=null&&p.startTime!=null),
  })).filter(row=>Number.isFinite(row.id));
  const actors=(report.masterData?.actors||[]).map(actor=>({id:Number(actor.id),name:actor.name||null,type:actor.type||null,subType:actor.subType||null})).filter(actor=>Number.isFinite(actor.id));
  const normalized={
    version:AVOID_HISTORY_STORE_VERSION,reportCode:String(report.code),title:report.title||String(report.code),startTime:Number(report.startTime)||0,endTime:Number(report.endTime)||0,revision:Number(report.revision)||0,visibility:report.visibility||null,
    guild:{id:Number(report.guild.id),name:report.guild.name||null},zone:{id:Number(report.zone.id),name:report.zone.name||null},masterData:{actors},fights,syncedAt:Number(syncedAt)||Date.now(),
  };
  normalized.fingerprint=fingerprint({version:normalized.version,reportCode:normalized.reportCode,startTime:normalized.startTime,endTime:normalized.endTime,revision:normalized.revision,guild:normalized.guild,zone:normalized.zone,actors:normalized.masterData.actors,fights:normalized.fights});
  return normalized;
}

export function avoidHistoryReportSummaryV1(report={}){
  const scopes=new Map();
  for(const fight of report.fights||[]){
    const key=`${Number(fight.encounterID)}:d${Number(fight.difficulty)}`;
    const row=scopes.get(key)||{scopeKey:key,encounterId:Number(fight.encounterID),bossName:fight.name||null,difficulty:Number(fight.difficulty),pulls:0,completedPulls:0,inProgressPulls:0,kills:0,latestFightId:null,latestStartTime:0};
    row.pulls++;if(fight.inProgress)row.inProgressPulls++;else row.completedPulls++;if(fight.kill)row.kills++;
    if(Number(fight.startTime)>=row.latestStartTime){row.latestStartTime=Number(fight.startTime)||0;row.latestFightId=Number(fight.id);}
    scopes.set(key,row);
  }
  return{historySchemaVersion:report.version||null,reportCode:report.reportCode,title:report.title,startTime:report.startTime,endTime:report.endTime,revision:report.revision,fingerprint:report.fingerprint,syncedAt:report.syncedAt,pulls:(report.fights||[]).length,scopes:[...scopes.values()].sort((a,b)=>a.latestStartTime-b.latestStartTime)};
}

export async function loadAvoidHistoryIndexV1({guildId,zoneId,storageGet=corpusGet}={}){
  return storageGet(avoidHistoryIndexKeyV1({guildId,zoneId}));
}

export async function loadAvoidHistoryReportV1({guildId,zoneId,reportCode,storageGet=corpusGet}={}){
  return storageGet(avoidHistoryReportKeyV1({guildId,zoneId,reportCode}));
}

export async function persistAvoidHistoryReportV1(report,{guildId,zoneId,storageSet=corpusSet}={}){
  const key=avoidHistoryReportKeyV1({guildId,zoneId,reportCode:report.reportCode});await storageSet(key,report);return{key,summary:avoidHistoryReportSummaryV1(report)};
}

export async function persistAvoidHistoryIndexV1(index,{guildId,zoneId,storageSet=corpusSet}={}){
  const key=avoidHistoryIndexKeyV1({guildId,zoneId});await storageSet(key,index);return{key,index};
}

export async function listAvoidHistoryReportsV1({guildId,zoneId,storageGet=corpusGet,storageList=corpusList}={}){
  const prefix=`${root(guildId,zoneId)}/reports/`,keys=await storageList(prefix),reports=[];
  for(const key of keys){const row=await storageGet(key);if(row?.reportCode)reports.push(row);}
  return reports.sort((a,b)=>Number(a.startTime)-Number(b.startTime)||String(a.reportCode).localeCompare(String(b.reportCode)));
}
