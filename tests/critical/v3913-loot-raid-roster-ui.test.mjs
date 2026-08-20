import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Loot v3.9.13.14 keeps clean item icons while original text-era Wowhead anchors remain real hover targets',async()=>{
  const [index,loader,runtime,overlay,css]=await Promise.all([
    readFile(new URL('../../index.html',import.meta.url),'utf8'),
    readFile(new URL('../../public/loot-runtime-v39132.js',import.meta.url),'utf8'),
    readFile(new URL('../../public/loot-runtime-v39137.js',import.meta.url),'utf8'),
    readFile(new URL('../../public/loot-runtime-v391310-overlay.js',import.meta.url),'utf8'),
    readFile(new URL('../../public/raidops-v3913-loot-v2.css',import.meta.url),'utf8'),
  ]);
  assert.match(index,/loot-runtime-v39132\.js\?v=3\.9\.13\.14/);
  assert.match(index,/wowhead_tooltips\s*=\s*whTooltips/);
  assert.match(loader,/loot-runtime-v39137\.js\?v=3\.9\.13\.10/);
  assert.match(loader,/loot-runtime-v391310-overlay\.js\?v=3\.9\.13\.14/);
  assert.match(runtime,/confirmedFromHomeLogs/);
  assert.match(runtime,/Directory-only guild members never enter allocation/i);
  assert.match(runtime,/HOME HISTORY/);
  assert.match(runtime,/ENGLISH \/ ESPAÑOL \/ ID/);
  assert.match(runtime,/CURRENT RAID LOOT CATALOG/);
  assert.doesNotMatch(runtime,/data-loot-boss/);
  assert.match(runtime,/players:\[playerPayload\(player\)\]/);
  assert.match(runtime,/itemLevelManual/);
  assert.match(runtime,/SIM INPUT · ILVL/);
  assert.match(runtime,/MIX 50\/50/);
  assert.match(runtime,/currentSlot/);
  assert.match(runtime,/importedSpecialization/);
  assert.match(runtime,/specCompatible/);
  assert.match(runtime,/allocationEligible/);
  assert.match(overlay,/loot-wowhead-icon-wrap/);
  assert.match(overlay,/loot-wowhead-tooltip-hitbox/);
  assert.match(overlay,/original text-era Wowhead anchor as a real 34x34 hover target/);
  assert.match(overlay,/source\.classList\.add\('loot-wowhead-tooltip-hitbox'\)/);
  assert.match(overlay,/wrap\.append\(visual,source\)/);
  assert.match(overlay,/pointer-events:none/,'the custom visual icon must not steal hover from the original Wowhead anchor');
  assert.doesNotMatch(overlay,/loot-wowhead-tooltip-hitbox\{[^}]*opacity\s*:\s*0/s,'the real Wowhead anchor must not be opacity-zero');
  assert.match(overlay,/color:transparent!important/);
  assert.match(overlay,/font-size:0!important/);
  assert.match(overlay,/\$WowheadPower/);
  assert.match(overlay,/refreshLinks/);
  assert.match(css,/\.loot-roster-panel\{width:100%/);
  assert.match(css,/\.loot-table-wrap\{width:100%;overflow-x:auto/);
});
