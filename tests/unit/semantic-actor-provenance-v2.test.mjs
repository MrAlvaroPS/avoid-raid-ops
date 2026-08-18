import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSemanticActorProvenancePreviewV2,executeSemanticActorProvenanceV2 } from '../../server/corpus/semantic-actor-provenance-v2.mjs';

const SIGNAL=730001,A=730002;
const evidence=[
  {kind:'context',signalId:SIGNAL,reportCode:'R1',source:'source-1',fightID:1,anchorTimestamp:1000,windowMs:2500,pagination:{complete:true},streams:{
    enemyDebuffs:[
      {timestamp:900,type:'removedebuff',abilityId:A,sourceID:1,targetID:10},
      {timestamp:1300,type:'applydebuff',abilityId:A,sourceID:10,targetID:1},
    ],
  }},
  {kind:'context',signalId:SIGNAL,reportCode:'R1',source:'source-1',fightID:1,anchorTimestamp:1000,windowMs:5000,pagination:{complete:true},streams:{
    enemyDebuffs:[
      {timestamp:900,type:'removedebuff',abilityId:A,sourceID:1,targetID:10},
      {timestamp:1300,type:'applydebuff',abilityId:A,sourceID:10,targetID:1},
    ],
  }},
];

function fakeFetcher(){
  let calls=0;
  const fn=async (_query,vars={})=>{
    calls++;
    const rateLimitData={limitPerHour:3600,pointsSpentThisHour:10+calls,pointsResetIn:3000};
    if(!vars.code)return{rateLimitData};
    return{rateLimitData,reportData:{report:{masterData:{actors:[
      {id:1,type:'Player',subType:'Mage',petOwner:null},
      {id:10,type:'NPC',subType:'Boss',petOwner:null},
    ]}}}};
  };
  fn.calls=()=>calls;
  return fn;
}

test('v2 preview remains metadata-only and gets a new fingerprint/version',()=>{
  const preview=buildSemanticActorProvenancePreviewV2({signalId:SIGNAL,abilityIds:[A],evidenceRecords:evidence});
  assert.equal(preview.version,'semantic-actor-provenance-preview-v2');
  assert.equal(preview.networkUpperBound.combatEventCalls,0);
  assert.equal(preview.safety.patternLevelAggregation,true);
  assert.equal(preview.safety.deduplicationScope,'anchor-occurrence');
});

test('v2 persists pattern-level role summaries while retaining conservative ability fallback',async()=>{
  const preview=buildSemanticActorProvenancePreviewV2({signalId:SIGNAL,abilityIds:[A],evidenceRecords:evidence});
  const fetcher=fakeFetcher();
  const result=await executeSemanticActorProvenanceV2({signalId:SIGNAL,abilityIds:[A],evidenceRecords:evidence,previewFingerprint:preview.fingerprint,confirmExecution:true,fetcher});
  assert.equal(fetcher.calls(),2);
  assert.equal(result.abilities.length,1);
  assert.equal(result.abilities[0].events,2,'duplicate 2.5s/5s contexts must not double count identical events');
  assert.equal(result.patterns.length,2);
  const before=result.patterns.find(row=>row.key===`simultaneous-1s|enemyDebuffs|${A}|removedebuff`);
  const after=result.patterns.find(row=>row.key===`after-1s|enemyDebuffs|${A}|applydebuff`);
  assert.equal(before.dominantSource.role,'friendly-player');
  assert.equal(before.dominantTarget.role,'encounter-boss');
  assert.equal(after.dominantSource.role,'encounter-boss');
  assert.equal(after.dominantTarget.role,'friendly-player');
  assert.equal(result.evidenceContract.rawActorIdsPersisted,false);
  assert.equal(result.evidenceContract.aggregationGranularity,'pattern-key-with-ability-fallback');
  assert.equal(result.evidenceContract.deduplicationScope,'anchor-occurrence');
  for(const row of [...result.abilities,...result.patterns]){
    assert.equal('sourceID' in row,false);
    assert.equal('targetID' in row,false);
  }
});

test('v2 deduplicates overlapping radii but preserves one combat event against distinct anchors',async()=>{
  const sharedEvent={timestamp:1500,type:'applydebuff',abilityId:A,sourceID:10,targetID:1};
  const multiAnchorEvidence=[
    {kind:'context',signalId:SIGNAL,reportCode:'R1',source:'source-1',fightID:1,anchorTimestamp:1000,windowMs:2500,pagination:{complete:true},streams:{enemyDebuffs:[sharedEvent]}},
    {kind:'context',signalId:SIGNAL,reportCode:'R1',source:'source-1',fightID:1,anchorTimestamp:1000,windowMs:5000,pagination:{complete:true},streams:{enemyDebuffs:[sharedEvent]}},
    {kind:'context',signalId:SIGNAL,reportCode:'R1',source:'source-1',fightID:1,anchorTimestamp:2000,windowMs:2500,pagination:{complete:true},streams:{enemyDebuffs:[sharedEvent]}},
    {kind:'context',signalId:SIGNAL,reportCode:'R1',source:'source-1',fightID:1,anchorTimestamp:2000,windowMs:5000,pagination:{complete:true},streams:{enemyDebuffs:[sharedEvent]}},
  ];
  const preview=buildSemanticActorProvenancePreviewV2({signalId:SIGNAL,abilityIds:[A],evidenceRecords:multiAnchorEvidence});
  const result=await executeSemanticActorProvenanceV2({signalId:SIGNAL,abilityIds:[A],evidenceRecords:multiAnchorEvidence,previewFingerprint:preview.fingerprint,confirmExecution:true,fetcher:fakeFetcher()});

  assert.equal(result.abilities[0].events,1,'ability fallback should count the underlying combat event once');
  assert.equal(result.patterns.length,2,'the same combat event can legitimately form a pattern around two distinct anchors');

  const after=result.patterns.find(row=>row.key===`after-1s|enemyDebuffs|${A}|applydebuff`);
  const before=result.patterns.find(row=>row.key===`before-1s|enemyDebuffs|${A}|applydebuff`);
  assert.equal(after.events,1);
  assert.equal(after.windows,1);
  assert.equal(before.events,1);
  assert.equal(before.windows,1);
  assert.equal(after.dominantSource.role,'encounter-boss');
  assert.equal(before.dominantSource.role,'encounter-boss');
});
