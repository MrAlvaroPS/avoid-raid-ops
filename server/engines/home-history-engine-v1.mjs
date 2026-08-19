import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { CURRENT_HISTORY_REPORT_QUERY,LIST_GUILD_REPORTS_QUERY } from '../wcl/queries/history.mjs';
import { loadLatestRaidCatalogV1 } from '../knowledge/raid-catalog-store-v1.mjs';
import { homeGuildId } from '../knowledge/scopes.mjs';
import { clusterRaidSessions } from '../analysis/progression/raid-sessions.mjs';
import { buildProgressModel } from '../analysis/progression/progress-metrics-v2.mjs';
import { buildIndexedRaidAttendance } from '../analysis/reliability/attendance-history-v1.mjs';
import {
  AVOID_HISTORY_STORE_VERSION,normalizeAvoidHistoryReportV1,avoidHistoryReportSummaryV1,
  loadAvoidHistoryIndexV1,listAvoidHistoryReportsV1,persistAvoidHistoryIndexV1,persistAvoidHistoryReportV1,
} from '../home/history-store-v1.mjs';

export const AVOID_HISTORY_ENGINE_VERSION='avoid-history-engine-v1';
const DAY=86400000;
const difficultyName=value=>({1:'LFR',2:'Flexible',3:'Normal',4:'Heroic',5:'Mythic'})[Number(value)]||`Difficulty ${value??'?'}`;
const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};

async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;async function worker(){while(true){const i=next++;if(i>=items.length)return;try{out[i]=await fn(items[i],i)}catch(error){out[i]={__error:error instanceof Error?error.message:String(error),item:items[i]};}}}await Promise.all(Array.from({length:Math.min(Math.max(1,limit),items.length||1)},worker));return out;}

async function listGuildRaidReports({guildId,zoneId,days=180,maxPages=5}){
  const end=Date.now()+DAY,start=end-Math.max(7,Math.min(730,Number(days)||180))*DAY,rows=[];let page=1,hasMore=true,total=null;
  while(hasMore&&page<=Math.max(1,Math.min(20,Number(maxPages)||5))){
    const data=await wclGraphql(LIST_GUILD_REPORTS_QUERY,{guildId:Number(guildId),start,end,zoneId:Number(zoneId),limit:100,page});
    const result=data?.reportData?.reports;if(!result)break;total=result.total??total;rows.push(...(result.data||[]));hasMore=Boolean(result.has_more_pages);page++;
  }
  const byCode=new Map();for(const row of rows)if(row?.code&&Number(row?.zone?.id)===Number(zoneId))byCode.set(String(row.code),row);
  return{reports:[...byCode.values()].sort((a,b)=>Number(a.startTime)-Number(b.startTime)),window:{start,end,days},pagination:{pagesScanned:page-1,total:total??byCode.size,truncated:hasMore},networkCalls:page-1};
}

function storedReportAsWcl(report={}){return{code:report.reportCode,title:report.title,startTime:report.startTime,endTime:report.endTime,zone:report.zone,guild:report.guild,masterData:report.masterData,fights:report.fights||[]};}
function reportHasInProgress(summary={}){return(summary.scopes||[]).some(scope=>Number(scope.inProgressPulls||0)>0);}
function reportNeedsRefresh(listed,previousSummary,now=Date.now()){
  if(!previousSummary)return true;
  if(Number(listed.endTime||0)!==Number(previousSummary.endTime||0))return true;
  if(reportHasInProgress(previousSummary))return true;
  // Recent reports are cheap to recheck on an explicit refresh and may still be receiving
  // uploads even when the listing endpoint has not advanced endTime yet.
  if(Number(listed.endTime||0)>now-12*60*60*1000)return true;
  return false;
}

function publicPullIndex(reports=[]){
  const pulls=[];
  for(const report of reports){
    const scopeCounts=new Map();
    for(const fight of report.fights||[]){
      if(fight.inProgress||!positive(fight.encounterID)||!positive(fight.difficulty))continue;
      const scopeKey=`${fight.encounterID}:d${fight.difficulty}`,pullNumber=(scopeCounts.get(scopeKey)||0)+1;scopeCounts.set(scopeKey,pullNumber);
      pulls.push({
        key:`${report.reportCode}:${fight.id}`,reportCode:report.reportCode,reportTitle:report.title,fightId:Number(fight.id),pullNumber,
        encounterId:Number(fight.encounterID),bossName:fight.name||`Encounter ${fight.encounterID}`,difficulty:Number(fight.difficulty),difficultyName:difficultyName(fight.difficulty),scopeKey,
        kill:Boolean(fight.kill),fightPercentage:Number.isFinite(Number(fight.fightPercentage))?Number(fight.fightPercentage):null,bossPercentage:Number.isFinite(Number(fight.bossPercentage))?Number(fight.bossPercentage):null,
        reportStartTime:Number(report.startTime)||0,fightStartTime:Number(fight.startTime)||0,fightEndTime:Number(fight.endTime)||0,
      });
    }
  }
  return pulls.sort((a,b)=>(a.reportStartTime+a.fightStartTime)-(b.reportStartTime+b.fightStartTime)||a.fightId-b.fightId);
}

export async function getPersistedAvoidHistoryIndexV1({guildId=homeGuildId(),zoneId=null}={}){
  let resolvedZone=positive(zoneId),catalog=null;
  if(!resolvedZone){catalog=await loadLatestRaidCatalogV1().catch(()=>null);resolvedZone=positive(catalog?.currentRaid?.zoneId);}
  if(!resolvedZone)return{ok:true,version:AVOID_HISTORY_ENGINE_VERSION,status:'raid-catalog-missing',guildId:Number(guildId),zone:null,reports:[],pulls:[],networkExecuted:false,wclCallsExecuted:0,needsRefresh:false};
  const index=await loadAvoidHistoryIndexV1({guildId,zoneId:resolvedZone}).catch(()=>null),reports=await listAvoidHistoryReportsV1({guildId,zoneId:resolvedZone}).catch(()=>[]),pulls=publicPullIndex(reports);
  return{
    ok:true,version:AVOID_HISTORY_ENGINE_VERSION,storeVersion:AVOID_HISTORY_STORE_VERSION,status:index?.status||'empty',guildId:Number(guildId),zone:index?.zone||{id:resolvedZone,name:catalog?.currentRaid?.name||null},
    syncedAt:index?.syncedAt||null,highWaterMark:index?.highWaterMark||null,reportCount:reports.length,pullCount:pulls.length,reports:reports.map(avoidHistoryReportSummaryV1).sort((a,b)=>Number(b.startTime)-Number(a.startTime)),pulls:[{key:'all',mode:'all',label:'All pulls'},...pulls.map(row=>({...row,mode:'single',label:`${row.bossName} · ${row.difficultyName} · Pull ${row.pullNumber}`}))],
    refresh:index?.refresh||null,networkExecuted:false,wclCallsExecuted:0,needsRefresh:!index||index.status!=='ready',
    evidenceContract:{source:'persisted-home-history',homeOnly:true,activeReportDoesNotMutateHistory:true,difficultyClassifiedPerFight:true,crossDifficultyAggregationForbidden:true},
  };
}

export async function getPersistedAvoidHistoryScopeV1({guildId=homeGuildId(),zoneId=null,encounterId,difficulty}={}){
  const encounter=positive(encounterId),diff=positive(difficulty);if(!encounter||!diff)throw new Error('encounterId and difficulty are required for persisted HOME history scope');
  const index=await getPersistedAvoidHistoryIndexV1({guildId,zoneId});if(!index.zone?.id)return{...index,encounter:null,nights:[],progressionPulls:[],progressModel:null,playerAttendance:null};
  const reports=(await listAvoidHistoryReportsV1({guildId,zoneId:index.zone.id})).map(storedReportAsWcl).map(report=>({...report,fights:(report.fights||[]).filter(f=>Number(f.encounterID)===encounter&&Number(f.difficulty)===diff)})).filter(report=>report.fights.length);
  const clustered=clusterRaidSessions(reports).sort((a,b)=>a.startTime-b.startTime),playerAttendance=buildIndexedRaidAttendance(clustered),rawProgressionPulls=clustered.flatMap(n=>(n.progressionPulls||[]).map(p=>({...p,sessionId:n.sessionId,sessionIndex:n.sessionIndex,sessionStartTime:n.startTime,sessionTitle:n.title}))).sort((a,b)=>Number(a.absoluteStartTime)-Number(b.absoluteStartTime));
  const built=buildProgressModel(rawProgressionPulls),progressionPulls=(built.canonicalPulls||[]).map(p=>{const{rosterIdentities,...rest}=p||{};return rest;}),progressModel={...built,canonicalPulls:undefined},nights=progressModel.nights||[],currentNight=nights.at(-1)||null,previousNight=nights.at(-2)||null,delta=currentNight&&previousNight?{medianPctPoints:Number(previousNight.medianFightPercentage)-Number(currentNight.medianFightPercentage),bestPctPoints:Number(previousNight.bestFightPercentage)-Number(currentNight.bestFightPercentage),pullDelta:Number(currentNight.pulls)-Number(previousNight.pulls)}:null;
  const firstFight=reports.flatMap(r=>r.fights).sort((a,b)=>Number(a.startTime)-Number(b.startTime))[0]||null;
  return{
    ...index,status:index.status==='empty'?'empty':'ready',encounter:{id:encounter,name:firstFight?.name||`Encounter ${encounter}`,difficulty:diff,difficultyName:difficultyName(diff),scopeKey:`${encounter}:d${diff}`},
    progressionPulls,progressModel,playerAttendance,nights,recentNights:nights.slice(-5),currentNight,previousNight,delta,
    reportDiagnostics:reports.map(report=>({reportCode:report.code,title:report.title,startTime:report.startTime,endTime:report.endTime,pulls:(report.fights||[]).filter(f=>!f.inProgress).length,difficulty:diff})),
    networkExecuted:false,wclCallsExecuted:0,
  };
}

export async function refreshPersistedAvoidHistoryV1({guildId=homeGuildId(),days=180,maxPages=5,maxChangedReports=40,concurrency=3}={}){
  const catalog=await loadLatestRaidCatalogV1().catch(()=>null),zoneId=positive(catalog?.currentRaid?.zoneId);if(!zoneId)throw new Error('Persisted current raid catalog is required before refreshing AvoiD history');
  const previous=await loadAvoidHistoryIndexV1({guildId,zoneId}).catch(()=>null),listed=await listGuildRaidReports({guildId,zoneId,days,maxPages}),previousByCode=new Map((previous?.reports||[]).map(row=>[String(row.reportCode),row]));
  const changed=listed.reports.filter(row=>reportNeedsRefresh(row,previousByCode.get(String(row.code))));
  const limit=Math.max(1,Math.min(100,Number(maxChangedReports)||40)),selected=changed.slice(-limit),loaded=await mapLimit(selected,Math.max(1,Math.min(6,Number(concurrency)||3)),async row=>{
    const data=await wclGraphql(CURRENT_HISTORY_REPORT_QUERY,{code:String(row.code)}),report=data?.reportData?.report;if(!report)return{skipped:true,code:row.code,reason:'report-not-found'};
    const normalized=normalizeAvoidHistoryReportV1(report,{guildId,zoneId,syncedAt:Date.now()});await persistAvoidHistoryReportV1(normalized,{guildId,zoneId});return{ok:true,summary:avoidHistoryReportSummaryV1(normalized)};
  });
  const errors=loaded.filter(row=>row?.__error||row?.skipped),updated=loaded.filter(row=>row?.ok).map(row=>row.summary),allReports=await listAvoidHistoryReportsV1({guildId,zoneId}),summaries=allReports.map(avoidHistoryReportSummaryV1).sort((a,b)=>Number(a.startTime)-Number(b.startTime)),remaining=Math.max(0,changed.length-selected.length),syncedAt=Date.now(),status=remaining>0||errors.length?'partial':'ready',highWaterMark=Math.max(0,...summaries.map(row=>Number(row.endTime)||0));
  const index={
    version:AVOID_HISTORY_STORE_VERSION,engineVersion:AVOID_HISTORY_ENGINE_VERSION,status,guildId:Number(guildId),zone:{id:zoneId,name:catalog.currentRaid?.name||null},catalogFingerprint:catalog.fingerprint||null,syncedAt,highWaterMark,reports:summaries,
    refresh:{explicit:true,listedReports:listed.reports.length,changedReports:changed.length,updatedReports:updated.length,remainingChangedReports:remaining,errors:errors.slice(0,10),window:listed.window,pagination:listed.pagination,networkCalls:listed.networkCalls+selected.length},
  };
  await persistAvoidHistoryIndexV1(index,{guildId,zoneId});
  return{ok:true,...index,networkExecuted:true,wclCallsExecuted:listed.networkCalls+selected.length,wclCombatEventCalls:0,automaticPolling:false,evidenceContract:{homeOnly:true,explicitRefresh:true,incremental:true,activeReportDoesNotMutateHistory:true,difficultyClassifiedPerFight:true}};
}
