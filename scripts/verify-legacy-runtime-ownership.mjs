import { readFile } from 'node:fs/promises';
import { ACTIVE_LOCAL_SCRIPTS } from '../config/active-assets.mjs';
import {
  LEGACY_RUNTIME_OWNERSHIP_VERSION,
  LEGACY_RUNTIME_PATH,
  LEGACY_RUNTIME_RESPONSIBILITIES,
  LEGACY_RUNTIME_PROGRESS_SHADOWED,
} from '../config/legacy-runtime-ownership.mjs';

const root=new URL('../',import.meta.url);
const [legacy,progress]=await Promise.all([
  readFile(new URL(LEGACY_RUNTIME_PATH,root),'utf8'),
  readFile(new URL('public/progress-runtime-v3713.js',root),'utf8'),
]);
const fail=[];
const expect=(condition,message)=>{if(!condition)fail.push(message)};
const declared=[...legacy.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]);
const declaredSet=new Set(declared);
const classified=new Map();

expect(LEGACY_RUNTIME_OWNERSHIP_VERSION==='legacy-runtime-ownership-v1','legacy runtime ownership version must stay explicit');
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
const progressAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='progress-runtime');
expect(legacyAsset?.authority==='compatibility','wcl-runtime.js must remain compatibility-only in active asset ownership');
expect(progressAsset?.authority==='primary'&&progressAsset?.owner==='progress','Progress runtime must remain the primary Progress owner');
expect(ACTIVE_LOCAL_SCRIPTS.indexOf(legacyAsset)<ACTIVE_LOCAL_SCRIPTS.indexOf(progressAsset),'Progress owner must load after the legacy runtime it shadows');

const progressEntry=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='progress-shadowed-writers');
expect(progressEntry?.status==='shadowed-by-primary-owner','Progress legacy writers must be explicitly shadowed, not primary');
expect(progressEntry?.canonicalOwner==='public/progress-runtime-v3713.js','Progress legacy writers must point to the canonical Progress owner');
expect(JSON.stringify(progressEntry?.functions)===JSON.stringify(LEGACY_RUNTIME_PROGRESS_SHADOWED),'Progress shadowed writer list must have one canonical declaration');
for(const fn of LEGACY_RUNTIME_PROGRESS_SHADOWED){
  expect(new RegExp(`['\"]${fn}['\"]`).test(progress),`canonical Progress owner no longer intercepts ${fn}`);
}
expect(/writerPolicy:'single-progress-writer'/.test(progress),'Progress owner must retain single-writer policy');

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
console.log(` - Progress has ${LEGACY_RUNTIME_PROGRESS_SHADOWED.length} legacy writers shadowed by progress-runtime-v3713.js`);
console.log(` - status distribution ${JSON.stringify(statusCounts)}`);
