import test from 'node:test';
import assert from 'node:assert/strict';
import { getIrisCapabilityContractV3910,findIrisCapabilityV3910 } from '../../server/iris/capability-contract-v3910.mjs';

test('v3.9.10 capability overlay exposes raid-first difficulty knowledge and full generic Holdout automation honestly',()=>{
  const contract=getIrisCapabilityContractV3910();
  assert.equal(contract.release,'3.9.10');
  assert.match(contract.invariants.raidBossDifficultyScope,/raid → boss → difficulty/i);
  assert.match(contract.invariants.difficultyIsolation,/never count as Mythic/i);
  assert.match(contract.invariants.difficultyIdentityMapping,/distinct namespaces/i);
  assert.match(contract.invariants.difficultyIdentityMapping,/JournalEncounterXDifficulty and JournalSectionXDifficulty only as applicability restrictions/i);
  assert.match(contract.invariants.bossAgnosticGlobalLearning,/encounter\+difficulty\+partition/i);
  assert.match(contract.invariants.holdoutSourceDiscovery,/may not inspect candidate combat outcomes/i);
  assert.match(contract.invariants.holdoutCombatAcquisition,/exact encounter fight IDs/i);

  const raidCatalog=findIrisCapabilityV3910('knowledge.raid-catalog.current');
  const bootstrap=findIrisCapabilityV3910('knowledge.raid.official-boss-difficulty-bootstrap');
  const mechanics=findIrisCapabilityV3910('knowledge.mechanics.boss-difficulty-read');
  assert.equal(raidCatalog.status,'available');
  assert.equal(raidCatalog.autonomy,'automatic');
  assert.match(raidCatalog.description,/without any combat report/i);
  assert.equal(bootstrap.status,'available');
  assert.match(bootstrap.description,/Difficulty table name\/player-range metadata resolves the client DifficultyID/i);
  assert.match(bootstrap.description,/applicability restrictions/i);
  assert.equal(mechanics.status,'available');
  assert.match(mechanics.description,/Normal, Heroic and Mythic evidence are never substituted/i);

  const sourcePreview=findIrisCapabilityV3910('corpus.untouched-holdout.source-discovery-preview');
  const discovery=findIrisCapabilityV3910('corpus.untouched-holdout.source-discovery');
  const reserve=findIrisCapabilityV3910('corpus.untouched-holdout.reserve');
  const acquisitionPreview=findIrisCapabilityV3910('corpus.untouched-holdout.acquire-combat-evidence-preview');
  const acquire=findIrisCapabilityV3910('corpus.untouched-holdout.acquire-combat-evidence');
  const evaluate=findIrisCapabilityV3910('corpus.untouched-holdout.evaluate');

  assert.equal(sourcePreview.status,'available');
  assert.equal(sourcePreview.autonomy,'automatic');
  assert.equal(discovery.status,'available');
  assert.equal(discovery.autonomy,'bounded');
  assert.match(discovery.description,/combat event\/table queries are forbidden/i);
  assert.equal(reserve.status,'available');
  assert.equal(acquisitionPreview.status,'available');
  assert.equal(acquisitionPreview.autonomy,'automatic');
  assert.equal(acquire.status,'available');
  assert.equal(acquire.autonomy,'bounded');
  assert.match(acquire.description,/source expansion/i);
  assert.match(acquire.description,/automatic Promotion/i);
  assert.equal(evaluate.status,'available');
  assert.match(evaluate.description,/never accepts caller-fabricated holdout evidence/i);
});
