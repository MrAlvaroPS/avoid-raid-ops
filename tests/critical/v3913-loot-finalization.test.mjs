import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('CRITICAL v3.9.13 Loot loader cache-busts the matrix runtime and activates the icon overlay in order',async()=>{
  const loader=await read('public/loot-runtime-v39132.js');
  assert.match(loader,/3\.9\.13\.10/);
  assert.match(loader,/loot-runtime-v39137\.js\?v=3\.9\.13\.10/);
  assert.match(loader,/addEventListener\('load'/);
  assert.match(loader,/loot-runtime-v391310-overlay\.js\?v=3\.9\.13\.10/);
});

test('CRITICAL v3.9.13 Loot selected/current items are iconized by item id without another item-data provider',async()=>{
  const overlay=await read('public/loot-runtime-v391310-overlay.js');
  assert.match(overlay,/wow\.zamimg\.com\/js\/tooltips\.js/);
  assert.match(overlay,/data-wh-iconize-link/);
  assert.match(overlay,/data-wh-icon-size/);
  assert.match(overlay,/refreshLinks/);
  assert.match(overlay,/\.loot-selected/);
  assert.match(overlay,/\.loot-current/);
  assert.match(overlay,/SIM ILVL/);
  assert.doesNotMatch(overlay,/api\.blizzard\.com|\/api\/loot\?item=/);
});

test('CRITICAL v3.9.13 Loot runtime keeps ST, MT5, neutral MIX and explicit simulated ilvl visible',async()=>{
  const runtime=await read('public/loot-runtime-v39137.js');
  const matrix=await read('server/loot/simc-matrix-v1.mjs');
  const runner=await read('server/loot/simc-runner-v1.mjs');
  assert.match(runtime,/MIX 50\/50/);
  assert.match(runtime,/SIM ILVL/);
  assert.match(runtime,/currentSlot/);
  assert.match(matrix,/mixGainPct/);
  assert.match(matrix,/raid_st:0\.5/);
  assert.match(matrix,/raid_mt5:0\.5/);
  assert.match(runner,/raid_st/);
  assert.match(runner,/desiredTargets:1/);
  assert.match(runner,/raid_mt5/);
  assert.match(runner,/desiredTargets:5/);
  assert.match(runner,/simulatedItemLevel/);
});
