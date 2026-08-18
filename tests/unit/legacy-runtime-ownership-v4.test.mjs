import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  LEGACY_RUNTIME_OWNERSHIP,
  LEGACY_RUNTIME_RESPONSIBILITIES,
  LEGACY_RUNTIME_PROGRESS_INTERCEPTED,
  LEGACY_RUNTIME_PROGRESS_EXECUTION_RETIRED,
  LEGACY_RUNTIME_PROGRESS_RETIREMENT_CANDIDATES,
} from '../../config/legacy-runtime-ownership.mjs';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('legacy WCL runtime responsibilities are explicit and contain no miscellaneous bucket',()=>{
  assert.equal(LEGACY_RUNTIME_OWNERSHIP.version,'legacy-runtime-ownership-v3');
  assert.equal(LEGACY_RUNTIME_OWNERSHIP.path,'public/wcl-runtime.js');
  assert.ok(LEGACY_RUNTIME_RESPONSIBILITIES.length>=10);
  for(const entry of LEGACY_RUNTIME_RESPONSIBILITIES){
    assert.ok(entry.functions.length>0,entry.id);
    assert.doesNotMatch(`${entry.id} ${entry.domain}`,/misc|other|unknown/i);
    assert.ok(entry.retirement.includes('-'),`${entry.id} must have an actionable retirement path`);
  }
});

test('Progress execution retirement is narrower than interception and precedes source deletion',async()=>{
  assert.deepEqual(LEGACY_RUNTIME_PROGRESS_INTERCEPTED,['applyProgressPage','applyProgressCurve','applyHistoryData','applyRealProgressMatrix']);
  assert.deepEqual(LEGACY_RUNTIME_PROGRESS_EXECUTION_RETIRED,['applyProgressPage','applyRealProgressMatrix']);
  assert.deepEqual(LEGACY_RUNTIME_PROGRESS_RETIREMENT_CANDIDATES,LEGACY_RUNTIME_PROGRESS_EXECUTION_RETIRED);
  const progress=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='progress-shadowed-writers');
  assert.equal(progress.status,'execution-retired');
  assert.equal(progress.canonicalOwner,'public/progress-runtime-v3713.js');
  assert.match(progress.retirement,/delete-from-legacy-runtime-after-green-browser-regression/);
  assert.deepEqual(progress.functions,LEGACY_RUNTIME_PROGRESS_EXECUTION_RETIRED);

  const [guard,source]=await Promise.all([read('public/progress-legacy-retirement-v4.js'),read('public/progress-runtime-v3713.js')]);
  assert.match(guard,/const EXECUTION_RETIRED=Object\.freeze\(\['applyProgressPage','applyRealProgressMatrix'\]\)/);
  assert.doesNotMatch(guard,/applyProgressCurve|applyHistoryData/,'guard may not disable shared Command Center behavior');
  assert.match(guard,/retired\.__avoidExecutionRetired=true/);
  assert.match(guard,/retired\.__irisProgressOwner=true/,'canonical Progress wrapper must skip already hard-retired writers');
  assert.match(guard,/temporary-guard-until-physical-source-deletion/);
  assert.match(source,/for\(const fn of \['applyProgressPage','applyProgressCurve','applyHistoryData','applyRealProgressMatrix'\]\)wrap\(fn\)/,'historical canonical owner remains byte-stable and keeps shared active-only interception');
  assert.match(source,/if\(active\(\)\)return/);
  assert.match(source,/setInterval\(\(\)=>renderFull\(false\),750\)/,'canonical Progress owner must repaint independently of legacy writer execution');
  assert.match(source,/&quot;/,'historical HTML escaping contract remains intact');
});

test('applyProgressCurve stays shared until Command Center is extracted from the compatibility monolith',()=>{
  const curve=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='shared-progression-curve');
  assert.equal(curve.domain,'command-center-progress');
  assert.equal(curve.status,'shared-compatibility-helper');
  assert.equal(curve.canonicalOwner,'public/wcl-runtime.js');
  assert.match(curve.retirement,/extract-shared-curve/);
});

test('applyHistoryData is shared with Command Center and cannot be retired as Progress-only code',async()=>{
  const history=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='shared-history-writer');
  assert.equal(history.domain,'command-center-progress');
  assert.equal(history.status,'shared-compatibility-writer');
  assert.equal(history.canonicalOwner,'public/wcl-runtime.js');
  assert.match(history.retirement,/split-command-center-history-from-progress-before-retirement/);
  assert.ok(!LEGACY_RUNTIME_PROGRESS_RETIREMENT_CANDIDATES.includes('applyHistoryData'));

  const legacy=await read('public/wcl-runtime.js');
  const start=legacy.indexOf('function applyHistoryData()');
  const end=legacy.indexOf('\nfunction applyLiveStatus',start);
  assert.ok(start>=0&&end>start,'applyHistoryData must remain auditable until split');
  const body=legacy.slice(start,end);
  assert.match(body,/Are we actually getting better\?/,'known Progress branch must remain visible until split');
  assert.match(body,/findOwnText\("Command Center"\)/,'known Command Center branch must remain visible until split');
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
