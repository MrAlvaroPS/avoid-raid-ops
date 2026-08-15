import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('v3.7.10 browser runtimes parse as JavaScript', async () => {
  for (const path of ['public/progress-runtime-v3710.js','public/iris-runtime-v3710.js']) {
    const source = await read(path);
    assert.doesNotThrow(() => new vm.Script(source, { filename: path }));
  }
});

test('Progress v3.7.10 exposes only explicit range controls as interactive state', async () => {
  const runtime = await read('public/progress-runtime-v3710.js');
  assert.match(runtime, /interactionPolicy:'explicit-controls-only'/);
  assert.match(runtime, /data-progress-range/);
  assert.match(runtime, /blockIndicatorInteraction/);
  assert.match(runtime, /data-progress-indicator/);
  assert.match(runtime, /\.stats-row \.stat/);
  assert.match(runtime, /\.night-table/);
  assert.match(runtime, /\.progress-window-matrix/);
  assert.match(runtime, /\.progress-health-panel/);
});

test('chart range redraws only the chart and does not call the full page render', async () => {
  const runtime = await read('public/progress-runtime-v3710.js');
  const rangeHandler = runtime.match(/qsa\('\[data-progress-range\]'[\s\S]*?\}\)\);/);
  assert.ok(rangeHandler, 'range handler should exist');
  assert.match(rangeHandler[0], /state\.range=btn\.dataset\.progressRange/);
  assert.match(rangeHandler[0], /renderChart\(pulls\)/);
  assert.doesNotMatch(rangeHandler[0], /renderFull/);
  assert.doesNotMatch(rangeHandler[0], /renderNights/);
  assert.doesNotMatch(rangeHandler[0], /renderMatrix/);
});

test('Progress implements the RL-only strategic metrics without Live tactics', async () => {
  const runtime = await read('public/progress-runtime-v3710.js');
  for (const label of [
    'DEEP PULL RATE',
    'CONSISTENCY GAP',
    'LAST BREAKTHROUGH',
    'PHASE CONVERSION',
    'NIGHT RETENTION',
    'RAID THROUGHPUT',
    'PROGRESSION STATE'
  ]) assert.match(runtime, new RegExp(label));
  assert.doesNotMatch(runtime, /KEEP \/ FIX|NEXT PULL|FIRST DEATH|RAID DPS|RAID HPS/);
});

test('strategic metric definitions remain deterministic and evidence-only', async () => {
  const runtime = await read('public/progress-runtime-v3710.js');
  assert.match(runtime, /bestPct\)\+10/); // deep zone = within 10pp of PB
  assert.match(runtime, /meaningfulBest-2/); // meaningful depth breakthrough
  assert.match(runtime, /previous\.slice\(-5\)/); // previous-night closing baseline
  assert.match(runtime, /Number\(closing\)\+2/); // retention tolerance
  assert.match(runtime, /current\.slice\(i-2,i\+1\)/); // 3-pull confirmation
  assert.match(runtime, /timed\.length\/\(minutes\/60\)/); // pulls per active hour
  assert.match(runtime, /gap<30/); // exclude long session gaps from downtime median
});

test('Progression health and stage matrix are independent of chart range', async () => {
  const runtime = await read('public/progress-runtime-v3710.js');
  assert.match(runtime, /independent from chart range/);
  assert.match(runtime, /const source=pulls\.slice\(-160\)/);
  assert.match(runtime, /renderHealth\(pulls\)/);
  assert.doesNotMatch(runtime.match(/function renderMatrix[\s\S]*?function ensureHealthPanel/)?.[0]||'', /visiblePulls/);
});

test('v3.7.10 Progress adds no browser WCL requests', async () => {
  const runtime = await read('public/progress-runtime-v3710.js');
  assert.match(runtime, /extraWclRequests:0/);
  assert.doesNotMatch(runtime, /fetch\(/);
});

test('Progress scope documents the non-interactive and metric contracts', async () => {
  const doc = await read('docs/PROGRESS-SCOPE.md');
  assert.match(doc, /Indicators are not interactive/);
  assert.match(doc, /chart range affects \*\*only All-pull progression\*\*/i);
  assert.match(doc, /DEEP PULL RATE/);
  assert.match(doc, /CONSISTENCY GAP/);
  assert.match(doc, /NIGHT RETENTION \/ WARM-UP TAX/);
  assert.match(doc, /RAID THROUGHPUT/);
  assert.match(doc, /may not use correlation to assign blame/i);
});
