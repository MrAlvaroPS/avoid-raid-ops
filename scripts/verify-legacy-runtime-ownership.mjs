import { readFile } from 'node:fs/promises';
import { ACTIVE_LOCAL_SCRIPTS } from '../config/active-assets.mjs';
import {
  LEGACY_RUNTIME_OWNERSHIP_VERSION,
  LEGACY_RUNTIME_PATH,
  LEGACY_RUNTIME_RESPONSIBILITIES,
  LEGACY_RUNTIME_PROGRESS_HISTORICAL_INTERCEPTS,
  LEGACY_RUNTIME_PROGRESS_ACTIVE_INTERCEPTS,
  LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED,
} from '../config/legacy-runtime-ownership.mjs';

const root=new URL('../',import.meta.url);
const [legacy,progress,historyBridge]=await Promise.all([
  readFile(new URL(LEGACY_RUNTIME_PATH,root),'utf8'),
  readFile(new URL('public/progress-runtime-v3713.js',root),'utf8'),
  readFile(new URL('public/command-center-history-bridge-v4.js',root),'utf8'),
]);
const fail=[];
const expect=(condition,message)=>{if(!condition)fail.push(message)};
const declared=[...legacy.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]);
const declaredSet=new Set(declared);
const classified=new Map();

expect(LEGACY_RUNTIME_OWNERSHIP_VERSION==='legacy-runtime-ownership-v4','legacy runtime ownership version must stay explicit');
expect(declared.length===80,`wcl-runtime.js must contain exactly 80 active function declarations after the first physical retirement; found ${declared.length}`);
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
expect(!LEGACY_RUNTIME_RESPONSIBILITIES.some(entry=>entry.id==='progress-shadowed-writers'),'physically retired functions must not remain active ownership responsibilities');

const legacyAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='wcl-legacy-runtime');
const historyBridgeAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='command-center-history-bridge');
const progressAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='progress-runtime');
expect(legacyAsset?.authority==='compatibility','wcl-runtime.js must remain compatibility-only in active asset ownership');
expect(historyBridgeAsset?.authority==='migration-bridge'&&historyBridgeAsset?.owner==='command-center','Command Center history bridge must remain an explicit migration-only owner');
expect(progressAsset?.authority==='primary'&&progressAsset?.owner==='progress','Progress runtime must remain the primary Progress owner');
expect(ACTIVE_LOCAL_SCRIPTS.indexOf(legacyAsset)<ACTIVE_LOCAL_SCRIPTS.indexOf(historyBridgeAsset),'Command Center history bridge must load after the legacy declaration it replaces');
expect(ACTIVE_LOCAL_SCRIPTS.indexOf(historyBridgeAsset)<ACTIVE_LOCAL_SCRIPTS.indexOf(progressAsset),'Command Center history bridge must load before Progress installs its active-screen guard');
expect(!ACTIVE_LOCAL_SCRIPTS.some(asset=>asset.id==='progress-legacy-retirement'),'temporary Progress retirement guard must disappear after physical source deletion');

expect(JSON.stringify(LEGACY_RUNTIME_PROGRESS_HISTORICAL_INTERCEPTS)===JSON.stringify(['applyProgressPage','applyProgressCurve','applyHistoryData','applyRealProgressMatrix']),'historical Progress interception inventory changed unexpectedly');
expect(JSON.stringify(LEGACY_RUNTIME_PROGRESS_ACTIVE_INTERCEPTS)===JSON.stringify(['applyProgressCurve','applyHistoryData']),'only shared Progress/Command Center compatibility functions may remain active');
expect(JSON.stringify(LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED)===JSON.stringify(['applyProgressPage','applyRealProgressMatrix']),'physical retirement inventory must remain explicit');
for(const fn of LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED){
  expect(!new RegExp(`function\\s+${fn}\\s*\\(`).test(legacy),`${fn} declaration survived physical retirement`);
  expect(!new RegExp(`${fn}\\s*\\(\\s*\\)`).test(legacy),`${fn} orchestration call survived physical retirement`);
}
for(const fn of LEGACY_RUNTIME_PROGRESS_ACTIVE_INTERCEPTS)expect(new RegExp(`function\\s+${fn}\\s*\\(`).test(legacy),`${fn} shared compatibility function disappeared`);
for(const fn of LEGACY_RUNTIME_PROGRESS_HISTORICAL_INTERCEPTS)expect(new RegExp(`['\"]${fn}['\"]`).test(progress),`historical canonical Progress owner no longer records ${fn}`);
expect(/const wrapped=function\(\.\.\.args\)\{if\(active\(\)\)return;return legacy\.apply\(this,args\);\}/.test(progress),'historical Progress owner must retain active-screen-only interception semantics');
expect(/writerPolicy:'single-progress-writer'/.test(progress),'Progress owner must retain single-writer policy');
expect(/setInterval\(\(\)=>renderFull\(false\),750\)/.test(progress),'canonical Progress owner must repaint independently of legacy writer execution');
expect(/&quot;/.test(progress),'historical Progress runtime HTML escaping must remain intact');

const curveEntry=classified.get('applyProgressCurve');
expect(curveEntry?.id==='shared-progression-curve','applyProgressCurve must remain separately classified');
expect(curveEntry?.status==='shared-compatibility-helper','applyProgressCurve is still shared compatibility behavior');
expect(curveEntry?.canonicalOwner==='public/wcl-runtime.js','applyProgressCurve must stay owned by compatibility runtime until Command Center extraction');
const legacyWithoutCurveDeclaration=legacy.replace(/function\s+applyProgressCurve\s*\(\s*\)/,'function __applyProgressCurveDeclaration()');
expect((legacyWithoutCurveDeclaration.match(/applyProgressCurve\s*\(\s*\)/g)||[]).length===1,'after Progress writer deletion, applyProgressCurve must have exactly the Command Center call site');

const historyEntry=classified.get('applyHistoryData');
expect(historyEntry?.id==='shared-history-writer','applyHistoryData must remain explicitly classified while its legacy body exists');
expect(historyEntry?.status==='shadowed-compatibility-writer','legacy applyHistoryData body must be shadowed before physical deletion');
expect(historyEntry?.canonicalOwner==='public/command-center-history-bridge-v4.js','Command Center history bridge must own active non-Progress history presentation');
expect(!LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED.includes('applyHistoryData'),'applyHistoryData cannot enter physical retirement history until its legacy declaration is deleted');
const historyStart=legacy.indexOf('function applyHistoryData()');
const historyEnd=legacy.indexOf('\nfunction applyLiveStatus',historyStart);
const historyBody=historyStart>=0&&historyEnd>historyStart?legacy.slice(historyStart,historyEnd):'';
expect(/Are we actually getting better\?/.test(historyBody),'legacy mixed history body unexpectedly changed before physical retirement');
expect(/findOwnText\("Command Center"\)/.test(historyBody),'legacy mixed history body unexpectedly lost its Command Center branch');
expect(/window\.applyHistoryData=applyCommandCenterHistory/.test(historyBridge),'bridge must replace the legacy global binding exactly once');
expect(/window\.__AVOID_WCL_HISTORY__/.test(historyBridge),'bridge must consume the shared History payload instead of issuing another request');
expect(/findOwnText\('Command Center'\)/.test(historyBridge),'bridge must be scoped to Command Center');
expect(!/Are we actually getting better\?/.test(historyBridge),'bridge may not write the Progress screen');
expect(!/MutationObserver|setInterval|setTimeout|fetch\s*\(/.test(historyBridge),'history bridge may not introduce observers, polling, timers or network requests');

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
console.log(` - ${declared.length} active function declarations are explicitly classified; 0 unowned`);
console.log(` - ${LEGACY_RUNTIME_RESPONSIBILITIES.length} active responsibilities have named domains and retirement paths`);
console.log(` - ${LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED.length} Progress-only legacy writers are physically absent from wcl-runtime.js`);
console.log(' - applyProgressCurve remains shared with Command Center and has one remaining compatibility call site');
console.log(' - applyHistoryData is shadowed by a timer-free Command Center bridge before Progress interception');
console.log(` - status distribution ${JSON.stringify(statusCounts)}`);
