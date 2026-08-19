import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

const SOURCE='apps/web/src/features/command-center/runtime.js';
const TRANSPORT='public/command-center-runtime.js';
const HISTORICAL_BRIDGE='public/command-center-history-bridge-v4.js';
const presentationPrefix=source=>source.split('  window.applyProgressCurve=')[0];

test('Command Center source owner and public transport are byte-identical while presentation logic stays equal to the validated historical bridge',async()=>{
  const [source,transport,bridge]=await Promise.all([read(SOURCE),read(TRANSPORT),read(HISTORICAL_BRIDGE)]);
  assert.equal(transport,source,'Command Center public transport must stay byte-identical to its feature source');
  assert.equal(presentationPrefix(source),presentationPrefix(bridge),'source-owner promotion must not alter the validated Command Center presentation functions');
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
