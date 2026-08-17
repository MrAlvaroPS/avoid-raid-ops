import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_RUNTIME_OWNERSHIP,
  LEGACY_RUNTIME_RESPONSIBILITIES,
  LEGACY_RUNTIME_PROGRESS_SHADOWED,
} from '../../config/legacy-runtime-ownership.mjs';

test('legacy WCL runtime responsibilities are explicit and contain no miscellaneous bucket',()=>{
  assert.equal(LEGACY_RUNTIME_OWNERSHIP.version,'legacy-runtime-ownership-v1');
  assert.equal(LEGACY_RUNTIME_OWNERSHIP.path,'public/wcl-runtime.js');
  assert.ok(LEGACY_RUNTIME_RESPONSIBILITIES.length>=10);
  for(const entry of LEGACY_RUNTIME_RESPONSIBILITIES){
    assert.ok(entry.functions.length>0,entry.id);
    assert.doesNotMatch(`${entry.id} ${entry.domain}`,/misc|other|unknown/i);
    assert.ok(entry.retirement.includes('-'),`${entry.id} must have an actionable retirement path`);
  }
});

test('Progress legacy writers are explicitly shadowed by the canonical Progress runtime',()=>{
  assert.deepEqual(LEGACY_RUNTIME_PROGRESS_SHADOWED,['applyProgressPage','applyProgressCurve','applyHistoryData','applyRealProgressMatrix']);
  const progress=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='progress-shadowed-writers');
  assert.equal(progress.status,'shadowed-by-primary-owner');
  assert.equal(progress.canonicalOwner,'public/progress-runtime-v3713.js');
  assert.deepEqual(progress.functions,LEGACY_RUNTIME_PROGRESS_SHADOWED);
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
