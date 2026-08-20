import { loadLatestRaidCatalogV1 } from '../knowledge/raid-catalog-store-v1.mjs';
import { homeGuildId } from '../knowledge/scopes.mjs';
import { clusterRaidSessions } from '../analysis/progression/raid-sessions.mjs';
import { buildProgressModel } from '../analysis/progression/progress-metrics-v2.mjs';
import { buildIndexedRaidAttendance } from '../analysis/reliability/attendance-history-v1.mjs';
import { AVOID_HISTORY_STORE_VERSION,avoidHistoryReportSummaryV1,loadAvoidHistoryIndexV1,listAvoidHistoryReportsV1 } from '../home/history-store-v1.mjs';

export const AVOID_HISTORY_READ_VERSION='avoid-history-read-v1';
const difficultyName=value=>({1:'LFR',2:'Flexible',3:'Normal',4:'Heroic',5:'Mythic'})[Number(value)]||`Difficulty ${value??'?'}`;
const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
const storedReportAsWcl=report=>({code:report.reportCode,title:report.title,startTime:report.startTime,endTime:report.endTime,zone:report.zone,guild:report.guild,masterData:report.masterData,fights:report.fights||[]});

export function buildAvoidHistoryPullIndexV1(reports=[]){
  const pulls=[];
  for(const report of reports){
    const scopeCounts=new Map();
    for(const fight of report.fights||[]){
      if(fight.inProgress||!positive(fight.encounterID)||!positive(fight.difficulty))continue;
      const scopeKey=`${fight.encounterID}:d${fight.difficulty}`,pullNumber=(scopeCounts.get(scopeKey)||0)+1;scopeCounts.set(scopeKey,pullNumber);
      pulls.push({key:`${report.reportCode}:${fight.id}`,reportCode:report.reportCode,reportTitle:report.title,fightId:Number(fight.id),pullNumber,encounterId:Number(fight.encounterID),bossName:fight.name||`Encounter ${fight.encounterID}`,difficulty:Number(fight.difficulty),difficultyName:difficultyName(fight.difficulty),scopeKey,kill:Boolean(fight.kill),fightPercentage:Number.isFinite(Number(fight.fightPercentage))?Number(fight.fightPercentage):null,bossPercentage:Number.isFinite(Number(fight.bossPercentage))?Number(fight.bossPercentage):null,reportStartTime:Number(report.startTime)||0,fightStartTime:Number(fight.startTime)||0,fightEndTime:Number(fight.endTime)||0});
    }
  }
  return pulls.sort((a,b)=>(a.reportStartTime+a.fightStartTime)-(b.reportStartTime+b.fightStartTime)||a.fightId-b.fightId);
}

export async function getPersistedAvoidHistoryIndexV1({guildId=homeGuildId(),zoneId=null}={}){
  let resolvedZone=positive(zoneId),catalog=null;
  if(!resolvedZone){catalog=await loadLatestRaidCatalogV1().catch(()=>null);resolvedZone=positive(catalog?.currentRaid?.zoneId);}
  if(!resolvedZone)return{ok:true,version:AVOID_HISTORY_READ_VERSION,status:'raid-catalog-missing',guildId:Number(guildId),zone:null,reports:[],pulls:[{key:'all',mode:'all',label:'All pulls'}],networkExecuted:false,wclCallsExecuted:0,needsRefresh:false};
  const index=await loadAvoidHistoryIndexV1({guildId,zoneId:resolvedZone}).catch(()=>null),reports=await listAvoidHistoryReportsV1({guildId,zoneId:resolvedZone}).catch(()=>[]),pulls=buildAvoidHistoryPullIndexV1(reports);
  return{ok:true,version:AVOID_HISTORY_READ_VERSION,storeVersion:AVOID_HISTORY_STORE_VERSION,status:index?.status||'empty',guildId:Number(guildId),zone:index?.zone||{id:resolvedZone,name:catalog?.currentRaid?.name||null},syncedAt:index?.syncedAt||null,highWaterMark:index?.highWaterMark||null,reportCount:reports.length,pullCount:pulls.length,reports:reports.map(avoidHistoryReportSummaryV1).sort((a,b)=>Number(b.startTime)-Number(a.startTime)),pulls:[{key:'all',mode:'all',label:'All pulls'},...pulls.map(row=>({...row,mode:'single',label:`${row.bossName} · ${row.difficultyName} · Pull ${row.pullNumber}`}))],refresh:index?.refresh||null,networkExecuted:false,wclCallsExecuted:0,needsRefresh:!index||index.status!=='ready',evidenceContract:{source:'persisted-home-history',homeOnly:true,activeReportDoesNotMutateHistory:true,difficultyClassifiedPerFight:true,crossDifficultyAggregationForbidden:true,readPathWclNetwork:false}};
}

export async function getPersistedAvoidHistoryScopeV1({guildId=homeGuildId(),zoneId=null,encounterId,difficulty}={}){
  const encounter=positive(encounterId),diff=positive(difficulty);if(!encounter||!diff)throw new Error('encounterId and difficulty are required for persisted HOME history scope');
  const index=await getPersistedAvoidHistoryIndexV1({guildId,zoneId});if(!index.zone?.id)return{...index,encounter:null,nights:[],progressionPulls:[],progressModel:null,playerAttendance:null};
  const reports=(await listAvoidHistoryReportsV1({guildId,zoneId:index.zone.id})).map(storedReportAsWcl).map(report=>({...report,fights:(report.fights||[]).filter(f=>Number(f.encounterID)===encounter&&Number(f.difficulty)===diff)})).filter(report=>report.fights.length);
  const clustered=clusterRaidSessions(reports).sort((a,b)=>a.startTime-b.startTime),playerAttendance=buildIndexedRaidAttendance(clustered),rawProgressionPulls=clustered.flatMap(n=>(n.progressionPulls||[]).map(p=>({...p,sessionId:n.sessionId,sessionIndex:n.sessionIndex,sessionStartTime:n.startTime,sessionTitle:n.title}))).sort((a,b)=>Number(a.absoluteStartTime)-Number(b.absoluteStartTime));
  const built=buildProgressModel(rawProgressionPulls),progressionPulls=(built.canonicalPulls||[]).map(p=>{const{rosterIdentities,...rest}=p||{};return rest;}),progressModel={...built,canonicalPulls:undefined},nights=progressModel.nights||[],currentNight=nights.at(-1)||null,previousNight=nights.at(-2)||null,delta=currentNight&&previousNight?{medianPctPoints:Number(previousNight.medianFightPercentage)-Number(currentNight.medianFightPercentage),bestPctPoints:Number(previousNight.bestFightPercentage)-Number(currentNight.bestFightPercentage),pullDelta:Number(currentNight.pulls)-Number(previousNight.pulls)}:null;
  const firstFight=reports.flatMap(r=>r.fights).sort((a,b)=>Number(a.startTime)-Number(b.startTime))[0]||null;
  return{...index,status:index.status==='empty'?'empty':'ready',encounter:{id:encounter,name:firstFight?.name||`Encounter ${encounter}`,difficulty:diff,difficultyName:difficultyName(diff),scopeKey:`${encounter}:d${diff}`},progressionPulls,progressModel,playerAttendance,nights,recentNights:nights.slice(-5),currentNight,previousNight,delta,reportDiagnostics:reports.map(report=>({reportCode:report.code,title:report.title,startTime:report.startTime,endTime:report.endTime,pulls:(report.fights||[]).filter(f=>!f.inProgress).length,difficulty:diff})),networkExecuted:false,wclCallsExecuted:0};
}
