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
  for(const row of [...result.abilities,...result.patterns]){
    assert.equal('sourceID' in row,false);
    assert.equal('targetID' in row,false);
  }
});
