import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_ASSET_MANIFEST,
  ACTIVE_STYLES,
  CSS_BUNDLE_SOURCES,
  ACTIVE_LOCAL_SCRIPTS,
  ACTIVE_EXTERNAL_SCRIPTS,
  RUNTIME_FAMILIES,
  HISTORICAL_ONLY_ASSETS,
} from '../../config/active-assets.mjs';

test('active compatibility asset manifest makes the current production stack explicit',()=>{
  assert.equal(ACTIVE_ASSET_MANIFEST.version,'active-assets-v1');
  assert.equal(ACTIVE_STYLES.length,2);
  assert.equal(CSS_BUNDLE_SOURCES.length,17);
  assert.equal(ACTIVE_LOCAL_SCRIPTS.length,12);
  assert.equal(ACTIVE_EXTERNAL_SCRIPTS.length,1);
  assert.equal(ACTIVE_STYLES[0].src,'/main.css');
  assert.equal(ACTIVE_STYLES[1].src,'/raidops-active.css?v=3.9.2-css1');
  assert.equal(ACTIVE_LOCAL_SCRIPTS[0].src,'/main.js');
  assert.equal(ACTIVE_LOCAL_SCRIPTS.at(-1).src,'/player-intelligence-v392.js?v=3.9.2');
  const fallbackBridge=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='mechanics-defensives-fallback-bridge');
  assert.equal(fallbackBridge?.src,'/mechanics-defensives-fallback-bridge-v4.js?v=4.0.0-migration4-shadow1');
  assert.equal(fallbackBridge?.owner,'split-source-owners');
  assert.equal(fallbackBridge?.authority,'migration-bridge');
  assert.equal(fallbackBridge?.role,'mechanics-source-parity-shadow-and-defensive-writer-shadow');
  const mechanicsSource=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='mechanics-source-runtime');
  assert.equal(mechanicsSource?.src,'/mechanics-runtime.js?v=4.0.0-migration4-shadow1');
  assert.equal(mechanicsSource?.sourceOwner,'apps/web/src/features/mechanics/runtime.js');
  assert.equal(mechanicsSource?.authority,'migration-source-shadow');
  const historyBridge=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='command-center-history-bridge');
  assert.equal(historyBridge?.src,'/command-center-history-bridge-v4.js?v=4.0.0-migration1');
  assert.equal(historyBridge?.owner,'command-center');
  assert.equal(historyBridge?.authority,'migration-bridge');
  assert.equal(ACTIVE_LOCAL_SCRIPTS.some(asset=>asset.id==='progress-legacy-retirement'),false,'temporary retirement guard must not survive physical source deletion');
  assert.equal(ACTIVE_LOCAL_SCRIPTS.some(asset=>asset.id==='corpus-ui-stability'),false,'Corpus migration guard must be physically retired after the green post-retirement checkpoint');
});

test('runtime domains have one primary owner while the monolithic WCL runtime is compatibility-only',()=>{
  const primaries=ACTIVE_LOCAL_SCRIPTS.filter(asset=>asset.authority==='primary');
  const domains=primaries.map(asset=>asset.domain);
  assert.equal(new Set(domains).size,domains.length);
  assert.deepEqual(domains,['bootstrap','data-platform','knowledge','mechanics','progress','iris','players']);
  const legacy=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='wcl-legacy-runtime');
  assert.equal(legacy.authority,'compatibility');
  assert.equal(legacy.retirement,'decompose-per-domain-before-retirement');
  const fallbackBridge=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='mechanics-defensives-fallback-bridge');
  const mechanicsSource=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='mechanics-source-runtime');
  const historyBridge=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='command-center-history-bridge');
  const progress=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='progress-runtime');
  assert.ok(ACTIVE_LOCAL_SCRIPTS.indexOf(legacy)<ACTIVE_LOCAL_SCRIPTS.indexOf(fallbackBridge));
  assert.ok(ACTIVE_LOCAL_SCRIPTS.indexOf(fallbackBridge)<ACTIVE_LOCAL_SCRIPTS.indexOf(mechanicsSource));
  assert.ok(ACTIVE_LOCAL_SCRIPTS.indexOf(mechanicsSource)<ACTIVE_LOCAL_SCRIPTS.indexOf(historyBridge));
  assert.ok(ACTIVE_LOCAL_SCRIPTS.indexOf(historyBridge)<ACTIVE_LOCAL_SCRIPTS.indexOf(progress));
});

test('versioned runtime families identify exactly one active generation in the manifest',()=>{
  const expected=new Map([
    ['encounter-intelligence','encounter-intelligence-v375.js'],
    ['progress-runtime','progress-runtime-v3713.js'],
    ['iris-runtime','iris-runtime-v3713.js'],
    ['player-intelligence','player-intelligence-v392.js'],
  ]);
  assert.equal(RUNTIME_FAMILIES.length,expected.size);
  for(const family of RUNTIME_FAMILIES)assert.equal(family.activeFile,expected.get(family.id));
  for(const old of ['/encounter-intelligence-v374.js','/progress-runtime-v3712.js','/iris-runtime-v3712.js','/player-intelligence-v386.js'])assert.ok(HISTORICAL_ONLY_ASSETS.includes(old));
});

test('CSS transport is consolidated without deleting or reordering additive source history',()=>{
  assert.equal(ACTIVE_STYLES[0].authority,'base');
  assert.equal(ACTIVE_STYLES[1].authority,'generated-bundle');
  assert.equal(ACTIVE_STYLES[1].retirement,'regenerate-from-source-manifest');
  assert.ok(CSS_BUNDLE_SOURCES.every(asset=>asset.authority==='source-layer'&&asset.retirement==='visual-equivalence-required'));
  assert.equal(CSS_BUNDLE_SOURCES.find(asset=>asset.id==='css-v378').domain,'progress');
  assert.equal(CSS_BUNDLE_SOURCES.find(asset=>asset.id==='css-v386').domain,'players');
  assert.equal(CSS_BUNDLE_SOURCES.find(asset=>asset.id==='css-v390').owner,'data-platform');
  assert.ok(CSS_BUNDLE_SOURCES.findIndex(asset=>asset.id==='css-v390')<CSS_BUNDLE_SOURCES.findIndex(asset=>asset.id==='css-v392'));
});
