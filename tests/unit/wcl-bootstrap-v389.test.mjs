import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('v3.8.9 browser bootstrap parses and releases the shell independently of WCL',async()=>{
  const source=await read('public/wcl-bootstrap-v389.js');
  assert.doesNotThrow(()=>new vm.Script(source,{filename:'public/wcl-bootstrap-v389.js'}));
  assert.match(source,/const SHELL_RELEASE_MS=900/);
  assert.match(source,/classList\.remove\('raidops-booting'\)/);
  assert.match(source,/root\(\).*opacity='.34'/s);
  assert.match(source,/coreReady\(\).*__AVOID_WCL__/s);
});

test('v3.8.9 bounds initial WCL browser requests and records diagnostics',async()=>{
  const source=await read('public/wcl-bootstrap-v389.js');
  assert.match(source,/'\/api\/wcl\/report':45000/);
  assert.match(source,/'\/api\/wcl\/status':15000/);
  assert.match(source,/__AVOID_WCL_REQUEST_DIAGNOSTICS__/);
  assert.match(source,/AbortController/);
  assert.match(source,/avoid:wcl-request-state/);
});

test('WCL OAuth is single-flight and cannot hang forever',async()=>{
  const source=await read('server/wcl/auth/token-cache.mjs');
  assert.match(source,/WCL_OAUTH_TIMEOUT_MS/);
  assert.match(source,/if \(cache\.pending\) return cache\.pending/);
  assert.match(source,/controller\.abort\(\)/);
  assert.match(source,/WCL OAuth timeout/);
});

test('WCL GraphQL requests have bounded waits with operation-level errors',async()=>{
  const source=await read('server/wcl/client/graphql-client.mjs');
  assert.match(source,/WCL_GRAPHQL_TIMEOUT_MS/);
  assert.match(source,/function operationName/);
  assert.match(source,/controller\.abort\(\)/);
  assert.match(source,/WCL GraphQL timeout \(\$\{operation\}\)/);
});
