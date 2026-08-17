import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

// These are the browser overlay runtimes currently activated by index.html after main.js.
// Keep this list explicit: if release wiring changes, this safety suite must be reviewed too.
const ACTIVE_OVERLAYS = [
  'public/wcl-bootstrap-v389.js',
  'public/wcl-runtime.js',
  'public/encounter-intelligence-v375.js',
  'public/corpus-ui-stability-v1.js',
  'public/progress-runtime-v3713.js',
  'public/iris-runtime-v3713.js',
  'public/player-intelligence-v386.js',
];

async function activeSources() {
  return Promise.all(ACTIVE_OVERLAYS.map(async path => [path, await read(path)]));
}

test('CRITICAL DOM LIVENESS: active overlay runtimes cannot install MutationObserver loops', async () => {
  for (const [path, source] of await activeSources()) {
    assert.doesNotMatch(
      source,
      /\bMutationObserver\b/,
      `${path} must not install MutationObserver; active overlays use explicit state/data polling instead`,
    );
  }
});

test('CRITICAL RELEASE OWNERSHIP: bootstrap is the only active writer of the visible release marker', async () => {
  const sources = await activeSources();
  const writers = sources.filter(([, source]) => /\.dataset\.release\s*=/.test(source));
  assert.deepEqual(
    writers.map(([path]) => path),
    ['public/wcl-bootstrap-v389.js'],
    'exactly one active runtime may write data-release on the global sidebar release label',
  );

  const bootstrap = writers[0][1];
  assert.match(bootstrap, /function patchVisibleRelease\(\)/);
  assert.match(bootstrap, /\.division b/);
  assert.match(bootstrap, /data-release/);
});

test('CRITICAL FEEDBACK GUARD: any active runtime touching the global division label is observer-free', async () => {
  for (const [path, source] of await activeSources()) {
    if (!/\.division b/.test(source)) continue;
    assert.doesNotMatch(source, /\bMutationObserver\b/, `${path} touches .division b and therefore must remain observer-free`);
    assert.doesNotMatch(source, /\.observe\s*\(/, `${path} touches .division b and therefore must not observe DOM mutations`);
  }
});

test('CRITICAL PLAYERS CHURN GUARD: Player Intelligence is signature-gated and never DOM-observer driven', async () => {
  const source = await read('public/player-intelligence-v386.js');
  assert.match(source, /if\(!force&&sig===last\)return/);
  assert.match(source, /setInterval\(\(\)=>render\(\),750\)/);
  assert.doesNotMatch(source, /\bMutationObserver\b/);
  assert.doesNotMatch(source, /\.division b/);
});

test('CRITICAL IRIS RELEASE GUARD: Iris component metadata cannot overwrite the global visible release', async () => {
  const source = await read('public/iris-runtime-v3713.js');
  assert.match(source, /visible app release is owned by bootstrap/);
  assert.doesNotMatch(source, /\.dataset\.release\s*=/);
  assert.doesNotMatch(source, /textContent\s*=\s*wanted/);
  assert.doesNotMatch(source, /\bMutationObserver\b/);
});

test('CRITICAL RELEASE WIRING: hotfix bootstrap loads before every shared data/component overlay', async () => {
  const index = await read('index.html');
  const bootstrap = index.indexOf('/wcl-bootstrap-v389.js?v=3.8.9.1');
  assert.ok(bootstrap >= 0, 'hotfix bootstrap must be wired into index.html');
  for (const asset of [
    '/wcl-runtime.js?v=3.8.5',
    '/encounter-intelligence-v375.js?v=3.8.5',
    '/progress-runtime-v3713.js?v=3.8.5',
    '/iris-runtime-v3713.js?v=3.8.9.1',
    '/player-intelligence-v386.js?v=3.8.9.1',
  ]) {
    const position = index.indexOf(asset);
    assert.ok(position > bootstrap, `${asset} must load after the release/liveness bootstrap`);
  }
});
