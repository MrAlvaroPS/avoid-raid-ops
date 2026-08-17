import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('v3.7.11 browser runtimes remain valid regression assets',async()=>{
  for(const path of ['public/progress-runtime-v3711.js','public/iris-runtime-v3711.js']){
    const source=await read(path);
    assert.doesNotThrow(()=>new vm.Script(source,{filename:path}));
  }
});

test('index preserves historical styles but activates v3.8.5 cache keys after legacy WCL adapter',async()=>{
  const index=await read('index.html');
  assert.match(index,/raidops-v3711\.css\?v=3\.7\.11/);
  assert.match(index,/raidops-v3712\.css\?v=3\.7\.12/);
  assert.match(index,/raidops-v3713\.css\?v=3\.8\.5/);
  assert.match(index,/raidops-v385\.css\?v=3\.8\.5/);
  assert.match(index,/wcl-runtime\.js\?v=3\.8\.5/);
  assert.match(index,/progress-runtime-v3713\.js\?v=3\.8\.5/);
  assert.match(index,/iris-runtime-v3713\.js\?v=3\.8\.5/);
  assert.match(index,/player-intelligence-v385\.js\?v=3\.8\.5/);
  assert.match(index,/encounter-intelligence-v375\.js\?v=3\.8\.5[\s\S]*corpus-ui-stability-v1\.js\?v=1\.0\.0/);
  assert.doesNotMatch(index,/progress-runtime-v3712\.js\?v=3\.7\.12/);
  assert.doesNotMatch(index,/iris-runtime-v3712\.js\?v=3\.7\.12/);
  assert.ok(index.indexOf('/wcl-runtime.js?v=3.8.5')<index.indexOf('/progress-runtime-v3713.js?v=3.8.5'));
  assert.ok(index.indexOf('/iris-runtime-v3713.js?v=3.8.5')<index.indexOf('/player-intelligence-v385.js?v=3.8.5'));
});

test('legacy WCL Progress writers remain identifiable and are intercepted by the active owner runtime',async()=>{
  const [legacy,owner]=await Promise.all([read('public/wcl-runtime.js'),read('public/progress-runtime-v3713.js')]);
  for(const fn of ['applyProgressPage','applyProgressCurve','applyHistoryData','applyRealProgressMatrix']){
    assert.match(legacy,new RegExp(`function ${fn}\\(`));
    assert.match(owner,new RegExp(`['"]${fn}['"]`));
  }
});

test('v3.8.5 release metadata is active while corpus v3.8.4 assets remain integrated',async()=>{
  const [pkg,iris,index]=await Promise.all([read('package.json'),read('public/iris-runtime-v3713.js'),read('index.html')]);
  assert.match(pkg,/"version": "0\.3\.8-5-vercel\.0"/);
  assert.match(pkg,/"iris": "node --env-file=\.env\.local scripts\/iris-local-worker\.mjs"/);
  assert.match(iris,/const RELEASE='3\.8\.5'/);
  assert.match(iris,/const IRIS='Iris'/);
  assert.match(iris,/const RAID_LEADER='Onie'/);
  assert.match(index,/corpus-ui-stability-v1\.js\?v=1\.0\.0/);
});