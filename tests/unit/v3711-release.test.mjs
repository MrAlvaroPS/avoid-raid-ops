import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('v3.7.11 browser runtimes remain valid regression assets',async()=>{
  for(const path of ['public/progress-runtime-v3711.js','public/iris-runtime-v3711.js']){const source=await read(path);assert.doesNotThrow(()=>new vm.Script(source,{filename:path}));}
});

test('index preserves historical styles and activates the v3.9.2 Players layer after the v3.9.0 data platform',async()=>{
  const index=await read('index.html');
  assert.match(index,/raidops-v3711\.css\?v=3\.7\.11/);assert.match(index,/raidops-v3712\.css\?v=3\.7\.12/);assert.match(index,/raidops-v3713\.css\?v=3\.8\.5/);assert.match(index,/raidops-v386\.css\?v=3\.8\.6/);assert.match(index,/raidops-v390\.css\?v=3\.9\.0/);assert.match(index,/raidops-v392\.css\?v=3\.9\.2/);
  assert.match(index,/wcl-bootstrap-v389\.js\?v=3\.8\.9\.1/);assert.match(index,/data-hub-v390\.js\?v=3\.9\.0/);assert.match(index,/knowledge-reindex-v390\.js\?v=3\.9\.0/);assert.match(index,/wcl-runtime\.js\?v=3\.8\.5/);assert.match(index,/progress-runtime-v3713\.js\?v=3\.8\.5/);assert.match(index,/iris-runtime-v3713\.js\?v=3\.8\.9\.1/);assert.match(index,/player-intelligence-v392\.js\?v=3\.9\.2/);
  assert.match(index,/encounter-intelligence-v375\.js\?v=3\.8\.5[\s\S]*corpus-ui-stability-v1\.js\?v=1\.1\.0/);
  assert.doesNotMatch(index,/progress-runtime-v3712\.js\?v=3\.7\.12/);assert.doesNotMatch(index,/iris-runtime-v3712\.js\?v=3\.7\.12/);assert.doesNotMatch(index,/player-intelligence-v386\.js\?v=3\.8\.9\.1/);
  assert.ok(index.indexOf('/wcl-bootstrap-v389.js?v=3.8.9.1')<index.indexOf('/data-hub-v390.js?v=3.9.0'));assert.ok(index.indexOf('/data-hub-v390.js?v=3.9.0')<index.indexOf('/wcl-runtime.js?v=3.8.5'));assert.ok(index.indexOf('/wcl-runtime.js?v=3.8.5')<index.indexOf('/player-intelligence-v392.js?v=3.9.2'));assert.ok(index.indexOf('/iris-runtime-v3713.js?v=3.8.9.1')<index.indexOf('/player-intelligence-v392.js?v=3.9.2'));
});

test('legacy WCL Progress writers remain identifiable and are intercepted by the active owner runtime',async()=>{
  const [legacy,owner]=await Promise.all([read('public/wcl-runtime.js'),read('public/progress-runtime-v3713.js')]);for(const fn of ['applyProgressPage','applyProgressCurve','applyHistoryData','applyRealProgressMatrix']){assert.match(legacy,new RegExp(`function ${fn}\\(`));assert.match(owner,new RegExp(`['"]${fn}['"]`));}
});

test('v3.9.4 keeps browser component versions honest while allowing later package overlays',async()=>{
  const [pkg,iris,players,bootstrap,capabilities]=await Promise.all([read('package.json'),read('public/iris-runtime-v3713.js'),read('public/player-intelligence-v392.js'),read('public/wcl-bootstrap-v389.js'),read('server/iris/capability-contract-v390.mjs')]);
  assert.match(pkg,/"version": "0\.3\.9-(?:[4-9]|\d{2,})-vercel\.0"/);assert.match(pkg,/"iris": "node --env-file=\.env\.local scripts\/iris-local-worker\.mjs"/);
  assert.match(iris,/const RELEASE='3\.8\.5'/);assert.match(iris,/const IRIS='Iris'/);assert.match(iris,/const RAID_LEADER='Onie'/);assert.match(players,/const VERSION='3\.9\.2'/);assert.match(capabilities,/release:'3\.9\.(?:[4-9]|\d{2,})'/);
  assert.doesNotMatch(iris,/new MutationObserver/);assert.doesNotMatch(iris,/b\.textContent=wanted/);assert.doesNotMatch(players,/new MutationObserver/);assert.doesNotMatch(players,/\.division b/);assert.match(bootstrap,/const RELEASE='3\.8\.9'/);assert.match(bootstrap,/if\(label\.dataset\.release!==release\)label\.dataset\.release=release/);
});
