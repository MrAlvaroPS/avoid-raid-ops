import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Loot search defaults to the persisted current-raid Blizzard Journal catalog',async()=>{
  const [service,catalog,runtime]=await Promise.all([
    readFile(new URL('../../server/services/loot-service.mjs',import.meta.url),'utf8'),
    readFile(new URL('../../server/loot/raid-item-catalog-v1.mjs',import.meta.url),'utf8'),
    readFile(new URL('../../public/loot-runtime-v39134.js',import.meta.url),'utf8'),
  ]);
  assert.match(service,/searchRaidLootCatalogV1\(q/);
  assert.match(service,/global.*===.*1.*searchLootItemsV1/s);
  assert.match(catalog,/journal\?\.items/);
  assert.match(catalog,/en_US/);
  assert.match(catalog,/es_ES/);
  assert.match(catalog,/currentRaidOnly:true/);
  assert.match(catalog,/zoneTrashAndBoECompletenessNotGuaranteed:true/);
  assert.match(runtime,/English\/Spanish item name or exact item ID/i);
  assert.match(runtime,/CURRENT RAID LOOT CATALOG/);
  assert.doesNotMatch(runtime,/data-loot-boss/);
});
