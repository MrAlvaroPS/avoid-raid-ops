import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySemanticProbeEvidenceV2 } from '../../server/corpus/semantic-probe-verifier-v2.mjs';
import { buildStoredSemanticSourceEvidenceV2,buildStoredFlankBackgroundEvidenceV2 } from '../../server/corpus/semantic-probe-stored-evidence-v2.mjs';

const TARGET=700001,SPECIFIC=700002,NOISE=700003;

function sourceEvidence({backgroundSpecificEvery=0}={}){
  return Array.from({length:5},(_,s)=>{
    const source=`source-${s+1}`,anchorOccurrences=[],contexts=[];
    for(let i=0;i<2;i++){
      const anchorTimestamp=100000+s*10000+i*4000,sourceID=100+s,targetID=200+s;
      anchorOccurrences.push({timestamp:anchorTimestamp,fightID:i+1,sourceID,targetID});
      contexts.push({complete:true,fightID:i+1,anchorTimestamp,streams:{
        buffs:[
          {timestamp:anchorTimestamp-500-(i*20),type:'refreshbuff',abilityId:SPECIFIC,sourceID,targetID},
          {timestamp:anchorTimestamp-2200,type:'refreshbuff',abilityId:NOISE,sourceID:900+s,targetID:800+s},
          {timestamp:anchorTimestamp-1800,type:'refreshbuff',abilityId:NOISE,sourceID:900+s,targetID:800+s},
          {timestamp:anchorTimestamp-1300,type:'refreshbuff',abilityId:NOISE,sourceID:900+s,targetID:800+s},
        ],
      }});
    }
    return{source,reportCode:`R${s+1}`,anchorOccurrences,contexts};
  });
}

function backgroundEvidence({specificEvery=0}={}){
  let index=0;
  return Array.from({length:5},(_,s)=>({
    source:`source-${s+1}`,reportCode:`R${s+1}`,anchorOccurrences:[],
    contexts:Array.from({length:2},(_,i)=>{
      const anchorTimestamp=300000+s*10000+i*5000;index++;
      const buffs=[{timestamp:anchorTimestamp-2100,type:'refreshbuff',abilityId:NOISE,sourceID:700+s,targetID:600+s}];
      if(specificEvery&&index%specificEvery===0)buffs.push({timestamp:anchorTimestamp-450,type:'refreshbuff',abilityId:SPECIFIC,sourceID:700+s,targetID:600+s});
      return{complete:true,fightID:i+1,anchorTimestamp,streams:{buffs}};
    }),
  }));
}

const knowledge={abilities:[{
  abilityId:SPECIFIC,semanticClass:'boss-ability-candidate',
  encounterAssociation:{status:'supported',support:[{provider:'lorrgs',reason:'synthetic encounter membership'}]},
}]};

test('v3.9.4 recurring evidence without a null/control baseline stays background-required',()=>{
  const result=verifySemanticProbeEvidenceV2({signalId:TARGET,sourceEvidence:sourceEvidence(),backgroundEvidence:[],abilityKnowledge:knowledge});
  assert.equal(result.structural.status,'reproduced');
  assert.equal(result.specificity.status,'background-required');
  assert.equal(result.mechanical.status,'background-required');
  assert.equal(result.promotion.eligible,false);
  assert.equal(result.canonicalCoverageContribution.deepReports,0);
  assert.equal(result.scoreChange.directDelta,0);
});

test('v3.9.4 null baseline demotes a globally frequent recurring neighbor to background noise',()=>{
  const result=verifySemanticProbeEvidenceV2({
    signalId:TARGET,sourceEvidence:sourceEvidence(),
    backgroundEvidence:backgroundEvidence({specificEvery:1}),abilityKnowledge:knowledge,
  });
  assert.equal(result.bestPattern.abilityId,SPECIFIC);
  assert.equal(result.specificity.status,'background-noise');
  assert.equal(result.mechanical.status,'background-noise');
  assert.ok(result.specificity.backgroundPrevalence>=result.specificity.anchorPrevalence*.8);
});

test('v3.9.4 specific low-density neighbor plus encounter provenance and stable topology becomes mechanically-supported, never promoted',()=>{
  const result=verifySemanticProbeEvidenceV2({
    signalId:TARGET,sourceEvidence:sourceEvidence(),
    backgroundEvidence:backgroundEvidence({specificEvery:10}),abilityKnowledge:knowledge,
  });
  assert.equal(result.bestPattern.abilityId,SPECIFIC);
  assert.equal(result.bestPattern.independentSources,5);
  assert.equal(result.bestPattern.windows,10);
  assert.equal(result.specificity.status,'specificity-supported');
  assert.ok(result.specificity.lift>=1.75);
  assert.equal(result.provider.status,'encounter-supported');
  assert.equal(result.topology.dominant,'same-edge');
  assert.equal(result.topology.consistent,true);
  assert.equal(result.temporal.status,'strong');
  assert.equal(result.mechanical.status,'mechanically-supported');
  assert.equal(result.promotion.eligible,false);
  assert.equal(result.promotion.automatic,false);
});

test('v3.9.4 not-listed-by-lorrgs is weak negative evidence, never a hard contradiction',()=>{
  const result=verifySemanticProbeEvidenceV2({
    signalId:TARGET,sourceEvidence:sourceEvidence(),backgroundEvidence:backgroundEvidence({specificEvery:10}),
    abilityKnowledge:{abilities:[{abilityId:SPECIFIC,encounterAssociation:{status:'not-listed-by-lorrgs',support:[]}}]},
  });
  assert.equal(result.provider.status,'not-listed-secondary');
  assert.equal(result.provider.hardContradiction,false);
  assert.equal(result.specificity.status,'specificity-supported');
  assert.equal(result.mechanical.status,'mechanically-supported','consistent actor topology may support the candidate without turning a third-party omission into contradiction');
});

test('v3.9.4 stored evidence reconstruction preserves actor topology and can derive zero-WCL outer flanks only from wider cached contexts',()=>{
  const anchorTs=50000;
  const records=[
    {kind:'anchor',signalId:TARGET,source:'source-a',reportCode:'RA',pagination:{complete:true},streams:{enemyCasts:[{timestamp:anchorTs,type:'cast',abilityId:TARGET,sourceID:10,targetID:20}]}},
    {kind:'context',signalId:TARGET,source:'source-a',reportCode:'RA',fightID:3,anchorTimestamp:anchorTs,windowMs:2500,pagination:{complete:true},streams:{buffs:[{timestamp:anchorTs-400,type:'refreshbuff',abilityId:SPECIFIC,sourceID:10,targetID:20}]}},
    {kind:'context',signalId:TARGET,source:'source-a',reportCode:'RA',fightID:3,anchorTimestamp:anchorTs,windowMs:5000,pagination:{complete:true},streams:{buffs:[{timestamp:anchorTs-400,type:'refreshbuff',abilityId:SPECIFIC,sourceID:10,targetID:20},{timestamp:anchorTs-4000,type:'refreshbuff',abilityId:NOISE,sourceID:30,targetID:40}]}},
  ];
  const stored=buildStoredSemanticSourceEvidenceV2({signalId:TARGET,evidenceRecords:records});
  assert.equal(stored.summary.sources,1);
  assert.ok(stored.summary.contexts>=1);
  assert.equal(stored.sourceEvidence[0].anchorOccurrences[0].sourceID,10);
  const flank=buildStoredFlankBackgroundEvidenceV2({signalId:TARGET,evidenceRecords:records,innerRadiusMs:2500});
  assert.equal(flank.summary.wclCalls,0);
  assert.equal(flank.summary.contexts,2);
  assert.equal(flank.backgroundEvidence[0].contexts[0].backgroundMethod,'cached-before-flank');
});
