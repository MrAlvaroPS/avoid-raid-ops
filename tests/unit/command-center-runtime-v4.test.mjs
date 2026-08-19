import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

const SOURCE='apps/web/src/features/command-center/runtime.js';
const TRANSPORT='public/command-center-runtime.js';
const ACTIVE_BRIDGE='public/command-center-history-bridge-v4.js';

test('Command Center candidate source and transport are byte-identical to the currently active bridge',async()=>{
  const [source,transport,bridge]=await Promise.all([read(SOURCE),read(TRANSPORT),read(ACTIVE_BRIDGE)]);
  assert.equal(transport,source,'Command Center public transport must stay byte-identical to its feature source');
  assert.equal(source,bridge,'candidate source must preserve the currently validated Command Center bridge behavior byte-for-byte before activation');
});

test('Command Center candidate runtime is passive and owns only the extracted presentation bindings',async()=>{
  const source=await read(SOURCE);
  assert.match(source,/window\.applyProgressCurve=applyCommandCenterProgressCurve/);
  assert.match(source,/window\.applyHistoryData=applyCommandCenterHistory/);
  assert.match(source,/window\.__AVOID_WCL__/);
  assert.match(source,/window\.__AVOID_WCL_HISTORY__/);
  assert.doesNotMatch(source,/\bfetch\s*\(|MutationObserver|\.observe\s*\(|setInterval|setTimeout|requestAnimationFrame/);
});
