import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('Loot is wired after the operational runtime without replacing the golden shell',async()=>{
  const index=await read('index.html');
  assert.match(index,/raidops-v3913-loot\.css\?v=3\.9\.13\.0/);
  assert.match(index,/loot-profile-bridge-v3913\.js\?v=3\.9\.13\.0/);
  assert.match(index,/loot-runtime-v39132\.js\?v=3\.9\.13\.2/);
  assert.ok(index.indexOf('avoid-operational-ui-v3912.js')<index.indexOf('loot-profile-bridge-v3913.js'));
  assert.ok(index.indexOf('loot-profile-bridge-v3913.js')<index.indexOf('loot-runtime-v39132.js'));
});

test('Loot remains raid-only, evidence-based, uses ST plus MT5, and never auto-awards',async()=>{
  const [runtime,runner,matrix,service]=await Promise.all([read('public/loot-runtime-v39137.js'),read('server/loot/simc-runner-v1.mjs'),read('server/loot/simc-matrix-v1.mjs'),read('server/services/loot-service.mjs')]);
  new vm.Script(runtime,{filename:'loot-runtime-v39137.js'});
  assert.match(runtime,/SIM is per raider/);
  assert.match(runtime,/ST 1T · MT 5T · MIX 50\/50/);
  assert.doesNotMatch(runtime,/LIVE_PULLS_MOCK|PLAYER_RELIABILITY_MOCK|Math\.random\(\).*gain/i);
  assert.match(runner,/fightStyle:'Patchwerk'/);
  assert.match(runner,/desiredTargets:1/);
  assert.match(runner,/desiredTargets:5/);
  assert.doesNotMatch(runner,/DungeonSlice/i);
  assert.match(matrix,/mixGainPct/);
  assert.match(service,/automaticAward:false/);
  assert.match(service,/healerAndTankRaidValueNotFabricated:true/);
  assert.match(service,/mixIsNeutralEqualWeightNotBossTruth:true/);
});

test('Loot prefers observed WCL CombatantInfo and materializes Armory only as fallback',async()=>{
  const [bridge,runner,service]=await Promise.all([read('public/loot-profile-bridge-v3913.js'),read('server/loot/simc-runner-v1.mjs'),read('server/services/loot-service.mjs')]);
  new vm.Script(bridge,{filename:'loot-profile-bridge-v3913.js'});
  assert.match(bridge,/observed\.character/);
  assert.match(runner,/source:'wcl-combatantinfo'/);
  assert.match(runner,/materializeArmoryProfile/);
  assert.match(runner,/save=base\.simc/);
  assert.match(runner,/source:'battle-net-armory-materialized'/);
  assert.match(runner,/bonusIdsPreserved:false/);
  assert.match(service,/observedCombatantInfoPreferred:true/);
  assert.match(service,/armoryFallbackAllowed:true/);
});

test('temporary WCL guild roster is directory-only and observed CombatantInfo wins',async()=>{
  const [runtime,store,engine,query]=await Promise.all([read('public/loot-runtime-v39137.js'),read('server/home/roster-store-v1.mjs'),read('server/engines/home-roster-engine.mjs'),read('server/wcl/queries/home-roster.mjs')]);
  assert.match(query,/members\(page:\$page,limit:\$limit\)/);
  assert.match(store,/wcl-guild-members-temporary/);
  assert.match(store,/wcl-combatant-info-observed/);
  assert.match(runtime,/Directory-only guild members never enter allocation/i);
  assert.match(runtime,/\/api\/wcl\/home-roster/);
  assert.match(runtime,/for\(const obs of observedRoster\(\)\)/);
  assert.match(engine,/networkExecuted:false/);
  assert.doesNotMatch(runtime,/__AVOID_WCL_TELEMETRY__\s*=/);
});

test('Loot is inserted below Composition and does not globally filter the app',async()=>{
  const runtime=await read('public/loot-runtime-v39137.js');
  assert.match(runtime,/composition/i);
  assert.match(runtime,/insertAdjacentElement\('afterend',clone\)/);
  assert.match(runtime,/if\(S\.open&&/);
  assert.doesNotMatch(runtime,/location\.assign|location\.reload/);
});

test('server-side active-spec eligibility produces the only list sent to the ST MT simulation matrix',async()=>{
  const service=await read('server/services/loot-service.mjs');
  assert.match(service,/eligibility=players\.map/);
  assert.match(service,/eligibility\.simEligible===true/);
  assert.match(service,/simulateLootRaidMatrixV1\(\{players:eligible/);
  assert.match(service,/physicalEligibilitySeparateFromSpecFit:true/);
});
