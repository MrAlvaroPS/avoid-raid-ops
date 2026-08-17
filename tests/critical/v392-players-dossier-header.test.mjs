import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL v3.9.2 PLAYERS: dossier remains column owner and roster scrolls only after consuming useful height',async()=>{
  const [css,runtime,index]=await Promise.all([
    read('public/raidops-v392.css'),read('public/player-intelligence-v392.js'),read('index.html')
  ]);
  assert.match(css,/\.layout-player\{align-items:start!important\}/);
  assert.match(css,/max-height:var\(--players-roster-max-height,none\)!important/);
  assert.match(css,/overflow-y:var\(--players-roster-overflow,visible\)!important/);
  assert.match(css,/\.layout-player>\.player-detail\{[^}]*width:100%!important/s);
  assert.match(runtime,/function syncRosterHeight\(\)/);
  assert.match(runtime,/dossier\.getBoundingClientRect\(\)\.height/);
  assert.match(runtime,/--players-roster-max-height/);
  assert.match(runtime,/list\.scrollHeight>target\+1\?'auto':'visible'/);
  assert.ok(index.indexOf('/raidops-v392.css?v=3.9.2')>index.indexOf('/raidops-v390.css?v=3.9.0'));
  assert.match(index,/player-intelligence-v392\.js\?v=3\.9\.2/);
});

test('CRITICAL v3.9.2 RELIABILITY HEADER: no shell mock can masquerade as a published roster score',async()=>{
  const [css,runtime,source,index]=await Promise.all([
    read('public/raidops-v392.css'),read('public/player-intelligence-v392.js'),read('apps/web/src/features/players/Players.js'),read('index.html')
  ]);
  assert.match(runtime,/const isPublished=p=>p\?\.status==='published'&&p\?\.publication\?\.publishable===true&&Number\.isFinite\(Number\(p\?\.value\)\)/);
  assert.match(runtime,/profiles\.filter\(isPublished\)/);
  assert.match(runtime,/published\.length\?String\(Math\.round\(published\.reduce/);
  assert.match(runtime,/:\s*'—'/);
  assert.match(runtime,/x\.dataset\.reliabilityOwned='true'/);
  assert.match(css,/banner-stat:not\(\[data-reliability-owned="true"\]\)/);
  assert.doesNotMatch(source,/children:"91%"/);
  assert.doesNotMatch(source,/Peer median 84%/);
  assert.match(source,/children:"—"/);
  assert.match(source,/Evidence gates pending/);
  assert.doesNotMatch(index,/player-intelligence-v386\.js\?v=3\.8\.9\.1/);
});
