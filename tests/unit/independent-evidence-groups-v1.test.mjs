import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndependentEvidenceGroupsV1 } from '../../server/corpus/independent-evidence-groups-v1.mjs';

const pattern='after-1s|debuffs|700002|applydebuff';
const episode={
  episodeId:'episode:9876:5:4:test',
  buildFingerprint:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  empiricalBuildFingerprint:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  scope:{encounterId:9876,difficulty:5,partition:4},
  anchor:{abilityId:700001},
};

const matched=status=>({
  episodeId:episode.episodeId,policyVersion:'matched-null-baseline-policy-v1',baselineSufficient:true,matchedPairs:4,matchedSources:3,
  patternAssessments:[{patternKey:pattern,abilityId:700002,displayName:'State',matchedPairs:4,anchorPrevalence:.75,matchedBackgroundPrevalence:.25,lift:2,prevalenceDelta:.5,status}],
});

function control({source,reportCode,referenceTimestamp=10000,anchorHit=true,nullHit=false}){
  return{
    kind:'matched-null-control',source,reportCode,fightID:1,referenceTimestamp,
    anchorObservedPatternKeys:anchorHit?[pattern]:[],
    streams:{debuffs:nullHit?[{timestamp:referenceTimestamp+500,type:'applydebuff',abilityId:700002}]:[]},
    pagination:{complete:true},validNull:true,
    evidenceContract:{targetSignalGuardValidated:true,innerControlEventsOnly:true,pairedAnchorComparison:true,anchorContextCoversEpisodeRadius:true,controlCoversEpisodeRadius:true},
  };
}

test('Matched Null-supported pattern is grouped by independent source identity, not by report count',()=>{
  const result=buildIndependentEvidenceGroupsV1({
    episode,matchedNullEvaluation:matched('matched-specificity-supported'),
    controlRecords:[
      control({source:'guild:1',reportCode:'A'}),
      control({source:'guild:1',reportCode:'B',referenceTimestamp:20000}),
      control({source:'guild:2',reportCode:'C'}),
      control({source:'user:3',reportCode:'D'}),
    ],
  });
  assert.equal(result.summary.matchedSupportedPatterns,1);
  assert.equal(result.summary.independentSources,3);
  assert.equal(result.patterns[0].independentGroups.length,3);
  assert.equal(result.patterns[0].independentGroups.find(row=>row.source==='guild:1').matchedPairs,2);
  assert.equal(result.patterns[0].status,'independent-groups-evidence-available');
  assert.equal(result.promotionContribution.independentEvidenceGroupsGate,'evidence-available');
  assert.equal(result.evidenceContract.statisticalStabilityNotYetClaimed,true);
  assert.equal(result.evidenceContract.homeAvoidDataUsed,false);
  assert.equal(result.evidenceContract.automaticPromotion,false);
});

test('Earlier diagnostic neighbors cannot enter Evidence Groups when Matched Null did not support them',()=>{
  for(const status of ['matched-specificity-partial','matched-background-noise','matched-baseline-insufficient']){
    const result=buildIndependentEvidenceGroupsV1({
      episode,matchedNullEvaluation:matched(status),
      controlRecords:[control({source:'guild:1',reportCode:'A'}),control({source:'guild:2',reportCode:'B'}),control({source:'guild:3',reportCode:'C'})],
    });
    assert.equal(result.patterns.length,0,status);
    assert.equal(result.summary.matchedSupportedPatterns,0,status);
    assert.equal(result.promotionContribution.independentEvidenceGroupsGate,'not-eligible-no-matched-supported-pattern',status);
  }
});

test('Evidence Groups records source-level direction but deliberately does not claim statistical stability',()=>{
  const result=buildIndependentEvidenceGroupsV1({
    episode,matchedNullEvaluation:matched('matched-specificity-supported'),
    controlRecords:[
      control({source:'guild:1',reportCode:'A',anchorHit:true,nullHit:false}),
      control({source:'guild:2',reportCode:'B',anchorHit:false,nullHit:true}),
      control({source:'guild:3',reportCode:'C',anchorHit:true,nullHit:true}),
    ],
  });
  const groups=Object.fromEntries(result.patterns[0].independentGroups.map(row=>[row.source,row]));
  assert.equal(groups['guild:1'].direction,'supportive-direction');
  assert.equal(groups['guild:2'].direction,'contradictory-direction');
  assert.equal(groups['guild:3'].direction,'neutral-direction');
  assert.equal(result.patterns[0].stabilityClaimed,false);
  assert.equal(result.patterns[0].promotionEligible,false);
});
