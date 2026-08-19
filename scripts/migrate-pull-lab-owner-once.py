from pathlib import Path
import re
import shutil


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)


# Source owner: keep the parity-proven renderer byte-for-byte, remove only shadow machinery.
source_path = Path('apps/web/src/features/pull-lab/runtime.js')
source = source_path.read_text()
shadow_start = "  function snapshot(root=document){"
binding_start = "  window.applyPullLabSource=()=>applyPullLabToRoot(document,window.__AVOID_WCL_TELEMETRY__);"
if source.count(shadow_start) != 1 or source.count(binding_start) != 1:
    raise SystemExit('Pull Lab source anchors changed; refusing migration')
start = source.index(shadow_start)
binding = source.index(binding_start, start)
source = source[:start] + source[binding:]
tail_start = source.index(binding_start)
tail_end = source.rindex('})();')
owner_tail = """  window.applyPullLabSource=()=>applyPullLabToRoot(document,window.__AVOID_WCL_TELEMETRY__);
  window.__AVOID_PULL_LAB_SOURCE_RUNTIME__=Object.freeze({
    version:'4.0.0-migration7-owner1',
    sourceOwner:'apps/web/src/features/pull-lab/runtime.js',
    transport:'public/pull-lab-runtime.js',
    mode:'single-source-owner',
    writerPolicy:'single-pull-lab-presentation-owner',
    sources:Object.freeze(['window.__AVOID_WCL_TELEMETRY__']),
    directRequests:0,
    timers:0,
    observers:0,
  });
"""
source = source[:tail_start] + owner_tail + source[tail_end:]
for forbidden in ('shadowAgainstLegacy', 'resetDynamicFields', 'function snapshot', 'parity-shadow', 'mismatches', 'lastMismatch'):
    if forbidden in source:
        raise SystemExit(f'Pull Lab source shadow residue remains: {forbidden}')
source_path.write_text(source)
Path('public/pull-lab-runtime.js').write_text(source)


# Legacy monolith: physically remove only applyPullLab and replace its one orchestration call.
legacy_path = Path('public/wcl-runtime.js')
legacy = legacy_path.read_text()
start_token = 'function applyPullLab() {'
next_token = 'function applyDamageHealing() {'
if legacy.count(start_token) != 1:
    raise SystemExit(f'legacy applyPullLab declarations: expected 1, found {legacy.count(start_token)}')
start = legacy.index(start_token)
end = legacy.index(next_token, start)
legacy = legacy[:start] + legacy[end:]
legacy = replace_once(
    legacy,
    'applyShell();applyCommandCenter();applyPullLab();applyDamageHealing();',
    'applyShell();applyCommandCenter();window.applyPullLabSource?.();applyDamageHealing();',
    'legacy applyAll Pull Lab call',
)
if 'function applyPullLab() {' in legacy:
    raise SystemExit('legacy applyPullLab declaration survived')
if legacy.count('window.applyPullLabSource?.()') != 1:
    raise SystemExit('legacy Pull Lab delegation must exist exactly once')
legacy_path.write_text(legacy)


# Ownership registry.
ownership_path = Path('config/legacy-runtime-ownership.mjs')
ownership = ownership_path.read_text()
ownership = replace_once(ownership,
    "export const LEGACY_RUNTIME_PULL_LAB_ACTIVE_WRITERS=Object.freeze(['applyPullLab']);",
    "export const LEGACY_RUNTIME_PULL_LAB_ACTIVE_WRITERS=Object.freeze([]);",
    'Pull Lab active writers')
ownership = replace_once(ownership,
    "export const LEGACY_RUNTIME_PULL_LAB_SHADOWED_WRITERS=Object.freeze(['applyPullLab']);",
    "export const LEGACY_RUNTIME_PULL_LAB_SHADOWED_WRITERS=Object.freeze([]);",
    'Pull Lab shadowed writers')
ownership = replace_once(ownership,
    "export const LEGACY_RUNTIME_PULL_LAB_PARITY_SHADOWED_WRITERS=Object.freeze(['applyPullLab']);",
    "export const LEGACY_RUNTIME_PULL_LAB_PARITY_SHADOWED_WRITERS=Object.freeze([]);",
    'Pull Lab parity-shadowed writers')
ownership = replace_once(ownership,
    "export const LEGACY_RUNTIME_PULL_LAB_PHYSICALLY_RETIRED=Object.freeze([]);",
    "export const LEGACY_RUNTIME_PULL_LAB_PHYSICALLY_RETIRED=Object.freeze(['applyPullLab']);",
    'Pull Lab physical retirement')
pattern = re.compile(
    r"  responsibility\('pull-lab','pull-lab','compatibility-writer-shadowed','public/wcl-runtime\.js','promote-pull-lab-source-after-browser-parity',\[\n"
    r"    'applyPullLab',\n"
    r"  \]\),\n"
)
ownership, count = pattern.subn('', ownership, count=1)
if count != 1:
    raise SystemExit(f'Pull Lab responsibility: expected 1 block, found {count}')
ownership_path.write_text(ownership)


# Active asset manifest and generated HTML identity.
assets_path = Path('config/active-assets.mjs')
assets = assets_path.read_text()
old_asset = "  asset('pull-lab-source-shadow','/pull-lab-runtime.js?v=4.0.0-migration7-shadow1','pull-lab-source','pull-lab','pull-lab-parity-shadow-non-authoritative','promote-after-browser-parity',{authority:'source-shadow',sourceOwner:'apps/web/src/features/pull-lab/runtime.js'}),"
new_asset = "  asset('pull-lab-source-runtime','/pull-lab-runtime.js?v=4.0.0-migration7-owner1','pull-lab-source','pull-lab','single-source-pull-lab-presentation','keep-stable-source-owned-transport',{authority:'source-owner',sourceOwner:'apps/web/src/features/pull-lab/runtime.js'}),"
assets = replace_once(assets, old_asset, new_asset, 'Pull Lab active asset')
assets_path.write_text(assets)

index_path = Path('index.html')
index = index_path.read_text()
index = replace_once(index,
    '/pull-lab-runtime.js?v=4.0.0-migration7-shadow1',
    '/pull-lab-runtime.js?v=4.0.0-migration7-owner1',
    'Pull Lab index asset identity')
index_path.write_text(index)


# Dedicated Pull Lab contract becomes post-retirement instead of parity-shadow.
pull_test = Path('tests/unit/pull-lab-runtime-v4.test.mjs')
pull_test.write_text("""import test from 'node:test';
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
""")


# Existing manifest unit test: only Pull Lab shadow terminology changes.
manifest_test_path = Path('tests/unit/active-assets-manifest-v4.test.mjs')
manifest_test = manifest_test_path.read_text()
for old, new in (
    ('pullLabShadow', 'pullLabSource'),
    ("asset.id==='pull-lab-source-shadow'", "asset.id==='pull-lab-source-runtime'"),
    ("'/pull-lab-runtime.js?v=4.0.0-migration7-shadow1'", "'/pull-lab-runtime.js?v=4.0.0-migration7-owner1'"),
    ("'source-shadow'", "'source-owner'"),
    ("'pull-lab-parity-shadow-non-authoritative'", "'single-source-pull-lab-presentation'"),
    ("'promote-after-browser-parity'", "'keep-stable-source-owned-transport'"),
):
    if old not in manifest_test:
        raise SystemExit(f'manifest test anchor missing: {old}')
    manifest_test = manifest_test.replace(old, new)
manifest_test_path.write_text(manifest_test)


# Runtime liveness test: source remains passive, but is now authoritative.
safety_path = Path('tests/unit/runtime-dom-safety-v389.test.mjs')
safety = safety_path.read_text()
block_start = "test('CRITICAL PULL LAB PARITY SOURCE:"
block_end = "test('CRITICAL MECHANICS SOURCE OWNER:"
if safety.count(block_start) != 1 or safety.count(block_end) != 1:
    raise SystemExit('runtime safety Pull Lab block anchors changed')
s = safety.index(block_start)
e = safety.index(block_end, s)
replacement = """test('CRITICAL PULL LAB SOURCE OWNER: feature source and transport are identical, passive and authoritative', async () => {
  const [source,transport] = await Promise.all([
    read('apps/web/src/features/pull-lab/runtime.js'),
    read('public/pull-lab-runtime.js'),
  ]);
  assert.equal(transport,source);
  assert.match(source,/window\.applyPullLabSource=/);
  assert.match(source,/mode:'single-source-owner'/);
  assert.match(source,/writerPolicy:'single-pull-lab-presentation-owner'/);
  assert.match(source,/directRequests:0/);
  assert.match(source,/timers:0/);
  assert.match(source,/observers:0/);
  assert.doesNotMatch(source,/parity-shadow|shadowAgainstLegacy|resetDynamicFields|mismatches|lastMismatch/);
  assert.doesNotMatch(source,OBSERVER_CONSTRUCTION);
  assert.doesNotMatch(source,/\.observe\s*\(/);
  assert.doesNotMatch(source,/setInterval|setTimeout|requestAnimationFrame|fetch\s*\(|queueMicrotask|addEventListener/);
});

"""
safety = safety[:s] + replacement + safety[e:]
safety = replace_once(safety,
    "  const pullLabShadow = index.indexOf('/pull-lab-runtime.js?v=4.0.0-migration7-shadow1');",
    "  const pullLabSource = index.indexOf('/pull-lab-runtime.js?v=4.0.0-migration7-owner1');",
    'runtime safety Pull Lab asset')
safety = replace_once(safety,
    "  assert.ok(pullLabShadow > legacy, 'Pull Lab parity source must load after the authoritative legacy writer exists');",
    "  assert.ok(pullLabSource > legacy, 'Pull Lab source owner must load after the legacy data/orchestration runtime');",
    'runtime safety legacy/Pull Lab ordering')
safety = replace_once(safety,
    "  assert.ok(defensiveSource > pullLabShadow, 'Defensive Audit source owner must remain after the passive Pull Lab shadow');",
    "  assert.ok(defensiveSource > pullLabSource, 'Defensive Audit source owner must remain after the Pull Lab source owner');",
    'runtime safety Pull Lab/Defensive ordering')
safety_path.write_text(safety)


# Active legacy responsibility count decreases by exactly one.
legacy_test_path = Path('tests/unit/legacy-runtime-ownership-v4.test.mjs')
legacy_test = legacy_test_path.read_text()
legacy_test = replace_once(
    legacy_test,
    'assert.ok(LEGACY_RUNTIME_RESPONSIBILITIES.length>=10);',
    'assert.ok(LEGACY_RUNTIME_RESPONSIBILITIES.length>=9);',
    'legacy responsibility count',
)
legacy_test_path.write_text(legacy_test)


# Guard the exact mutation surface. Data Truth is deliberately not rewritten here;
# its old parity assertion will be converted separately after inspecting the first owner run.
expected = {
    'apps/web/src/features/pull-lab/runtime.js',
    'public/pull-lab-runtime.js',
    'public/wcl-runtime.js',
    'config/legacy-runtime-ownership.mjs',
    'config/active-assets.mjs',
    'index.html',
    'tests/unit/pull-lab-runtime-v4.test.mjs',
    'tests/unit/active-assets-manifest-v4.test.mjs',
    'tests/unit/runtime-dom-safety-v389.test.mjs',
    'tests/unit/legacy-runtime-ownership-v4.test.mjs',
}
import subprocess
changed = set(subprocess.check_output(['git', 'diff', '--name-only'], text=True).splitlines())
if changed != expected:
    raise SystemExit(f'unexpected mutation surface: {sorted(changed)}')

print('Pull Lab owner migration prepared exactly:')
for path in sorted(changed):
    print(' -', path)
