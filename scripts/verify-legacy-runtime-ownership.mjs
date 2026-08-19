import { access, readFile } from 'node:fs/promises';
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
  LEGACY_RUNTIME_CORPUS_RESIDUALS_PHYSICALLY_RETIRED,
  LEGACY_RUNTIME_CORPUS_GUARDS_PHYSICALLY_RETIRED,
} from '../config/legacy-runtime-ownership.mjs';

const root=new URL('../',import.meta.url);
const [legacy,progress,commandBridge,players,encounter]=await Promise.all([
  readFile(new URL(LEGACY_RUNTIME_PATH,root),'utf8'),
  readFile(new URL('public/progress-runtime-v3713.js',root),'utf8'),
  readFile(new URL('public/command-center-history-bridge-v4.js',root),'utf8'),
  readFile(new URL('public/player-intelligence-v392.js',root),'utf8'),
  readFile(new URL('public/encounter-intelligence-v375.js',root),'utf8'),
]);
const fail=[];
const expect=(condition,message)=>{if(!condition)fail.push(message)};
const declared=[...legacy.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]);
const declaredSet=new Set(declared);
const classified=new Map();

expect(LEGACY_RUNTIME_OWNERSHIP_VERSION==='legacy-runtime-ownership-v4','legacy runtime ownership version must stay explicit');
expect(declared.length===62,`wcl-runtime.js must contain exactly 62 active function declarations after Progress, Players, Corpus, Mechanics and Defensive Audit presentation retirement; found ${declared.length}`);
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
expect(!declaredSet.has('applyMechanicsAndDefensives'),'shared Mechanics/Defensive fallback declaration must be physically retired');
expect(!LEGACY_RUNTIME_RESPONSIBILITIES.some(entry=>entry.id==='mechanics-defensives-fallback'),'retired shared fallback cannot remain an active legacy responsibility');
expect((legacy.match(/window\.applyMechanicsAndDefensives\?\.\(\)/g)||[]).length===1,'legacy orchestration must delegate to exactly one optional bridge-owned fallback binding');
for(const fn of ['applyTelemetryMechanics','applyIntelligenceMechanics'])expect(!declaredSet.has(fn),`${fn} declaration must be physically retired from the legacy monolith`);
expect((legacy.match(/window\.applyTelemetryMechanics\?\.\(\)/g)||[]).length===1,'supplemental orchestration must delegate Mechanics telemetry to exactly one source-owned binding');
expect((legacy.match(/window\.applyIntelligenceMechanics\?\.\(\)/g)||[]).length===1,'intelligence orchestration must delegate Mechanics intelligence to exactly one source-owned binding');

const legacyAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='wcl-legacy-runtime');
const commandBridgeAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='command-center-history-bridge');
const encounterAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='encounter-intelligence');
const progressAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='progress-runtime');
const playersAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='player-intelligence');
expect(legacyAsset?.authority==='compatibility','wcl-runtime.js must remain compatibility-only in active asset ownership');
expect(commandBridgeAsset?.authority==='migration-bridge'&&commandBridgeAsset?.owner==='command-center','Command Center bridge must remain an explicit migration-only owner');
expect(encounterAsset?.authority==='primary'&&encounterAsset?.owner==='mechanics-corpus','Encounter Intelligence must remain the primary Mechanics/Corpus owner');
expect(!ACTIVE_LOCAL_SCRIPTS.some(asset=>asset.id==='corpus-ui-stability'),'retired Corpus stability guard must not remain active');
expect(progressAsset?.authority==='primary'&&progressAsset?.owner==='progress','Progress runtime must remain the primary Progress owner');
expect(playersAsset?.authority==='primary'&&playersAsset?.owner==='players','Player Intelligence runtime must remain the primary Players owner');
expect(ACTIVE_LOCAL_SCRIPTS.indexOf(legacyAsset)<ACTIVE_LOCAL_SCRIPTS.indexOf(commandBridgeAsset),'Command Center bridge must load after the compatibility runtime call sites');
expect(ACTIVE_LOCAL_SCRIPTS.indexOf(legacyAsset)<ACTIVE_LOCAL_SCRIPTS.indexOf(encounterAsset),'canonical Corpus owner must remain after the compatibility runtime in the reviewed load order');
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
const retiredCorpusResidues=['corpusEndpoint','corpusState','corpusLoadedEncounter','corpusFetching','corpusDriving','corpusTargetReports','corpusNumber','sleep'];
expect(JSON.stringify(LEGACY_RUNTIME_CORPUS_HISTORICAL_WRITERS)===JSON.stringify(historicalCorpus),'historical Corpus writer inventory changed unexpectedly');
expect(JSON.stringify(LEGACY_RUNTIME_CORPUS_ACTIVE_WRITERS)===JSON.stringify([]),'no legacy Corpus presentation writer may remain active after physical retirement');
expect(JSON.stringify(LEGACY_RUNTIME_CORPUS_SHADOWED_WRITERS)===JSON.stringify([]),'Corpus shadow inventory must be cleared after physical retirement');
expect(JSON.stringify(LEGACY_RUNTIME_CORPUS_PHYSICALLY_RETIRED)===JSON.stringify(historicalCorpus),'historical Corpus presentation writer must be physically retired');
expect(JSON.stringify(LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED)===JSON.stringify(retiredCorpusHelpers),'all seven legacy Corpus workflow helpers must be physically retired');
expect(JSON.stringify(LEGACY_RUNTIME_CORPUS_RESIDUALS_PHYSICALLY_RETIRED)===JSON.stringify(retiredCorpusResidues),'all eight dead legacy Corpus residues must be physically retired');
expect(JSON.stringify(LEGACY_RUNTIME_CORPUS_GUARDS_PHYSICALLY_RETIRED)===JSON.stringify(['public/corpus-ui-stability-v1.js']),'retired Corpus guard inventory changed unexpectedly');
expect(!LEGACY_RUNTIME_RESPONSIBILITIES.some(entry=>entry.id==='corpus-presentation-shadow'),'retired Corpus presentation cannot remain an active legacy responsibility');
expect(!LEGACY_RUNTIME_RESPONSIBILITIES.some(entry=>entry.id==='corpus-workflow-bridge'),'retired Corpus workflow helpers cannot remain an active legacy responsibility');
for(const fn of [...historicalCorpus,...retiredCorpusHelpers]){
  expect(!new RegExp(`(?:async\\s+)?function\\s+${fn}\\s*\\(`).test(legacy),`${fn} declaration survived physical retirement`);
  expect(!classified.has(fn),`${fn} survived in active legacy ownership responsibilities`);
}
for(const token of retiredCorpusResidues)expect(!new RegExp(`\\b${token}\\b`).test(legacy),`${token} residue survived physical retirement`);
expect(!/applyIntelligence\(\);applyCorpusWorkbench\(\);removeRosterIntelligenceOutsideComposition\(\)/.test(legacy),'applyAll must not invoke the retired Corpus renderer');
expect(/function ensureCorpusPanel\(\)/.test(encounter),'canonical Encounter owner must create the Corpus card');
expect(/function syncCorpusVisibility\(\)/.test(encounter),'canonical Encounter owner must own cross-page Corpus visibility');
expect(/catalogue\.insertAdjacentElement\('beforebegin',panel\)/.test(encounter),'canonical Corpus card must retain placement immediately before the mechanic catalogue');
expect(/dataset\.avoidCorpusOwner='encounter-intelligence-v375'/.test(encounter),'canonical card must publish explicit DOM ownership');
expect(!/window\.applyCorpusWorkbench|shadowLegacyCorpusWriter|corpusShadowInstalled/.test(encounter),'canonical owner must contain no executable legacy Corpus compatibility binding');
expect(/writerPolicy:'single-corpus-writer'/.test(encounter),'Encounter owner must retain the single-Corpus-writer policy');
expect(/legacyRendererPolicy:'physically-retired-no-runtime-binding'/.test(encounter),'Corpus owner must record final legacy renderer retirement');
expect(/legacyCompatibilityBinding:false/.test(encounter),'Corpus owner must explicitly publish zero legacy compatibility binding');
expect(/crossPageVisibilityOwner:'encounter-intelligence-v375'/.test(encounter),'Encounter must own cross-page visibility after guard deletion');
expect(encounter.includes("window.addEventListener('popstate',syncCorpusVisibility)"),'canonical Corpus owner must retain popstate visibility protection');
expect(encounter.includes("document.addEventListener('click',event=>{if(event.target?.closest?.('nav button'))setTimeout(()=>tick(true),120);},true);"),'canonical Corpus owner must retain navigation repaint protection');
expect((encounter.match(/setInterval\s*\(/g)||[]).length===1&&/setInterval\(\(\)=>tick\(false\),1500\)/.test(encounter),'Corpus closure must retain exactly the existing Encounter 1500ms loop');
expect((encounter.match(/\bfetch\s*\(/g)||[]).length===2,'Corpus closure must add zero request call sites beyond the two canonical Encounter Corpus fetch paths');
expect(!/MutationObserver|requestAnimationFrame/.test(encounter),'Corpus canonical owner may not add observers or guard animation loops');
try{await access(new URL('public/corpus-ui-stability-v1.js',root));fail.push('retired Corpus stability guard file still exists')}catch{}

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
