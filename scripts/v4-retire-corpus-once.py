from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def require(condition, message):
    if not condition:
        raise SystemExit(message)

def replace_once(text, old, new, label):
    require(text.count(old) == 1, f'{label}: expected exactly one match, found {text.count(old)}')
    return text.replace(old, new, 1)

# ---------------------------------------------------------------------------
# 1. Remove only the eight explicitly approved legacy Corpus functions and
#    the single applyAll() presentation call. Keep legacy Corpus globals and
#    constants for a separate post-green liveness audit.
# ---------------------------------------------------------------------------
runtime_path = ROOT / 'public/wcl-runtime.js'
runtime = runtime_path.read_text()
original_runtime = runtime
ranges = [
    ('function corpusCountdown(', 'function corpusContext('),
    ('function corpusContext(', 'async function corpusRequest('),
    ('async function corpusRequest(', 'async function refreshCorpusStatus('),
    ('async function refreshCorpusStatus(', 'async function pollCorpus('),
    ('async function pollCorpus(', 'function corpusCell('),
    ('function corpusCell(', 'function corpusButton('),
    ('function corpusButton(', 'function applyCorpusWorkbench('),
    ('function applyCorpusWorkbench(', 'function applyAll('),
]
for start_marker, end_marker in ranges:
    start = runtime.find(start_marker)
    end = runtime.find(end_marker, start + len(start_marker))
    require(start >= 0 and end >= 0, f'Runtime boundary missing: {start_marker} -> {end_marker}')
    runtime = runtime[:start] + runtime[end:]

old_apply_all = 'applySupplemental();applyIntelligence();applyCorpusWorkbench();removeRosterIntelligenceOutsideComposition();'
new_apply_all = 'applySupplemental();applyIntelligence();removeRosterIntelligenceOutsideComposition();'
runtime = replace_once(runtime, old_apply_all, new_apply_all, 'applyAll Corpus call')

retired_writer = ['applyCorpusWorkbench']
retired_helpers = ['corpusCountdown','corpusContext','corpusRequest','refreshCorpusStatus','pollCorpus','corpusCell','corpusButton']
for name in retired_writer + retired_helpers:
    require(f'function {name}(' not in runtime and f'async function {name}(' not in runtime, f'{name} declaration survived')
require('const corpusNumber = new Intl.NumberFormat();' in runtime, 'corpusNumber was removed outside approved scope')
require('const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));' in runtime, 'sleep was removed outside approved scope')
require('let corpusState = null;' in runtime, 'Corpus state was cleaned before liveness audit')
require('const corpusEndpoint = new URL("/api/wcl/corpus", location.origin);' in runtime, 'Corpus endpoint was cleaned before liveness audit')
require(runtime != original_runtime, 'Runtime retirement produced no diff')
runtime_path.write_text(runtime)

# ---------------------------------------------------------------------------
# 2. Canonical Encounter must keep a global compatibility binding so the
#    existing stability guard remains meaningful for one extra validation
#    round even though the historical renderer no longer exists.
# ---------------------------------------------------------------------------
encounter_path = ROOT / 'public/encounter-intelligence-v375.js'
encounter = encounter_path.read_text()
old_shadow = """  function shadowLegacyCorpusWriter(){
    if(corpusShadowInstalled)return;
    const legacy=window.applyCorpusWorkbench;if(typeof legacy!=='function')return;
    const shadow=function(...args){if(mechanicsPage()){ensureCorpusPanel();return;}return legacy.apply(this,args);};
    shadow.__avoidCorpusPresentationShadow=true;shadow.__avoidLegacyCorpusWriter=legacy;window.applyCorpusWorkbench=shadow;corpusShadowInstalled=true;
  }
"""
new_shadow = """  function shadowLegacyCorpusWriter(){
    if(corpusShadowInstalled)return;
    const legacy=typeof window.applyCorpusWorkbench==='function'?window.applyCorpusWorkbench:null;
    const shadow=function(...args){if(mechanicsPage()){ensureCorpusPanel();return;}syncCorpusVisibility();if(legacy)return legacy.apply(this,args);};
    shadow.__avoidCorpusPresentationShadow=true;shadow.__avoidLegacyCorpusWriter=legacy;window.applyCorpusWorkbench=shadow;corpusShadowInstalled=true;
  }
"""
encounter = replace_once(encounter, old_shadow, new_shadow, 'Encounter Corpus compatibility binding')
encounter = replace_once(
    encounter,
    "legacyRendererPolicy:'shadow-on-mechanics-delegate-elsewhere'",
    "legacyRendererPolicy:'canonical-binding-delegates-legacy-when-present'",
    'Encounter Corpus owner metadata',
)
encounter_path.write_text(encounter)

# ---------------------------------------------------------------------------
# 3. Ownership manifest: historical writer/helper knowledge remains explicit,
#    but no Corpus responsibility is active in wcl-runtime.js.
# ---------------------------------------------------------------------------
config_path = ROOT / 'config/legacy-runtime-ownership.mjs'
config = config_path.read_text()
for responsibility_id in ('corpus-workflow-bridge', 'corpus-presentation-shadow'):
    pattern = re.compile(
        rf"  responsibility\('{re.escape(responsibility_id)}'.*?\n  \]\),\n",
        re.S,
    )
    config, count = pattern.subn('', config, count=1)
    require(count == 1, f'Could not remove {responsibility_id} ownership responsibility')
config = replace_once(
    config,
    "export const LEGACY_RUNTIME_CORPUS_ACTIVE_WRITERS=Object.freeze(['applyCorpusWorkbench']);",
    "export const LEGACY_RUNTIME_CORPUS_ACTIVE_WRITERS=Object.freeze([]);",
    'Corpus active writer inventory',
)
config = replace_once(
    config,
    "export const LEGACY_RUNTIME_CORPUS_SHADOWED_WRITERS=Object.freeze(['applyCorpusWorkbench']);",
    "export const LEGACY_RUNTIME_CORPUS_SHADOWED_WRITERS=Object.freeze([]);",
    'Corpus shadow writer inventory',
)
config = replace_once(
    config,
    "export const LEGACY_RUNTIME_CORPUS_PHYSICALLY_RETIRED=Object.freeze([]);",
    "export const LEGACY_RUNTIME_CORPUS_PHYSICALLY_RETIRED=Object.freeze(['applyCorpusWorkbench']);\nexport const LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED=Object.freeze(['corpusCountdown','corpusContext','corpusRequest','refreshCorpusStatus','pollCorpus','corpusCell','corpusButton']);",
    'Corpus physical retirement inventory',
)
config = replace_once(
    config,
    '  corpusPhysicallyRetired:LEGACY_RUNTIME_CORPUS_PHYSICALLY_RETIRED,',
    '  corpusPhysicallyRetired:LEGACY_RUNTIME_CORPUS_PHYSICALLY_RETIRED,\n  corpusWorkflowHelpersPhysicallyRetired:LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED,',
    'Corpus ownership export',
)
config_path.write_text(config)

# ---------------------------------------------------------------------------
# 4. Executable ownership verifier: require physical absence, canonical
#    ownership, unchanged Encounter polling/request count, and retained guard.
# ---------------------------------------------------------------------------
verifier_path = ROOT / 'scripts/verify-legacy-runtime-ownership.mjs'
verifier = verifier_path.read_text()
verifier = replace_once(
    verifier,
    '  LEGACY_RUNTIME_CORPUS_PHYSICALLY_RETIRED,\n',
    '  LEGACY_RUNTIME_CORPUS_PHYSICALLY_RETIRED,\n  LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED,\n',
    'Verifier Corpus imports',
)
verifier, count = re.subn(
    r"expect\(declared\.length===75,`[^`]+`\);",
    "expect(declared.length===67,`wcl-runtime.js must contain exactly 67 active function declarations after Progress, Players and Corpus retirement; found ${declared.length}`);",
    verifier,
    count=1,
)
require(count == 1, 'Verifier active-function assertion was not updated')
start = verifier.find("const historicalCorpus=['applyCorpusWorkbench'];")
end = verifier.find("expect((legacy.match(/window\\.applyProgressCurve", start)
require(start >= 0 and end >= 0, 'Verifier Corpus block boundaries not found')
new_verifier_block = r"""const historicalCorpus=['applyCorpusWorkbench'];
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

"""
verifier = verifier[:start] + new_verifier_block + verifier[end:]
verifier = replace_once(
    verifier,
    "console.log(` - ${LEGACY_RUNTIME_CORPUS_SHADOWED_WRITERS.length} historical Corpus presentation writer is shadowed on Mechanics while remaining physically present`);\nconsole.log(' - canonical Encounter Intelligence can create/place the Corpus card and retains the existing 1500ms polling owner');",
    "console.log(` - ${LEGACY_RUNTIME_CORPUS_PHYSICALLY_RETIRED.length} historical Corpus presentation writer is physically retired from wcl-runtime.js`);\nconsole.log(` - ${LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED.length} legacy Corpus workflow helpers are physically retired from wcl-runtime.js`);\nconsole.log(' - canonical Encounter Intelligence creates/places the Corpus card, owns the compatibility binding and retains the existing 1500ms polling owner');",
    'Verifier Corpus summary',
)
verifier_path.write_text(verifier)

# ---------------------------------------------------------------------------
# 5. Unit ownership contract mirrors the executable verifier.
# ---------------------------------------------------------------------------
test_path = ROOT / 'tests/unit/legacy-runtime-ownership-v4.test.mjs'
test = test_path.read_text()
test = replace_once(
    test,
    '  LEGACY_RUNTIME_CORPUS_PHYSICALLY_RETIRED,\n',
    '  LEGACY_RUNTIME_CORPUS_PHYSICALLY_RETIRED,\n  LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED,\n',
    'Unit Corpus imports',
)
start = test.find("test('Corpus presentation is shadowed by canonical Encounter while workflow helpers remain physically present'")
end = test.find("test('Command Center owns the retired curve and history behavior through one passive bridge'", start)
require(start >= 0 and end >= 0, 'Unit Corpus test boundaries not found')
new_test_block = r"""test('Corpus presentation and legacy workflow helpers are physically retired while canonical Encounter remains sole owner',async()=>{
  const writers=['applyCorpusWorkbench'];
  const helpers=['corpusCountdown','corpusContext','corpusRequest','refreshCorpusStatus','pollCorpus','corpusCell','corpusButton'];
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_HISTORICAL_WRITERS,writers);
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_ACTIVE_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_SHADOWED_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_PHYSICALLY_RETIRED,writers);
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED,helpers);
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='corpus-presentation-shadow'),undefined);
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='corpus-workflow-bridge'),undefined);

  const [legacy,owner,guard]=await Promise.all([read('public/wcl-runtime.js'),read('public/encounter-intelligence-v375.js'),read('public/corpus-ui-stability-v1.js')]);
  for(const name of [...writers,...helpers]) assert.doesNotMatch(legacy,new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`),`${name} must be physically absent`);
  assert.doesNotMatch(legacy,/applyIntelligence\(\);applyCorpusWorkbench\(\);removeRosterIntelligenceOutsideComposition\(\)/,'applyAll no longer invokes Corpus presentation');
  assert.match(owner,/function ensureCorpusPanel\(\)/);
  assert.match(owner,/catalogue\.insertAdjacentElement\('beforebegin',panel\)/);
  assert.match(owner,/dataset\.avoidCorpusOwner='encounter-intelligence-v375'/);
  assert.match(owner,/const legacy=typeof window\.applyCorpusWorkbench==='function'\?window\.applyCorpusWorkbench:null/);
  assert.match(owner,/window\.applyCorpusWorkbench=shadow/,'canonical owner keeps the temporary compatibility binding for the guard');
  assert.match(owner,/writerPolicy:'single-corpus-writer'/);
  assert.match(owner,/legacyRendererPolicy:'canonical-binding-delegates-legacy-when-present'/);
  assert.equal((owner.match(/setInterval\s*\(/g)||[]).length,1,'retirement adds no polling beyond the existing Encounter loop');
  assert.match(owner,/setInterval\(\(\)=>tick\(false\),1500\)/);
  assert.equal((owner.match(/\bfetch\s*\(/g)||[]).length,2,'retirement adds zero request call sites');
  assert.doesNotMatch(owner,/MutationObserver/);
  assert.match(guard,/const nativeCorpusRenderer = window\.applyCorpusWorkbench/,'stability guard stays active for one extra validation round');
  assert.match(guard,/legacyPollingRendererSuppressed: true/);
});

"""
test = test[:start] + new_test_block + test[end:]
test_path.write_text(test)

# ---------------------------------------------------------------------------
# 6. Single changelog only.
# ---------------------------------------------------------------------------
changelog_path = ROOT / 'CHANGELOG.md'
changelog = changelog_path.read_text()
note = "- Physically retired the eight legacy Corpus runtime functions (`corpusCountdown`, `corpusContext`, `corpusRequest`, `refreshCorpusStatus`, `pollCorpus`, `corpusCell`, `corpusButton`, `applyCorpusWorkbench`) and removed the `applyAll()` presentation call after the green shadow checkpoint and explicit approval. Encounter Intelligence remains the sole Corpus presentation/data-polling owner; its existing 1500 ms loop and two request call sites are unchanged. The Corpus stability guard remains for one additional post-retirement validation round.\n"
if note not in changelog:
    anchor = '### Mainline integration — v3.9.0 to v3.9.2\n'
    require(anchor in changelog, 'Changelog insertion anchor missing')
    changelog = changelog.replace(anchor, note + '\n' + anchor, 1)
changelog_path.write_text(changelog)

print('V4 CORPUS PHYSICAL RETIREMENT: PATCHED')
print(' - 8 approved legacy Corpus functions removed')
print(' - applyAll Corpus presentation call removed')
print(' - canonical Encounter compatibility binding retained for guard round')
print(' - legacy Corpus globals/constants intentionally untouched pending liveness audit')
