export const RELIABILITY_MODEL_VERSION='1.1.0';

export const RELIABILITY_METRIC_IDS=Object.freeze({
  overall:'reliability.overall.v1',
  mechanics:'reliability.mechanics.v1',
  survival:'reliability.survival.v1',
  defensives:'reliability.defensives.v1',
  duties:'reliability.duties.v1',
  adaptation:'reliability.adaptation_signal.v1',
  confidence:'reliability.confidence.v1',
  peerDelta:'reliability.peer_delta.v1'
});

export const RELIABILITY_POLICY=Object.freeze({
  version:RELIABILITY_MODEL_VERSION,
  purpose:'dependable-execution-and-availability-under-observable-progression-responsibility',
  parsePolicy:'performance-and-parse-are-context-only-and-never-enter-reliability-score',

  // Base weights only. Optional Duties may renormalize after all mandatory
  // dimensions and the publication coverage gate are satisfied.
  roleWeights:Object.freeze({
    DPS:Object.freeze({mechanics:0.40,survival:0.25,defensives:0.20,duties:0.15}),
    HEAL:Object.freeze({mechanics:0.35,survival:0.25,defensives:0.25,duties:0.15}),
    TANK:Object.freeze({mechanics:0.30,survival:0.30,defensives:0.30,duties:0.10}),
    UNKNOWN:Object.freeze({mechanics:0.40,survival:0.25,defensives:0.20,duties:0.15})
  }),

  // The scoring prior is absolute and versioned. It deliberately does NOT use
  // the current roster/peer median. Otherwise a player's score could change
  // simply because their comparison group changed. Peers are explanatory only.
  priors:Object.freeze({
    equivalentOpportunityStrength:8,
    scoringSuccessRate:Object.freeze({mechanics:0.90,survival:0.92,defensives:0.86,duties:0.90})
  }),

  mechanicSeverityImportance:Object.freeze({1:0.40,2:0.55,3:0.70,4:0.85,5:1.00}),
  evidenceConfidence:Object.freeze({confirmed:1.00,high:0.90,medium:0.65,low:0.35,unknown:0.00}),
  survivalIncidentPenalty:Object.freeze({firstMeaningfulDeath:1.00,meaningfulDeath:0.50}),

  // Survival measures raid availability, not proven blame. Cause evidence is
  // explanatory only; it never adds another Survival penalty.
  survivalSemantics:Object.freeze({kind:'availability-not-causality',causeDoesNotMultiplyPenalty:true}),

  // Recurrence is explanatory and part of the adaptation signal. It does not
  // multiply the base mechanic penalty and therefore cannot double-charge the
  // same failed occurrence.
  adaptation:Object.freeze({
    minimumPriorExposures:2,
    currentFormPulls:10,
    repeatedFailureWarningRate:0.25
  }),

  peerSelection:Object.freeze({
    requireSameEncounterContext:true,
    sameSpecRoleMinPeers:3,
    sameClassRoleMinPeers:3,
    sameRoleMinPeers:5,
    rosterMinPeers:10
  }),

  publication:Object.freeze({
    minPullsAttended:15,
    minNights:2,
    minConfidence:'medium',
    minScoredWeightCoverage:0.75,
    // Defensives is mandatory: execution Reliability is not considered mature
    // until Iris can prove availability rather than infer it from absent casts.
    requiredDimensions:Object.freeze(['mechanics','survival','defensives']),
    minScoredDimensions:3,
    minMechanicOpportunityMass:20,
    minSurvivalPulls:15,
    minDefensiveOpportunityMass:8,
    minDutyOpportunityMass:8
  }),

  confidence:Object.freeze({
    medium:Object.freeze({pulls:20,nights:2,effectiveOpportunities:35,evidenceCoverage:0.70}),
    high:Object.freeze({pulls:35,nights:3,effectiveOpportunities:70,evidenceCoverage:0.85})
  }),

  comparison:Object.freeze({
    requireSameScoredDimensions:true,
    minimumConfidence:'medium'
  }),

  dataTruth:Object.freeze({
    unknownAvailabilityIsNotFailure:true,
    incompleteSourceCannotProveCleanSuccess:true,
    raidWideUnassignedFailureIsNotPlayerFailure:true,
    postWipeDeathsAreNotReliabilityFailures:true,
    duplicateLoggerEvidenceCountsOnce:true,
    probableCausalityDoesNotCreateExtraPenalty:true,
    unverifiedCorpusRulesCannotScore:true,
    peerGroupDoesNotChangeAbsoluteScore:true,
    performanceDoesNotScore:true
  })
});

export const roleKey=role=>{
  const value=String(role||'').toUpperCase();
  if(value==='HEAL'||value==='HEALER')return 'HEAL';
  if(value==='TANK')return 'TANK';
  if(value==='DPS'||value==='MELEE'||value==='RANGED')return 'DPS';
  return 'UNKNOWN';
};

export const reliabilityWeightsForRole=role=>RELIABILITY_POLICY.roleWeights[roleKey(role)]||RELIABILITY_POLICY.roleWeights.UNKNOWN;
