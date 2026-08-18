import { readFile } from 'node:fs/promises';
import { ACTIVE_LOCAL_SCRIPTS } from '../config/active-assets.mjs';
import {
  LEGACY_RUNTIME_OWNERSHIP_VERSION,
  LEGACY_RUNTIME_PATH,
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
} from '../config/legacy-runtime-ownership.mjs';

const root=new URL('../',import.meta.url);
const [legacy,progress,commandBridge,players,encounter,corpusGuard]=await Promise.all([
  readFile(new URL(LEGACY_RUNTIME_PATH,root),'utf8'),
  readFile(new URL('public/progress-runtime-v3713.js',root),'utf8'),
  readFile(new URL('public/command-center-history-bridge-v4.js',root),'utf8'),
  readFile(new URL('public/player-intelligence-v392.js',root),'utf8'),
  readFile(new URL('public/encounter-intelligence-v375.js',root),'utf8'),
  readFile(new URL('public/corpus-ui-stability-v1.js',root),'utf8'),
]);
const fail=[];
const expect=(condition,message)=>{if(!condition)fail.push(message)};
const declared=[...legacy.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]);
const declaredSet=new Set(declared);
const classified=new Map();

expect(LEGACY_RUNTIME_OWNERSHIP_VERSION==='legacy-runtime-ownership-v4','legacy runtime ownership version must stay explicit');
expect(declared.length===67,`wcl-runtime.js must contain exactly 67 active function declarations after Progress, Players and Corpus retirement; found ${declared.length}`);
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
expect(!LEGACY_RUNTIME_RESPONSIBILITIES.some(entry=>entry.id==='progress-shadowed-writers'),'physically retired Progress functions must not remain active ownership responsibilities');
expect(!LEGACY_RUNTIME_RESPONSIBILITIES.some(entry=>entry.id==='progress-compatibility-guard'),'physically retired missing-history policy must not remain an active legacy responsibility');
expect(!LEGACY_RUNTIME_RESPONSIBILITIES.some(entry=>entry.id==='players-presentation-shadow'),'physically retired Players presentation functions must not remain active ownership responsibilities');

const legacyAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='wcl-legacy-runtime');
const commandBridgeAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='command-center-history-bridge');
const encounterAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='encounter-intelligence');
const corpusGuardAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='corpus-ui-stability');
const progressAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='progress-runtime');
const playersAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='player-intelligence');
expect(legacyAsset?.authority==='compatibility','wcl-runtime.js must remain compatibility-only in active asset ownership');
expect(commandBridgeAsset?.authority==='migration-bridge'&&commandBridgeAsset?.owner==='command-center','Command Center bridge must remain an explicit migration-only owner');
expect(encounterAsset?.authority==='primary'&&encounterAsset?.owner==='mechanics-corpus','Encounter Intelligence must remain the primary Mechanics/Corpus owner');
expect(corpusGuardAsset?.authority==='guard','Corpus stability runtime must remain an explicit guard during this checkpoint');
expect(progressAsset?.authority==='primary'&&progressAsset?.owner==='progress','Progress runtime must remain the primary Progress owner');
expect(playersAsset?.authority==='primary'&&playersAsset?.owner==='players','Player Intelligence runtime must remain the primary Players owner');
expect(ACTIVE_LOCAL_SCRIPTS.indexOf(legacyAsset)<ACTIVE_LOCAL_SCRIPTS.indexOf(commandBridgeAsset),'Command Center bridge must load after the compatibility runtime call sites');
expect(ACTIVE_LOCAL_SCRIPTS.indexOf(legacyAsset)<ACTIVE_LOCAL_SCRIPTS.indexOf(encounterAsset),'canonical Corpus owner must load after the legacy writer so it can shadow the historical global');
expect(ACTIVE_LOCAL_SCRIPTS.indexOf(encounterAsset)<ACTIVE_LOCAL_SCRIPTS.indexOf(corpusGuardAsset),'Corpus stability guard must wrap the already-installed canonical shadow during validation');
expect(ACTIVE_LOCAL_SCRIPTS.indexOf(commandBridgeAsset)<ACTIVE_LOCAL_SCRIPTS.indexOf(progressAsset),'Command Center bridge must load before Progress installs its historical active-screen guards');
expect(ACTIVE_LOCAL_SCRIPTS.indexOf(legacyAsset)<ACTIVE_LOCAL_SCRIPTS.indexOf(playersAsset),'canonical Players owner must load after the compatibility runtime and consume its shared data/helper bridge');
expect(!ACTIVE_LOCAL_SCRIPTS.some(asset=>asset.id==='progress-legacy-retirement'),'temporary Progress retirement guard must not return');

const retiredProgressNames=['applyProgressPage','applyProgressCurve','applyHistoryData','applyRealProgressMatrix','neutralizeMissingHistory'];
expect(JSON.stringify(LEGACY_RUNTIME_PROGRESS_HISTORICAL_INTERCEPTS)===JSON.stringify(retiredProgressNames),'historical Progress interception inventory changed unexpectedly');
expect(JSON.stringify(LEGACY_RUNTIME_PROGRESS_ACTIVE_INTERCEPTS)===JSON.stringify([]),'no historical Progress writer may remain declared in the legacy monolith');
expect(JSON.stringify(LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED)===JSON.stringify(retiredProgressNames),'all five historical Progress compatibility targets must remain physically retired');
for(const fn of LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED){
  expect(!new RegExp(`function\\s+${fn}\\s*\\(`).test(legacy),`${fn} declaration survived physical retirement`);
  expect(!classified.has(fn),`${fn} survived in active legacy ownership responsibilities`);
}
for(const fn of LEGACY_RUNTIME_PROGRESS_HISTORICAL_INTERCEPTS)expect(new RegExp(`['\"]${fn}['\"]`).test(progress),`historical canonical Progress owner no longer records ${fn}`);
expect(/const wrapped=function\(\.\.\.args\)\{if\(active\(\)\)return;return legacy\.apply\(this,args\);\}/.test(progress),'historical Progress owner must retain active-screen-only interception semantics');
expect(/writerPolicy:'single-progress-writer'/.test(progress),'Progress owner must retain single-writer policy');
expect(/setInterval\(\(\)=>renderFull\(false\),750\)/.test(progress),'canonical Progress owner must repaint independently of legacy writer execution');
expect(/&quot;/.test(progress),'historical Progress runtime HTML escaping must remain intact');

const historicalPlayers=['applyPlayers','applyTelemetryPlayers'];
expect(JSON.stringify(LEGACY_RUNTIME_PLAYERS_HISTORICAL_WRITERS)===JSON.stringify(historicalPlayers),'historical Players writer inventory changed unexpectedly');
expect(JSON.stringify(LEGACY_RUNTIME_PLAYERS_ACTIVE_WRITERS)===JSON.stringify([]),'no historical Players presentation writer may remain active in the legacy monolith');
expect(JSON.stringify(LEGACY_RUNTIME_PLAYERS_SHADOWED_WRITERS)===JSON.stringify([]),'Players shadow state must be cleared after physical retirement');
expect(JSON.stringify(LEGACY_RUNTIME_PLAYERS_PHYSICALLY_RETIRED)===JSON.stringify(historicalPlayers),'both historical Players presentation writers must be physically retired');
for(const fn of LEGACY_RUNTIME_PLAYERS_PHYSICALLY_RETIRED){
  expect(!new RegExp(`function\\s+${fn}\\s*\\(`).test(legacy),`${fn} declaration survived physical retirement`);
  expect(!classified.has(fn),`${fn} survived in active legacy ownership responsibilities`);
  expect(new RegExp(`['\"]${fn}['\"]`).test(players),`canonical Players owner must retain historical writer knowledge for ${fn}`);
}
expect(!/applyPlayers\s*\(\s*\)\s*;/.test(legacy),'applyAll must not invoke the retired applyPlayers writer');
expect(!/applyTelemetryPlayers\s*\(\s*\)\s*;/.test(legacy),'supplemental orchestration must not invoke the retired applyTelemetryPlayers writer');
const playersBridge=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='players-data-bridge');
expect(playersBridge?.status==='compatibility-support'&&playersBridge?.functions.includes('playerOutput'),'shared Players data/helper bridge must remain active after presentation retirement');
expect(/window\.__AVOID_PLAYER_INTELLIGENCE_OWNER__=PLAYER_OWNER/.test(players),'canonical Players owner must publish explicit ownership metadata');
expect(/writerPolicy:'single-player-writer'/.test(players),'canonical Players owner must retain single-writer policy');
expect(/function shadowLegacyPlayerWriter\(name\)/.test(players),'canonical Players owner may retain passive historical interception knowledge during migration');
expect((players.match(/setInterval\s*\(/g)||[]).length===1&&/setInterval\(\(\)=>render\(\),750\)/.test(players),'Players retirement must add no polling beyond the existing 750ms canonical repaint');
expect(!/MutationObserver|fetch\s*\(/.test(players),'Players canonical owner may not add observers or direct network requests');

const historicalCorpus=['applyCorpusWorkbench'];
const retiredCorpusHelpers=['corpusCountdown','corpusContext','corpusRequest','refreshCorpusStatus','pollCorpus','corpusCell','corpusButton'];
expect(JSON.stringify(LEGACY_RUNTIME_CORPUS_HISTORICAL_WRITERS)===JSON.stringify(historicalCorpus),'historical Corpus writer inventory changed unexpectedly');
expect(JSON.stringify(LEGACY_RUNTIME_CORPUS_ACTIVE_WRITERS)===JSON.stringify([]),'no legacy Corpus presentation writer may remain active after physical retirement');
expect(JSON.stringify(LEGACY_RUNTIME_CORPUS_SHADOWED_WRITERS)===JSON.stringify([]),'Corpus shadow inventory must be cleared after physical retirement');
expect(JSON.stringify(LEGACY_RUNTIME_CORPUS_PHYSICALLY_RETIRED)===JSON.stringify(historicalCorpus),'historical Corpus presentation writer must be physically retired');
expect(JSON.stringify(LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED)===JSON.stringify(retiredCorpusHelpers),'all seven legacy Corpus workflow helpers must be physically retired');
expect(!LEGACY_RUNTIME_RESPONSIBILITIES.some(entry=>entry.id==='corpus-presentation-shadow'),'retired Corpus presentation cannot remain an active legacy responsibility');
expect(!LEGACY_RUNTIME_RESPONSIBILITIES.some(entry=>entry.id==='corpus-workflow-bridge'),'retired Corpus workflow helpers cannot remain an active legacy responsibility');
for(const fn of [...historicalCorpus,...retiredCorpusHelpers]){
  expect(!new RegExp(`(?:async\s+)?function\s+${fn}\s*\(`).test(legacy),`${fn} declaration survived physical retirement`);
  expect(!classified.has(fn),`${fn} survived in active legacy ownership responsibilities`);
}
expect(!/applyIntelligence\(\);applyCorpusWorkbench\(\);removeRosterIntelligenceOutsideComposition\(\)/.test(legacy),'applyAll must not invoke the retired Corpus renderer');
expect(/function ensureCorpusPanel\(\)/.test(encounter),'canonical Encounter owner must create the Corpus card without the legacy renderer');
expect(/catalogue\.insertAdjacentElement\('beforebegin',panel\)/.test(encounter),'canonical Corpus card must retain placement immediately before the mechanic catalogue');
expect(/dataset\.avoidCorpusOwner='encounter-intelligence-v375'/.test(encounter),'canonical card must publish explicit DOM ownership');
expect(/const legacy=typeof window\.applyCorpusWorkbench==='function'\?window\.applyCorpusWorkbench:null/.test(encounter),'canonical owner must tolerate physical absence of the historical renderer');
expect(/window\.applyCorpusWorkbench=shadow/.test(encounter),'canonical owner must publish the temporary compatibility binding for the stability guard');
expect(/writerPolicy:'single-corpus-writer'/.test(encounter),'Encounter owner must retain the single-Corpus-writer policy');
expect(/legacyRendererPolicy:'canonical-binding-delegates-legacy-when-present'/.test(encounter),'Corpus owner must record post-retirement compatibility semantics');
expect((encounter.match(/setInterval\s*\(/g)||[]).length===1&&/setInterval\(\(\)=>tick\(false\),1500\)/.test(encounter),'Corpus retirement must add no polling beyond the existing Encounter 1500ms loop');
expect((encounter.match(/\bfetch\s*\(/g)||[]).length===2,'Corpus retirement must add zero request call sites beyond the two existing Encounter Corpus fetch paths');
expect(!/MutationObserver/.test(encounter),'Corpus canonical owner may not add mutation observers');
expect(/const nativeCorpusRenderer = window\.applyCorpusWorkbench/.test(corpusGuard),'Corpus stability guard must remain for one additional post-retirement validation round');
expect(/legacyPollingRendererSuppressed: true/.test(corpusGuard),'Corpus stability guard must retain its suppression contract during the extra validation round');

expect((legacy.match(/window\.applyProgressCurve\?\.\(\)/g)||[]).length===1,'Command Center must call the extracted curve through exactly one optional global bridge binding');
expect((legacy.match(/window\.applyHistoryData\?\.\(\)/g)||[]).length===1,'supplemental orchestration must call extracted history through exactly one optional global bridge binding');
expect(/window\.applyProgressCurve=applyCommandCenterProgressCurve/.test(commandBridge),'Command Center bridge must own the progression-curve global binding');
expect(/window\.applyHistoryData=applyCommandCenterHistory/.test(commandBridge),'Command Center bridge must own the history global binding');
expect(/window\.__AVOID_WCL__/.test(commandBridge),'Command Center curve must consume the already-loaded report payload');
expect(/window\.__AVOID_WCL_HISTORY__/.test(commandBridge),'Command Center history must consume the already-loaded History payload');
expect(/findOwnText\('Command Center'\)/.test(commandBridge),'Command Center bridge must stay scoped to Command Center');
expect(!/Are we actually getting better\?/.test(commandBridge),'Command Center bridge may not write the Progress screen');
expect(!/MutationObserver|setInterval|setTimeout|requestAnimationFrame|fetch\s*\(/.test(commandBridge),'Command Center bridge may not introduce observers, polling, timers, animation loops or network requests');

expect(!/function\s+neutralizeMissingHistory\s*\(\s*\)/.test(legacy),'legacy missing-history declaration must be physically retired');
expect(!/neutralizeMissingHistory\s*\(\s*\)\s*;/.test(legacy),'legacy supplemental orchestration must not invoke the retired missing-history writer');
expect(/wrap\('neutralizeMissingHistory'\)/.test(progress),'canonical Progress owner should retain historical interception knowledge during the v4 migration');
expect(/missingHistoryPolicy:'canonical-progress-owner'/.test(progress),'Progress runtime metadata must declare canonical missing-history ownership');
expect(/function\s+renderMissingHistory\s*\(/.test(progress),'canonical Progress owner must contain the missing-history renderer');
for(const text of [
  'Raid-session history unavailable · no Golden fallback',
  'HISTORY UNAVAILABLE',
  'Current-report progression remains real. Cross-session comparisons require the History endpoint.',
])expect(progress.includes(text),`canonical Progress missing-history policy lost required Data Truth text: ${text}`);
expect(!/fetch\s*\(/.test(progress),'canonical Progress owner must not add a direct network request for missing-history handling');

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
console.log(` - ${LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED.length} historical Progress compatibility targets are physically absent from wcl-runtime.js`);
console.log(` - ${LEGACY_RUNTIME_PLAYERS_PHYSICALLY_RETIRED.length} historical Players presentation writers are physically absent from wcl-runtime.js`);
console.log(` - ${LEGACY_RUNTIME_CORPUS_PHYSICALLY_RETIRED.length} historical Corpus presentation writer is physically retired from wcl-runtime.js`);
console.log(` - ${LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED.length} legacy Corpus workflow helpers are physically retired from wcl-runtime.js`);
console.log(' - canonical Encounter Intelligence creates/places the Corpus card, owns the compatibility binding and retains the existing 1500ms polling owner');
console.log(' - shared Players data/helper bridge remains active for the canonical dossier owner');
console.log(' - Command Center owns extracted progression-curve and cross-night history bindings through one passive bridge');
console.log(' - missing-History presentation is now exclusively owned by canonical Progress; the legacy body and call are physically absent');
console.log(` - status distribution ${JSON.stringify(statusCounts)}`);
