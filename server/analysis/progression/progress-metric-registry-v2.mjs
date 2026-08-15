import { PROGRESS_METRICS_VERSION, PROGRESS_METRIC_POLICY } from './progress-metrics-v2.mjs';

/**
 * Stable semantic identifiers for Progress v2.
 * A metric ID encodes its denominator/population/formula contract. Consumers
 * must reuse the same ID instead of reimplementing a similar-looking formula.
 */
export const PROGRESS_METRIC_IDS=Object.freeze({
  totalRawPulls:'progress.total_raw_pulls.v2',
  metricEligiblePulls:'progress.metric_eligible_pulls.v2',
  bestPull:'progress.best_pull.v2',
  deepPullRate:'progress.deep_pull_rate.v2',
  consistencyGap:'progress.consistency_gap.v2',
  breakthroughAge:'progress.breakthrough_age.v2',
  stageConversion:'progress.stage_conversion.v2',
  nightRetention:'progress.night_retention.v2',
  raidThroughput:'progress.raid_throughput.v2',
  nightSummary:'progress.night_summary.v2',
  stageMatrix:'progress.stage_matrix.v2',
  progressionState:'progress.state.v2',
  dataQuality:'progress.data_quality.v2'
});

export const PROGRESS_METRIC_REGISTRY=Object.freeze({
  version:PROGRESS_METRICS_VERSION,
  policy:PROGRESS_METRIC_POLICY,
  populationContract:Object.freeze({
    rawCanonical:'all deduplicated analytical pulls',
    strategic:'progressMetricEligible === true',
    currentForm:`latest ${PROGRESS_METRIC_POLICY.currentFormPulls} metric-eligible pulls`,
    previousForm:`previous ${PROGRESS_METRIC_POLICY.previousFormPulls} metric-eligible pulls`,
    throughput:'raw timestamped analytical pulls in the raid night'
  }),
  metrics:Object.freeze({
    [PROGRESS_METRIC_IDS.totalRawPulls]:Object.freeze({scope:'raw-canonical-history',direction:'descriptive',modelPath:'totals.rawPulls'}),
    [PROGRESS_METRIC_IDS.metricEligiblePulls]:Object.freeze({scope:'metric-eligible-history',direction:'descriptive',modelPath:'totals.metricEligiblePulls'}),
    [PROGRESS_METRIC_IDS.bestPull]:Object.freeze({scope:'metric-eligible-history',direction:'lower-is-deeper',modelPath:'bestPull.fightPercentage'}),
    [PROGRESS_METRIC_IDS.deepPullRate]:Object.freeze({scope:'current-form',direction:'higher-is-better',modelPath:'block.currentDeepRatePct'}),
    [PROGRESS_METRIC_IDS.consistencyGap]:Object.freeze({scope:'current-form',direction:'lower-is-better',modelPath:'block.consistencyGapPp'}),
    [PROGRESS_METRIC_IDS.breakthroughAge]:Object.freeze({scope:'metric-eligible-history',direction:'lower-is-more-recent',modelPath:'breakthrough'}),
    [PROGRESS_METRIC_IDS.stageConversion]:Object.freeze({scope:'current-form',direction:'higher-is-better',modelPath:'health.phaseConversionPct'}),
    [PROGRESS_METRIC_IDS.nightRetention]:Object.freeze({scope:'latest-two-nights-metric-eligible',direction:'lower-recovery-cost-is-better',modelPath:'health.retention'}),
    [PROGRESS_METRIC_IDS.raidThroughput]:Object.freeze({scope:'latest-raw-timestamped-night',direction:'contextual',modelPath:'health.throughput'}),
    [PROGRESS_METRIC_IDS.nightSummary]:Object.freeze({scope:'raid-session-with-metric-eligible-subset',direction:'descriptive',modelPath:'nights'}),
    [PROGRESS_METRIC_IDS.stageMatrix]:Object.freeze({scope:'metric-eligible-history-window',direction:'higher-stage-repeatability-is-better',modelPath:'matrix'}),
    [PROGRESS_METRIC_IDS.progressionState]:Object.freeze({scope:'current-form-synthesis-gated-by-data-quality',direction:'descriptive-synthesis',modelPath:'state'}),
    [PROGRESS_METRIC_IDS.dataQuality]:Object.freeze({scope:'raw-canonical-history',direction:'diagnostic',modelPath:'dataQuality'})
  })
});
