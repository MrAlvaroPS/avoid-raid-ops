import { readFile } from 'node:fs/promises';
import { ACTIVE_LOCAL_SCRIPTS } from '../config/active-assets.mjs';
import {
  LEGACY_RUNTIME_OWNERSHIP_VERSION,
  LEGACY_RUNTIME_PATH,
  LEGACY_RUNTIME_RESPONSIBILITIES,
  LEGACY_RUNTIME_PROGRESS_INTERCEPTED,
  LEGACY_RUNTIME_PROGRESS_EXECUTION_RETIRED,
  LEGACY_RUNTIME_PROGRESS_RETIREMENT_CANDIDATES,
} from '../config/legacy-runtime-ownership.mjs';

const root=new URL('../',import.meta.url);
const [legacy,guard,progress]=await Promise.all([
  readFile(new URL(LEGACY_RUNTIME_PATH,root),'utf8'),
  readFile(new URL('public/progress-legacy-retirement-v4.js',root),'utf8'),
  readFile(new URL('public/progress-runtime-v3713.js',root),'utf8'),
]);
const fail=[];
const expect=(condition,message)=>{if(!condition)fail.push(message)};
const declared=[...legacy.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]);
const declaredSet=new Set(declared);
const classified=new Map();

expect(LEGACY_RUNTIME_OWNERSHIP_VERSION==='legacy-runtime-ownership-v3','legacy runtime ownership version must stay explicit');
expect(declared.length===declaredSet.size,'wcl-runtime.js contains duplicate function declarations');

for(const responsibility of LEGACY_RUNTIME_RESPONSIBILITIES){
  expect(Boolean(responsibility.id&&responsibility.domain&&responsibility.status&&responsibility.canonicalOwner&&responsibility.retirement),`responsibility ${responsibility.id||'<missing>'} lacks ownership metadata`);
  expect(!/misc|other|unknown/i.test(`${responsibility.id} ${responsibility.domain}`),`responsibility ${responsibility.id} uses an unowned catch-all domain`);
  expect(responsibility.functions.length>0,`responsibility ${responsibility.id} classifies no functions`);
  for(const fn of responsibility.functions){
    if(classified.has(fn))fail.push(`${fn} is classified twice: ${classified.get(fn).id} and ${responsibility.id}`);
    else classified.set(fn,responsibility);
  }
}

const unclassified=declared.filter(fn=>!classified.has(fn));
const stale=[...classified.keys()].filter(fn=>!declaredSet.has(fn));
expect(unclassified.length===0,`unclassified wcl-runtime.js functions: ${unclassified.join(', ')||'none'}`);
expect(stale.length===0,`ownership manifest lists missing functions: ${stale.join(', ')||'none'}`);

const legacyAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='wcl-legacy-runtime');
const guardAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='progress-legacy-retirement');
const progressAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='progress-runtime');
const legacyIndex=ACTIVE_LOCAL_SCRIPTS.indexOf(legacyAsset);
const guardIndex=ACTIVE_LOCAL_SCRIPTS.indexOf(guardAsset);
const progressIndex=ACTIVE_LOCAL_SCRIPTS.indexOf(progressAsset);
expect(legacyAsset?.authority==='compatibility','wcl-runtime.js must remain compatibility-only in active asset ownership');
expect(guardAsset?.authority==='guard'&&guardAsset?.retirement==='delete-with-retired-legacy-writers','Progress execution-retirement guard must be explicitly temporary');
expect(progressAsset?.authority==='primary'&&progressAsset?.owner==='progress','Progress runtime must remain the primary Progress owner');
expect(guardIndex===legacyIndex+1&&progressIndex>guardIndex,'temporary Progress retirement guard must load immediately after legacy runtime and before the canonical Progress owner');

const progressEntry=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='progress-shadowed-writers');
expect(progressEntry?.status==='execution-retired','retirable Progress legacy writers must be execution-retired before source deletion');
expect(progressEntry?.canonicalOwner==='public/progress-runtime-v3713.js','retirable Progress legacy writers must point to the canonical Progress owner');
expect(JSON.stringify(progressEntry?.functions)===JSON.stringify(LEGACY_RUNTIME_PROGRESS_RETIREMENT_CANDIDATES),'Progress retirement candidates must have one canonical declaration');
expect(JSON.stringify(LEGACY_RUNTIME_PROGRESS_EXECUTION_RETIRED)===JSON.stringify(LEGACY_RUNTIME_PROGRESS_RETIREMENT_CANDIDATES),'execution-retired set must exactly match the pending physical-deletion set');
expect(/const EXECUTION_RETIRED=Object\.freeze\(\['applyProgressPage','applyRealProgressMatrix'\]\)/.test(guard),'retirement guard must globally disable exactly the two Progress-only legacy writers');
expect(!/applyProgressCurve|applyHistoryData/.test(guard),'retirement guard must never disable shared Command Center behavior');
expect(/retired\.__avoidExecutionRetired=true/.test(guard),'retirement guard must mark its hard no-op writers');
expect(/retired\.__irisProgressOwner=true/.test(guard),'canonical Progress wrapper must skip already hard-retired writers');
expect(/temporary-guard-until-physical-source-deletion/.test(guard),'retirement guard must advertise its deletion condition');
for(const fn of LEGACY_RUNTIME_PROGRESS_INTERCEPTED){
  expect(new RegExp(`['\"]${fn}['\"]`).test(progress),`historical canonical Progress owner no longer accounts for ${fn}`);
}
expect(/const wrapped=function\(\.\.\.args\)\{if\(active\(\)\)return;return legacy\.apply\(this,args\);\}/.test(progress),'historical Progress owner must retain its active-screen-only interception semantics');
expect(/writerPolicy:'single-progress-writer'/.test(progress),'Progress owner must retain single-writer policy');
expect(/setInterval\(\(\)=>renderFull\(false\),750\)/.test(progress),'canonical Progress owner must repaint independently of legacy writer execution');
expect(/&quot;/.test(progress),'historical Progress runtime HTML escaping must remain intact');

const curveEntry=classified.get('applyProgressCurve');
expect(curveEntry?.id==='shared-progression-curve','applyProgressCurve must remain classified separately from retirable Progress writers');
expect(curveEntry?.status==='shared-compatibility-helper','applyProgressCurve is still shared compatibility behavior, not dead Progress code');
expect(curveEntry?.canonicalOwner==='public/wcl-runtime.js','applyProgressCurve must stay owned by compatibility runtime until its Command Center use is extracted');
expect((legacy.match(/applyProgressCurve\s*\(\s*\)/g)||[]).length>=2,'applyProgressCurve no longer has the known cross-screen call pattern; review ownership before changing it');

const historyEntry=classified.get('applyHistoryData');
expect(historyEntry?.id==='shared-history-writer','applyHistoryData must remain classified as shared until its Command Center branch is split');
expect(historyEntry?.status==='shared-compatibility-writer','applyHistoryData is not currently safe Progress-only dead code');
expect(!LEGACY_RUNTIME_PROGRESS_RETIREMENT_CANDIDATES.includes('applyHistoryData'),'applyHistoryData cannot be a physical-retirement candidate while Command Center consumes it');
const historyStart=legacy.indexOf('function applyHistoryData()');
const historyEnd=legacy.indexOf('\nfunction applyLiveStatus',historyStart);
const historyBody=historyStart>=0&&historyEnd>historyStart?legacy.slice(historyStart,historyEnd):'';
expect(/Are we actually getting better\?/.test(historyBody),'applyHistoryData known Progress branch disappeared; review ownership');
expect(/findOwnText\("Command Center"\)/.test(historyBody),'applyHistoryData known Command Center branch disappeared; review ownership');

const applyAll=classified.get('applyAll');
expect(applyAll?.status==='compatibility-orchestrator','applyAll must stay classified as orchestration, not a product-domain owner');
for(const forbidden of ['primary','canonical'])expect(!applyAll?.status.includes(forbidden),`applyAll may not become ${forbidden} ownership`);

if(fail.length){
  console.error('LEGACY RUNTIME OWNERSHIP VERIFICATION: FAIL');
  for(const message of fail)console.error(' -',message);
  process.exit(1);
}
const statusCounts={};
for(const entry of LEGACY_RUNTIME_RESPONSIBILITIES)statusCounts[entry.status]=(statusCounts[entry.status]||0)+entry.functions.length;
console.log('LEGACY RUNTIME OWNERSHIP VERIFICATION: PASS');
console.log(` - ${declared.length} function declarations are explicitly classified; 0 unowned`);
console.log(` - ${LEGACY_RUNTIME_RESPONSIBILITIES.length} responsibilities have named domains and retirement paths`);
console.log(` - Progress accounts for ${LEGACY_RUNTIME_PROGRESS_INTERCEPTED.length} legacy functions; ${LEGACY_RUNTIME_PROGRESS_EXECUTION_RETIRED.length} Progress-only writers are execution-retired by a temporary guard and pending source deletion`);
console.log(' - applyProgressCurve remains shared with Command Center and cannot be removed as Progress-only code');
console.log(' - applyHistoryData also remains shared until its Command Center history writer is split');
console.log(` - status distribution ${JSON.stringify(statusCounts)}`);
