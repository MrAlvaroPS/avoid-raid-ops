import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Loot emits valid id-only SimC item syntax and materializes Armory before profilesets',async()=>{
  const source=await readFile(new URL('../../server/loot/simc-runner-v1.mjs',import.meta.url),'utf8');
  assert.match(source,/return `,\$\{parts\.join\(','\)\}`/);
  assert.match(source,/const itemOpt=`,id=\$\{Number\(item\.id\)\}/);
  assert.match(source,/save=base\.simc/);
  assert.match(source,/source:'battle-net-armory-materialized'/);
  assert.match(source,/profile:\{lines:\['base\.simc'\]/);
});

test('Loot understands SimulationCraft JSON v3 profileset metrics arrays',async()=>{
  const source=await readFile(new URL('../../server/loot/simc-runner-v1.mjs',import.meta.url),'utf8');
  assert.match(source,/Array\.isArray\(row\?\.metrics\)/);
  assert.match(source,/safeToken\(metric\?\.metric\)===['"]dps['"]/);
  assert.match(source,/raw\?\.profilesets\|\|raw\?\.sim\?\.profilesets/);
});
