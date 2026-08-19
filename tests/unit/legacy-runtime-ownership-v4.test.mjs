import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import {
  LEGACY_RUNTIME_OWNERSHIP,
  LEGACY_RUNTIME_RESPONSIBILITIES,
  LEGACY_RUNTIME_PROGRESS_HISTORICAL_INTERCEPTS,
  LEGACY_RUNTIME_PROGRESS_ACTIVE_INTERCEPTS,
  LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED,
  LEGACY_RUNTIME_PLAYERS_HISTORICAL_WRITERS,
  LEGACY_RUNTIME_PLAYERS_ACTIVE_WRITERS,
  LEGACY_RUNTIME_PLAYERS_SHADOWED_WRITERS,
  LEGACY_RUNTIME_PLAYERS_PHYSICALLY_RETIRED,
  LEGACY_RUNTIME_CORPUS_HISTORICAL_WRITERS,
  LEGACY_RUNTIME_CORPUS_ACTIVE_WRITERS,
  LEGACY_RUNTIME_CORPUS_SHADOWED_WRITERS,
  LEGACY_RUNTIME_CORPUS_PHYSICALLY_RETIRED,
  LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED,
  LEGACY_RUNTIME_CORPUS_RESIDUALS_PHYSICALLY_RETIRED,
  LEGACY_RUNTIME_CORPUS_GUARDS_PHYSICALLY_RETIRED,
} from '../../config/legacy-runtime-ownership.mjs';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('legacy WCL runtime responsibilities are explicit and contain no miscellaneous bucket',()=>{
  assert.equal(LEGACY_RUNTIME_OWNERSHIP.version,'legacy-runtime-ownership-v4');
  assert.equal(LEGACY_RUNTIME_OWNERSHIP.path,'public/wcl-runtime.js');
  assert.ok(LEGACY_RUNTIME_RESPONSIBILITIES.length>=9);
  for(const entry of LEGACY_RUNTIME_RESPONSIBILITIES){
    assert.ok(entry.functions.length>0,entry.id);
    assert.doesNotMatch(`${entry.id} ${entry.domain}`,/misc|other|unknown/i);
    assert.ok(entry.retirement.includes('-'),`${entry.id} must have an actionable retirement path`);
  }
});

test('all historical Progress compatibility targets are physically absent from the legacy monolith',async()=>{
  const retired=['applyProgressPage','applyProgressCurve','applyHistoryData','applyRealProgressMatrix','neutralizeMissingHistory'];
  assert.deepEqual(LEGACY_RUNTIME_PROGRESS_HISTORICAL_INTERCEPTS,retired);
  assert.deepEqual(LEGACY_RUNTIME_PROGRESS_ACTIVE_INTERCEPTS,[]);
  assert.deepEqual(LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED,retired);
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='progress-shadowed-writers'),undefined,'physically deleted functions cannot remain active ownership entries');
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='progress-compatibility-guard'),undefined,'retired missing-history guard cannot remain an active legacy responsibility');
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='shared-progression-curve'),undefined,'retired curve cannot remain an active legacy responsibility');
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='shared-history-writer'),undefined,'retired history writer cannot remain an active legacy responsibility');

  const [legacy,progress]=await Promise.all([read('public/wcl-runtime.js'),read('public/progress-runtime-v3713.js')]);
  for(const retiredName of LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED){
    assert.doesNotMatch(legacy,new RegExp(`function\\s+${retiredName}\\s*\\(`),`${retiredName} declaration must be physically absent`);
    assert.match(progress,new RegExp(`['\"]${retiredName}['\"]`),`${retiredName} remains historical interception knowledge in canonical Progress`);
  }
  assert.doesNotMatch(legacy,/neutralizeMissingHistory\s*\(\s*\)\s*;/,'supplemental orchestration must not invoke the retired missing-history writer');
  assert.match(progress,/setInterval\(\(\)=>renderFull\(false\),750\)/,'canonical Progress owner must repaint independently of legacy writers');
  assert.match(progress,/&quot;/,'historical HTML escaping contract remains intact');
});

test('Players presentation writers are physically retired while the shared data bridge remains',async()=>{
  const writers=['applyPlayers','applyTelemetryPlayers'];
  assert.deepEqual(LEGACY_RUNTIME_PLAYERS_HISTORICAL_WRITERS,writers);
  assert.deepEqual(LEGACY_RUNTIME_PLAYERS_ACTIVE_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_PLAYERS_SHADOWED_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_PLAYERS_PHYSICALLY_RETIRED,writers);
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='players-presentation-shadow'),undefined,'physically deleted Players writers cannot remain active ownership entries');

  const bridge=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='players-data-bridge');
  assert.equal(bridge.status,'compatibility-support');
  assert.equal(bridge.canonicalOwner,'public/player-intelligence-v392.js');
  assert.ok(bridge.functions.includes('playerOutput'));
  assert.ok(!bridge.functions.some(fn=>writers.includes(fn)));

  const [legacy,owner]=await Promise.all([read('public/wcl-runtime.js'),read('public/player-intelligence-v392.js')]);
  for(const writer of writers){
    assert.doesNotMatch(legacy,new RegExp(`function\\s+${writer}\\s*\\(`),`${writer} declaration must be physically absent`);
    assert.match(owner,new RegExp(`['\"]${writer}['\"]`),`${writer} remains historical migration knowledge in canonical Players`);
  }
  assert.doesNotMatch(legacy,/applyPlayers\s*\(\s*\)\s*;/,'applyAll must not invoke the retired applyPlayers writer');
  assert.doesNotMatch(legacy,/applyTelemetryPlayers\s*\(\s*\)\s*;/,'supplemental orchestration must not invoke the retired applyTelemetryPlayers writer');
  assert.match(owner,/window\.__AVOID_PLAYER_INTELLIGENCE_OWNER__=PLAYER_OWNER/);
  assert.match(owner,/writerPolicy:'single-player-writer'/);
  assert.match(owner,/function shadowLegacyPlayerWriter\(name\)/,'historical interception knowledge may remain passive during migration');
  assert.equal((owner.match(/setInterval\s*\(/g)||[]).length,1,'retirement adds no polling beyond the existing canonical repaint');
  assert.match(owner,/setInterval\(\(\)=>render\(\),750\)/);
  assert.doesNotMatch(owner,/MutationObserver|fetch\s*\(/);
});

test('Corpus legacy runtime, residues and migration guard are fully retired while Encounter remains sole owner',async()=>{
  const writers=['applyCorpusWorkbench'];
  const helpers=['corpusCountdown','corpusContext','corpusRequest','refreshCorpusStatus','pollCorpus','corpusCell','corpusButton'];
  const residues=['corpusEndpoint','corpusState','corpusLoadedEncounter','corpusFetching','corpusDriving','corpusTargetReports','corpusNumber','sleep'];
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_HISTORICAL_WRITERS,writers);
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_ACTIVE_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_SHADOWED_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_PHYSICALLY_RETIRED,writers);
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED,helpers);
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_RESIDUALS_PHYSICALLY_RETIRED,residues);
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_GUARDS_PHYSICALLY_RETIRED,['public/corpus-ui-stability-v1.js']);
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='corpus-presentation-shadow'),undefined);
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='corpus-workflow-bridge'),undefined);

  const [legacy,owner]=await Promise.all([read('public/wcl-runtime.js'),read('public/encounter-intelligence-v375.js')]);
  for(const name of [...writers,...helpers]) assert.doesNotMatch(legacy,new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`),`${name} must be physically absent`);
  for(const token of residues)assert.doesNotMatch(legacy,new RegExp(`\\b${token}\\b`),`${token} must be physically absent`);
  assert.doesNotMatch(legacy,/applyIntelligence\(\);applyCorpusWorkbench\(\);removeRosterIntelligenceOutsideComposition\(\)/,'applyAll no longer invokes Corpus presentation');
  assert.match(legacy,/\.roster-intelligence-panel, \.corpus-workbench/,'click isolation for the canonical Corpus card remains intact');
  assert.match(owner,/function ensureCorpusPanel\(\)/);
  assert.match(owner,/function syncCorpusVisibility\(\)/);
  assert.match(owner,/catalogue\.insertAdjacentElement\('beforebegin',panel\)/);
  assert.match(owner,/dataset\.avoidCorpusOwner='encounter-intelligence-v375'/);
  assert.doesNotMatch(owner,/window\.applyCorpusWorkbench|shadowLegacyCorpusWriter|corpusShadowInstalled/);
  assert.match(owner,/writerPolicy:'single-corpus-writer'/);
  assert.match(owner,/legacyRendererPolicy:'physically-retired-no-runtime-binding'/);
  assert.match(owner,/legacyCompatibilityBinding:false/);
  assert.match(owner,/crossPageVisibilityOwner:'encounter-intelligence-v375'/);
  assert.equal((owner.match(/setInterval\s*\(/g)||[]).length,1,'closure adds no polling beyond the existing Encounter loop');
  assert.match(owner,/setInterval\(\(\)=>tick\(false\),1500\)/);
  assert.equal((owner.match(/\bfetch\s*\(/g)||[]).length,2,'closure adds zero request call sites');
  assert.doesNotMatch(owner,/MutationObserver|requestAnimationFrame/);
  await assert.rejects(()=>access(new URL('../../public/corpus-ui-stability-v1.js',import.meta.url)),'retired Corpus migration guard must be physically absent');
});

test('Command Center owns retired curve and history behavior through its feature source owner',async()=>{
  const [legacy,source,transport]=await Promise.all([
    read('public/wcl-runtime.js'),
    read('apps/web/src/features/command-center/runtime.js'),
    read('public/command-center-runtime.js'),
  ]);
  assert.equal(transport,source,'Command Center transport must remain byte-identical to its feature source');
  assert.match(legacy,/window\.applyProgressCurve\?\.\(\)/,'Command Center uses extracted curve binding');
  assert.match(legacy,/window\.applyHistoryData\?\.\(\)/,'supplemental orchestration uses extracted history binding');
  assert.match(source,/window\.applyProgressCurve=applyCommandCenterProgressCurve/);
  assert.match(source,/window\.applyHistoryData=applyCommandCenterHistory/);
  assert.match(source,/window\.__AVOID_WCL__/);
  assert.match(source,/window\.__AVOID_WCL_HISTORY__/);
  assert.match(source,/window\.__AVOID_COMMAND_CENTER_SOURCE_RUNTIME__/);
  assert.match(source,/mode:'single-source-owner'/);
  assert.match(source,/writerPolicy:'single-command-center-progression-history-owner'/);
  assert.match(source,/findOwnText\('Command Center'\)/);
  assert.doesNotMatch(source,/Are we actually getting better\?/);
  assert.doesNotMatch(source,/MutationObserver|setInterval|setTimeout|requestAnimationFrame|fetch\s*\(/);
  await assert.rejects(
    ()=>access(new URL('../../public/command-center-history-bridge-v4.js',import.meta.url)),
    error=>error?.code==='ENOENT',
    'retired historical Command Center bridge must remain physically absent',
  );
});

test('missing-history policy is owned only by canonical Progress after physical retirement',async()=>{
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='progress-compatibility-guard'),undefined);

  const [legacy,progress]=await Promise.all([read('public/wcl-runtime.js'),read('public/progress-runtime-v3713.js')]);
  assert.doesNotMatch(legacy,/function neutralizeMissingHistory\(\)/,'legacy missing-history declaration must be physically absent');
  assert.doesNotMatch(legacy,/neutralizeMissingHistory\s*\(\s*\)\s*;/,'legacy orchestration must not call missing-history presentation');
  assert.match(progress,/wrap\('neutralizeMissingHistory'\)/,'Progress retains historical interception knowledge during the v4 migration');
  assert.match(progress,/missingHistoryPolicy:'canonical-progress-owner'/);
  assert.match(progress,/function renderMissingHistory\(\)/);
  assert.match(progress,/Raid-session history unavailable · no Golden fallback/);
  assert.match(progress,/HISTORY UNAVAILABLE/);
  assert.match(progress,/Current-report progression remains real\. Cross-session comparisons require the History endpoint\./);
  assert.doesNotMatch(progress,/fetch\s*\(/,'Progress missing-history ownership must add zero direct network requests');
});

test('legacy monolith has orchestration ownership but no canonical product-domain claim',()=>{
  const orchestration=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='network-orchestration');
  assert.equal(orchestration.status,'compatibility-orchestrator');
  assert.deepEqual(orchestration.functions,['applyAll','fetchJson','fetchData']);
});
