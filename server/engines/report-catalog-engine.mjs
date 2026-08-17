import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { REPORT_CATALOG_ANCHOR_QUERY,REPORT_CATALOG_LIST_QUERY } from '../wcl/queries/report-catalog.mjs';

const DAY=86400000;
const CACHE_TTL_MS=20000;
const cache=new Map();

const clampDays=value=>Math.max(2,Math.min(365,Number(value)||120));
const publicReport=(report,selectedCode)=>({
  code:report.code,
  title:report.title||report.code,
  startTime:Number(report.startTime)||0,
  endTime:Number(report.endTime)||0,
  zone:report.zone?{id:Number(report.zone.id),name:report.zone.name}:null,
  selected:report.code===selectedCode,
});

export function filterCurrentRaidReports(reports,{zoneId,selectedCode}={}){
  const exactZone=Number(zoneId);
  const byCode=new Map();
  for(const report of reports||[]){
    if(!report?.code||Number(report?.zone?.id)!==exactZone)continue;
    byCode.set(report.code,report);
  }
  return [...byCode.values()]
    .sort((a,b)=>Number(b.startTime)-Number(a.startTime))
    .map(report=>publicReport(report,selectedCode));
}

async function anchorReport(reportCode){
  const data=await wclGraphql(REPORT_CATALOG_ANCHOR_QUERY,{code:reportCode});
  return data?.reportData?.report||null;
}

async function listPages({guildId,zoneId,start,end,maxPages=10}){
  const reports=[];let page=1,total=null,hasMore=true;
  while(hasMore&&page<=maxPages){
    const data=await wclGraphql(REPORT_CATALOG_LIST_QUERY,{guildId,start,end,zoneId,limit:100,page});
    const result=data?.reportData?.reports;if(!result)break;
    total=result.total??total;
    reports.push(...(result.data||[]));
    hasMore=Boolean(result.has_more_pages);page++;
  }
  return {reports,total:total??reports.length,pagesScanned:page-1,truncated:hasMore};
}

/**
 * Report catalog is intentionally scoped by the selected report's exact WCL
 * zone. That makes Mythic+ and unrelated/old raids structurally ineligible
 * instead of trying to filter noise later by title heuristics.
 */
export async function getAvoidReportCatalog({reportCode,guildId,days=120,force=false}){
  if(!reportCode)throw new Error('reportCode is required');
  if(!Number.isFinite(Number(guildId))||Number(guildId)<=0)throw new Error('guildId is required');
  const windowDays=clampDays(days);
  const anchor=await anchorReport(reportCode);
  if(!anchor?.zone?.id)return null;

  const zoneId=Number(anchor.zone.id);
  const key=`${Number(guildId)}:${zoneId}:${windowDays}`;
  const existing=cache.get(key);
  if(!force&&existing&&Date.now()-existing.at<CACHE_TTL_MS){
    return {...existing.value,cache:{kind:'server-memory',hit:true,ttlMs:CACHE_TTL_MS}};
  }

  const end=Math.max(Date.now(),Number(anchor.endTime)||Date.now());
  const start=end-windowDays*DAY;
  const listed=await listPages({guildId:Number(guildId),zoneId,start,end});
  const reports=filterCurrentRaidReports(listed.reports,{zoneId,selectedCode:reportCode});

  if(!reports.some(report=>report.code===reportCode))reports.push(publicReport(anchor,reportCode));
  reports.sort((a,b)=>b.startTime-a.startTime);

  const value={
    generatedAt:Date.now(),
    modelVersion:'report-catalog-v1',
    guildId:Number(guildId),
    selectedReportCode:reportCode,
    zone:{id:zoneId,name:anchor.zone.name},
    window:{days:windowDays,start,end},
    reports,
    latestReport:reports[0]||null,
    pagination:{total:listed.total,pagesScanned:listed.pagesScanned,truncated:listed.truncated},
    filterPolicy:{
      id:'current-raid-zone-v1',
      include:'exact selected-report WCL zone only',
      mythicPlus:'excluded by exact raid zone scope',
      unrelatedRaids:'excluded by exact raid zone scope',
      titleHeuristics:false,
    },
  };
  cache.set(key,{at:Date.now(),value});
  return {...value,cache:{kind:'server-memory',hit:false,ttlMs:CACHE_TTL_MS}};
}
