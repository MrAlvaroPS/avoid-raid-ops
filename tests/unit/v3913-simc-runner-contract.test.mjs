import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('managed SimC state schema remains independent from manager code version',async()=>{
  const src=await readFile('server/loot/simc-manager-v1.mjs','utf8');
  assert.match(src,/SIMC_MANAGER_VERSION='simc-nightly-manager-v1\.2'/);
  assert.match(src,/SIMC_STATE_VERSION='simc-nightly-state-v1'/);
  assert.match(src,/state\.version=SIMC_STATE_VERSION/);
});

test('Battle.net fallback credentials are temporary and derived from existing Blizzard env',async()=>{
  const src=await readFile('server/loot/simc-runner-v1.mjs','utf8');
  assert.match(src,/BLIZZARD_CLIENT_ID/);
  assert.match(src,/BLIZZARD_CLIENT_SECRET/);
  assert.match(src,/apikey\.txt/);
  assert.match(src,/persisted:false/);
  assert.match(src,/rm\(dir,\{recursive:true,force:true\}/);
});
