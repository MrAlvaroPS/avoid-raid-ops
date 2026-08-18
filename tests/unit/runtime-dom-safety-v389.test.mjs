import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const OBSERVER_CONSTRUCTION = /\bnew\s+(?:window\.)?MutationObserver\s*\(/;

// These are the browser overlay runtimes currently activated by index.html after main.js.
// Keep this list explicit: if release wiring changes, the safety inventory test below fails
// until the new runtime is deliberately reviewed and added here.
const ACTIVE_OVERLAYS = [
  'public/wcl-bootstrap-v389.js',
  'public/data-hub-v390.js',
  'public/knowledge-reindex-v390.js',
  'public/wcl-runtime.js',
  'public/command-center-history-bridge-v4.js',
  'public/encounter-intelligence-v375.js',
  'public/corpus-ui-stability-v1.js',
  'public/progress-runtime-v3713.js',
  'public/iris-runtime-v3713.js',
  'public/player-intelligence-v392.js',
];

async function activeSources() {
  return Promise.all(ACTIVE_OVERLAYS.map(async path => [path, await read(path)]));
}

test('CRITICAL SAFETY INVENTORY: every active local browser overlay is covered by liveness guards', async () => {
  const index = await read('index.html');
  const wired = [...index.matchAll(/<script\s+src="\/(?!main\.js)([^"?]+\.js)(?:\?[^" ]*)?"\s+defer><\/script>/g)]
    .map(match => `public/${match[1]}`);
  assert.deepEqual(wired, ACTIVE_OVERLAYS, 'changing active browser overlays requires an explicit liveness-safety review');
});

test('CRITICAL DOM LIVENESS: active overlay runtimes cannot construct MutationObservers', async () => {
  for (const [path, source] of await activeSources()) {
    assert.doesNotMatch(source, OBSERVER_CONSTRUCTION, `${path} must not construct MutationObserver; active overlays use explicit state/data polling instead`);
  }
});

test('CRITICAL COMMAND CENTER HISTORY BRIDGE: migration bridge is passive and request-free', async () => {
  const source = await read('public/command-center-history-bridge-v4.js');
  assert.match(source,/window\.applyHistoryData=applyCommandCenterHistory/);
  assert.match(source,/window\.__AVOID_WCL_HISTORY__/);
  assert.doesNotMatch(source,OBSERVER_CONSTRUCTION);
  assert.doesNotMatch(source,/\.observe\s*\(/);
  assert.doesNotMatch(source,/setInterval|setTimeout|requestAnimationFrame|fetch\s*\(/);
});

test('CRITICAL RELEASE OWNERSHIP: bootstrap is the only active writer of the visible release marker', async () => {
  const sources = await activeSources();
  const writers = sources.filter(([, source]) => /\.dataset\.release\s*=/.test(source));
  assert.deepEqual(writers.map(([path]) => path), ['public/wcl-bootstrap-v389.js'], 'exactly one active runtime may write data-release on the global sidebar release label');
  const bootstrap = writers[0][1];
  assert.match(bootstrap, /function patchVisibleRelease\(\)/);
  assert.match(bootstrap, /\.division b/);
  assert.match(bootstrap, /data-release/);
});

test('CRITICAL FEEDBACK GUARD: any active runtime touching the global division label is observer-free', async () => {
  for (const [path, source] of await activeSources()) {
    if (!/\.division b/.test(source)) continue;
    assert.doesNotMatch(source, OBSERVER_CONSTRUCTION, `${path} touches .division b and therefore must not construct a DOM observer`);
    assert.doesNotMatch(source, /\.observe\s*\(/, `${path} touches .division b and therefore must not observe DOM mutations`);
  }
});

test('CRITICAL PLAYERS CHURN GUARD: Player Intelligence is data-signature gated, node-identity aware and never DOM-observer driven', async () => {
  const source = await read('public/player-intelligence-v392.js');
  assert.match(source, /if\(!force&&sig===last&&!domRebuilt\)/);
  assert.match(source, /detailNode!==ownedDetail/);
  assert.match(source, /listNode!==ownedList/);
  assert.match(source, /matrixNode!==ownedMatrix/);
  assert.match(source, /setInterval\(\(\)=>render\(\),750\)/);
  assert.doesNotMatch(source, OBSERVER_CONSTRUCTION);
  assert.doesNotMatch(source, /\.observe\s*\(/);
  assert.doesNotMatch(source, /\.division b/);
});

test('CRITICAL IRIS RELEASE GUARD: Iris component metadata cannot overwrite the global visible release', async () => {
  const source = await read('public/iris-runtime-v3713.js');
  assert.match(source, /visible app release is owned by bootstrap/);
  assert.doesNotMatch(source, /\.dataset\.release\s*=/);
  assert.doesNotMatch(source, /textContent\s*=\s*wanted/);
  assert.doesNotMatch(source, OBSERVER_CONSTRUCTION);
  assert.doesNotMatch(source, /\.observe\s*\(/);
});

test('CRITICAL RELEASE WIRING: bootstrap and v3.9 cache/data layers load before shared WCL/component overlays', async () => {
  const index = await read('index.html');
  const bootstrap = index.indexOf('/wcl-bootstrap-v389.js?v=3.8.9.1');
  const dataHub = index.indexOf('/data-hub-v390.js?v=3.9.0');
  const reindex = index.indexOf('/knowledge-reindex-v390.js?v=3.9.0');
  const legacy = index.indexOf('/wcl-runtime.js?v=3.8.5');
  const historyBridge = index.indexOf('/command-center-history-bridge-v4.js?v=4.0.0-migration1');
  const progress = index.indexOf('/progress-runtime-v3713.js?v=3.8.5');
  assert.ok(bootstrap >= 0, 'hotfix bootstrap must be wired into index.html');
  assert.ok(dataHub > bootstrap, 'data hub must wrap the bootstrap fetch layer, not bypass it');
  assert.ok(reindex > dataHub, 'knowledge reindex guard must listen after the data hub is initialized');
  assert.ok(legacy > reindex, 'legacy compatibility runtime must load after data platform layers');
  assert.ok(historyBridge > legacy, 'history bridge must replace the legacy global binding after its declaration');
  assert.ok(progress > historyBridge, 'Progress must install its active-screen wrapper after the Command Center bridge');
  for (const asset of [
    '/encounter-intelligence-v375.js?v=3.8.5',
    '/corpus-ui-stability-v1.js?v=1.1.0',
    '/iris-runtime-v3713.js?v=3.8.9.1',
    '/player-intelligence-v392.js?v=3.9.2',
  ]) {
    const position = index.indexOf(asset);
    assert.ok(position > reindex, `${asset} must load after the bootstrap + data platform layers`);
  }
});
