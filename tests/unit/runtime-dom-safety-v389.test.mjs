import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

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
  'public/defensive-audit-runtime.js',
  'public/mechanics-runtime.js',
  'public/command-center-history-bridge-v4.js',
  'public/encounter-intelligence-v375.js',
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

test('CRITICAL MECHANICS SOURCE OWNER: feature source and stable public transport are identical and passive', async () => {
  const [source,transport] = await Promise.all([
    read('apps/web/src/features/mechanics/runtime.js'),
    read('public/mechanics-runtime.js'),
  ]);
  assert.equal(transport, source);
  assert.match(source,/window\.applyTelemetryMechanics=applyTelemetryMechanics/);
  assert.match(source,/window\.applyIntelligenceMechanics=applyIntelligenceMechanics/);
  assert.match(source,/mode:'single-source-owner'/);
  assert.match(source,/writerPolicy:'single-mechanics-presentation-owner'/);
  assert.doesNotMatch(source,/queueMicrotask|parity-shadow/);
  assert.doesNotMatch(source,OBSERVER_CONSTRUCTION);
  assert.doesNotMatch(source,/\.observe\s*\(/);
  assert.doesNotMatch(source,/setInterval|setTimeout|requestAnimationFrame|fetch\s*\(/);
});

test('CRITICAL DEFENSIVE SOURCE OWNER: feature source and stable public transport are identical, single-owner and passive', async () => {
  const [source,transport] = await Promise.all([
    read('apps/web/src/features/defensive-audit/runtime.js'),
    read('public/defensive-audit-runtime.js'),
  ]);
  assert.equal(transport, source);
  assert.match(source,/window\.applyTelemetryDefensives=applyTelemetryDefensives/);
  assert.match(source,/window\.applyIntelligenceDefensives=applyIntelligenceDefensives/);
  assert.match(source,/mode:'single-source-owner'/);
  assert.match(source,/writerPolicy:'single-defensive-audit-presentation-owner'/);
  assert.match(source,/directRequests:0/);
  assert.match(source,/timers:0/);
  assert.match(source,/observers:0/);
  assert.doesNotMatch(source,/parity-shadow|queueMicrotask|mismatches|const snapshot|function shadow/);
  assert.doesNotMatch(source,OBSERVER_CONSTRUCTION);
  assert.doesNotMatch(source,/\.observe\s*\(/);
  assert.doesNotMatch(source,/setInterval|setTimeout|requestAnimationFrame|fetch\s*\(/);
});

test('CRITICAL MECHANICS/DEFENSIVES BRIDGE: post-owner retirement bridge is physically absent', async () => {
  const retired=new URL('../../public/mechanics-defensives-fallback-bridge-v4.js',import.meta.url);
  await assert.rejects(access(retired),error=>error?.code==='ENOENT');
  const index=await read('index.html');
  assert.ok(!index.includes('/mechanics-defensives-fallback-bridge-v4.js'),'retired split bridge must not remain in release wiring');
  const legacy=await read('public/wcl-runtime.js');
  assert.doesNotMatch(legacy,/window\.applyMechanicsAndDefensives\?\.\(\)/,'retired split fallback call site must not remain in legacy orchestration');
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
  const defensiveSource = index.indexOf('/defensive-audit-runtime.js?v=4.0.0-migration5-owner1');
  const mechanicsSource = index.indexOf('/mechanics-runtime.js?v=4.0.0-migration4-owner1');
  const historyBridge = index.indexOf('/command-center-history-bridge-v4.js?v=4.0.0-migration1');
  const progress = index.indexOf('/progress-runtime-v3713.js?v=3.8.5');
  assert.ok(bootstrap >= 0, 'hotfix bootstrap must be wired into index.html');
  assert.ok(dataHub > bootstrap, 'data hub must wrap the bootstrap fetch layer, not bypass it');
  assert.ok(reindex > dataHub, 'knowledge reindex guard must listen after the data hub is initialized');
  assert.ok(legacy > reindex, 'legacy compatibility runtime must load after data platform layers');
  assert.ok(defensiveSource > legacy, 'Defensive Audit source owner must load directly after the legacy compatibility layer');
  assert.ok(mechanicsSource > defensiveSource, 'Mechanics source owner must remain after the Defensive Audit source owner');
  assert.ok(historyBridge > mechanicsSource, 'Command Center history bridge must remain after the Mechanics source owner');
  assert.ok(progress > historyBridge, 'Progress must install its active-screen wrapper after the Command Center bridge');
  for (const asset of [
    '/encounter-intelligence-v375.js?v=3.8.5',
    '/iris-runtime-v3713.js?v=3.8.9.1',
    '/player-intelligence-v392.js?v=3.9.2',
  ]) {
    const position = index.indexOf(asset);
    assert.ok(position > reindex, `${asset} must load after the bootstrap + data platform layers`);
  }
  assert.ok(!index.includes('/corpus-ui-stability-v1.js'), 'physically retired Corpus migration guard must not return to release wiring');
});
