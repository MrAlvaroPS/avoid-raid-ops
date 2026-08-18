import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySemanticProbeEvidenceV32 } from '../../server/corpus/semantic-probe-verifier-v3-2.mjs';

const TARGET=720001,NOISE=720002,SPECIFIC=720003;

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
const specificPatternKey=`before-1s|buffs|${SPECIFIC}|refreshbuff`;

test('v3.2 never lets provider encounter support override mixed actor provenance',()=>{
  const actorProvenance={abilities:[{
    abilityId:SPECIFIC,
    dominantSource:{role:'friendly-player',share:.69},
    dominantTarget:{role:'friendly-pet',share:.96},
  }]};
  const result=verifySemanticProbeEvidenceV32({signalId:TARGET,sourceEvidence:anchors(),backgroundEvidence:controls(),abilityKnowledge:knowledge,actorProvenance});
  assert.equal(result.bestPattern.abilityId,SPECIFIC);
  assert.equal(result.specificity.status,'specificity-supported');
  assert.equal(result.provider.status,'encounter-supported');
  assert.equal(result.actorProvenance.status,'mixed-or-unknown');
  assert.equal(result.actorProvenance.granularity,'ability-fallback');
  assert.equal(result.mechanical.status,'provenance-required');
  assert.equal(result.selectionDiagnostics.mechanicallySupportedCandidates,0);
  assert.ok(result.selectionDiagnostics.provenanceRequiredCandidates>=1);
});

test('v3.2 keeps strong player-origin evidence as a context marker even when provider supports the ability identity',()=>{
  const actorProvenance={abilities:[{
    abilityId:SPECIFIC,
    dominantSource:{role:'friendly-player',share:1},
    dominantTarget:{role:'encounter-boss',share:1},
  }]};
  const result=verifySemanticProbeEvidenceV32({signalId:TARGET,sourceEvidence:anchors(),backgroundEvidence:controls(),abilityKnowledge:knowledge,actorProvenance});
  assert.equal(result.actorProvenance.status,'player-origin');
  assert.equal(result.mechanical.status,'player-origin-context-marker');
  assert.equal(result.selectionDiagnostics.encounterOriginCandidates,0);
});

test('v3.2 requires encounter-side provenance plus provider or topology corroboration for mechanical support',()=>{
  const actorProvenance={patterns:[{
    key:specificPatternKey,abilityId:SPECIFIC,relation:'before-1s',stream:'buffs',eventType:'refreshbuff',
    dominantSource:{role:'encounter-boss',share:1},
    dominantTarget:{role:'friendly-player',share:1},
  }]};
  const result=verifySemanticProbeEvidenceV32({signalId:TARGET,sourceEvidence:anchors(),backgroundEvidence:controls(),abilityKnowledge:knowledge,actorProvenance});
  assert.equal(result.actorProvenance.status,'encounter-origin');
  assert.equal(result.actorProvenance.granularity,'pattern');
  assert.equal(result.mechanical.status,'mechanically-supported');
});

test('v3.2 prefers exact pattern provenance over contradictory ability-level fallback',()=>{
  const actorProvenance={
    abilities:[{
      abilityId:SPECIFIC,
      dominantSource:{role:'friendly-player',share:1},
      dominantTarget:{role:'encounter-boss',share:1},
    }],
    patterns:[{
      key:specificPatternKey,abilityId:SPECIFIC,relation:'before-1s',stream:'buffs',eventType:'refreshbuff',
      dominantSource:{role:'encounter-boss',share:1},
      dominantTarget:{role:'friendly-player',share:1},
    }],
  };
  const result=verifySemanticProbeEvidenceV32({signalId:TARGET,sourceEvidence:anchors(),backgroundEvidence:controls(),abilityKnowledge:knowledge,actorProvenance});
  assert.equal(result.actorProvenance.granularity,'pattern');
  assert.equal(result.actorProvenance.status,'encounter-origin');
  assert.equal(result.mechanical.status,'mechanically-supported');
  assert.ok(result.selectionDiagnostics.patternProvenanceCandidates>=1);
});

test('v3.2 unresolved provenance cannot be replaced by topology alone',()=>{
  const result=verifySemanticProbeEvidenceV32({signalId:TARGET,sourceEvidence:anchors(),backgroundEvidence:controls(),abilityKnowledge:null,actorProvenance:null});
  assert.equal(result.topology.consistent,true);
  assert.equal(result.actorProvenance.status,'unresolved');
  assert.equal(result.mechanical.status,'provenance-required');
});
