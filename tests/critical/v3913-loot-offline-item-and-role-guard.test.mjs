import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const text=path=>readFile(path,'utf8');

test('Loot item snapshots remain offline-first and locally migrate Blizzard stat metadata',async()=>{
  const provider=await text('server/loot/item-provider-v1.mjs');
  assert.match(provider,/loadLootItemSnapshotV1/);
  assert.match(provider,/persistLootItemSnapshotV1/);
  assert.match(provider,/withRetry/);
  assert.match(provider,/staleFallback:true/);
  assert.match(provider,/migratedFromRaw/);
  assert.match(provider,/primaryStats/);
  assert.match(provider,/oauthCalls:0,blizzardCalls:0/);
});

test('physical equipability, active-spec fit, and SimC eligibility are distinct gates',async()=>{
  const [eligibility,service]=await Promise.all([text('server/loot/eligibility-v1.mjs'),text('server/services/loot-service.mjs')]);
  assert.match(eligibility,/physicalEligible/);
  assert.match(eligibility,/specCompatible/);
  assert.match(eligibility,/allocationEligible/);
  assert.match(eligibility,/simEligible/);
  assert.match(eligibility,/beastmastery/);
  assert.match(service,/eligibility\.simEligible===true/);
  assert.match(service,/physicalEligibilitySeparateFromSpecFit:true/);
});

test('Armory-imported tank or healer cannot become a raid DPS loot percentage',async()=>{
  const runner=await text('server/loot/simc-runner-v1.mjs');
  assert.match(runner,/raw\?\.sim\?\.players\?\.\[0\].*role/s);
  assert.match(runner,/role-model-pending/);
  assert.match(runner,/Tank survivability\/raid value is not modeled safely/);
  assert.match(runner,/Healing raid value is not modeled safely/);
  assert.match(runner,/importedSpecialization/);
  assert.match(runner,/simulatedItemLevel:finite\(itemLevel\)/);
  assert.match(runner,/currentSlot:comparisonGear\(currentGear,slots\)/);
});
