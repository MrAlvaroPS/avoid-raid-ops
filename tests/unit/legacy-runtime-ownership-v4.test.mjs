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

test('all historical Progress interception targets are physically absent from the legacy monolith',async()=>{
  assert.deepEqual(LEGACY_RUNTIME_PROGRESS_HISTORICAL_INTERCEPTS,['applyProgressPage','applyProgressCurve','applyHistoryData','applyRealProgressMatrix']);
  assert.deepEqual(LEGACY_RUNTIME_PROGRESS_ACTIVE_INTERCEPTS,[]);
  assert.deepEqual(LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED,['applyProgressPage','applyProgressCurve','applyHistoryData','applyRealProgressMatrix']);
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='progress-shadowed-writers'),undefined,'physically deleted functions cannot remain active ownership entries');
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='shared-progression-curve'),undefined,'retired curve cannot remain an active legacy responsibility');
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='shared-history-writer'),undefined,'retired history writer cannot remain an active legacy responsibility');

  const [legacy,progress]=await Promise.all([read('public/wcl-runtime.js'),read('public/progress-runtime-v3713.js')]);
  for(const retired of LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED){
    assert.doesNotMatch(legacy,new RegExp(`function\\s+${retired}\\s*\\(`),`${retired} declaration must be physically absent`);
    assert.match(progress,new RegExp(`['\"]${retired}['\"]`),`${retired} remains historical interception knowledge in canonical Progress`);
  }
  assert.match(progress,/setInterval\(\(\)=>renderFull\(false\),750\)/,'canonical Progress owner must repaint independently of legacy writers');
  assert.match(progress,/&quot;/,'historical HTML escaping contract remains intact');
});

test('Command Center owns the retired curve and history behavior through one passive bridge',async()=>{
  const [legacy,bridge]=await Promise.all([read('public/wcl-runtime.js'),read('public/command-center-history-bridge-v4.js')]);
  assert.match(legacy,/window\.applyProgressCurve\?\.\(\)/,'Command Center uses extracted curve binding');
  assert.match(legacy,/window\.applyHistoryData\?\.\(\)/,'supplemental orchestration uses extracted history binding');
  assert.match(bridge,/window\.applyProgressCurve=applyCommandCenterProgressCurve/);
  assert.match(bridge,/window\.applyHistoryData=applyCommandCenterHistory/);
  assert.match(bridge,/window\.__AVOID_WCL__/);
  assert.match(bridge,/window\.__AVOID_WCL_HISTORY__/);
  assert.match(bridge,/findOwnText\('Command Center'\)/);
  assert.doesNotMatch(bridge,/Are we actually getting better\?/);
  assert.doesNotMatch(bridge,/MutationObserver|setInterval|setTimeout|requestAnimationFrame|fetch\s*\(/);
});

test('missing-history guard is shadowed by canonical Progress before physical retirement',async()=>{
  const guard=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='progress-compatibility-guard');
  assert.deepEqual(guard.functions,['neutralizeMissingHistory']);
  assert.equal(guard.domain,'progress');
  assert.equal(guard.status,'shadowed-compatibility-guard');
  assert.equal(guard.canonicalOwner,'public/progress-runtime-v3713.js');
  assert.match(guard.retirement,/physically-delete-missing-history-guard-after-browser-validation/);

  const [legacy,progress]=await Promise.all([read('public/wcl-runtime.js'),read('public/progress-runtime-v3713.js')]);
  assert.match(legacy,/function neutralizeMissingHistory\(\)/,'legacy body remains present and auditable at shadow checkpoint');
  assert.match(progress,/wrap\('neutralizeMissingHistory'\)/,'Progress suppresses legacy writer on its active screen');
  assert.match(progress,/missingHistoryPolicy:'canonical-progress-owner'/);
  assert.match(progress,/function renderMissingHistory\(\)/);
  assert.match(progress,/Raid-session history unavailable · no Golden fallback/);
  assert.match(progress,/HISTORY UNAVAILABLE/);
  assert.match(progress,/Current-report progression remains real\. Cross-session comparisons require the History endpoint\./);
  assert.doesNotMatch(progress,/fetch\s*\(/,'Progress missing-history ownership must add zero direct network requests');
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
