import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { shouldRetryWindowsShellLaunchV1 } from '../../server/loot/simc-manager-v1.mjs';

test('Windows UNKNOWN/EINVAL spawn failures retry through the shell, but other platforms/errors do not',()=>{
  assert.equal(shouldRetryWindowsShellLaunchV1({code:'UNKNOWN'},{platform:'win32'}),true);
  assert.equal(shouldRetryWindowsShellLaunchV1({code:'EINVAL'},{platform:'win32'}),true);
  assert.equal(shouldRetryWindowsShellLaunchV1({code:'ENOENT'},{platform:'win32'}),false);
  assert.equal(shouldRetryWindowsShellLaunchV1({code:'UNKNOWN'},{platform:'linux'}),false);
});

test('managed SimC never applies the six-hour freshness gate while no current worker exists',async()=>{
  const source=await readFile(new URL('../../server/loot/simc-manager-v1.mjs',import.meta.url),'utf8');
  assert.match(source,/checkDue:!current\|\|!state\.lastCheckedAt/);
  assert.match(source,/due=force\|\|!current\|\|!state\.lastCheckedAt/);
  assert.match(source,/windows-shell-fallback/);
  assert.match(source,/launchAttempts/);
});
