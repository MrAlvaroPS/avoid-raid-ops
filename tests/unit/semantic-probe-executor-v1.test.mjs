import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SEMANTIC_PROBE_EXECUTION_DEFAULTS,
  buildSemanticProbeExecutionPreview,
  executeSemanticProbePlanV1,
  semanticProbeExecutionFingerprint,
  semanticProbeAnchorEvidenceKey,
} from '../../server/corpus/semantic-surgical-probe-executor-v1.mjs';
import { fetchSemanticEventBundle } from '../../server/corpus/semantic-probe-wcl-v1.mjs';
import {
  SEMANTIC_PROBE_EVENTS_QUERY,
  SEMANTIC_PROBE_EVENTS_CONTINUATION_QUERY,
} from '../../server/wcl/queries/semantic-probes.mjs';

const TARGET=700001,NEIGHBOR=700002;
const CONFIG={...SEMANTIC_PROBE_EXECUTION_DEFAULTS,maxWclCalls:20,maxAnchorContinuationRounds:1,maxContextContinuationRounds:0,maxContextQueries:6,windowRadiiMs:[2500]};

function emptyReport(){
  return Object.fromEntries(['enemyCasts','friendDamage','interrupts','debuffs','buffs','enemyBuffs','enemyDebuffs','deaths'].map(key=>[key,{data:[],nextPageTimestamp:null}]));
}

function plan(anchorCount=3){
  const anchors=Array.from({length:anchorCount},(_,index)=>({
    stage:'anchor-occurrences',reportCode:String.fromCharCode(65+index),source:`guild:${100+index}`,fightIDs:[index+1],
    selectionEvidence:{selectionTier:'canonical-deep-target-events',persistedTargetEvents:10,completeCanonicalDeep:true,canonicalDeepSelected:true},
    queryShape:{fightIDs:[index+1],abilityID:TARGET},evidenceClass:'diagnostic-semantic-surgical',canonicalCoverageContribution:{deepReports:0,deepPulls:0},executesWcl:false,
  }));
  return{
    version:'semantic-surgical-probe-plan-v2',evidenceSelectionVersion:'semantic-probe-evidence-selection-v1',
    scope:{encounterId:9876,difficulty:5,partition:9},targetSignals:1,
    signals:[{
      id:TARGET,name:'Synthetic Signal',missingEvidence:['deterministic-structural-pattern'],anchorRequests:anchors,
      verificationContract:{minimumIndependentSources:3,minimumAnchorOccurrences:6,noAutomaticMechanicPromotion:true,noDirectScoreChange:true},
    }],
  };
}

function memoryStore(){
  const map=new Map();
  return{
    map,
    get:async key=>map.get(key)||null,
    set:async(key,value)=>{map.set(key,structuredClone(value));return value;},
  };
}

function fakeFetcher(log){
  return async(query,variables={})=>{
    log.push({query,variables:structuredClone(variables)});
    const rateLimitData={limitPerHour:3600,pointsSpentThisHour:200+log.length,pointsResetIn:1200};
    if(query.includes('AvoidCorpusRateLimit'))return{rateLimitData};
    const report=emptyReport();
    if(variables.abilityID!==null&&variables.abilityID!==undefined&&Number.isFinite(Number(variables.abilityID))){
      const fight=Number(variables.fightIDs[0]);
      report.enemyCasts={data:[
        {timestamp:10000+fight*100,fight,abilityGameID:TARGET,type:'cast',sourceID:9000,targetID:1},
        {timestamp:20000+fight*100,fight,abilityGameID:TARGET,type:'cast',sourceID:9000,targetID:2},
      ],nextPageTimestamp:null};
    }else{
      const start=Number(variables.windowStart),fight=Number(variables.fightIDs[0]);
      report.enemyCasts={data:[{timestamp:start+2000,fight,abilityGameID:NEIGHBOR,type:'cast',sourceID:9000,targetID:3}],nextPageTimestamp:null};
    }
    return{rateLimitData,reportData:{report}};
  };
}

test('semantic probe queries match the WCL v2 Report.events abilityID Float contract',()=>{
  for(const query of [SEMANTIC_PROBE_EVENTS_QUERY,SEMANTIC_PROBE_EVENTS_CONTINUATION_QUERY]){
    assert.match(query,/\$abilityID:Float\b/);
    assert.doesNotMatch(query,/\$abilityID:Int\b/);
  }
});

test('execution preview is stable, 0-WCL and exposes an honest bounded call budget',()=>{
  const p=plan();
  const preview=buildSemanticProbeExecutionPreview({plan:p,cacheEntries:[],config:CONFIG});
  assert.equal(preview.wclCallsExecuted,0);
  assert.equal(preview.executesWcl,false);
  assert.equal(preview.plannedAnchorRequests,3);
  assert.equal(preview.potentialContextWindows,6);
  assert.equal(preview.callBudget.wclPointCostEstimate,null);
  assert.equal(preview.callBudget.hardWclCallCap,20);
  assert.equal(preview.executionPolicy.manualConfirmationRequired,true);
  assert.equal(preview.executionPolicy.countsTowardDeepReports,false);
  assert.equal(preview.executionPolicy.resumablePagination,true);
  assert.equal(preview.fingerprint,semanticProbeExecutionFingerprint(p,CONFIG));
});

test('preview budgets adaptive windows and counts only complete anchor evidence as cache hits',()=>{
  const p=plan(5);
  const config={...SEMANTIC_PROBE_EXECUTION_DEFAULTS,maxWclCalls:16,maxContextQueries:12,maxAnchorOccurrencesPerSource:2,windowRadiiMs:[2500,5000]};
  const requests=p.signals[0].anchorRequests;
  const completeKey=semanticProbeAnchorEvidenceKey(p,p.signals[0],requests[0]);
  const partialKey=semanticProbeAnchorEvidenceKey(p,p.signals[0],requests[1]);
  const preview=buildSemanticProbeExecutionPreview({
    plan:p,config,
    cacheEntries:[
      {key:completeKey,value:{kind:'anchor',signalId:TARGET,pagination:{complete:true}}},
      {key:partialKey,value:{kind:'anchor',signalId:TARGET,pagination:{complete:false,reason:'max-continuation-rounds'}}},
    ],
  });
  assert.equal(preview.plannedAnchorRequests,5);
  assert.equal(preview.anchorCacheHits,1);
  assert.equal(preview.anchorCachePartial,1);
  assert.equal(preview.anchorQueriesRemaining,4);
  assert.equal(preview.potentialContextWindows,12);
  assert.equal(preview.callBudget.initialQueryUpperBound,17);
  assert.equal(preview.cacheAccounting.partialEvidenceIsNotACacheHit,true);
});

test('partial semantic bundle resumes from its persisted cursor without repeating the first page',async()=>{
  const log=[];
  const runQuery=async(query,variables={})=>{
    log.push({query,variables:structuredClone(variables)});
    const report=emptyReport();
    if(query.includes('AvoidSemanticProbeEventsContinuation')){
      report.enemyCasts={data:[{timestamp:20000,fight:1,abilityGameID:TARGET,type:'cast',sourceID:9,targetID:2}],nextPageTimestamp:null};
    }else{
      report.enemyCasts={data:[{timestamp:10000,fight:1,abilityGameID:TARGET,type:'cast',sourceID:9,targetID:1}],nextPageTimestamp:15000};
    }
    return{rateLimitData:{limitPerHour:3600,pointsSpentThisHour:100,pointsResetIn:1000},reportData:{report}};
  };
  let checkpoint=null;
  const first=await fetchSemanticEventBundle({
    code:'A',fightIDs:[1],abilityID:TARGET,maxContinuationRounds:0,runQuery,
    onProgress:async bundle=>{checkpoint=structuredClone(bundle);},
  });
  assert.equal(first.pagination.complete,false);
  assert.equal(first.pagination.streams.enemyCasts.nextPageTimestamp,15000);
  assert.equal(log.length,1);
  const resumed=await fetchSemanticEventBundle({
    code:'A',fightIDs:[1],abilityID:TARGET,maxContinuationRounds:1,runQuery,resumeBundle:checkpoint,
  });
  assert.equal(resumed.pagination.complete,true);
  assert.equal(log.length,2);
  assert.match(log[1].query,/AvoidSemanticProbeEventsContinuation/);
  assert.equal(resumed.streams.enemyCasts.length,2);
});

test('executor refuses missing confirmation and stale preview before any WCL call',async()=>{
  const p=plan(),store=memoryStore(),log=[];
  await assert.rejects(()=>executeSemanticProbePlanV1({plan:p,previewFingerprint:'bad',confirmExecution:false,config:CONFIG,fetcher:fakeFetcher(log),storageGet:store.get,storageSet:store.set}),/confirmExecution:true/);
  await assert.rejects(()=>executeSemanticProbePlanV1({plan:p,previewFingerprint:'bad',confirmExecution:true,config:CONFIG,fetcher:fakeFetcher(log),storageGet:store.get,storageSet:store.set}),/fingerprint/);
  assert.equal(log.length,0);
});

test('executor uses exact fights, reproduces a generic pattern across sources, persists evidence and is idempotent',async()=>{
  const p=plan(),store=memoryStore(),log=[];
  const deepProfiles=['A','B','C'].map((code,index)=>({code,fights:[{id:index+1,startTime:0,endTime:40000}]}));
  const fingerprint=semanticProbeExecutionFingerprint(p,CONFIG);
  const result=await executeSemanticProbePlanV1({
    plan:p,previewFingerprint:fingerprint,confirmExecution:true,config:CONFIG,deepProfiles,
    fetcher:fakeFetcher(log),storageGet:store.get,storageSet:store.set,
  });
  assert.equal(result.status,'complete');
  assert.equal(result.signals[0].verification.status,'reproduced');
  assert.equal(result.signals[0].verification.bestPattern.abilityId,NEIGHBOR);
  assert.equal(result.signals[0].verification.evidence.queriedSources,3);
  assert.equal(result.signals[0].verification.evidence.anchorOccurrences,6);
  assert.deepEqual(result.canonicalCoverageContribution,{deepReports:0,deepPulls:0});
  assert.equal(result.automaticPromotion,false);
  assert.equal(log.filter(row=>row.query.includes('AvoidCorpusRateLimit')).length,1);
  const semantic=log.filter(row=>row.query.includes('AvoidSemanticProbeEvents('));
  assert.equal(semantic.length,9);
  assert.ok(semantic.every(row=>Array.isArray(row.variables.fightIDs)&&row.variables.fightIDs.length===1));
  assert.ok(semantic.filter(row=>row.variables.abilityID==null).every(row=>Number.isFinite(Number(row.variables.windowStart))&&Number.isFinite(Number(row.variables.windowEnd))));
  const before=log.length;
  const second=await executeSemanticProbePlanV1({
    plan:p,previewFingerprint:fingerprint,confirmExecution:true,config:CONFIG,deepProfiles,
    fetcher:fakeFetcher(log),storageGet:store.get,storageSet:store.set,
  });
  assert.equal(second.reusedCompletedRun,true);
  assert.equal(second.wclCallsExecutedThisInvocation,0);
  assert.equal(log.length,before);
});

test('semantic execution surface is isolated from corpus Improve and remains POST-confirmed',async()=>{
  const route=await readFile(new URL('../../routes/api/wcl/semantic-probe.js',import.meta.url),'utf8');
  assert.match(route,/action!=='execute'/);
  assert.match(route,/confirmExecution!==true/);
  assert.match(route,/Preview fingerprint is missing or stale/);
  assert.match(route,/GET supports only preview or result/);
  assert.doesNotMatch(route,/startCorpus|launchCorpusExecution|improveModel/);

  const genericPaths=[
    '../../server/corpus/semantic-surgical-probe-executor-v1.mjs',
    '../../server/corpus/semantic-probe-wcl-v1.mjs',
    '../../server/corpus/semantic-probe-verifier-v1.mjs',
    '../../server/wcl/queries/semantic-probes.mjs',
    '../../routes/api/wcl/semantic-probe.js',
  ];
  const banned=[/Belo['’]?ren/i,/Voidlight Rupture/i,/\b3182\b/,/\b1243866\b/];
  for(const path of genericPaths){
    const source=await readFile(new URL(path,import.meta.url),'utf8');
    for(const pattern of banned)assert.doesNotMatch(source,pattern,`${path} must remain boss-agnostic`);
  }
});