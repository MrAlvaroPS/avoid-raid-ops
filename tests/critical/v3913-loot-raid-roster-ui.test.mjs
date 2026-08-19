import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Loot v3.9.13.4 is current-raid scoped, preserves manual item level and simulates one raider at a time',async()=>{
  const [index,loader,runtime,css]=await Promise.all([
    readFile(new URL('../../index.html',import.meta.url),'utf8'),
    readFile(new URL('../../public/loot-runtime-v39132.js',import.meta.url),'utf8'),
    readFile(new URL('../../public/loot-runtime-v39134.js',import.meta.url),'utf8'),
    readFile(new URL('../../public/raidops-v3913-loot-v2.css',import.meta.url),'utf8'),
  ]);
  assert.match(index,/loot-runtime-v39132\.js\?v=3\.9\.13\.2/);
  assert.match(loader,/loot-runtime-v39134\.js\?v=3\.9\.13\.4/);
  assert.match(runtime,/confirmedFromHomeLogs/);
  assert.match(runtime,/Directory-only guild members never enter allocation/i);
  assert.match(runtime,/HOME HISTORY/);
  assert.match(runtime,/ENGLISH \/ ESPAÑOL \/ ID/);
  assert.match(runtime,/CURRENT RAID LOOT CATALOG/);
  assert.doesNotMatch(runtime,/data-loot-boss/);
  assert.doesNotMatch(runtime,/refreshRaidHistory/);
  assert.doesNotMatch(runtime,/data-loot-history-refresh/);
  assert.match(runtime,/avoid:home-history-ready/);
  assert.match(runtime,/itemLevelManual:false/);
  assert.match(runtime,/if\(!S\.itemLevelManual\)S\.itemLevel=/);
  assert.match(runtime,/const itemLevel=readItemLevelInput\(\)/);
  assert.match(runtime,/action:'simulate',item:S\.item,itemLevel,players:\[playerPayload\(player\)\]/);
  assert.match(runtime,/SIM ILVL/);
  assert.match(runtime,/SIM QUALITY[\s\S]*loot-search-button[\s\S]*data-loot-search/);
  assert.match(css,/grid-template-columns:170px minmax\(320px,1fr\) 115px 145px 82px/);
  assert.match(css,/\.loot-search-button\{align-self:end/);
  assert.match(css,/\.loot-roster-panel\{width:100%/);
  assert.match(css,/\.loot-table-wrap\{width:100%;overflow-x:auto/);
});
