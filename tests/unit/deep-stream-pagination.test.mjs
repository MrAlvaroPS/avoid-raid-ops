import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchCompleteDeepEventData,
  DEEP_STREAM_KEYS,
  DEEP_STREAM_PAGINATION_POLICY_VERSION,
} from '../../server/corpus/deep-events-pagination.mjs';
import { CORPUS_DEEP_EVENTS_CONTINUATION_QUERY } from '../../server/wcl/queries/corpus.mjs';

function stream(data=[],nextPageTimestamp=null){return{data,nextPageTimestamp};}
function response(overrides={},spent=100){
  const report={};
  for(const key of DEEP_STREAM_KEYS)report[key]=stream([],null);
  Object.assign(report,overrides);
  return{
    rateLimitData:{limitPerHour:3600,pointsSpentThisHour:spent,pointsResetIn:1200},
    reportData:{report},
  };
}

test('Deep pagination advances each WCL stream from its own nextPageTimestamp',async()=>{
  const calls=[];
  const pages=[
    response({
      enemyCasts:stream([{id:'cast-1'}],null),
      friendDamage:stream([{id:'damage-1'}],100),
      buffs:stream([{id:'buff-1'}],200),
    },100),
    response({
      friendDamage:stream([{id:'damage-2'}],150),
      buffs:stream([{id:'buff-2'}],null),
    },140),
    response({
      friendDamage:stream([{id:'damage-3'}],null),
    },160),
  ];
  const fetcher=async(query,variables)=>{
    calls.push({query,variables});
    const page=pages[calls.length-1];
    if(!page)throw new Error('unexpected extra WCL page');
    return page;
  };

  const out=await fetchCompleteDeepEventData({code:'ABC',fightIDs:[1,2,2],fetcher});
  assert.equal(out.pagination.policyVersion,DEEP_STREAM_PAGINATION_POLICY_VERSION);
  assert.equal(out.pagination.complete,true);
  assert.equal(out.pagination.queryCount,3);
  assert.equal(out.pagination.continuationRounds,2);
  assert.equal(out.pagination.streams.friendDamage.pages,3);
  assert.equal(out.pagination.streams.friendDamage.events,3);
  assert.equal(out.pagination.streams.buffs.pages,2);
  assert.equal(out.pagination.streams.buffs.events,2);
  assert.deepEqual(out.data.reportData.report.friendDamage.data.map(x=>x.id),['damage-1','damage-2','damage-3']);
  assert.deepEqual(out.data.reportData.report.buffs.data.map(x=>x.id),['buff-1','buff-2']);
  assert.equal(out.data.reportData.report.friendDamage.nextPageTimestamp,null);
  assert.equal(out.data.rateLimitData.pointsSpentThisHour,160);

  assert.deepEqual(calls[0].variables.fightIDs,[1,2]);
  assert.equal(calls[1].variables.friendDamageOn,true);
  assert.equal(calls[1].variables.friendDamageStart,100);
  assert.equal(calls[1].variables.buffsOn,true);
  assert.equal(calls[1].variables.buffsStart,200);
  assert.equal(calls[1].variables.enemyCastsOn,false);
  assert.equal(calls[2].variables.friendDamageOn,true);
  assert.equal(calls[2].variables.friendDamageStart,150);
  assert.equal(calls[2].variables.buffsOn,false);
});

test('Deep pagination keeps a stalled cursor incomplete instead of looping or fabricating coverage',async()=>{
  let n=0;
  const fetcher=async()=>{
    n++;
    if(n===1)return response({friendDamage:stream([{id:1}],100)});
    return response({friendDamage:stream([{id:2}],100)});
  };
  const out=await fetchCompleteDeepEventData({code:'STALL',fightIDs:[7],fetcher});
  assert.equal(n,2);
  assert.equal(out.pagination.complete,false);
  assert.equal(out.pagination.reason,'stalled-cursor');
  assert.deepEqual(out.pagination.stalledStreams,['friendDamage']);
  assert.deepEqual(out.pagination.remainingStreams,['friendDamage']);
  assert.equal(out.data.reportData.report.friendDamage.nextPageTimestamp,100);
});

test('Deep pagination exposes an honest shortfall when the continuation safety limit is reached',async()=>{
  let n=0;
  const fetcher=async()=>{
    n++;
    if(n===1)return response({debuffs:stream([{id:1}],100)});
    return response({debuffs:stream([{id:2}],200)});
  };
  const out=await fetchCompleteDeepEventData({code:'CAP',fightIDs:[9],maxContinuationRounds:1,fetcher});
  assert.equal(n,2);
  assert.equal(out.pagination.complete,false);
  assert.equal(out.pagination.reason,'max-continuation-rounds');
  assert.deepEqual(out.pagination.remainingStreams,['debuffs']);
  assert.equal(out.data.reportData.report.debuffs.nextPageTimestamp,200);
});

test('continuation query has independent start cursors and skips already-complete aliases',()=>{
  for(const key of DEEP_STREAM_KEYS){
    assert.match(CORPUS_DEEP_EVENTS_CONTINUATION_QUERY,new RegExp(`\\$${key}Start:Float`));
    assert.match(CORPUS_DEEP_EVENTS_CONTINUATION_QUERY,new RegExp(`@include\\(if:\\$${key}On\\)`));
    assert.match(CORPUS_DEEP_EVENTS_CONTINUATION_QUERY,new RegExp(`startTime:\\$${key}Start`));
  }
});
