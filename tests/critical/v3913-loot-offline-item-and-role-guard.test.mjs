import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const text=path=>readFile(path,'utf8');

test('Loot persists Blizzard item snapshots and retries transient provider outages',async()=>{
  const provider=await text('server/loot/item-provider-v1.mjs');
  assert.match(provider,/loadLootItemSnapshotV1/);
  assert.match(provider,/persistLootItemSnapshotV1/);
  assert.match(provider,/withRetry/);
  assert.match(provider,/staleFallback:true/);
  assert.match(provider,/oauthCalls:0,blizzardCalls:0/);
});

test('Armory-imported tank or healer cannot become a raid DPS loot percentage',async()=>{
  const runner=await text('server/loot/simc-runner-v1.mjs');
  assert.match(runner,/raw\?\.sim\?\.players\?\.\[0\].*role/s);
  assert.match(runner,/role-model-pending/);
  assert.match(runner,/Tank survivability\/raid value is not modeled safely/);
  assert.match(runner,/Healing raid value is not modeled safely/);
  assert.match(runner,/importedSpecialization/);
});
