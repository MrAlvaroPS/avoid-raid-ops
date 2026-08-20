import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('SimC default sync builds the official nightly commit from source and never auto-runs downloaded Windows nightlies',async()=>{
  const [pkg,sourceManager,sourceScript,nativeScript]=await Promise.all([
    readFile(new URL('../../package.json',import.meta.url),'utf8'),
    readFile(new URL('../../server/loot/simc-source-manager-v1.mjs',import.meta.url),'utf8'),
    readFile(new URL('../../scripts/simc-source-sync.mjs',import.meta.url),'utf8'),
    readFile(new URL('../../scripts/simc-nightly-sync.mjs',import.meta.url),'utf8'),
  ]);
  assert.match(pkg,/"sync:simc"\s*:\s*"[^"]*simc-source-sync\.mjs/);
  assert.match(pkg,/"predev"\s*:\s*"[^"]*--preflight/);
  assert.match(sourceManager,/discoverLatestSimcNightlyV1/);
  assert.match(sourceManager,/https:\/\/github\.com\/simulationcraft\/simc\.git/);
  assert.match(sourceManager,/-DBUILD_GUI=OFF/);
  assert.match(sourceManager,/Microsoft\.VisualStudio\.Component\.VC\.Tools\.x86\.x64/);
  assert.match(sourceScript,/SIMC_PATH persisted to \.env\.local/);
  assert.match(nativeScript,/BLOCKED BY SECURITY POLICY/);
  assert.match(nativeScript,/--allow-native-nightly/);
});
