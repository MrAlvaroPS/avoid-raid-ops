import { paginatorEvents } from '../wcl/normalization/events.mjs';
import { SEMANTIC_PROBE_EVENTS_QUERY, SEMANTIC_PROBE_EVENTS_CONTINUATION_QUERY } from '../wcl/queries/semantic-probes.mjs';

export const SEMANTIC_PROBE_STREAM_KEYS = Object.freeze([
  'enemyCasts','friendDamage','interrupts','debuffs','buffs','enemyBuffs','enemyDebuffs','deaths',
]);
export const SEMANTIC_PROBE_PAGINATION_VERSION='semantic-probe-pagination-v2';

const finiteOptional=value=>{
  if(value==null||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};
const finiteCursor=finiteOptional;

function snapshot(report,key){
  return{events:paginatorEvents(report?.[key]),cursor:finiteCursor(report?.[key]?.nextPageTimestamp)};
}

function eventSignature(event={}){
  const ability=event?.abilityGameID??event?.abilityId??event?.ability?.guid??event?.ability?.id??null;
  return [event?.timestamp??null,event?.fight??event?.fightID??null,event?.type??null,ability,event?.sourceID??event?.source?.id??null,event?.targetID??event?.target?.id??null].join(':');
}
function mergeEvents(existing=[],incoming=[]){
  const out=[...(existing||[])],seen=new Set(out.map(eventSignature));
  for(const event of incoming||[]){const key=eventSignature(event);if(seen.has(key))continue;seen.add(key);out.push(event);}
  return out;
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

function bundleFromState({events,cursors,pages,stalled,lastRate,queryCount,totalContinuationRounds,reason='incomplete'}){
  const remaining=SEMANTIC_PROBE_STREAM_KEYS.filter(key=>cursors[key]!=null);
  const complete=remaining.length===0;
  return{
    streams:Object.fromEntries(SEMANTIC_PROBE_STREAM_KEYS.map(key=>[key,[...(events[key]||[])]])),
    rateLimit:lastRate||null,
    pagination:{
      version:SEMANTIC_PROBE_PAGINATION_VERSION,
      complete,
      reason:complete?'complete':reason,
      queryCount:Number(queryCount||0),
      continuationRounds:Number(totalContinuationRounds||0),
      remainingStreams:remaining,
      stalledStreams:[...stalled],
      streams:Object.fromEntries(SEMANTIC_PROBE_STREAM_KEYS.map(key=>[key,{
        pages:Number(pages[key]||0),
        events:Number(events[key]?.length||0),
        complete:cursors[key]==null,
        nextPageTimestamp:cursors[key]==null?null:Number(cursors[key]),
      }])),
    },
  };
}

function resumeState(bundle){
  if(!bundle||bundle?.pagination?.complete)return null;
  const streams=bundle?.pagination?.streams||{};
  const resumable=SEMANTIC_PROBE_STREAM_KEYS.some(key=>finiteCursor(streams?.[key]?.nextPageTimestamp)!=null);
  if(!resumable)return null;
  const events={},cursors={},pages={};
  for(const key of SEMANTIC_PROBE_STREAM_KEYS){
    events[key]=[...(bundle?.streams?.[key]||[])];
    cursors[key]=streams?.[key]?.complete?null:finiteCursor(streams?.[key]?.nextPageTimestamp);
    pages[key]=Number(streams?.[key]?.pages||0);
  }
  return{
    events,cursors,pages,
    stalled:new Set(bundle?.pagination?.stalledStreams||[]),
    lastRate:bundle?.rateLimit||null,
    queryCount:Number(bundle?.pagination?.queryCount||0),
    totalContinuationRounds:Number(bundle?.pagination?.continuationRounds||0),
  };
}

/**
 * Fetch one bounded semantic evidence bundle while preserving independent WCL cursors.
 * `runQuery` is supplied by the executor and is responsible for rate-budget enforcement
 * before every network request. `resumeBundle` may be a previously persisted partial
 * bundle. `onProgress` is called after each successfully received WCL page so a later
 * budget stop never forces already-paid pages to be downloaded again.
 * This module never broadens fightIDs or time windows.
 */
export async function fetchSemanticEventBundle({
  code,fightIDs=[],abilityID=null,windowStart=null,windowEnd=null,limit=1000,
  maxContinuationRounds=1,runQuery,resumeBundle=null,onProgress=null,
}={}){
  const ids=[...new Set((fightIDs||[]).map(Number).filter(Number.isFinite))];
  if(!code||!ids.length)throw new Error('Semantic probe requires report code and exact fightIDs');
  if(typeof runQuery!=='function')throw new Error('Semantic probe requires a budget-aware runQuery function');
  const boundedLimit=Math.max(100,Math.min(10000,Number(limit)||1000));
  const rawWindowStart=finiteOptional(windowStart),rawWindowEnd=finiteOptional(windowEnd);
  const maxRounds=Math.max(0,Math.min(4,Number(maxContinuationRounds)||0));
  const emit=async bundle=>{if(typeof onProgress==='function')await onProgress(bundle);return bundle;};

  let state=resumeState(resumeBundle);
  if(!state){
    const first=await runQuery(SEMANTIC_PROBE_EVENTS_QUERY,{
      code:String(code),fightIDs:ids,
      abilityID:finiteOptional(abilityID),
      windowStart:rawWindowStart==null?null:Math.max(0,rawWindowStart),
      windowEnd:rawWindowEnd==null?null:Math.max(0,rawWindowEnd),
      limit:boundedLimit,
    },{kind:'semantic-events-first',code:String(code),fightIDs:ids});

    const report=first?.reportData?.report;
    if(!report){
      return emit({
        streams:Object.fromEntries(SEMANTIC_PROBE_STREAM_KEYS.map(key=>[key,[]])),
        rateLimit:first?.rateLimitData||null,
        pagination:{version:SEMANTIC_PROBE_PAGINATION_VERSION,complete:false,reason:'missing-report',queryCount:1,continuationRounds:0,remainingStreams:[...SEMANTIC_PROBE_STREAM_KEYS],stalledStreams:[],streams:{}},
      });
    }

    const events={},cursors={},pages={};
    for(const key of SEMANTIC_PROBE_STREAM_KEYS){
      const snap=snapshot(report,key);events[key]=[...snap.events];cursors[key]=snap.cursor;pages[key]=1;
    }
    state={events,cursors,pages,stalled:new Set(),lastRate:first?.rateLimitData||null,queryCount:1,totalContinuationRounds:0};
    await emit(bundleFromState({...state,reason:'incomplete'}));
  }

  let roundsThisInvocation=0;
  while(roundsThisInvocation<maxRounds){
    const active=new Set(SEMANTIC_PROBE_STREAM_KEYS.filter(key=>state.cursors[key]!=null&&!state.stalled.has(key)));
    if(!active.size)break;
    const before=Object.fromEntries([...active].map(key=>[key,Number(state.cursors[key])]));
    const page=await runQuery(SEMANTIC_PROBE_EVENTS_CONTINUATION_QUERY,continuationVariables({
      code,fightIDs:ids,abilityID,windowEnd,limit:boundedLimit,cursors:state.cursors,active,
    }),{kind:'semantic-events-continuation',code:String(code),fightIDs:ids,streams:[...active]});
    state.queryCount++;roundsThisInvocation++;state.totalContinuationRounds++;
    if(page?.rateLimitData)state.lastRate=page.rateLimitData;
    const nextReport=page?.reportData?.report||{};
    for(const key of active){
      const snap=snapshot(nextReport,key);
      state.events[key]=mergeEvents(state.events[key],snap.events);
      state.pages[key]=Number(state.pages[key]||0)+1;
      if(snap.cursor==null){state.cursors[key]=null;continue;}
      if(!(Number(snap.cursor)>Number(before[key]))){state.cursors[key]=Number(before[key]);state.stalled.add(key);continue;}
      state.cursors[key]=Number(snap.cursor);
    }
    await emit(bundleFromState({...state,reason:'incomplete'}));
  }

  const remaining=SEMANTIC_PROBE_STREAM_KEYS.filter(key=>state.cursors[key]!=null);
  const actionable=remaining.filter(key=>!state.stalled.has(key));
  const reason=remaining.length===0?'complete':actionable.length===0&&state.stalled.size?'stalled-cursor':roundsThisInvocation>=maxRounds?'max-continuation-rounds':'incomplete';
  return emit(bundleFromState({...state,reason}));
}
