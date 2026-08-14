import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Progress v3.7.8 reuses the already-loaded WCL payloads and adds no requests', async () => {
  const runtime = await read('public/progress-runtime-v378.js');
  assert.match(runtime, /window\.__AVOID_WCL__/);
  assert.match(runtime, /window\.__AVOID_WCL_TELEMETRY__/);
  assert.match(runtime, /window\.__AVOID_WCL_HISTORY__/);
  assert.match(runtime, /extraWclRequests:\s*0/);
  assert.doesNotMatch(runtime, /\bfetch\s*\(/);
});

test('Progress v3.7.8 makes pull selection, ranges, chart and RL brief operational', async () => {
  const runtime = await read('public/progress-runtime-v378.js');
  assert.match(runtime, /LAST 20/);
  assert.match(runtime, /LAST 10/);
  assert.match(runtime, /data-progress-pull/);
  assert.match(runtime, /data-progress-prev/);
  assert.match(runtime, /data-progress-next/);
  assert.match(runtime, /progress-median-line/);
  assert.match(runtime, /progress-point/);
  assert.match(runtime, /Between-pull RL brief/);
  assert.match(runtime, /no unsupported causality/i);
  assert.match(runtime, /Observed regression · no causal blame/);
});

test('Progress v3.7.8 preserves the three existing Progress panels and adds instead of replacing', async () => {
  const source = await read('apps/web/src/features/progress/Progress.js');
  const runtime = await read('public/progress-runtime-v378.js');
  assert.match(source, /All-pull progression/);
  assert.match(source, /Night-over-night/);
  assert.match(source, /Phase progression matrix/);
  assert.match(runtime, /panelByTitle\('All-pull progression'\)/);
  assert.match(runtime, /panelByTitle\('Night-over-night'\)/);
  assert.match(runtime, /panelByTitle\('Phase progression matrix'\)/);
  assert.match(runtime, /insertAdjacentElement\('afterend', panel\)/);
});

test('Corpus standby checkpoint records hot reads and the bounded normal recompile contract', async () => {
  const checkpoint = await read('docs/CORPUS-STANDBY-2026-08-14.md');
  assert.match(checkpoint, /775\.51 MB/);
  assert.match(checkpoint, /3\.9K/);
  assert.match(checkpoint, /425\.84 MB/);
  assert.match(checkpoint, /4\.8K/);
  assert.match(checkpoint, /59\.43 MB/);
  assert.match(checkpoint, /2\.9K/);
  assert.match(checkpoint, /read 1 aggregate/);
  assert.match(checkpoint, /read 1 job\/state/);
  assert.match(checkpoint, /read 1 model/);
  assert.match(checkpoint, /not 308 files of raw profiles/);
  assert.match(checkpoint, /FULL REBUILD FROM RAW CORPUS/);
  assert.match(checkpoint, /0 raw-profile listing operations/);
});

test('Product references are persisted literally', async () => {
  const refs = await read('docs/PRODUCT-REFERENCES.md');
  for (const domain of ['wowanalyzer.com','wipefest.gg','archon.gg','lorrgs.io','mythictrap.com','wowhead.com']) {
    assert.match(refs, new RegExp(domain.replace('.', '\\.')));
  }
});

test('index activates v3.7.8 Progress and Iris while retaining prior additive CSS', async () => {
  const index = await read('index.html');
  assert.match(index, /raidops-v378\.css\?v=3\.7\.8/);
  assert.match(index, /progress-runtime-v378\.js\?v=3\.7\.8/);
  assert.match(index, /iris-runtime-v378\.js\?v=3\.7\.8/);
  assert.match(index, /raidops-v377\.css\?v=3\.7\.7/);
  assert.doesNotMatch(index, /iris-runtime-v377\.js/);
});
