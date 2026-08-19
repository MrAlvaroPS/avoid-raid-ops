import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

const SOURCE='apps/web/src/features/command-center/runtime.js';
const TRANSPORT='public/command-center-runtime.js';
const RETIRED_BRIDGE='public/command-center-history-bridge-v4.js';

test('Command Center source owner and public transport remain byte-identical after historical bridge retirement',async()=>{
  const [source,transport]=await Promise.all([read(SOURCE),read(TRANSPORT)]);
  assert.equal(transport,source,'Command Center public transport must stay byte-identical to its feature source');
  await assert.rejects(access(new URL(`../../${RETIRED_BRIDGE}`,import.meta.url)),error=>error?.code==='ENOENT','historical Command Center bridge must remain physically absent');
});

test('Command Center runtime is explicit single-source owner and remains passive',async()=>{
  const source=await read(SOURCE);
  assert.match(source,/window\.applyProgressCurve=applyCommandCenterProgressCurve/);
  assert.match(source,/window\.applyHistoryData=applyCommandCenterHistory/);
  assert.match(source,/window\.__AVOID_WCL__/);
  assert.match(source,/window\.__AVOID_WCL_HISTORY__/);
  assert.match(source,/window\.__AVOID_COMMAND_CENTER_SOURCE_RUNTIME__/);
  assert.match(source,/sourceOwner:'apps\/web\/src\/features\/command-center\/runtime\.js'/);
  assert.match(source,/transport:'public\/command-center-runtime\.js'/);
  assert.match(source,/mode:'single-source-owner'/);
  assert.match(source,/writerPolicy:'single-command-center-progression-history-owner'/);
  assert.match(source,/directRequests:0/);
  assert.match(source,/timers:0/);
  assert.match(source,/observers:0/);
  assert.doesNotMatch(source,/\bfetch\s*\(|MutationObserver|\.observe\s*\(|setInterval|setTimeout|requestAnimationFrame/);
});
