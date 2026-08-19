import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('Loot is wired after the operational runtime with its own CSS',async()=>{
  const index=await read('index.html');
  assert.match(index,/raidops-v3913-loot\.css\?v=3\.9\.13\.0/);
  assert.match(index,/loot-runtime-v3913\.js\?v=3\.9\.13\.0/);
  assert.ok(index.indexOf('avoid-operational-ui-v3912.js')<index.indexOf('loot-runtime-v3913.js'),'Loot must layer after the stabilized operational runtime');
});

test('Loot remains raid-only, evidence-based, and never auto-awards',async()=>{
  const [runtime,runner,service]=await Promise.all([read('public/loot-runtime-v3913.js'),read('server/loot/simc-runner-v1.mjs'),read('server/services/loot-service.mjs')]);
  assert.match(runtime,/RUN RAID-ONLY SIM/);
  assert.match(runtime,/Simulation gain is evidence, not an automatic award decision/);
  assert.doesNotMatch(runtime,/LIVE_PULLS_MOCK|PLAYER_RELIABILITY_MOCK|Math\.random\(\).*gain/i);
  assert.match(runner,/fight_style=Patchwerk/);
  assert.match(runner,/scenario!=='raid_st'/);
  assert.doesNotMatch(runner,/DungeonSlice/i);
  assert.match(service,/automaticAward:false/);
  assert.match(service,/healerAndTankRaidValueNotFabricated:true/);
});

test('Loot is inserted below Composition and does not globally filter the app',async()=>{
  const runtime=await read('public/loot-runtime-v3913.js');
  assert.match(runtime,/composition/i);
  assert.match(runtime,/insertAdjacentElement\('afterend',clone\)/);
  assert.match(runtime,/if\(S\.open\)teardown\(\)/);
  assert.doesNotMatch(runtime,/location\.assign|location\.reload/);
});

test('server-side eligibility runs before SimulationCraft',async()=>{
  const service=await read('server/services/loot-service.mjs');
  const eligibility=service.indexOf('evaluateLootEligibilityV1');
  const simulation=service.indexOf('simulateLootRaidV1');
  assert.ok(eligibility>=0&&simulation>eligibility,'eligibility must be evaluated before sim execution');
});
