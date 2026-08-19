import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL v3.9.11 NAVIGATION: raid catalog/provider network requires explicit refresh=1',async()=>{
  const route=await read('routes/api/knowledge/raid-catalog.js');
  assert.match(route,/refresh['"]\)===['"]1['"]/);
  assert.match(route,/let catalog=await readCatalog\(\)/);
  assert.match(route,/if\(force\).*refreshCatalog/s);
  assert.match(route,/includeOfficial&&force\?await ensureRaidOfficialKnowledgeV1/);
  assert.match(route,/normalReadProviderNetwork:false/);
  assert.match(route,/providerRefreshExplicit:true/);
  assert.doesNotMatch(route,/DEFAULT_MAX_AGE_MS|age<=maxAgeMs/);
});
