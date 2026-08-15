import { PROGRESS_METRICS_VERSION, PROGRESS_METRIC_POLICY } from './progress-metrics-v1.mjs';

/**
 * Stable semantic identifiers for Progress metrics.
 *
 * Consumers should share these IDs when the denominator/population/formula is
 * the same. A materially different formula gets a new ID/version instead of
 * silently changing the meaning of an existing metric.
 */
export const PROGRESS_METRIC_IDS=Object.freeze({
  totalPulls:'progress.total_pulls.v1',
  bestPull:'progress.best_pull.v1',
  deepPullRate:'progress.deep_pull_rate.v1',
  consistencyGap:'progress.consistency_gap.v1',
  breakthroughAge:'progress.breakthrough_age.v1',
  stageConversion:'progress.stage_conversion.v1',
  nightRetention:'progress.night_retention.v1',
  raidThroughput:'progress.raid_throughput.v1',
  nightSummary:'progress.night_summary.v1',
  stageMatrix:'progress.stage_matrix.v1',
  progressionState:'progress.state.v1'
});

export const PROGRESS_METRIC_REGISTRY=Object.freeze({
  version:PROGRESS_METRICS_VERSION,
  policy:PROGRESS_METRIC_POLICY,
  metrics:Object.freeze({
    [PROGRESS_METRIC_IDS.totalPulls]:Object.freeze({scope:'canonical-pulls',direction:'descriptive',modelPath:'totals.pulls'}),
    [PROGRESS_METRIC_IDS.bestPull]:Object.freeze({scope:'progress-scored-pulls',direction:'lower-is-deeper',modelPath:'bestPull.fightPercentage'}),
    [PROGRESS_METRIC_IDS.deepPullRate]:Object.freeze({scope:'latest-scored-block',direction:'higher-is-better',modelPath:'block.currentDeepRatePct'}),
    [PROGRESS_METRIC_IDS.consistencyGap]:Object.freeze({scope:'latest-scored-block',direction:'lower-is-better',modelPath:'block.consistencyGapPp'}),
    [PROGRESS_METRIC_IDS.breakthroughAge]:Object.freeze({scope:'canonical-history',direction:'lower-is-more-recent',modelPath:'breakthrough'}),
    [PROGRESS_METRIC_IDS.stageConversion]:Object.freeze({scope:'latest-canonical-block',direction:'higher-is-better',modelPath:'health.phaseConversionPct'}),
    [PROGRESS_METRIC_IDS.nightRetention]:Object.freeze({scope:'latest-two-valid-nights',direction:'lower-recovery-cost-is-better',modelPath:'health.retention'}),
    [PROGRESS_METRIC_IDS.raidThroughput]:Object.freeze({scope:'latest-timestamped-night',direction:'contextual',modelPath:'health.throughput'}),
    [PROGRESS_METRIC_IDS.nightSummary]:Object.freeze({scope:'canonical-raid-session',direction:'descriptive',modelPath:'nights'}),
    [PROGRESS_METRIC_IDS.stageMatrix]:Object.freeze({scope:'canonical-history-window',direction:'higher-stage-repeatability-is-better',modelPath:'matrix'}),
    [PROGRESS_METRIC_IDS.progressionState]:Object.freeze({scope:'canonical-model',direction:'descriptive-synthesis',modelPath:'state'})
  })
});
