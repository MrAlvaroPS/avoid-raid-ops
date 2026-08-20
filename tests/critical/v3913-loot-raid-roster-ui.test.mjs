import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Loot v3.9.13.11 is current-raid scoped, HOME-history roster scoped and simulates one valid candidate at a time',async()=>{
  const [index,loader,runtime,overlay,css]=await Promise.all([
    readFile(new URL('../../index.html',import.meta.url),'utf8'),
    readFile(new URL('../../public/loot-runtime-v39132.js',import.meta.url),'utf8'),
    readFile(new URL('../../public/loot-runtime-v39137.js',import.meta.url),'utf8'),
    readFile(new URL('../../public/loot-runtime-v391310-overlay.js',import.meta.url),'utf8'),
    readFile(new URL('../../public/raidops-v3913-loot-v2.css',import.meta.url),'utf8'),
  ]);
  assert.match(index,/loot-runtime-v39132\.js\?v=3\.9\.13\.(?:2|11)/);
  assert.match(loader,/loot-runtime-v39137\.js\?v=3\.9\.13\.10/);
  assert.match(loader,/loot-runtime-v391310-overlay\.js\?v=3\.9\.13\.11/);
  assert.match(runtime,/confirmedFromHomeLogs/);
  assert.match(runtime,/Directory-only guild members never enter allocation/i);
  assert.match(runtime,/HOME HISTORY/);
  assert.match(runtime,/ENGLISH \/ ESPAÑOL \/ ID/);
  assert.match(runtime,/CURRENT RAID LOOT CATALOG/);
  assert.doesNotMatch(runtime,/data-loot-boss/);
  assert.doesNotMatch(runtime,/refreshRaidHistory/);
  assert.doesNotMatch(runtime,/data-loot-history-refresh/);
  assert.match(runtime,/avoid:home-history-ready/);
  assert.match(runtime,/players:\[playerPayload\(player\)\]/);
  assert.match(runtime,/data-loot-sim=/);
  assert.match(runtime,/itemLevelManual/);
  assert.match(runtime,/SIM INPUT · ILVL/);
  assert.match(runtime,/SIM ILVL/);
  assert.match(runtime,/MIX 50\/50/);
  assert.match(runtime,/currentSlot/);
  assert.match(runtime,/importedSpecialization/);
  assert.match(runtime,/AVAILABLE AFTER SIM \/ COMBATANTINFO/);
  assert.match(runtime,/specCompatible/);
  assert.match(runtime,/allocationEligible/);
  assert.match(runtime,/SPEC INCOMPATIBLE/);
  assert.match(runtime,/elig\?\.simEligible!==true/);
  assert.match(overlay,/loot-wowhead-icon-link/);
  assert.match(overlay,/SIM ILVL/);
  assert.match(overlay,/\$WowheadPower/);
  assert.match(overlay,/refreshLinks/);
  assert.match(overlay,/sourceHref/);
  assert.match(overlay,/Preserve the exact WCL Wowhead URL/);
  assert.match(overlay,/removeAttribute\('title'\)/);
  assert.doesNotMatch(overlay,/a\.title=/,'native browser titles must not mask the full Wowhead tooltip');
  assert.match(overlay,/data-wowhead/);
  assert.match(css,/\.loot-roster-panel\{width:100%/);
  assert.match(css,/\.loot-table-wrap\{width:100%;overflow-x:auto/);
  assert.match(css,/\.loot-sim-input/);
});
