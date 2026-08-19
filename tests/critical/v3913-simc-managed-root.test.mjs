import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('managed SimulationCraft does not depend on Vite process.cwd()',async()=>{
  const source=await readFile(new URL('../../server/loot/simc-manager-v1.mjs',import.meta.url),'utf8');
  assert.match(source,/fileURLToPath\(import\.meta\.url\)/);
  assert.match(source,/PROJECT_ROOT/);
  assert.match(source,/recoverInstalledCurrent/);
  assert.match(source,/\.raidops-simc/);
  assert.doesNotMatch(source,/join\(process\.cwd\(\),'\.raidops-simc'\)/);
});
