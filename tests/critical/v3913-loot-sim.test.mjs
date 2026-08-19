import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('Loot is wired beneath the golden application without replacing the shell',async()=>{
  const [index,runtime,css]=await Promise.all([read('index.html'),read('public/loot-runtime-v3913.js'),read('public/raidops-v3913-loot.css')]);
  assert.match(index,/raidops-v3913-loot\.css/);
  assert.match(index,/loot-profile-bridge-v3913\.js/);
  assert.match(index,/loot-runtime-v3913\.js/);
  assert.match(runtime,/Composition/i);
  assert.match(runtime,/insertAdjacentElement\('afterend'/);
  assert.match(css,/avoid-loot-root/);
});

test('Loot uses official SimulationCraft CLI and never fabricates role value',async()=>{
  const [runner,service,doc]=await Promise.all([read('server/loot/simc-runner-v1.mjs'),read('server/services/loot-service.mjs'),read('docs/LOOT-SIMULATION-V1.md')]);
  assert.match(runner,/simulationcraft-official-cli/);
  assert.match(runner,/SIMC_PATH/);
  assert.match(runner,/scenario!=='raid_st'/);
  assert.match(runner,/role-model-pending/);
  assert.doesNotMatch(runner,/raidbots/i);
  assert.match(service,/automaticAward:false/);
  assert.match(service,/healerAndTankRaidValueNotFabricated:true/);
  assert.match(doc,/official SimulationCraft repository is the engine dependency/i);
});

test('Loot keeps eligibility, sim gain and social context as separate signals',async()=>{
  const [runtime,eligibility,ledger]=await Promise.all([read('public/loot-runtime-v3913.js'),read('server/loot/eligibility-v1.mjs'),read('server/loot/ledger-v1.mjs')]);
  assert.match(runtime,/RELIABILITY/);
  assert.match(runtime,/ATTENDANCE/);
  assert.match(runtime,/SENIORITY/);
  assert.match(runtime,/LOOT/);
  assert.match(runtime,/AWARD/);
  assert.match(eligibility,/weapon-proficiency-unresolved/);
  assert.match(ledger,/source:'local-ledger'/);
  assert.match(ledger,/futureSync:\['wowaudit'\]/);
});
