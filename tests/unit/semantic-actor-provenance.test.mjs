import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSemanticActorProvenancePreview,executeSemanticActorProvenance } from '../../server/corpus/semantic-actor-provenance-v1.mjs';

const SIGNAL=700001,A=700002,B=700003;
const evidence=[
  {kind:'context',signalId:SIGNAL,reportCode:'R1',source:'source-1',fightID:1,anchorTimestamp:1000,windowMs:2500,pagination:{complete:true},streams:{
    enemyDebuffs:[{timestamp:900,type:'removedebuff',abilityId:A,sourceID:1,targetID:10},{timestamp:950,type:'applydebuff',abilityId:B,sourceID:2,targetID:10}],
  }},
  {kind:'context',signalId:SIGNAL,reportCode:'R2',source:'source-2',fightID:2,anchorTimestamp:2000,windowMs:2500,pagination:{complete:true},streams:{
    friendDamage:[{timestamp:2005,type:'damage',abilityId:A,sourceID:20,targetID:3}],
  }},
];

function fakeFetcher(){
  let calls=0;
  const fn=async (_query,vars={})=>{
    calls++;
    const rateLimitData={limitPerHour:3600,pointsSpentThisHour:10+calls,pointsResetIn:3000};
    if(!vars.code)return{rateLimitData};
    if(vars.code==='R1')return{rateLimitData,reportData:{report:{masterData:{actors:[
      {id:1,type:'Player',subType:'Mage',petOwner:null},
      {id:2,type:'Pet',subType:'Pet',petOwner:1},
      {id:10,type:'NPC',subType:'Boss',petOwner:null},
    ]}}}};
    if(vars.code==='R2')return{rateLimitData,reportData:{report:{masterData:{actors:[
      {id:3,type:'Player',subType:'Priest',petOwner:null},
      {id:20,type:'NPC',subType:'Boss',petOwner:null},
    ]}}}};
    throw new Error('unexpected report');
  };
  fn.calls=()=>calls;
  return fn;
}

test('v3.9.6 preview is zero-network and bounded to one preflight plus report metadata calls',()=>{
  const preview=buildSemanticActorProvenancePreview({signalId:SIGNAL,abilityIds:[A,B],evidenceRecords:evidence});
  assert.equal(preview.reports,2);
  assert.equal(preview.networkUpperBound.wclCalls,3);
  assert.equal(preview.networkUpperBound.combatEventCalls,0);
  assert.equal(preview.safety.rawActorIdsPersisted,false);
});

test('v3.9.6 classifies player, owned pet and boss provenance without persisting actor ids',async()=>{
  const preview=buildSemanticActorProvenancePreview({signalId:SIGNAL,abilityIds:[A,B],evidenceRecords:evidence});
  const fetcher=fakeFetcher();
  const result=await executeSemanticActorProvenance({signalId:SIGNAL,abilityIds:[A,B],evidenceRecords:evidence,previewFingerprint:preview.fingerprint,confirmExecution:true,fetcher});
  assert.equal(fetcher.calls(),3);
  assert.equal(result.reportsResolved,2);
  assert.equal(result.wclCallsExecuted,3);
  const a=result.abilities.find(row=>row.abilityId===A);
  assert.equal(a.sourceRoles['friendly-player'],1);
  assert.equal(a.sourceRoles['encounter-boss'],1);
  assert.equal(a.targetRoles['encounter-boss'],1);
  assert.equal(a.targetRoles['friendly-player'],1);
  const b=result.abilities.find(row=>row.abilityId===B);
  assert.equal(b.dominantSource.role,'friendly-pet');
  assert.equal(b.dominantTarget.role,'encounter-boss');
  assert.equal(result.evidenceContract.rawActorIdsPersisted,false);
  assert.equal(result.evidenceContract.rawActorNamesPersisted,false);
  for(const row of result.abilities){
    assert.equal('sourceID' in row,false);
    assert.equal('targetID' in row,false);
  }
});

test('v3.9.6 refuses stale preview before spending WCL',async()=>{
  const fetcher=fakeFetcher();
  await assert.rejects(()=>executeSemanticActorProvenance({signalId:SIGNAL,abilityIds:[A,B],evidenceRecords:evidence,previewFingerprint:'stale',confirmExecution:true,fetcher}),/stale/i);
  assert.equal(fetcher.calls(),0);
});
