import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { CURRENT_HISTORY_REPORT_QUERY,LIST_GUILD_REPORTS_QUERY,REPORT_HISTORY_FIGHTS_QUERY } from '../wcl/queries/history.mjs';
import { selectEncounter } from '../wcl/normalization/fights.mjs';
import { clusterRaidSessions } from '../analysis/progression/raid-sessions.mjs';
import { buildProgressModel } from '../analysis/progression/progress-metrics-v2.mjs';
import { buildPlayerAttendance } from '../analysis/reliability/player-attendance-v1.mjs';

async function mapLimit(items,limit,fn){
  const out=new Array(items.length);let next=0;
  async function worker(){
    while(true){
      const i=next++;if(i>=items.length)return;
      try{out[i]=await fn(items[i],i)}catch(e){out[i]={__error:e instanceof Error?e.message:String(e),code:items[i]?.code}}
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length||1)},worker));
  return out;
}

async function listAllReports({guildId,start,end,zoneId,maxPages=10}){
  const all=[];let pageNo=1,total=null,hasMore=true;
  while(hasMore&&pageNo<=maxPages){
    const data=await wclGraphql(LIST_GUILD_REPORTS_QUERY,{guildId,start,end,zoneId,limit:100,page:pageNo});
    const page=data?.reportData?.reports;if(!page)break;
    total=page.total??total;all.push(...(page.data||[]));hasMore=Boolean(page.has_more_pages);pageNo++;
  }
  const byCode=new Map();for(const r of all)if(r?.code)byCode.set(r.code,r);
  return {reports:[...byCode.values()],total:total??byCode.size,hasMore,pageCount:pageNo-1,truncated:hasMore};
}

const clean=v=>String(v||'').trim().toLowerCase();
function actorIdentity(actor){
  if(!actor)return null;
  const canonical=actor.canonicalID??actor.canonicalId??null;
  if(canonical!=null)return`wcl:${canonical}`;
  const name=clean(actor.name);if(!name)return null;
  const server=actor.server||null;
  const realm=clean(typeof server==='string'?server:(server?.slug||server?.name));
  const region=clean(typeof server==='object'?(server?.region?.slug||server?.region?.compactName):actor?.region);
  if(realm)return`character:${region||'unknown-region'}:${realm}:${name}`;
  return`name:${name}`;
}

function attendanceDirectory(reports){
  const directory=new Map();
  for(const report of reports||[]){
    for(const actor of report?.masterData?.actors||[]){
      const key=actorIdentity(actor);if(!key)continue;
      if(!directory.has(key))directory.set(key,{
        key,
        name:actor.name||null,
        className:actor.subType||actor.type||null,
        server:actor.server||null
      });
    }
  }
  return directory;
}

function asFightReports(reports,field){
  return (reports||[]).map(r=>({...r,fights:r?.[field]||[]})).filter(r=>r.fights.length);
}

function stripRosterKeys(pull){
  if(!pull||typeof pull!=='object')return pull;
  const {rosterKeys,...rest}=pull;
  return rest;
}

export async function getGuildHistory({reportCode,guildId,encounterId,daysBefore=35,daysAfter=7}){
  const currentData=await wclGraphql(CURRENT_HISTORY_REPORT_QUERY,{code:reportCode});
  const current=currentData?.reportData?.report;
  if(!current)return null;

  const selected=selectEncounter(current.fights,encounterId);
  const anchor=selected[0];
  if(!anchor){
    return {generatedAt:Date.now(),engineVersion:'3.8.2',guildId,zone:current.zone,encounter:null,nights:[],recentNights:[],progressionPulls:[],progressModel:null,playerAttendance:{status:'pending',scope:'raid-zone-history-window',players:[]},currentNight:null,previousNight:null,delta:null,pagination:{total:0,hasMore:false,candidatesScanned:0}};
  }

  const DAY=86400000;
  const start=Number(current.startTime)-daysBefore*DAY;
  const end=Number(current.endTime)+daysAfter*DAY;
  const listing=await listAllReports({guildId,start,end,zoneId:Number(current.zone.id)});
  let candidates=listing.reports.slice().sort((a,b)=>Number(a.startTime)-Number(b.startTime));
  if(!candidates.some(r=>r.code===reportCode)){
    candidates.push({code:reportCode,title:current.title,startTime:current.startTime,endTime:current.endTime,zone:current.zone});
  }

  const loaded=await mapLimit(candidates,4,async r=>{
    const d=await wclGraphql(REPORT_HISTORY_FIGHTS_QUERY,{code:r.code,encounterId:Number(anchor.encounterID),difficulty:Number(anchor.difficulty)});
    return d?.reportData?.report||null;
  });
  const errors=loaded.filter(x=>x?.__error);
  const reports=loaded.filter(x=>x&&!x.__error&&((x.raidFights||[]).length||(x.encounterFights||[]).length));
  const encounterReports=asFightReports(reports,'encounterFights');
  const raidReports=asFightReports(reports,'raidFights');

  // Progress remains encounter-scoped and analytical. Attendance intentionally
  // uses every closed boss pull in the zone/history window so an early reset is
  // still proof the player attended raid, without contaminating Progress.
  const clustered=clusterRaidSessions(encounterReports,{currentReportCode:reportCode}).sort((a,b)=>a.startTime-b.startTime);
  const raidClustered=clusterRaidSessions(raidReports,{currentReportCode:reportCode,includeAllClosed:true}).sort((a,b)=>a.startTime-b.startTime);
  const playerAttendance={
    ...buildPlayerAttendance(raidClustered,attendanceDirectory(reports)),
    scope:'raid-zone-history-window',
    zoneId:Number(current.zone.id),
    historyWindowDays:daysBefore,
    windowStart:start,
    windowEnd:end,
    semantics:'Raid attendance across all canonical closed boss pulls in the indexed zone/history window; denominator starts at first indexed appearance, not an inferred guild join date.'
  };
  const rawProgressionPulls=clustered
    .flatMap(n=>(n.progressionPulls||[]).map(p=>({...p,sessionId:n.sessionId,sessionIndex:n.sessionIndex,sessionStartTime:n.startTime,sessionTitle:n.title})))
    .sort((a,b)=>Number(a.absoluteStartTime)-Number(b.absoluteStartTime));

  const built=buildProgressModel(rawProgressionPulls);
  const progressionPulls=(built.canonicalPulls||[]).map(stripRosterKeys);
  const progressModel={...built,canonicalPulls:undefined};
  const nights=progressModel.nights||[];
  const recent=nights.slice(-5);

  const currentSessionId=progressionPulls.find(p=>Array.isArray(p.reportCodes)&&p.reportCodes.includes(reportCode))?.sessionId || recent.at(-1)?.sessionId || null;
  const currentNight=currentSessionId?nights.find(n=>n.sessionId===currentSessionId)||null:null;
  const currentIndex=currentNight?nights.findIndex(n=>n.sessionId===currentNight.sessionId):-1;
  const previousNight=currentIndex>0?nights[currentIndex-1]:null;
  const delta=currentNight&&previousNight?{
    medianPctPoints:Number(previousNight.medianFightPercentage)-Number(currentNight.medianFightPercentage),
    bestPctPoints:Number(previousNight.bestFightPercentage)-Number(currentNight.bestFightPercentage),
    pullDelta:Number(currentNight.pulls)-Number(previousNight.pulls)
  }:null;

  return {
    generatedAt:Date.now(),
    engineVersion:'3.8.2',
    guildId,
    zone:current.zone,
    encounter:{id:anchor.encounterID,name:anchor.name,difficulty:anchor.difficulty},
    historyWindow:{daysBefore,daysAfter,start,end},
    progressionPulls,
    progressModel,
    playerAttendance,
    nights,
    recentNights:recent,
    currentNight,
    previousNight,
    delta,
    reportDiagnostics:reports.map(r=>({
      reportCode:r.code,title:r.title,startTime:r.startTime,endTime:r.endTime,
      encounterPulls:(r.encounterFights||[]).filter(f=>!f.inProgress).length,
      raidBossPulls:(r.raidFights||[]).filter(f=>!f.inProgress).length
    })),
    pagination:{total:listing.total,hasMore:listing.hasMore,pagesScanned:listing.pageCount,candidatesScanned:candidates.length,truncated:listing.truncated},
    errors:errors.slice(0,5),
    evidence:{
      nightProgress:'confirmed',
      progressionPullSeries:'canonical-deduped-from-history-reports',
      progressMetrics:'server-derived-single-source-v2-data-integrity',
      progressMetricEligibility:'versioned-and-auditable',
      playerAttendance:'canonical-deduped-all-closed-raid-boss-pulls-since-first-indexed-appearance',
      playerAttendanceScope:'raid-zone-history-window',
      playerAttendanceJoinDate:'not-claimed-by-wcl',
      queryStrategy:'two-stage-paginated-dual-population',
      sessionClustering:'time-window',
      pullDeduplication:'timestamp+duration+progress',
      historyWindowDays:daysBefore,
      resetBoundary:'not-calculated',
      rosterCausality:'not-calculated'
    }
  };
}