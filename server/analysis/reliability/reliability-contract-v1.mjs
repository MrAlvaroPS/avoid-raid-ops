export const RELIABILITY_CONTRACT_VERSION='reliability-v1.0.0';

export const RELIABILITY_SCOPE=Object.freeze({
  encounter:'encounter+difficulty+partition',
  currentFormPulls:20,
  parsePolicy:'excluded-from-reliability-score',
  scoreMeaning:'Estimated repeatability of correct assigned execution in comparable progression pulls.',
});

export const RELIABILITY_DIMENSIONS=Object.freeze({
  mechanics:{id:'reliability.mechanics.v1',weight:0.35,priorRate:0.86,priorStrength:12,critical:true},
  survival:{id:'reliability.survival.v1',weight:0.25,priorRate:0.88,priorStrength:10,critical:true},
  defensives:{id:'reliability.defensives.v1',weight:0.20,priorRate:0.82,priorStrength:10,critical:false},
  utility:{id:'reliability.utility.v1',weight:0.10,priorRate:0.88,priorStrength:8,critical:false},
  adaptation:{id:'reliability.adaptation.v1',weight:0.10,priorRate:0.80,priorStrength:8,critical:false},
});

export const RELIABILITY_POLICY=Object.freeze({
  minimumPublishedDimensions:3,
  requiredPublishedDimensions:['mechanics','survival'],
  minimumPublishedEffectiveOpportunities:30,
  minimumPublishedNights:2,
  minimumPublishedEvidenceCoverage:0.65,
  highConfidenceEffectiveOpportunities:60,
  highConfidenceNights:3,
  highConfidenceCoverage:0.85,
  recentHalfLifePulls:20,
  firstExposureSeverityMultiplier:0.45,
  secondExposureSeverityMultiplier:0.72,
  repeatedFailureMultiplier:1.25,
  deathLinkedMultiplier:1.35,
  firstDeathMultiplier:1.20,
  lowConfidenceEvidenceWeight:0.35,
  mediumConfidenceEvidenceWeight:0.70,
  highConfidenceEvidenceWeight:1,
  confirmedEvidenceWeight:1,
  peerMinimumPlayers:5,
  peerFallbackOrder:['same-spec-role','same-role','guild'],
});

export const RELIABILITY_METRIC_IDS=Object.freeze({
  overall:'reliability.overall.v1',
  confidence:'reliability.confidence.v1',
  evidenceCoverage:'reliability.evidence_coverage.v1',
  peerComparison:'reliability.peer_comparison.v1',
  explanation:'reliability.explanation.v1',
  performanceContext:'player.performance_context.v1',
});

export function assertReliabilityContract(){
  const weights=Object.values(RELIABILITY_DIMENSIONS).reduce((sum,row)=>sum+row.weight,0);
  if(Math.abs(weights-1)>1e-9)throw new Error(`Reliability dimension weights must sum to 1; got ${weights}`);
  for(const [key,row] of Object.entries(RELIABILITY_DIMENSIONS)){
    if(!(row.weight>0))throw new Error(`Reliability dimension ${key} has invalid weight`);
    if(!(row.priorRate>=0&&row.priorRate<=1))throw new Error(`Reliability dimension ${key} has invalid priorRate`);
    if(!(row.priorStrength>0))throw new Error(`Reliability dimension ${key} has invalid priorStrength`);
  }
  return true;
}

assertReliabilityContract();
