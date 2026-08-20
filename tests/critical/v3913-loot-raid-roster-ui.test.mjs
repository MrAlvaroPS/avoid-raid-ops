import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Loot v3.9.13.8 is current-raid scoped, HOME-history roster scoped and simulates one valid candidate at a time',async()=>{
  const [index,loader,runtime,css]=await Promise.all([
    readFile(new URL('../../index.html',import.meta.url),'utf8'),
    readFile(new URL('../../public/loot-runtime-v39132.js',import.meta.url),'utf8'),
    readFile(new URL('../../public/loot-runtime-v39137.js',import.meta.url),'utf8'),
    readFile(new URL('../../public/raidops-v3913-loot-v2.css',import.meta.url),'utf8'),
  ]);
  assert.match(index,/loot-runtime-v39132\.js\?v=3\.9\.13\.2/);
  assert.match(loader,/loot-runtime-v39137\.js\?v=3\.9\.13\.8/);
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
  assert.match(runtime,/currentSlot/);
  assert.match(runtime,/importedSpecialization/);
  assert.match(runtime,/AVAILABLE AFTER SIM \/ COMBATANTINFO/);
  assert.match(runtime,/specCompatible/);
  assert.match(runtime,/allocationEligible/);
  assert.match(runtime,/SPEC INCOMPATIBLE/);
  assert.match(runtime,/elig\?\.simEligible!==true/);
  assert.match(css,/\.loot-roster-panel\{width:100%/);
  assert.match(css,/\.loot-table-wrap\{width:100%;overflow-x:auto/);
  assert.match(css,/\.loot-sim-input/);
});
