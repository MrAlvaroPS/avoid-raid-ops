import { RELIABILITY_METRIC_IDS,RELIABILITY_MODEL_VERSION,RELIABILITY_POLICY } from './reliability-policy-v1.mjs';

export const RELIABILITY_METRIC_REGISTRY=Object.freeze({
  [RELIABILITY_METRIC_IDS.overall]:Object.freeze({
    id:RELIABILITY_METRIC_IDS.overall,version:RELIABILITY_MODEL_VERSION,
    label:'Reliability',unit:'score-0-100',
    population:'published player Reliability dimensions under one encounter/difficulty/partition context',
    formula:'sum(componentScore * effectiveRoleWeight) after publication gates; missing optional weights renormalize only after >=75% scored-weight coverage',
    excludes:['DPS','HPS','parse percentile','ranking','raw throughput','attendance as a quality signal']
  }),
  [RELIABILITY_METRIC_IDS.mechanics]:Object.freeze({
    id:RELIABILITY_METRIC_IDS.mechanics,version:RELIABILITY_MODEL_VERSION,
    label:'Mechanics',unit:'score-0-100',
    population:'proven player-owned mechanic opportunities',
    formula:'Bayesian posterior of severity-weighted clean opportunity mass; failed mass discounted by evidence confidence',
    minimumMass:RELIABILITY_POLICY.publication.minMechanicOpportunityMass
  }),
  [RELIABILITY_METRIC_IDS.survival]:Object.freeze({
    id:RELIABILITY_METRIC_IDS.survival,version:RELIABILITY_MODEL_VERSION,
    label:'Survival',unit:'score-0-100',
    population:'eligible pulls attended by the player',
    formula:'Bayesian posterior where first meaningful death penalty=1.0, later meaningful pre-wipe death penalty=0.5, no meaningful death=0',
    minimumMass:RELIABILITY_POLICY.publication.minSurvivalPulls
  }),
  [RELIABILITY_METRIC_IDS.defensives]:Object.freeze({
    id:RELIABILITY_METRIC_IDS.defensives,version:RELIABILITY_MODEL_VERSION,
    label:'Defensives',unit:'score-0-100',
    population:'danger windows with confirmed personal-defensive availability',
    formula:'Bayesian posterior of danger-weighted on-time defensive opportunities; unknown availability is excluded',
    minimumMass:RELIABILITY_POLICY.publication.minDefensiveOpportunityMass
  }),
  [RELIABILITY_METRIC_IDS.duties]:Object.freeze({
    id:RELIABILITY_METRIC_IDS.duties,version:RELIABILITY_MODEL_VERSION,
    label:'Duties',unit:'score-0-100',
    population:'explicitly assigned and observable player duty opportunities',
    formula:'Bayesian posterior of importance-weighted assigned duty success',
    minimumMass:RELIABILITY_POLICY.publication.minDutyOpportunityMass
  }),
  [RELIABILITY_METRIC_IDS.adaptation]:Object.freeze({
    id:RELIABILITY_METRIC_IDS.adaptation,version:RELIABILITY_MODEL_VERSION,
    label:'Adaptation signal',unit:'rate',
    population:'later opportunities for a mechanic after the player has previously failed it',
    formula:'repeatedFailures / repeatOpportunities',
    scoringRole:'explanatory-only; never an additional base-score penalty'
  }),
  [RELIABILITY_METRIC_IDS.confidence]:Object.freeze({
    id:RELIABILITY_METRIC_IDS.confidence,version:RELIABILITY_MODEL_VERSION,
    label:'Reliability confidence',unit:'low-medium-high',
    population:'profile evidence coverage',
    formula:'threshold gate over pulls, nights, effective opportunities, scored-weight coverage and identity quality'
  }),
  [RELIABILITY_METRIC_IDS.peerDelta]:Object.freeze({
    id:RELIABILITY_METRIC_IDS.peerDelta,version:RELIABILITY_MODEL_VERSION,
    label:'Peer delta',unit:'score-points',
    population:'same metric/version and compatible peer context',
    formula:'player component/overall score minus labeled peer baseline; overall comparison requires same scored dimensions and >=MEDIUM confidence'
  })
});

export function reliabilityMetricDefinition(id){return RELIABILITY_METRIC_REGISTRY[id]||null;}
