import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySemanticProbeEvidenceV3 } from '../../server/corpus/semantic-probe-verifier-v3.mjs';

const TARGET=710001,NOISE=710002,SPECIFIC=710003;

function anchors(){
  return Array.from({length:5},(_,s)=>{
    const source=`source-${s+1}`,anchorOccurrences=[],contexts=[];
    for(let i=0;i<2;i++){
      const t=100000+s*10000+i*4000,sourceID=100+s,targetID=200+s;
      anchorOccurrences.push({timestamp:t,fightID:i+1,sourceID,targetID});
      contexts.push({complete:true,fightID:i+1,anchorTimestamp:t,streams:{
        friendDamage:[{timestamp:t-120,type:'damage',abilityId:NOISE,sourceID:900+s,targetID:800+s}],
        buffs:[{timestamp:t-450,type:'refreshbuff',abilityId:SPECIFIC,sourceID,targetID}],
      }});
    }
    return{source,reportCode:`R${s+1}`,anchorOccurrences,contexts};
  });
}

function controls(){
  let n=0;
  return Array.from({length:5},(_,s)=>({
    source:`source-${s+1}`,reportCode:`R${s+1}`,anchorOccurrences:[],
    contexts:Array.from({length:2},(_,i)=>{
      n++;const t=300000+s*10000+i*5000;
      return{complete:true,fightID:i+1,anchorTimestamp:t,streams:{
        friendDamage:n===10?[]:[{timestamp:t-100,type:'damage',abilityId:NOISE,sourceID:700+s,targetID:600+s}],
        buffs:n===10?[{timestamp:t-400,type:'refreshbuff',abilityId:SPECIFIC,sourceID:700+s,targetID:600+s}]:[],
      }};
    }),
  }));
}

const knowledge={abilities:[{abilityId:SPECIFIC,encounterAssociation:{status:'supported',support:[{provider:'synthetic',reason:'fixture'}]}}]};

test('v3 rejects structural rank #1 when it is background noise and selects the specific candidate',()=>{
  const result=verifySemanticProbeEvidenceV3({signalId:TARGET,sourceEvidence:anchors(),backgroundEvidence:controls(),abilityKnowledge:knowledge});
  assert.equal(result.structural.status,'reproduced');
  assert.equal(result.structuralBestPattern.abilityId,NOISE,'synthetic fixture keeps frequent noise first in structural ranking');
  assert.equal(result.bestPattern.abilityId,SPECIFIC,'candidate-wise specificity must replace the noisy structural winner');
  assert.equal(result.specificity.status,'specificity-supported');
  assert.equal(result.provider.status,'encounter-supported');
  assert.equal(result.topology.consistent,true);
  assert.equal(result.mechanical.status,'mechanically-supported');
  assert.equal(result.selectionDiagnostics.structuralTopRejectedAsNoise,true);
  assert.ok(result.selectionDiagnostics.backgroundNoiseCandidates>=1);
  assert.ok(result.selectionDiagnostics.specificitySupportedCandidates>=1);
  assert.equal(result.promotion.eligible,false);
  assert.equal(result.scoreChange.directDelta,0);
});

test('v3 exposes per-candidate null-baseline evidence rather than hiding rejected candidates',()=>{
  const result=verifySemanticProbeEvidenceV3({signalId:TARGET,sourceEvidence:anchors(),backgroundEvidence:controls(),abilityKnowledge:knowledge});
  const noise=result.candidateAssessments.find(row=>row.pattern.abilityId===NOISE);
  const specific=result.candidateAssessments.find(row=>row.pattern.abilityId===SPECIFIC);
  assert.equal(noise.specificity.status,'background-noise');
  assert.equal(noise.specificity.anchorPrevalence,1);
  assert.equal(noise.specificity.backgroundPrevalence,.9);
  assert.equal(specific.specificity.status,'specificity-supported');
  assert.equal(specific.specificity.anchorPrevalence,1);
  assert.equal(specific.specificity.backgroundPrevalence,.1);
});

test('v3 still refuses all specificity claims when the null baseline is missing',()=>{
  const result=verifySemanticProbeEvidenceV3({signalId:TARGET,sourceEvidence:anchors(),backgroundEvidence:[],abilityKnowledge:knowledge});
  assert.equal(result.mechanical.status,'background-required');
  assert.equal(result.specificity.status,'background-required');
  assert.equal(result.promotion.automatic,false);
});

test('v3.1 keeps a specific player-origin neighbor as a context marker instead of a native boss mechanic',()=>{
  const actorProvenance={abilities:[{
    abilityId:SPECIFIC,
    dominantSource:{role:'friendly-player',share:1},
    dominantTarget:{role:'encounter-boss',share:1},
  }]};
  const result=verifySemanticProbeEvidenceV3({signalId:TARGET,sourceEvidence:anchors(),backgroundEvidence:controls(),abilityKnowledge:knowledge,actorProvenance});
  assert.equal(result.bestPattern.abilityId,SPECIFIC);
  assert.equal(result.specificity.status,'specificity-supported');
  assert.equal(result.actorProvenance.status,'player-origin');
  assert.equal(result.mechanical.status,'player-origin-context-marker');
  assert.equal(result.selectionDiagnostics.playerOriginCandidates,1);
  assert.equal(result.promotion.eligible,false);
});

test('v3.1 encounter-origin provenance can independently support a specific mechanical candidate',()=>{
  const actorProvenance={abilities:[{
    abilityId:SPECIFIC,
    dominantSource:{role:'encounter-boss',share:1},
    dominantTarget:{role:'friendly-player',share:1},
  }]};
  const result=verifySemanticProbeEvidenceV3({signalId:TARGET,sourceEvidence:anchors(),backgroundEvidence:controls(),abilityKnowledge:null,actorProvenance});
  assert.equal(result.actorProvenance.status,'encounter-origin');
  assert.equal(result.mechanical.status,'mechanically-supported');
  assert.equal(result.selectionDiagnostics.encounterOriginCandidates,1);
});
