import { readFile, writeFile, unlink } from 'node:fs/promises';

async function replaceOnce(path,before,after){
  const source=await readFile(path,'utf8');
  const hits=source.split(before).length-1;
  if(hits!==1)throw new Error(`${path}: expected exactly one migration anchor, found ${hits}`);
  await writeFile(path,source.replace(before,after));
}

await replaceOnce(
  'public/wcl-runtime.js',
  'removeRosterIntelligenceOutsideComposition();applyShell();applyCommandCenter();applyPullLab();applyDamageHealing();window.applyMechanicsAndDefensives?.();applyComposition();applyLive();applySupplemental();applyIntelligence();removeRosterIntelligenceOutsideComposition();applyDataTruthScrub();',
  'removeRosterIntelligenceOutsideComposition();applyShell();applyCommandCenter();applyPullLab();applyDamageHealing();applyComposition();applyLive();applySupplemental();applyIntelligence();removeRosterIntelligenceOutsideComposition();applyDataTruthScrub();'
);

await replaceOnce(
  'scripts/verify-legacy-runtime-ownership.mjs',
  "  LEGACY_RUNTIME_RESPONSIBILITIES,\n  LEGACY_RUNTIME_PROGRESS_HISTORICAL_INTERCEPTS,",
  "  LEGACY_RUNTIME_RESPONSIBILITIES,\n  LEGACY_RUNTIME_MECHANICS_DEFENSIVES_BRIDGES_PHYSICALLY_RETIRED,\n  LEGACY_RUNTIME_PROGRESS_HISTORICAL_INTERCEPTS,"
);

await replaceOnce(
  'scripts/verify-legacy-runtime-ownership.mjs',
  "expect((legacy.match(/window\\.applyMechanicsAndDefensives\\?\\.\\(\\)/g)||[]).length===1,'legacy orchestration must delegate to exactly one optional bridge-owned fallback binding');",
  "expect((legacy.match(/window\\.applyMechanicsAndDefensives\\?\\.\\(\\)/g)||[]).length===0,'retired split fallback call site must be physically absent from legacy orchestration');"
);

await replaceOnce(
  'scripts/verify-legacy-runtime-ownership.mjs',
  "expect(!ACTIVE_LOCAL_SCRIPTS.some(asset=>asset.id==='progress-legacy-retirement'),'temporary Progress retirement guard must not return');",
  "expect(!ACTIVE_LOCAL_SCRIPTS.some(asset=>asset.id==='progress-legacy-retirement'),'temporary Progress retirement guard must not return');\nexpect(!ACTIVE_LOCAL_SCRIPTS.some(asset=>asset.id==='mechanics-defensives-fallback-bridge'),'retired Mechanics/Defensive split bridge must not remain active');\nfor(const retired of LEGACY_RUNTIME_MECHANICS_DEFENSIVES_BRIDGES_PHYSICALLY_RETIRED){\n  try{await access(new URL(retired,root));fail.push(`${retired} physically retired bridge file still exists`)}\n  catch(error){if(error?.code!=='ENOENT')fail.push(`${retired} retirement check failed: ${error?.message||error}`)}\n}"
);

await unlink(new URL(import.meta.url));
console.log('V4 SPLIT BRIDGE RETIREMENT: applied exact call-site and ownership-verifier cleanup');
