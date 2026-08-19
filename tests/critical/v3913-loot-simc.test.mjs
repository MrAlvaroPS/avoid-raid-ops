import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const text=path=>readFile(path,'utf8');

test('Loot uses official SimulationCraft CLI with managed nightly provenance, not Raidbots wrappers',async()=>{
  await Promise.all([
    import('../../server/loot/simc-runner-v1.mjs'),
    import('../../server/loot/simc-manager-v1.mjs'),
    import('../../server/loot/simc-result-policy-v1.mjs'),
    import('../../server/services/loot-service.mjs'),
    import('../../server/engines/home-roster-engine.mjs')
  ]);
  const [pkg,index,runner,manager,policy,service,runtime]=await Promise.all([
    text('package.json'),text('index.html'),text('server/loot/simc-runner-v1.mjs'),text('server/loot/simc-manager-v1.mjs'),text('server/loot/simc-result-policy-v1.mjs'),text('server/services/loot-service.mjs'),text('public/loot-runtime-v3913.js')
  ]);
  const parsed=JSON.parse(pkg);
  assert.equal(parsed.scripts['sync:simc'],'node --env-file=.env.local scripts/simc-nightly-sync.mjs --force');
  assert.equal(parsed.scripts['status:simc'],'node --env-file=.env.local scripts/simc-nightly-sync.mjs --status');
  assert.equal(parsed.scripts['sync:home-roster'],'node --env-file=.env.local scripts/iris-home-roster-smoke.mjs --refresh');
  assert.equal(parsed.scripts['validate:loot-roster'],'node --env-file=.env.local scripts/loot-roster-smoke.mjs');
  assert.match(parsed.scripts.predev,/simc-nightly-sync\.mjs --ensure/);
  assert.match(manager,/downloads\.simulationcraft\.org\/nightly/);
  assert.match(manager,/archiveSha256/);
  assert.match(manager,/display_build=2/);
  assert.match(manager,/githubCommitVerification/);
  assert.match(runner,/simulationcraft-official-cli/);
  assert.match(runner,/MANAGED_NIGHTLY/);
  assert.match(runner,/BLIZZARD_CLIENT_ID/);
  assert.match(runner,/apikey\.txt/);
  assert.match(policy,/unsupported-by-current-simc-nightly/);
  assert.match(service,/unsupportedSimcSpecsRemainEligible:true/);
  assert.doesNotMatch(`${runner}\n${manager}\n${service}`,/raidbots/i);
  assert.doesNotMatch(`${runner}\n${manager}\n${service}`,/mckilem|simcraft-api/i);
  assert.match(index,/loot-runtime-v3913\.js/);
  assert.match(runtime,/RUN RAID-ONLY SIM/);
});
