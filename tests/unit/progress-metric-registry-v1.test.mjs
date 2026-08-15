import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRESS_METRIC_IDS, PROGRESS_METRIC_REGISTRY } from '../../server/analysis/progression/progress-metric-registry-v1.mjs';
import { PROGRESS_METRIC_POLICY, PROGRESS_METRICS_VERSION } from '../../server/analysis/progression/progress-metrics-v1.mjs';

test('Progress metric registry shares the canonical version and policy object', () => {
  assert.equal(PROGRESS_METRIC_REGISTRY.version,PROGRESS_METRICS_VERSION);
  assert.equal(PROGRESS_METRIC_REGISTRY.policy,PROGRESS_METRIC_POLICY);
});

test('Progress metric IDs are stable semantic contracts', () => {
  assert.equal(PROGRESS_METRIC_IDS.totalPulls,'progress.total_pulls.v1');
  assert.equal(PROGRESS_METRIC_IDS.bestPull,'progress.best_pull.v1');
  assert.equal(PROGRESS_METRIC_IDS.deepPullRate,'progress.deep_pull_rate.v1');
  assert.equal(PROGRESS_METRIC_IDS.consistencyGap,'progress.consistency_gap.v1');
  assert.equal(PROGRESS_METRIC_IDS.nightRetention,'progress.night_retention.v1');
  assert.equal(PROGRESS_METRIC_IDS.raidThroughput,'progress.raid_throughput.v1');
  assert.equal(PROGRESS_METRIC_IDS.progressionState,'progress.state.v1');
  for(const id of Object.values(PROGRESS_METRIC_IDS)) assert.ok(PROGRESS_METRIC_REGISTRY.metrics[id],`registry entry for ${id}`);
});
