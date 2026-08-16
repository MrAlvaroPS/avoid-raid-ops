import test from 'node:test';
import assert from 'node:assert/strict';
import { RELIABILITY_METRIC_REGISTRY,reliabilityMetricDefinition } from '../../server/analysis/reliability/reliability-metric-registry-v1.mjs';
import { RELIABILITY_METRIC_IDS,RELIABILITY_MODEL_VERSION } from '../../server/analysis/reliability/reliability-policy-v1.mjs';

test('Reliability metric IDs resolve to one shared model version',()=>{
  for(const id of Object.values(RELIABILITY_METRIC_IDS)){
    const def=reliabilityMetricDefinition(id);
    assert.ok(def,`missing metric definition ${id}`);
    assert.equal(def.version,RELIABILITY_MODEL_VERSION);
  }
});

test('overall Reliability registry explicitly excludes parse/output',()=>{
  const overall=RELIABILITY_METRIC_REGISTRY[RELIABILITY_METRIC_IDS.overall];
  assert.ok(overall.excludes.includes('DPS'));
  assert.ok(overall.excludes.includes('HPS'));
  assert.ok(overall.excludes.includes('parse percentile'));
  assert.match(overall.formula,/publication gates/);
});

test('adaptation is a signal and not another base-score dimension',()=>{
  const adaptation=RELIABILITY_METRIC_REGISTRY[RELIABILITY_METRIC_IDS.adaptation];
  assert.match(adaptation.scoringRole,/never an additional base-score penalty/);
});
