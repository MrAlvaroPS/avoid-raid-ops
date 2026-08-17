import { RELIABILITY_METRIC_IDS,RELIABILITY_MODEL_VERSION,RELIABILITY_POLICY } from './reliability-policy-v1.mjs';

export const RELIABILITY_METRIC_REGISTRY=Object.freeze({
  [RELIABILITY_METRIC_IDS.overall]:Object.freeze({
    id:RELIABILITY_METRIC_IDS.overall,version:RELIABILITY_MODEL_VERSION,
    label:'Reliability',unit:'score-0-100',
    population:'published player execution dimensions under one encounter+difficulty+partition context',
    formula:'sum(componentScore * effectiveRoleWeight) after publication gates; component scores use fixed versioned scoring priors; peers never enter the score',
    mandatoryDimensions:Object.freeze(['mechanics','survival','defensives']),
    excludes:Object.freeze(['DPS','HPS','parse percentile','ranking','raw throughput','attendance as a quality signal','peer-group performance as a scoring prior'])
  }),
  [RELIABILITY_METRIC_IDS.mechanics]:Object.freeze({
    id:RELIABILITY_METRIC_IDS.mechanics,version:RELIABILITY_MODEL_VERSION,
    label:'Mechanics',unit:'score-0-100',
    population:'complete, observable, player-owned mechanic opportunities',
    formula:'fixed-prior Bayesian posterior of severity × evidence-confidence weighted opportunity mass; failed mass uses the lower defensible opportunity/failure confidence',
    minimumMass:RELIABILITY_POLICY.publication.minMechanicOpportunityMass
  }),
  [RELIABILITY_METRIC_IDS.survival]:Object.freeze({
    id:RELIABILITY_METRIC_IDS.survival,version:RELIABILITY_MODEL_VERSION,
    label:'Survival',unit:'score-0-100',
    population:'eligible pulls attended by the player with complete meaningful-death source',
    formula:'fixed-prior Bayesian posterior where first meaningful pre-wipe death penalty=1.0, later meaningful death penalty=0.5, no meaningful death=0',
    minimumMass:RELIABILITY_POLICY.publication.minSurvivalPulls
  }),
  [RELIABILITY_METRIC_IDS.defensives]:Object.freeze({
    id:RELIABILITY_METRIC_IDS.defensives,version:RELIABILITY_MODEL_VERSION,
    label:'Defensives',unit:'score-0-100',
    population:'complete danger windows with confirmed personal-defensive availability and observable outcome',
    formula:'fixed-prior Bayesian posterior of danger × evidence-confidence weighted on-time defensive opportunities; unknown availability/outcome is excluded',
    minimumMass:RELIABILITY_POLICY.publication.minDefensiveOpportunityMass
  }),
  [RELIABILITY_METRIC_IDS.duties]:Object.freeze({
    id:RELIABILITY_METRIC_IDS.duties,version:RELIABILITY_MODEL_VERSION,
    label:'Duties',unit:'score-0-100',
    population:'complete, explicitly assigned and observable player duty opportunities',
    formula:'fixed-prior Bayesian posterior of importance × evidence-confidence weighted assigned duty success',
    minimumMass:RELIABILITY_POLICY.publication.minDutyOpportunityMass,
    publicationRole:'optional dimension; never substitutes for mandatory Defensives'
  }),
  [RELIABILITY_METRIC_IDS.adaptation]:Object.freeze({
    id:RELIABILITY_METRIC_IDS.adaptation,version:RELIABILITY_MODEL_VERSION,
    label:'Adaptation signal',unit:'rate',
    population:'later proven opportunities for a mechanic after the player has previously failed it',
    formula:'repeatedFailures / repeatOpportunities',
    scoringRole:'explanatory-only; never an additional base-score penalty'
  }),
  [RELIABILITY_METRIC_IDS.confidence]:Object.freeze({
    id:RELIABILITY_METRIC_IDS.confidence,version:RELIABILITY_MODEL_VERSION,
    label:'Reliability confidence',unit:'low-medium-high',
    population:'profile evidence coverage',
    formula:'independent threshold gate over pulls, nights, effective opportunities, scored-weight coverage, source completeness and identity quality'
  }),
  [RELIABILITY_METRIC_IDS.peerDelta]:Object.freeze({
    id:RELIABILITY_METRIC_IDS.peerDelta,version:RELIABILITY_MODEL_VERSION,
    label:'Peer delta',unit:'score-points',
    population:'same Reliability metric/version in compatible encounter+difficulty+partition context',
    formula:'player score minus labeled peer benchmark; explanatory only and never feeds absolute Reliability',
    comparisonGate:'overall comparison requires published scores, same model/context/scored dimensions and >=MEDIUM confidence'
  })
});

export function reliabilityMetricDefinition(id){return RELIABILITY_METRIC_REGISTRY[id]||null;}
