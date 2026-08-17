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

test('overall Reliability registry excludes parse/output and peer-group scoring',()=>{
  const overall=RELIABILITY_METRIC_REGISTRY[RELIABILITY_METRIC_IDS.overall];
  assert.ok(overall.excludes.includes('DPS'));
  assert.ok(overall.excludes.includes('HPS'));
  assert.ok(overall.excludes.includes('parse percentile'));
  assert.ok(overall.excludes.includes('peer-group performance as a scoring prior'));
  assert.deepEqual([...overall.mandatoryDimensions],['mechanics','survival','defensives']);
  assert.match(overall.formula,/fixed versioned scoring priors/);
  assert.match(overall.formula,/peers never enter the score/);
});

test('dimension registries require complete/observable opportunity populations',()=>{
  const mechanics=RELIABILITY_METRIC_REGISTRY[RELIABILITY_METRIC_IDS.mechanics];
  const survival=RELIABILITY_METRIC_REGISTRY[RELIABILITY_METRIC_IDS.survival];
  const defensives=RELIABILITY_METRIC_REGISTRY[RELIABILITY_METRIC_IDS.defensives];
  assert.match(mechanics.population,/complete, observable, player-owned/);
  assert.match(survival.population,/complete meaningful-death source/);
  assert.match(defensives.population,/confirmed personal-defensive availability and observable outcome/);
});

test('peer delta is explanatory only and adaptation is not another base-score dimension',()=>{
  const peer=RELIABILITY_METRIC_REGISTRY[RELIABILITY_METRIC_IDS.peerDelta];
  const adaptation=RELIABILITY_METRIC_REGISTRY[RELIABILITY_METRIC_IDS.adaptation];
  assert.match(peer.formula,/never feeds absolute Reliability/);
  assert.match(adaptation.scoringRole,/never an additional base-score penalty/);
});
