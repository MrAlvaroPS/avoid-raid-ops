import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Windows native SimulationCraft nightlies are never auto-executed by dev',async()=>{
  const [pkg,script]=await Promise.all([
    readFile(new URL('../../package.json',import.meta.url),'utf8'),
    readFile(new URL('../../scripts/simc-nightly-sync.mjs',import.meta.url),'utf8'),
  ]);
  assert.match(pkg,/"predev"\s*:\s*"[^"]*--preflight"/);
  assert.doesNotMatch(pkg,/"predev"\s*:\s*"[^"]*--ensure"/);
  assert.match(script,/BLOCKED BY SECURITY POLICY/);
  assert.match(script,/--allow-native-nightly/);
  assert.match(script,/nativeNightlyAutoExecution:false/);
  assert.match(script,/networkExecuted:false/);
});
