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

test('Pull Lab has an explicit source, byte-identical transport and authoritative source-owned active asset',async()=>{
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
  const asset=ACTIVE_LOCAL_SCRIPTS.find(entry=>entry.id==='pull-lab-source-runtime');
  assert.equal(asset?.authority,'source-owner');
  assert.equal(asset?.sourceOwner,LEGACY_RUNTIME_PULL_LAB_RUNTIME_SOURCE);
  assert.equal(asset?.role,'single-source-pull-lab-presentation');
  assert.equal(asset?.retirement,'keep-stable-source-owned-transport');
});

test('Pull Lab source owner is passive and cannot create a second browser lifecycle',async()=>{
  const source=await read(LEGACY_RUNTIME_PULL_LAB_RUNTIME_SOURCE);
  assert.match(source,/mode:'single-source-owner'/);
  assert.match(source,/writerPolicy:'single-pull-lab-presentation-owner'/);
  assert.match(source,/window\.applyPullLabSource=/);
  assert.match(source,/directRequests:0/);
  assert.match(source,/timers:0/);
  assert.match(source,/observers:0/);
  assert.doesNotMatch(source,/parity-shadow|shadowAgainstLegacy|resetDynamicFields|mismatches|lastMismatch/);
  assert.doesNotMatch(source,/fetch\s*\(/);
  assert.doesNotMatch(source,/MutationObserver/);
  assert.doesNotMatch(source,/setInterval\s*\(/);
  assert.doesNotMatch(source,/setTimeout\s*\(/);
  assert.doesNotMatch(source,/requestAnimationFrame\s*\(/);
  assert.doesNotMatch(source,/queueMicrotask\s*\(/);
  assert.doesNotMatch(source,/addEventListener\s*\(/);
});

test('Pull Lab legacy writer is physically retired after green browser parity',async()=>{
  assert.deepEqual(LEGACY_RUNTIME_PULL_LAB_HISTORICAL_WRITERS,['applyPullLab']);
  assert.deepEqual(LEGACY_RUNTIME_PULL_LAB_ACTIVE_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_PULL_LAB_SHADOWED_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_PULL_LAB_PARITY_SHADOWED_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_PULL_LAB_PHYSICALLY_RETIRED,['applyPullLab']);
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='pull-lab'),undefined);
  const legacy=await read('public/wcl-runtime.js');
  assert.doesNotMatch(legacy,/function\s+applyPullLab\s*\(/,'legacy Pull Lab writer must be physically absent');
  assert.match(legacy,/window\.applyPullLabSource\?\.\(\)/,'legacy orchestration must delegate Pull Lab to the feature source owner');
  assert.equal((legacy.match(/applyPullLabSource/g)||[]).length,1,'legacy monolith gets one Pull Lab source-owner delegation only');
});
