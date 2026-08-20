import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Loot defaults to Docker source builds and never auto-executes downloaded Windows nightlies',async()=>{
  const [pkg,dockerScript,nativeScript,runner]=await Promise.all([
    readFile(new URL('../../package.json',import.meta.url),'utf8'),
    readFile(new URL('../../scripts/simc-docker-sync.mjs',import.meta.url),'utf8'),
    readFile(new URL('../../scripts/simc-nightly-sync.mjs',import.meta.url),'utf8'),
    readFile(new URL('../../server/loot/simc-runner-v1.mjs',import.meta.url),'utf8'),
  ]);
  assert.match(pkg,/"predev"\s*:\s*"[^"]*simc-docker-sync\.mjs --preflight"/);
  assert.match(pkg,/"sync:simc"\s*:\s*"[^"]*simc-docker-sync\.mjs --force"/);
  assert.match(pkg,/"sync:simc-native"/);
  assert.match(dockerScript,/official nightly commit/);
  assert.match(dockerScript,/official Dockerfile/);
  assert.match(nativeScript,/BLOCKED BY SECURITY POLICY/);
  assert.match(nativeScript,/--allow-native-nightly/);
  assert.match(runner,/source:'MANAGED_DOCKER'/);
  assert.doesNotMatch(runner,/source:'MANAGED_NIGHTLY'/);
});
