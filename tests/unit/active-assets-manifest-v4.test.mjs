import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_ASSET_MANIFEST,
  ACTIVE_STYLES,
  ACTIVE_LOCAL_SCRIPTS,
  ACTIVE_EXTERNAL_SCRIPTS,
  RUNTIME_FAMILIES,
  HISTORICAL_ONLY_ASSETS,
} from '../../config/active-assets.mjs';

test('active compatibility asset manifest makes the current production stack explicit',()=>{
  assert.equal(ACTIVE_ASSET_MANIFEST.version,'active-assets-v1');
  assert.equal(ACTIVE_STYLES.length,18);
  assert.equal(ACTIVE_LOCAL_SCRIPTS.length,10);
  assert.equal(ACTIVE_EXTERNAL_SCRIPTS.length,1);
  assert.equal(ACTIVE_STYLES[0].src,'/main.css');
  assert.equal(ACTIVE_LOCAL_SCRIPTS[0].src,'/main.js');
  assert.equal(ACTIVE_LOCAL_SCRIPTS.at(-1).src,'/player-intelligence-v392.js?v=3.9.2');
});

test('runtime domains have one primary owner while the monolithic WCL runtime is compatibility-only',()=>{
  const primaries=ACTIVE_LOCAL_SCRIPTS.filter(asset=>asset.authority==='primary');
  const domains=primaries.map(asset=>asset.domain);
  assert.equal(new Set(domains).size,domains.length);
  assert.deepEqual(domains,['bootstrap','data-platform','knowledge','mechanics','progress','iris','players']);
  const legacy=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='wcl-legacy-runtime');
  assert.equal(legacy.authority,'compatibility');
  assert.equal(legacy.retirement,'decompose-per-domain-before-retirement');
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

test('CSS consolidation remains visual-equivalence gated instead of deleting additive history blindly',()=>{
  const overlays=ACTIVE_STYLES.filter(asset=>asset.authority==='overlay');
  assert.equal(overlays.length,17);
  assert.ok(overlays.every(asset=>asset.retirement==='visual-equivalence-required'));
  assert.equal(ACTIVE_STYLES.find(asset=>asset.id==='css-v378').domain,'progress');
  assert.equal(ACTIVE_STYLES.find(asset=>asset.id==='css-v386').domain,'players');
  assert.equal(ACTIVE_STYLES.find(asset=>asset.id==='css-v390').owner,'data-platform');
});
