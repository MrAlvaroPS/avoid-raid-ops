import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('SimC default sync builds the official nightly commit from source in Docker and never auto-runs downloaded Windows nightlies',async()=>{
  const [pkg,dockerManager,dockerScript,sourceManager,nativeScript]=await Promise.all([
    readFile(new URL('../../package.json',import.meta.url),'utf8'),
    readFile(new URL('../../server/loot/simc-docker-manager-v1.mjs',import.meta.url),'utf8'),
    readFile(new URL('../../scripts/simc-docker-sync.mjs',import.meta.url),'utf8'),
    readFile(new URL('../../server/loot/simc-source-manager-v1.mjs',import.meta.url),'utf8'),
    readFile(new URL('../../scripts/simc-nightly-sync.mjs',import.meta.url),'utf8'),
  ]);
  assert.match(pkg,/"sync:simc"\s*:\s*"[^"]*simc-docker-sync\.mjs --force/);
  assert.match(pkg,/"predev"\s*:\s*"[^"]*simc-docker-sync\.mjs --preflight/);
  assert.match(dockerManager,/discoverLatestSimcNightlyV1/);
  assert.match(dockerManager,/https:\/\/github\.com\/simulationcraft\/simc\.git/);
  assert.match(dockerManager,/docker\.path,\['build'/);
  assert.match(dockerManager,/display_build=2/);
  assert.match(dockerScript,/Docker/);
  assert.match(sourceManager,/-DBUILD_GUI=OFF/);
  assert.match(nativeScript,/BLOCKED BY SECURITY POLICY/);
  assert.match(nativeScript,/--allow-native-nightly/);
});
