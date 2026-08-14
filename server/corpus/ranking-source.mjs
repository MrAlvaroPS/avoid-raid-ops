import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { CORPUS_RANKINGS_QUERY } from '../wcl/queries/corpus.mjs';

function firstFinite(...values){for(const v of values){const n=Number(v);if(Number.isFinite(n))return n;}return null;}
function reportCodeFrom(node){
  if(!node||typeof node!=='object')return null;
  const direct=[node.reportCode,node.reportID,node.reportId].find(v=>typeof v==='string'&&v.length>=8);if(direct)return direct;
  if(typeof node.report==='string'&&node.report.length>=8)return node.report;
  if(node.report&&typeof node.report==='object'&&typeof node.report.code==='string')return node.report.code;
  if(typeof node.code==='string'&&node.code.length>=8&&(node.fightID!=null||node.fightId!=null||node.duration!=null||node.total!=null))return node.code;
  return null;
}

export function extractRankingRows(json){
  const rows=[],seen=new Set();
  const walk=(node,depth=0)=>{
    if(depth>14||node==null)return;
    if(Array.isArray(node)){for(const x of node)walk(x,depth+1);return;}
    if(typeof node!=='object')return;
    const code=reportCodeFrom(node);
    if(code){
      const fightId=firstFinite(node.fightID,node.fightId,node.report?.fightID,node.report?.fightId);
      const key=`${code}:${fightId??''}`;
      if(!seen.has(key)){seen.add(key);rows.push({reportCode:code,fightId,rank:firstFinite(node.rank,node.rankPercent,node.percentile),startTime:firstFinite(node.startTime,node.report?.startTime),duration:firstFinite(node.duration)});}
    }
    for(const v of Object.values(node))if(v&&typeof v==='object')walk(v,depth+1);
  };
  walk(json);
  return rows;
}

export function rankingHasMore(json,currentPage,rows){
  const candidates=[];
  const walk=(node,depth=0)=>{
    if(depth>10||!node||typeof node!=='object')return;
    if(Array.isArray(node)){node.forEach(x=>walk(x,depth+1));return;}
    for(const [k,v] of Object.entries(node)){
      const key=k.toLowerCase();
      if(['hasmorepages','has_more_pages','hasmore'].includes(key)&&typeof v==='boolean')candidates.push(v);
      if(['last_page','lastpage','totalpages','total_pages'].includes(key)&&Number.isFinite(Number(v)))candidates.push(Number(currentPage)<Number(v));
      if(v&&typeof v==='object')walk(v,depth+1);
    }
  };
  walk(json);
  if(candidates.includes(true))return true;
  if(candidates.length)return false;
  return (rows||[]).length>0;
}

export async function fetchRankingPage({encounterId,difficulty=5,partition=0,page=1}){
  const requestedPartition=Number(partition||0);
  const data=await wclGraphql(CORPUS_RANKINGS_QUERY,{encounter:Number(encounterId),difficulty:Number(difficulty),partition:requestedPartition>0?requestedPartition:null,page:Number(page)});
  const encounter=data?.worldData?.encounter||null;const raw=encounter?.fightRankings??null;const rows=extractRankingRows(raw);
  const partitions=encounter?.zone?.partitions||[];const resolvedPartition=requestedPartition>0?requestedPartition:Number(partitions.find(p=>p?.default)?.id)||null;
  return {encounter:encounter?{id:encounter.id,name:encounter.name,journalID:encounter.journalID,zone:encounter.zone}:null,resolvedPartition,rows,hasMore:rankingHasMore(raw,page,rows),rateLimit:data?.rateLimitData||null,rawShape:raw&&typeof raw==='object'?Object.keys(raw).slice(0,20):[]};
}
