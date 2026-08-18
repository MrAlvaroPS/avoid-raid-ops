import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  LEGACY_RUNTIME_OWNERSHIP,
  LEGACY_RUNTIME_RESPONSIBILITIES,
  LEGACY_RUNTIME_PROGRESS_HISTORICAL_INTERCEPTS,
  LEGACY_RUNTIME_PROGRESS_ACTIVE_INTERCEPTS,
  LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED,
} from '../../config/legacy-runtime-ownership.mjs';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('legacy WCL runtime responsibilities are explicit and contain no miscellaneous bucket',()=>{
  assert.equal(LEGACY_RUNTIME_OWNERSHIP.version,'legacy-runtime-ownership-v4');
  assert.equal(LEGACY_RUNTIME_OWNERSHIP.path,'public/wcl-runtime.js');
  assert.ok(LEGACY_RUNTIME_RESPONSIBILITIES.length>=10);
  for(const entry of LEGACY_RUNTIME_RESPONSIBILITIES){
    assert.ok(entry.functions.length>0,entry.id);
    assert.doesNotMatch(`${entry.id} ${entry.domain}`,/misc|other|unknown/i);
    assert.ok(entry.retirement.includes('-'),`${entry.id} must have an actionable retirement path`);
  }
});

test('Progress-only legacy writers are physically absent while historical interception stays auditable',async()=>{
  assert.deepEqual(LEGACY_RUNTIME_PROGRESS_HISTORICAL_INTERCEPTS,['applyProgressPage','applyProgressCurve','applyHistoryData','applyRealProgressMatrix']);
  assert.deepEqual(LEGACY_RUNTIME_PROGRESS_ACTIVE_INTERCEPTS,['applyProgressCurve','applyHistoryData']);
  assert.deepEqual(LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED,['applyProgressPage','applyRealProgressMatrix']);
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='progress-shadowed-writers'),undefined,'physically deleted functions cannot remain active ownership entries');

  const [legacy,progress]=await Promise.all([read('public/wcl-runtime.js'),read('public/progress-runtime-v3713.js')]);
  for(const retired of LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED){
    assert.doesNotMatch(legacy,new RegExp(`function\\s+${retired}\\s*\\(`),`${retired} declaration must be physically absent`);
    assert.doesNotMatch(legacy,new RegExp(`${retired}\\s*\\(\\s*\\)`),`${retired} orchestration call must be physically absent`);
  }
  for(const active of LEGACY_RUNTIME_PROGRESS_ACTIVE_INTERCEPTS)assert.match(legacy,new RegExp(`function\\s+${active}\\s*\\(`),`${active} legacy body must remain auditable until its physical-retirement checkpoint`);
  assert.match(progress,/for\(const fn of \['applyProgressPage','applyProgressCurve','applyHistoryData','applyRealProgressMatrix'\]\)wrap\(fn\)/,'historical canonical owner remains byte-stable and may still name absent legacy functions');
  assert.match(progress,/setInterval\(\(\)=>renderFull\(false\),750\)/,'canonical Progress owner must repaint independently of legacy writers');
  assert.match(progress,/&quot;/,'historical HTML escaping contract remains intact');
});

test('applyProgressCurve is shadowed by the Command Center bridge before physical retirement',async()=>{
  const curve=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='shared-progression-curve');
  assert.equal(curve.domain,'command-center-progress');
  assert.equal(curve.status,'shadowed-compatibility-helper');
  assert.equal(curve.canonicalOwner,'public/command-center-history-bridge-v4.js');
  assert.match(curve.retirement,/physically-delete-legacy-curve-body-after-browser-validation/);

  const [legacy,bridge]=await Promise.all([read('public/wcl-runtime.js'),read('public/command-center-history-bridge-v4.js')]);
  assert.match(legacy,/function applyProgressCurve\(/,'legacy curve remains auditable until physical deletion');
  assert.match(bridge,/window\.applyProgressCurve=applyCommandCenterProgressCurve/);
  assert.match(bridge,/window\.__AVOID_WCL__/);
  assert.match(bridge,/findOwnText\('Command Center'\)/);
  assert.doesNotMatch(bridge,/MutationObserver|setInterval|setTimeout|requestAnimationFrame|fetch\s*\(/);
});

test('applyHistoryData is shadowed by the Command Center bridge before physical retirement',async()=>{
  const history=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='shared-history-writer');
  assert.equal(history.domain,'command-center-progress');
  assert.equal(history.status,'shadowed-compatibility-writer');
  assert.equal(history.canonicalOwner,'public/command-center-history-bridge-v4.js');
  assert.match(history.retirement,/physically-delete-mixed-legacy-body-after-browser-validation/);
  assert.ok(!LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED.includes('applyHistoryData'));

  const [legacy,bridge]=await Promise.all([read('public/wcl-runtime.js'),read('public/command-center-history-bridge-v4.js')]);
  const start=legacy.indexOf('function applyHistoryData()');
  const end=legacy.indexOf('\nfunction applyLiveStatus',start);
  assert.ok(start>=0&&end>start,'legacy applyHistoryData remains auditable until physical deletion');
  const body=legacy.slice(start,end);
  assert.match(body,/Are we actually getting better\?/,'known legacy Progress branch remains visible at the shadow checkpoint');
  assert.match(body,/findOwnText\("Command Center"\)/,'known legacy Command Center branch remains visible at the shadow checkpoint');
  assert.match(bridge,/window\.applyHistoryData=applyCommandCenterHistory/);
  assert.match(bridge,/window\.__AVOID_WCL_HISTORY__/);
  assert.doesNotMatch(bridge,/Are we actually getting better\?/);
  assert.doesNotMatch(bridge,/MutationObserver|setInterval|setTimeout|requestAnimationFrame|fetch\s*\(/);
});

test('Corpus workbench remains classified but migration does not resume corpus operations',()=>{
  const corpus=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='corpus-workbench');
  assert.equal(corpus.domain,'mechanics-corpus');
  assert.equal(corpus.canonicalOwner,'public/encounter-intelligence-v375.js');
  assert.match(corpus.retirement,/without-resuming-corpus/);
});

test('legacy monolith has orchestration ownership but no canonical product-domain claim',()=>{
  const orchestration=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='network-orchestration');
  assert.equal(orchestration.status,'compatibility-orchestrator');
  assert.deepEqual(orchestration.functions,['applyAll','fetchJson','fetchData']);
});
