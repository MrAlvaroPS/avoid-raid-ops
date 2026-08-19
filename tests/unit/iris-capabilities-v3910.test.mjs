import test from 'node:test';
import assert from 'node:assert/strict';
import { getIrisCapabilityContractV3910,findIrisCapabilityV3910 } from '../../server/iris/capability-contract-v3910.mjs';

test('v3.9.10 capability overlay exposes generic Holdout automation without claiming combat acquisition exists',()=>{
  const contract=getIrisCapabilityContractV3910();
  assert.equal(contract.release,'3.9.10');
  assert.match(contract.invariants.bossAgnosticGlobalLearning,/encounter\+difficulty\+partition/i);
  assert.match(contract.invariants.holdoutSourceDiscovery,/may not inspect candidate combat outcomes/i);

  const preview=findIrisCapabilityV3910('corpus.untouched-holdout.source-discovery-preview');
  const discovery=findIrisCapabilityV3910('corpus.untouched-holdout.source-discovery');
  const reserve=findIrisCapabilityV3910('corpus.untouched-holdout.reserve');
  const evaluate=findIrisCapabilityV3910('corpus.untouched-holdout.evaluate');
  const acquire=findIrisCapabilityV3910('corpus.untouched-holdout.acquire-combat-evidence');

  assert.equal(preview.status,'available');
  assert.equal(preview.autonomy,'automatic');
  assert.equal(discovery.status,'available');
  assert.equal(discovery.autonomy,'bounded');
  assert.match(discovery.description,/combat event\/table queries are forbidden/i);
  assert.equal(reserve.status,'available');
  assert.equal(evaluate.status,'available');
  assert.equal(acquire.status,'planned');
  assert.equal(acquire.autonomy,'unavailable');
  assert.match(acquire.description,/must not substitute manual boss-specific/i);
});
