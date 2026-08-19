import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { ACTIVE_LOCAL_SCRIPTS } from '../../config/active-assets.mjs';
import {
  LEGACY_RUNTIME_RESPONSIBILITIES,
  LEGACY_RUNTIME_PULL_LAB_SOURCE_OWNER,
  LEGACY_RUNTIME_PULL_LAB_RUNTIME_SOURCE,
  LEGACY_RUNTIME_PULL_LAB_RUNTIME_TRANSPORT,
  LEGACY_RUNTIME_PULL_LAB_HISTORICAL_WRITERS,
  LEGACY_RUNTIME_PULL_LAB_ACTIVE_WRITERS,
  LEGACY_RUNTIME_PULL_LAB_SHADOWED_WRITERS,
  LEGACY_RUNTIME_PULL_LAB_PARITY_SHADOWED_WRITERS,
  LEGACY_RUNTIME_PULL_LAB_PHYSICALLY_RETIRED,
} from '../../config/legacy-runtime-ownership.mjs';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('Pull Lab has an explicit source, byte-identical transport and non-authoritative active asset',async()=>{
  assert.equal(LEGACY_RUNTIME_PULL_LAB_SOURCE_OWNER,'apps/web/src/features/pull-lab/PullLab.js');
  assert.equal(LEGACY_RUNTIME_PULL_LAB_RUNTIME_SOURCE,'apps/web/src/features/pull-lab/runtime.js');
  assert.equal(LEGACY_RUNTIME_PULL_LAB_RUNTIME_TRANSPORT,'public/pull-lab-runtime.js');
  await Promise.all([
    access(new URL(`../../${LEGACY_RUNTIME_PULL_LAB_SOURCE_OWNER}`,import.meta.url)),
    access(new URL(`../../${LEGACY_RUNTIME_PULL_LAB_RUNTIME_SOURCE}`,import.meta.url)),
    access(new URL(`../../${LEGACY_RUNTIME_PULL_LAB_RUNTIME_TRANSPORT}`,import.meta.url)),
  ]);
  const [source,transport]=await Promise.all([
    read(LEGACY_RUNTIME_PULL_LAB_RUNTIME_SOURCE),
    read(LEGACY_RUNTIME_PULL_LAB_RUNTIME_TRANSPORT),
  ]);
  assert.equal(transport,source,'public Pull Lab transport must stay byte-identical to its feature-owned source');
  const asset=ACTIVE_LOCAL_SCRIPTS.find(entry=>entry.id==='pull-lab-source-shadow');
  assert.equal(asset?.authority,'source-shadow');
  assert.equal(asset?.sourceOwner,LEGACY_RUNTIME_PULL_LAB_RUNTIME_SOURCE);
  assert.equal(asset?.retirement,'promote-after-browser-parity');
});

test('Pull Lab shadow is passive and cannot create a second browser lifecycle',async()=>{
  const source=await read(LEGACY_RUNTIME_PULL_LAB_RUNTIME_SOURCE);
  assert.match(source,/mode:'parity-shadow'/);
  assert.match(source,/writerPolicy:'legacy-authoritative-source-shadow-only'/);
  assert.match(source,/window\.applyPullLabSource=/);
  assert.match(source,/shadows:Object\.freeze\(\['applyPullLab'\]\)/);
  assert.match(source,/shadowAgainstLegacy/);
  assert.doesNotMatch(source,/fetch\s*\(/);
  assert.doesNotMatch(source,/MutationObserver/);
  assert.doesNotMatch(source,/setInterval\s*\(/);
  assert.doesNotMatch(source,/setTimeout\s*\(/);
  assert.doesNotMatch(source,/requestAnimationFrame\s*\(/);
  assert.doesNotMatch(source,/queueMicrotask\s*\(/);
  assert.doesNotMatch(source,/addEventListener\s*\(/);
  assert.equal((source.match(/shadowAgainstLegacy\s*\(\s*\)/g)||[]).length,1,'shadow function must only be declared, never auto-run');
});

test('Pull Lab legacy writer remains authoritative until browser parity is green',async()=>{
  assert.deepEqual(LEGACY_RUNTIME_PULL_LAB_HISTORICAL_WRITERS,['applyPullLab']);
  assert.deepEqual(LEGACY_RUNTIME_PULL_LAB_ACTIVE_WRITERS,['applyPullLab']);
  assert.deepEqual(LEGACY_RUNTIME_PULL_LAB_SHADOWED_WRITERS,['applyPullLab']);
  assert.deepEqual(LEGACY_RUNTIME_PULL_LAB_PARITY_SHADOWED_WRITERS,['applyPullLab']);
  assert.deepEqual(LEGACY_RUNTIME_PULL_LAB_PHYSICALLY_RETIRED,[]);
  const responsibility=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='pull-lab');
  assert.equal(responsibility?.status,'compatibility-writer-shadowed');
  assert.equal(responsibility?.canonicalOwner,'public/wcl-runtime.js');
  const legacy=await read('public/wcl-runtime.js');
  assert.equal((legacy.match(/function\s+applyPullLab\s*\(/g)||[]).length,1,'legacy Pull Lab writer must remain intact during parity stage');
  assert.equal((legacy.match(/applyPullLab\s*\(\s*\)/g)||[]).length,2,'one declaration plus one applyAll invocation must remain during parity stage');
  assert.doesNotMatch(legacy,/window\.applyPullLabSource\?\.\(\)/,'legacy runtime must not delegate visible product rendering before promotion');
});
