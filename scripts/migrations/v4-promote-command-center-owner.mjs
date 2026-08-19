import { readFile, writeFile, unlink } from 'node:fs/promises';

async function replaceOnce(path,before,after){
  const source=await readFile(path,'utf8');
  const hits=source.split(before).length-1;
  if(hits!==1)throw new Error(`${path}: expected exactly one migration anchor, found ${hits}`);
  await writeFile(path,source.replace(before,after));
}

await replaceOnce(
  'scripts/verify-legacy-runtime-ownership.mjs',
  "const [legacy,progress,commandBridge,players,encounter]=await Promise.all([\n  readFile(new URL(LEGACY_RUNTIME_PATH,root),'utf8'),\n  readFile(new URL('public/progress-runtime-v3713.js',root),'utf8'),\n  readFile(new URL('public/command-center-history-bridge-v4.js',root),'utf8'),\n  readFile(new URL('public/player-intelligence-v392.js',root),'utf8'),\n  readFile(new URL('public/encounter-intelligence-v375.js',root),'utf8'),\n]);",
  "const [legacy,progress,commandSource,commandTransport,players,encounter]=await Promise.all([\n  readFile(new URL(LEGACY_RUNTIME_PATH,root),'utf8'),\n  readFile(new URL('public/progress-runtime-v3713.js',root),'utf8'),\n  readFile(new URL('apps/web/src/features/command-center/runtime.js',root),'utf8'),\n  readFile(new URL('public/command-center-runtime.js',root),'utf8'),\n  readFile(new URL('public/player-intelligence-v392.js',root),'utf8'),\n  readFile(new URL('public/encounter-intelligence-v375.js',root),'utf8'),\n]);"
);

await replaceOnce(
  'scripts/verify-legacy-runtime-ownership.mjs',
  "const commandBridgeAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='command-center-history-bridge');",
  "const commandCenterAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='command-center-source-runtime');"
);

await replaceOnce(
  'scripts/verify-legacy-runtime-ownership.mjs',
  "expect(commandBridgeAsset?.authority==='migration-bridge'&&commandBridgeAsset?.owner==='command-center','Command Center bridge must remain an explicit migration-only owner');",
  "expect(commandCenterAsset?.authority==='source-owner'&&commandCenterAsset?.owner==='command-center-source'&&commandCenterAsset?.sourceOwner==='apps/web/src/features/command-center/runtime.js','Command Center must be owned by its feature source runtime');"
);

await replaceOnce(
  'scripts/verify-legacy-runtime-ownership.mjs',
  "expect(ACTIVE_LOCAL_SCRIPTS.indexOf(legacyAsset)<ACTIVE_LOCAL_SCRIPTS.indexOf(commandBridgeAsset),'Command Center bridge must load after the compatibility runtime call sites');",
  "expect(ACTIVE_LOCAL_SCRIPTS.indexOf(legacyAsset)<ACTIVE_LOCAL_SCRIPTS.indexOf(commandCenterAsset),'Command Center source owner must load after the compatibility runtime call sites');"
);

await replaceOnce(
  'scripts/verify-legacy-runtime-ownership.mjs',
  "expect(ACTIVE_LOCAL_SCRIPTS.indexOf(commandBridgeAsset)<ACTIVE_LOCAL_SCRIPTS.indexOf(progressAsset),'Command Center bridge must load before Progress installs its historical active-screen guards');",
  "expect(ACTIVE_LOCAL_SCRIPTS.indexOf(commandCenterAsset)<ACTIVE_LOCAL_SCRIPTS.indexOf(progressAsset),'Command Center source owner must load before Progress installs its historical active-screen guards');"
);

await replaceOnce(
  'scripts/verify-legacy-runtime-ownership.mjs',
  "expect((legacy.match(/window\\.applyProgressCurve\\?\\.\\(\\)/g)||[]).length===1,'Command Center must call the extracted curve through exactly one optional global bridge binding');\nexpect((legacy.match(/window\\.applyHistoryData\\?\\.\\(\\)/g)||[]).length===1,'supplemental orchestration must call extracted history through exactly one optional global bridge binding');\nexpect(/window\\.applyProgressCurve=applyCommandCenterProgressCurve/.test(commandBridge),'Command Center bridge must own the progression-curve global binding');\nexpect(/window\\.applyHistoryData=applyCommandCenterHistory/.test(commandBridge),'Command Center bridge must own the history global binding');\nexpect(/window\\.__AVOID_WCL__/.test(commandBridge),'Command Center curve must consume the already-loaded report payload');\nexpect(/window\\.__AVOID_WCL_HISTORY__/.test(commandBridge),'Command Center history must consume the already-loaded History payload');\nexpect(/findOwnText\\('Command Center'\\)/.test(commandBridge),'Command Center bridge must stay scoped to Command Center');\nexpect(!/Are we actually getting better\\?/.test(commandBridge),'Command Center bridge may not write the Progress screen');\nexpect(!/MutationObserver|setInterval|setTimeout|requestAnimationFrame|fetch\\s*\\(/.test(commandBridge),'Command Center bridge may not introduce observers, polling, timers, animation loops or network requests');",
  "expect((legacy.match(/window\\.applyProgressCurve\\?\\.\\(\\)/g)||[]).length===1,'Command Center must call the extracted curve through exactly one optional source-owned binding');\nexpect((legacy.match(/window\\.applyHistoryData\\?\\.\\(\\)/g)||[]).length===1,'supplemental orchestration must call extracted history through exactly one optional source-owned binding');\nexpect(commandSource===commandTransport,'Command Center public transport must stay byte-identical to its feature-owned source');\nexpect(/window\\.applyProgressCurve=applyCommandCenterProgressCurve/.test(commandSource),'Command Center source owner must own the progression-curve global binding');\nexpect(/window\\.applyHistoryData=applyCommandCenterHistory/.test(commandSource),'Command Center source owner must own the history global binding');\nexpect(/window\\.__AVOID_WCL__/.test(commandSource),'Command Center curve must consume the already-loaded report payload');\nexpect(/window\\.__AVOID_WCL_HISTORY__/.test(commandSource),'Command Center history must consume the already-loaded History payload');\nexpect(/findOwnText\\('Command Center'\\)/.test(commandSource),'Command Center source owner must stay scoped to Command Center');\nexpect(/mode:'single-source-owner'/.test(commandSource),'Command Center runtime must publish single-source ownership');\nexpect(/writerPolicy:'single-command-center-progression-history-owner'/.test(commandSource),'Command Center runtime must publish its writer policy');\nexpect(!/Are we actually getting better\\?/.test(commandSource),'Command Center source owner may not write the Progress screen');\nexpect(!/MutationObserver|setInterval|setTimeout|requestAnimationFrame|fetch\\s*\\(/.test(commandSource),'Command Center source owner may not introduce observers, polling, timers, animation loops or network requests');"
);

await replaceOnce(
  'scripts/verify-legacy-runtime-ownership.mjs',
  "console.log(' - Command Center owns extracted progression-curve and cross-night history bindings through one passive bridge');",
  "console.log(' - Command Center owns extracted progression-curve and cross-night history bindings through one passive feature source owner');"
);

const releasePath='tests/unit/v3711-release.test.mjs';
let release=await readFile(releasePath,'utf8');
const oldQuery='command-center-runtime\\.js\\?v=4\\.0\\.0-migration6-transport1';
const newQuery='command-center-runtime\\.js\\?v=4\\.0\\.0-migration6-owner1';
const queryHits=release.split(oldQuery).length-1;
if(queryHits!==1)throw new Error(`${releasePath}: expected one regex query anchor, found ${queryHits}`);
release=release.replace(oldQuery,newQuery);
const oldLiteral='/command-center-runtime.js?v=4.0.0-migration6-transport1';
const literalHits=release.split(oldLiteral).length-1;
if(literalHits!==2)throw new Error(`${releasePath}: expected two literal query anchors, found ${literalHits}`);
release=release.split(oldLiteral).join('/command-center-runtime.js?v=4.0.0-migration6-owner1');
await writeFile(releasePath,release);

await unlink(new URL(import.meta.url));
console.log('V4 COMMAND CENTER OWNER PROMOTION: aligned central ownership and historical release contracts');
