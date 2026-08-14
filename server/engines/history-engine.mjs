import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { CURRENT_HISTORY_REPORT_QUERY,LIST_GUILD_REPORTS_QUERY,REPORT_HISTORY_FIGHTS_QUERY } from '../wcl/queries/history.mjs';
import { selectEncounter } from '../wcl/normalization/fights.mjs';
import { clusterRaidSessions } from '../analysis/progression/raid-sessions.mjs';

async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;async function worker(){while(true){const i=next++;if(i>=items.length)return;try{out[i]=await fn(items[i],i)}catch(e){out[i]={__error:e instanceof Error?e.message:String(e),code:items[i]?.code}}}}await Promise.all(Array.from({length:Math.min(limit,items.length||1)},worker));return out;}

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

export async function getGuildHistory({reportCode,guildId,encounterId,daysBefore=35,daysAfter=7}){
 const currentData=await wclGraphql(CURRENT_HISTORY_REPORT_QUERY,{code:reportCode}); const current=currentData?.reportData?.report;if(!current)return null;
 const selected=selectEncounter(current.fights,encounterId);const anchor=selected[0];if(!anchor)return{generatedAt:Date.now(),guildId,zone:current.zone,encounter:null,nights:[],recentNights:[],currentNight:null,previousNight:null,delta:null,pagination:{total:0,hasMore:false,candidatesScanned:0}};
 const DAY=86400000;const start=Number(current.startTime)-daysBefore*DAY;const end=Number(current.endTime)+daysAfter*DAY;
 const listing=await listAllReports({guildId,start,end,zoneId:Number(current.zone.id)});let candidates=listing.reports.slice().sort((a,b)=>Number(a.startTime)-Number(b.startTime));
 if(!candidates.some(r=>r.code===reportCode)) candidates.push({code:reportCode,title:current.title,startTime:current.startTime,endTime:current.endTime,zone:current.zone});
 const loaded=await mapLimit(candidates,4,async r=>{const d=await wclGraphql(REPORT_HISTORY_FIGHTS_QUERY,{code:r.code,encounterId:Number(anchor.encounterID),difficulty:Number(anchor.difficulty)});return d?.reportData?.report||null});
 const errors=loaded.filter(x=>x?.__error);const reports=loaded.filter(x=>x&&!x.__error&&(x.fights||[]).length);
 const nights=clusterRaidSessions(reports,{currentReportCode:reportCode}).sort((a,b)=>a.startTime-b.startTime);
 const recent=nights.slice(-5);const currentNight=nights.find(n=>(n.reportCodes||[]).includes(reportCode))||recent.at(-1)||null;const previousNight=currentNight?nights.filter(n=>Number(n.startTime)<Number(currentNight.startTime)).at(-1)||null:null;
 const delta=currentNight&&previousNight?{medianPctPoints:Number(previousNight.medianFightPercentage)-Number(currentNight.medianFightPercentage),bestPctPoints:Number(previousNight.bestFightPercentage)-Number(currentNight.bestFightPercentage),pullDelta:Number(currentNight.pulls)-Number(previousNight.pulls)}:null;
 return{generatedAt:Date.now(),engineVersion:'3.4.2',guildId,zone:current.zone,encounter:{id:anchor.encounterID,name:anchor.name,difficulty:anchor.difficulty},nights,recentNights:recent,currentNight,previousNight,delta,reportDiagnostics:reports.map(r=>({reportCode:r.code,title:r.title,startTime:r.startTime,endTime:r.endTime,pulls:(r.fights||[]).filter(f=>!f.inProgress).length})),pagination:{total:listing.total,hasMore:listing.hasMore,pagesScanned:listing.pageCount,candidatesScanned:candidates.length,truncated:listing.truncated},errors:errors.slice(0,5),evidence:{nightProgress:'confirmed',queryStrategy:'two-stage-paginated',sessionClustering:'time-window',pullDeduplication:'timestamp+duration+progress',resetBoundary:'not-calculated',rosterCausality:'not-calculated'}};
}
