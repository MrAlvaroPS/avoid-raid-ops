import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ACTIVE_STYLES,
  ACTIVE_EXTERNAL_SCRIPTS,
  ACTIVE_LOCAL_SCRIPTS,
} from '../../config/active-assets.mjs';
import {
  ACTIVE_ASSET_HTML_MARKERS,
  renderActiveAssetBlocks,
  synchronizeActiveAssetHtml,
} from '../../scripts/lib/active-asset-html.mjs';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');
const count=(source,needle)=>source.split(needle).length-1;

test('active asset HTML is already synchronized with the canonical manifest',async()=>{
  const html=await read('index.html');
  assert.equal(synchronizeActiveAssetHtml(html),html);
});

test('active asset HTML synchronization is idempotent',async()=>{
  const html=await read('index.html');
  const once=synchronizeActiveAssetHtml(html);
  assert.equal(synchronizeActiveAssetHtml(once),once);
});

test('rendered active asset order matches the manifest exactly',()=>{
  const blocks=renderActiveAssetBlocks();
  assert.deepEqual(blocks.styles,ACTIVE_STYLES.map(asset=>`<link rel="stylesheet" href="${asset.src}" />`));
  assert.deepEqual(blocks.externalScripts,ACTIVE_EXTERNAL_SCRIPTS.map(asset=>`<script src="${asset.src}" defer></script>`));
  assert.deepEqual(blocks.localScripts,ACTIVE_LOCAL_SCRIPTS.map(asset=>`<script src="${asset.src}" defer></script>`));
});

test('index owns each active asset marker exactly once and in valid order',async()=>{
  const html=await read('index.html');
  for(const [label,[start,end]] of Object.entries(ACTIVE_ASSET_HTML_MARKERS)){
    assert.equal(count(html,start),1,`${label} start marker must occur once`);
    assert.equal(count(html,end),1,`${label} end marker must occur once`);
    assert.ok(html.indexOf(start)<html.indexOf(end),`${label} markers must be ordered`);
  }
});

test('malformed or duplicate active asset markers fail closed',async()=>{
  const html=await read('index.html');
  const [styleStart,styleEnd]=ACTIVE_ASSET_HTML_MARKERS.styles;
  assert.throws(()=>synchronizeActiveAssetHtml(html.replace(styleStart,'')),/styles asset markers must exist exactly once/);
  assert.throws(()=>synchronizeActiveAssetHtml(html.replace(styleEnd,styleStart)),/styles asset markers must exist exactly once/);
  assert.throws(()=>synchronizeActiveAssetHtml(html.replace(styleStart,`${styleStart}\n    ${styleStart}`)),/styles asset markers must exist exactly once/);
});

test('asset synchronization leaves boot and Wowhead configuration outside generated blocks untouched',async()=>{
  const html=await read('index.html');
  const drifted=html
    .replace('/raidops-active.css?v=3.9.2-css1','/drift.css')
    .replace('/progress-runtime-v3713.js?v=3.8.5','/drift-progress.js');
  const beforeBoot=drifted.match(/<script>document\.documentElement\.classList\.add\("raidops-booting"\);<\/script>/)?.[0];
  const beforeWowhead=drifted.match(/<script>var whTooltips = \{[^<]+<\/script>/)?.[0];
  const synchronized=synchronizeActiveAssetHtml(drifted);
  assert.equal(synchronized.match(/<script>document\.documentElement\.classList\.add\("raidops-booting"\);<\/script>/)?.[0],beforeBoot);
  assert.equal(synchronized.match(/<script>var whTooltips = \{[^<]+<\/script>/)?.[0],beforeWowhead);
  assert.ok(synchronized.includes('/raidops-active.css?v=3.9.2-css1'));
  assert.ok(synchronized.includes('/progress-runtime-v3713.js?v=3.8.5'));
  assert.ok(!synchronized.includes('/drift.css'));
  assert.ok(!synchronized.includes('/drift-progress.js'));
});
