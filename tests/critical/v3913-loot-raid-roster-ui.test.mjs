import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Loot v3.9.13.2 is raid-wide, history-roster scoped and simulates one raider at a time',async()=>{
  const [index,runtime,css]=await Promise.all([
    readFile(new URL('../../index.html',import.meta.url),'utf8'),
    readFile(new URL('../../public/loot-runtime-v39132.js',import.meta.url),'utf8'),
    readFile(new URL('../../public/raidops-v3913-loot-v2.css',import.meta.url),'utf8'),
  ]);
  assert.match(index,/loot-runtime-v39132\.js\?v=3\.9\.13\.2/);
  assert.doesNotMatch(index,/loot-runtime-v3913\.js\?v=3\.9\.13\.1/);
  assert.match(runtime,/confirmedFromHomeLogs/);
  assert.match(runtime,/guild-directory-only characters stay out/i);
  assert.match(runtime,/UPDATE RAID HISTORY/);
  assert.match(runtime,/ENGLISH \/ ESPAÑOL \/ ID/);
  assert.doesNotMatch(runtime,/data-loot-boss/);
  assert.match(runtime,/players:\[playerPayload\(player\)\]/);
  assert.match(runtime,/data-loot-sim=/);
  assert.match(css,/\.loot-roster-panel\{width:100%/);
  assert.match(css,/\.loot-table-wrap\{width:100%;overflow-x:auto/);
});
