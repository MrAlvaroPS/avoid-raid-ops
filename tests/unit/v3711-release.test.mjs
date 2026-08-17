import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { CSS_BUNDLE_SOURCES } from '../../config/active-assets.mjs';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('v3.7.11 browser runtimes remain valid regression assets',async()=>{
  for(const path of ['public/progress-runtime-v3711.js','public/iris-runtime-v3711.js']){
    const source=await read(path);assert.doesNotThrow(()=>new vm.Script(source,{filename:path}));
  }
});

test('index uses one generated compatibility stylesheet while preserving historical source order and runtime layering',async()=>{
  const index=await read('index.html');
  const styleSources=CSS_BUNDLE_SOURCES.map(asset=>asset.src);
  assert.deepEqual(styleSources.slice(-6),['/raidops-v3711.css?v=3.7.11','/raidops-v3712.css?v=3.7.12','/raidops-v3713.css?v=3.8.5','/raidops-v386.css?v=3.8.6','/raidops-v390.css?v=3.9.0','/raidops-v392.css?v=3.9.2']);
  assert.match(index,/main\.css[\s\S]*raidops-active\.css\?v=3\.9\.2-css1/);
  for(const source of styleSources)assert.ok(!index.includes(source),`${source} must be a bundle source, not an individual production request`);
  assert.match(index,/wcl-bootstrap-v389\.js\?v=3\.8\.9\.1/);assert.match(index,/data-hub-v390\.js\?v=3\.9\.0/);assert.match(index,/knowledge-reindex-v390\.js\?v=3\.9\.0/);assert.match(index,/wcl-runtime\.js\?v=3\.8\.5/);assert.match(index,/progress-runtime-v3713\.js\?v=3\.8\.5/);assert.match(index,/iris-runtime-v3713\.js\?v=3\.8\.9\.1/);assert.match(index,/player-intelligence-v392\.js\?v=3\.9\.2/);
  assert.match(index,/encounter-intelligence-v375\.js\?v=3\.8\.5[\s\S]*corpus-ui-stability-v1\.js\?v=1\.1\.0/);
  assert.doesNotMatch(index,/progress-runtime-v3712\.js\?v=3\.7\.12/);assert.doesNotMatch(index,/iris-runtime-v3712\.js\?v=3\.7\.12/);assert.doesNotMatch(index,/player-intelligence-v386\.js\?v=3\.8\.9\.1/);
  assert.ok(index.indexOf('/wcl-bootstrap-v389.js?v=3.8.9.1')<index.indexOf('/data-hub-v390.js?v=3.9.0'));
  assert.ok(index.indexOf('/data-hub-v390.js?v=3.9.0')<index.indexOf('/wcl-runtime.js?v=3.8.5'));
  assert.ok(index.indexOf('/wcl-runtime.js?v=3.8.5')<index.indexOf('/player-intelligence-v392.js?v=3.9.2'));
  assert.ok(index.indexOf('/iris-runtime-v3713.js?v=3.8.9.1')<index.indexOf('/player-intelligence-v392.js?v=3.9.2'));
});

test('legacy WCL Progress writers remain identifiable and are intercepted by the active owner runtime',async()=>{
  const [legacy,owner]=await Promise.all([read('public/wcl-runtime.js'),read('public/progress-runtime-v3713.js')]);
  for(const fn of ['applyProgressPage','applyProgressCurve','applyHistoryData','applyRealProgressMatrix']){assert.match(legacy,new RegExp(`function ${fn}\\(`));assert.match(owner,new RegExp(`['"]${fn}['"]`));}
});

test('component versions remain traceable while product release has one shared owner',async()=>{
  const [pkg,webPkg,release,iris,players,bootstrap,capabilities,appShell]=await Promise.all([read('package.json'),read('apps/web/package.json'),read('packages/release/src/index.js'),read('public/iris-runtime-v3713.js'),read('public/player-intelligence-v392.js'),read('public/wcl-bootstrap-v389.js'),read('server/iris/capability-contract-v390.mjs'),read('apps/web/src/app/AppShell.js')]);
  assert.match(pkg,/"version": "0\.3\.9-4-vercel\.0"/);assert.match(pkg,/"iris": "node --env-file=\.env\.local scripts\/iris-local-worker\.mjs"/);
  assert.match(webPkg,/"version": "0\.0\.0-private\.0"/);assert.match(webPkg,/@avoid\/release/);
  assert.match(release,/PRODUCT_RELEASE_VERSION='3\.9\.4'/);assert.match(release,/PRODUCT_RELEASE_LABEL=`v\$\{PRODUCT_RELEASE_VERSION\}`/);
  assert.match(iris,/const RELEASE='3\.8\.5'/);assert.match(iris,/const IRIS='Iris'/);assert.match(iris,/const RAID_LEADER='Onie'/);
  assert.match(players,/const VERSION='3\.9\.2'/);
  assert.match(capabilities,/release:'3\.9\.4'/);
  assert.doesNotMatch(iris,/new MutationObserver/);assert.doesNotMatch(iris,/b\.textContent=wanted/);
  assert.doesNotMatch(players,/new MutationObserver/);assert.doesNotMatch(players,/\.division b/);
  assert.match(bootstrap,/const BOOTSTRAP_VERSION='3\.8\.9'/);assert.match(bootstrap,/nativeFetch\('\/api\/release'/);assert.doesNotMatch(bootstrap,/const RELEASE=/);
  assert.match(appShell,/PRODUCT_RELEASE_LABEL/);assert.match(appShell,/@avoid\/release/);assert.doesNotMatch(appShell,/children:"01"/);
});
