import { paginatorEvents } from '../wcl/normalization/events.mjs';
import { SEMANTIC_PROBE_EVENTS_QUERY, SEMANTIC_PROBE_EVENTS_CONTINUATION_QUERY } from '../wcl/queries/semantic-probes.mjs';

export const SEMANTIC_PROBE_STREAM_KEYS = Object.freeze([
  'enemyCasts','friendDamage','interrupts','debuffs','buffs','enemyBuffs','enemyDebuffs','deaths',
]);
export const SEMANTIC_PROBE_PAGINATION_VERSION='semantic-probe-pagination-v1';

const finiteOptional=value=>{
  if(value==null||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};
const finiteCursor=finiteOptional;

function snapshot(report,key){
  return{events:paginatorEvents(report?.[key]),cursor:finiteCursor(report?.[key]?.nextPageTimestamp)};
}

function continuationVariables({code,fightIDs,abilityID,windowEnd,limit,cursors,active}){
  const vars={
    code:String(code),fightIDs:[...(fightIDs||[])],abilityID:finiteOptional(abilityID),
    windowEnd:finiteOptional(windowEnd),limit:Number(limit)||1000,
  };
  for(const key of SEMANTIC_PROBE_STREAM_KEYS){
    vars[`${key}On`]=active.has(key);
    vars[`${key}Start`]=active.has(key)?finiteCursor(cursors[key]):null;
  }
  return vars;
}

/**
 * Fetch one bounded semantic evidence bundle while preserving independent WCL cursors.
 * `runQuery` is supplied by the executor and is responsible for rate-budget enforcement
 * before every network request. This module never broadens fightIDs or time windows.
 */
export async function fetchSemanticEventBundle({
  code,fightIDs=[],abilityID=null,windowStart=null,windowEnd=null,limit=1000,
  maxContinuationRounds=1,runQuery,
}={}){
  const ids=[...new Set((fightIDs||[]).map(Number).filter(Number.isFinite))];
  if(!code||!ids.length)throw new Error('Semantic probe requires report code and exact fightIDs');
  if(typeof runQuery!=='function')throw new Error('Semantic probe requires a budget-aware runQuery function');
  const boundedLimit=Math.max(100,Math.min(10000,Number(limit)||1000));
  const rawWindowStart=finiteOptional(windowStart),rawWindowEnd=finiteOptional(windowEnd);
  const first=await runQuery(SEMANTIC_PROBE_EVENTS_QUERY,{
    code:String(code),fightIDs:ids,
    abilityID:finiteOptional(abilityID),
    windowStart:rawWindowStart==null?null:Math.max(0,rawWindowStart),
    windowEnd:rawWindowEnd==null?null:Math.max(0,rawWindowEnd),
    limit:boundedLimit,
  },{kind:'semantic-events-first',code:String(code),fightIDs:ids});

  const report=first?.reportData?.report;
  if(!report){
    return{
      streams:Object.fromEntries(SEMANTIC_PROBE_STREAM_KEYS.map(key=>[key,[]])),
      rateLimit:first?.rateLimitData||null,
      pagination:{version:SEMANTIC_PROBE_PAGINATION_VERSION,complete:false,reason:'missing-report',queryCount:1,continuationRounds:0,remainingStreams:[...SEMANTIC_PROBE_STREAM_KEYS],streams:{}},
    };
  }

  const events={},cursors={},pages={},stalled=new Set();
  for(const key of SEMANTIC_PROBE_STREAM_KEYS){
    const snap=snapshot(report,key);events[key]=[...snap.events];cursors[key]=snap.cursor;pages[key]=1;
  }
  let lastRate=first?.rateLimitData||null;
  let queryCount=1,rounds=0;
  const maxRounds=Math.max(0,Math.min(4,Number(maxContinuationRounds)||0));

  while(rounds<maxRounds){
    const active=new Set(SEMANTIC_PROBE_STREAM_KEYS.filter(key=>cursors[key]!=null&&!stalled.has(key)));
    if(!active.size)break;
    const before=Object.fromEntries([...active].map(key=>[key,Number(cursors[key])]));
    const page=await runQuery(SEMANTIC_PROBE_EVENTS_CONTINUATION_QUERY,continuationVariables({
      code,fightIDs:ids,abilityID,windowEnd,limit:boundedLimit,cursors,active,
    }),{kind:'semantic-events-continuation',code:String(code),fightIDs:ids,streams:[...active]});
    queryCount++;rounds++;
    if(page?.rateLimitData)lastRate=page.rateLimitData;
    const nextReport=page?.reportData?.report||{};
    for(const key of active){
      const snap=snapshot(nextReport,key);events[key].push(...snap.events);pages[key]++;
      if(snap.cursor==null){cursors[key]=null;continue;}
      if(!(Number(snap.cursor)>Number(before[key]))){cursors[key]=Number(before[key]);stalled.add(key);continue;}
      cursors[key]=Number(snap.cursor);
    }
  }

  const remaining=SEMANTIC_PROBE_STREAM_KEYS.filter(key=>cursors[key]!=null);
  return{
    streams:events,
    rateLimit:lastRate,
    pagination:{
      version:SEMANTIC_PROBE_PAGINATION_VERSION,
      complete:remaining.length===0,
      reason:remaining.length===0?'complete':stalled.size?'stalled-cursor':rounds>=maxRounds?'max-continuation-rounds':'incomplete',
      queryCount,continuationRounds:rounds,remainingStreams:remaining,stalledStreams:[...stalled],
      streams:Object.fromEntries(SEMANTIC_PROBE_STREAM_KEYS.map(key=>[key,{
        pages:Number(pages[key]||0),events:Number(events[key]?.length||0),complete:cursors[key]==null,nextPageTimestamp:cursors[key]==null?null:Number(cursors[key]),
      }])),
    },
  };
}
