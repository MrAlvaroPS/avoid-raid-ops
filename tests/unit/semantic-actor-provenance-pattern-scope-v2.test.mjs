import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSemanticActorProvenancePreview,
  executeSemanticActorProvenance,
} from '../../server/corpus/semantic-actor-provenance-v1.mjs';
import { verifySemanticProbeEvidenceV3 } from '../../server/corpus/semantic-probe-verifier-v3.mjs';

const rateLimitData={limitPerHour:3600,pointsSpentThisHour:20,pointsResetIn:1800};

test('actor provenance is persisted by exact semantic pattern, not only abilityId',async()=>{
  const signalId=9000,abilityId=1001;
  const evidenceRecords=[{
    kind:'context',signalId,reportCode:'R1',fightID:1,anchorTimestamp:10000,windowMs:2500,
    pagination:{complete:true},
    streams:{
      debuffs:[{abilityGameID:abilityId,timestamp:11000,type:'removedebuff',sourceID:1,targetID:2}],
      enemyDebuffs:[{abilityGameID:abilityId,timestamp:8500,type:'removedebuff',sourceID:3,targetID:4}],
    },
  }];
  const preview=buildSemanticActorProvenancePreview({signalId,abilityIds:[abilityId],evidenceRecords,maxReports:1});
  const fetcher=async(_query,variables)=>{
    if(!variables?.code)return{rateLimitData};
    return{
      rateLimitData,
      reportData:{report:{masterData:{actors:[
        {id:1,type:'Player',subType:'Mage'},
        {id:2,type:'Pet',subType:'Pet',petOwner:1},
        {id:3,type:'NPC',subType:'Boss'},
        {id:4,type:'NPC',subType:'Add'},
      ]}}},
    };
  };
  const result=await executeSemanticActorProvenance({
    signalId,abilityIds:[abilityId],evidenceRecords,previewFingerprint:preview.fingerprint,
    confirmExecution:true,maxReports:1,fetcher,
  });
  assert.equal(result.version,'semantic-actor-provenance-v2');
  assert.equal(result.evidenceContract.aggregationScope,'pattern-signature-v1');
  assert.equal(result.evidenceContract.rawActorIdsPersisted,false);
  assert.equal(result.patterns.length,2);

  const playerPattern=result.patterns.find(row=>row.key==='after-1s|debuffs|1001|removedebuff');
  const encounterPattern=result.patterns.find(row=>row.key==='before-2.5s|enemyDebuffs|1001|removedebuff');
  assert.ok(playerPattern);
  assert.ok(encounterPattern);
  assert.equal(playerPattern.dominantSource.role,'friendly-player');
  assert.equal(playerPattern.dominantSource.share,1);
  assert.equal(playerPattern.dominantTarget.role,'friendly-pet');
  assert.equal(encounterPattern.dominantSource.role,'encounter-boss');
  assert.equal(encounterPattern.dominantSource.share,1);
  assert.equal(encounterPattern.dominantTarget.role,'encounter-npc');
});

function sourceEvidenceRow(index){
  const anchorTimestamp=10000+index*10000;
  return{
    source:`source:${index}`,anchorOccurrences:[{timestamp:anchorTimestamp,fightID:index+1,sourceID:50,targetID:60}],
    contexts:[{
      complete:true,anchorTimestamp,fightID:index+1,
      streams:{
        buffs:[{abilityGameID:1001,timestamp:anchorTimestamp-500,type:'applybuff',sourceID:1,targetID:2}],
        debuffs:[{abilityGameID:1002,timestamp:anchorTimestamp+500,type:'applydebuff',sourceID:50,targetID:2}],
      },
    }],
  };
}

function backgroundEvidence(){
  const rows=[];
  for(let source=0;source<2;source++){
    rows.push({
      source:`bg:${source}`,anchorOccurrences:[],
      contexts:Array.from({length:3},(_,i)=>({complete:true,referenceTimestamp:5000+source*20000+i*3000,fightID:source+10,streams:{}})),
    });
  }
  return rows;
}

test('verifier applies provenance to the exact pattern signature and prefers encounter-origin pattern',()=>{
  const actorProvenance={
    version:'semantic-actor-provenance-v2',
    patterns:[
      {
        key:'before-1s|buffs|1001|applybuff',abilityId:1001,relation:'before-1s',stream:'buffs',eventType:'applybuff',
        dominantSource:{role:'friendly-player',share:1},dominantTarget:{role:'friendly-player',share:1},
      },
      {
        key:'after-1s|debuffs|1002|applydebuff',abilityId:1002,relation:'after-1s',stream:'debuffs',eventType:'applydebuff',
        dominantSource:{role:'encounter-boss',share:1},dominantTarget:{role:'friendly-player',share:1},
      },
    ],
  };
  const verification=verifySemanticProbeEvidenceV3({
    signalId:9000,
    sourceEvidence:[sourceEvidenceRow(0),sourceEvidenceRow(1),sourceEvidenceRow(2)],
    backgroundEvidence:backgroundEvidence(),
    actorProvenance,
    minimumIndependentSources:2,
    minimumAnchorOccurrences:2,
  });
  assert.equal(verification.version,'semantic-candidate-specificity-verification-v3.2');
  assert.equal(verification.selectionPolicy,'candidate-wise-specificity-pattern-actor-provenance-v3');
  assert.equal(verification.bestPattern.abilityId,1002);
  assert.equal(verification.actorProvenance.status,'encounter-origin');
  assert.equal(verification.actorProvenance.patternScoped,true);
  assert.equal(verification.mechanical.status,'mechanically-supported');
  const player=verification.candidateAssessments.find(row=>row.pattern.abilityId===1001);
  assert.equal(player.actorProvenance.status,'player-origin');
  assert.equal(player.mechanical.status,'player-origin-context-marker');
});

test('legacy ability-level provenance is not silently reused as exact-pattern evidence',()=>{
  const verification=verifySemanticProbeEvidenceV3({
    signalId:9000,
    sourceEvidence:[sourceEvidenceRow(0),sourceEvidenceRow(1),sourceEvidenceRow(2)],
    backgroundEvidence:backgroundEvidence(),
    actorProvenance:{abilities:[{abilityId:1002,dominantSource:{role:'encounter-boss',share:1},dominantTarget:{role:'friendly-player',share:1}}]},
    minimumIndependentSources:2,
    minimumAnchorOccurrences:2,
  });
  for(const row of verification.candidateAssessments){
    assert.equal(row.actorProvenance.patternScoped,false);
    assert.equal(row.actorProvenance.status,'unresolved');
  }
});
