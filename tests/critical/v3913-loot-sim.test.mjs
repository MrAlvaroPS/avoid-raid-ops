import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('Loot is wired beneath the golden application without replacing the shell',async()=>{
  const [index,runtime,css]=await Promise.all([read('index.html'),read('public/loot-runtime-v39137.js'),read('public/raidops-v3913-loot-v2.css')]);
  assert.match(index,/loot-runtime-v39132\.js/);
  assert.match(runtime,/Composition/i);
  assert.match(runtime,/insertAdjacentElement\('afterend'/);
  assert.match(css,/avoid-loot-root/);
});

test('Loot uses official Dockerized SimulationCraft CLI and never fabricates role value',async()=>{
  const [runner,matrix,service,doc]=await Promise.all([read('server/loot/simc-runner-v1.mjs'),read('server/loot/simc-matrix-v1.mjs'),read('server/services/loot-service.mjs'),read('docs/LOOT-SIMULATION-V1.md')]);
  assert.match(runner,/simulationcraft-official-cli/);
  assert.match(runner,/MANAGED_DOCKER/);
  assert.match(runner,/role-model-pending/);
  assert.match(runner,/desiredTargets:1/);
  assert.match(runner,/desiredTargets:5/);
  assert.doesNotMatch(runner,/raidbots/i);
  assert.match(matrix,/MIX 50\/50/);
  assert.match(service,/automaticAward:false/);
  assert.match(service,/healerAndTankRaidValueNotFabricated:true/);
  assert.match(doc,/official SimulationCraft repository is the engine dependency/i);
});

test('Loot keeps eligibility, sim gain and social context as separate signals',async()=>{
  const [runtime,eligibility,ledger]=await Promise.all([read('public/loot-runtime-v39137.js'),read('server/loot/eligibility-v1.mjs'),read('server/loot/ledger-v1.mjs')]);
  assert.match(runtime,/RELIABILITY/);
  assert.match(runtime,/ATTENDANCE/);
  assert.match(runtime,/INDEXED SINCE/);
  assert.match(runtime,/LOOT/);
  assert.match(runtime,/AWARD/);
  assert.match(eligibility,/weapon-proficiency-unresolved/);
  assert.match(ledger,/source:'local-ledger'/);
  assert.match(ledger,/futureSync:\['wowaudit'\]/);
});
