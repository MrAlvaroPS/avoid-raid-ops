import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const text=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('Loot uses official SimulationCraft source in managed Docker, not Raidbots or downloaded native nightlies',async()=>{
  await Promise.all([
    import('../../server/loot/simc-runner-v1.mjs'),
    import('../../server/loot/simc-docker-manager-v1.mjs'),
    import('../../server/loot/simc-result-policy-v1.mjs'),
    import('../../server/services/loot-service.mjs'),
    import('../../server/engines/home-roster-engine.mjs')
  ]);
  const [pkg,index,runner,dockerManager,policy,service,runtime]=await Promise.all([
    text('package.json'),text('index.html'),text('server/loot/simc-runner-v1.mjs'),text('server/loot/simc-docker-manager-v1.mjs'),text('server/loot/simc-result-policy-v1.mjs'),text('server/services/loot-service.mjs'),text('public/loot-runtime-v39137.js')
  ]);
  const parsed=JSON.parse(pkg);
  assert.equal(parsed.scripts['sync:simc'],'node --env-file=.env.local scripts/simc-docker-sync.mjs --force');
  assert.equal(parsed.scripts['status:simc'],'node --env-file=.env.local scripts/simc-docker-sync.mjs --status');
  assert.equal(parsed.scripts['sync:home-roster'],'node --env-file=.env.local scripts/iris-home-roster-smoke.mjs --refresh');
  assert.equal(parsed.scripts['validate:loot-roster'],'node --env-file=.env.local scripts/loot-roster-smoke.mjs');
  assert.match(parsed.scripts.predev,/simc-docker-sync\.mjs --preflight/);
  assert.match(dockerManager,/simulationcraft\/simc/i);
  assert.match(dockerManager,/imageTag/);
  assert.match(dockerManager,/display_build=2/);
  assert.match(runner,/simulationcraft-official-cli/);
  assert.match(runner,/MANAGED_DOCKER/);
  assert.match(runner,/BLIZZARD_CLIENT_ID/);
  assert.match(runner,/apikey\.txt/);
  assert.match(policy,/unsupported-by-current-simc-nightly/);
  assert.match(service,/unsupportedSimcSpecsRemainEligible:true/);
  assert.match(service,/unitargetAndFiveTargetSeparated:true/);
  assert.doesNotMatch(`${runner}\n${dockerManager}\n${service}`,/raidbots/i);
  assert.doesNotMatch(`${runner}\n${dockerManager}\n${service}`,/mckilem|simcraft-api/i);
  assert.match(index,/loot-runtime-v39132\.js/);
  assert.match(runtime,/ST 1T · MT 5T · MIX 50\/50/);
});
