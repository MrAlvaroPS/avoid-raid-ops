from pathlib import Path

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text()

def write(path, text):
    (ROOT / path).write_text(text)

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)

# 1) Remove the eight dead Corpus residues from the legacy runtime.
path = 'public/wcl-runtime.js'
text = read(path)
text = replace_once(
    text,
    """const corpusEndpoint = new URL("/api/wcl/corpus", location.origin);

let telemetry = null;
let historyData = null;
let intelligence = null;
let selectedPlayerIndex = 0;
let corpusState = null;
let corpusLoadedEncounter = null;
let corpusFetching = false;
let corpusDriving = false;
let corpusTargetReports = 1000;
""",
    """let telemetry = null;
let historyData = null;
let intelligence = null;
let selectedPlayerIndex = 0;
""",
    'legacy Corpus state block',
)
text = replace_once(
    text,
    """const corpusNumber = new Intl.NumberFormat();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
""",
    '',
    'legacy Corpus formatter/sleep block',
)
for token in (
    'corpusEndpoint','corpusState','corpusLoadedEncounter','corpusFetching',
    'corpusDriving','corpusTargetReports','corpusNumber','sleep'
):
    if token in text:
        raise SystemExit(f'{path}: retired residue still present: {token}')
if '.corpus-workbench' not in text:
    raise SystemExit(f'{path}: canonical Corpus click-isolation selector must remain')
write(path, text)

# 2) Remove the temporary legacy shadow/global binding from the canonical Encounter owner.
path = 'public/encounter-intelligence-v375.js'
text = read(path)
text = replace_once(text, "  let corpusShadowInstalled=false;\n", '', 'Corpus shadow state')
shadow = """  function shadowLegacyCorpusWriter(){
    if(corpusShadowInstalled)return;
    const legacy=typeof window.applyCorpusWorkbench==='function'?window.applyCorpusWorkbench:null;
    const shadow=function(...args){if(mechanicsPage()){ensureCorpusPanel();return;}syncCorpusVisibility();if(legacy)return legacy.apply(this,args);};
    shadow.__avoidCorpusPresentationShadow=true;shadow.__avoidLegacyCorpusWriter=legacy;window.applyCorpusWorkbench=shadow;corpusShadowInstalled=true;
  }

"""
text = replace_once(text, shadow, '', 'Corpus legacy shadow function')
old_bottom = """  async function tick(force=false){patchVersion();shadowLegacyCorpusWriter();if(!mechanicsPage()){syncCorpusVisibility();return;}ensureCorpusPanel();const [status,model]=await Promise.all([fetchStatus(force),fetchModel(force)]);if(model)render(model,status);}
  shadowLegacyCorpusWriter();
  window.__AVOID_ENCOUNTER_CORPUS_OWNER__=Object.freeze({version:VERSION,owner:'encounter-intelligence-v375',pageOwner:'Mechanics',writerPolicy:'single-corpus-writer',historicalWriters:Object.freeze(['applyCorpusWorkbench']),legacyRendererPolicy:'canonical-binding-delegates-legacy-when-present',canonicalPanelCreation:true,pollingIntervalMs:1500});
"""
new_bottom = """  async function tick(force=false){patchVersion();if(!mechanicsPage()){syncCorpusVisibility();return;}ensureCorpusPanel();const [status,model]=await Promise.all([fetchStatus(force),fetchModel(force)]);if(model)render(model,status);}
  window.__AVOID_ENCOUNTER_CORPUS_OWNER__=Object.freeze({version:VERSION,owner:'encounter-intelligence-v375',pageOwner:'Mechanics',writerPolicy:'single-corpus-writer',historicalWriters:Object.freeze(['applyCorpusWorkbench']),legacyRendererPolicy:'physically-retired-no-runtime-binding',legacyCompatibilityBinding:false,canonicalPanelCreation:true,crossPageVisibilityOwner:'encounter-intelligence-v375',pollingIntervalMs:1500});
"""
text = replace_once(text, old_bottom, new_bottom, 'Corpus canonical owner footer')
for token in ('corpusShadowInstalled','shadowLegacyCorpusWriter','window.applyCorpusWorkbench','__avoidCorpusPresentationShadow','__avoidLegacyCorpusWriter'):
    if token in text:
        raise SystemExit(f'{path}: temporary compatibility token survived: {token}')
for required in (
    "function ensureCorpusPanel()",
    "function syncCorpusVisibility()",
    "catalogue.insertAdjacentElement('beforebegin',panel)",
    "window.addEventListener('popstate',syncCorpusVisibility)",
    "setInterval(()=>tick(false),1500)",
    "legacyRendererPolicy:'physically-retired-no-runtime-binding'",
    "legacyCompatibilityBinding:false",
):
    if required not in text:
        raise SystemExit(f'{path}: required canonical Corpus contract missing: {required}')
if text.count('setInterval(') != 1:
    raise SystemExit(f'{path}: expected exactly one polling loop after cleanup')
if text.count('fetch(') != 2:
    raise SystemExit(f'{path}: expected exactly two Corpus request call sites after cleanup')
if 'MutationObserver' in text:
    raise SystemExit(f'{path}: MutationObserver introduced unexpectedly')
write(path, text)

# 3) Remove the now-redundant guard from transport and disk.
path = 'config/active-assets.mjs'
text = read(path)
guard_asset = "  asset('corpus-ui-stability','/corpus-ui-stability-v1.js?v=1.1.0','mechanics-corpus','mechanics-page-guard','mechanics-only-corpus-visibility-guard','retire-after-page-ownership-is-source-native',{authority:'guard'}),\n"
text = replace_once(text, guard_asset, '', 'active Corpus guard asset')
write(path, text)

path = 'index.html'
text = read(path)
text = replace_once(text, '    <script src="/corpus-ui-stability-v1.js?v=1.1.0" defer></script>\n', '', 'index Corpus guard script')
write(path, text)

guard_path = ROOT / 'public/corpus-ui-stability-v1.js'
if not guard_path.exists():
    raise SystemExit('public/corpus-ui-stability-v1.js must exist before approved physical deletion')
guard_path.unlink()

# 4) Record the completed retirement in ownership metadata.
path = 'config/legacy-runtime-ownership.mjs'
text = read(path)
anchor = "export const LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED=Object.freeze(['corpusCountdown','corpusContext','corpusRequest','refreshCorpusStatus','pollCorpus','corpusCell','corpusButton']);\n"
addition = anchor + "export const LEGACY_RUNTIME_CORPUS_RESIDUALS_PHYSICALLY_RETIRED=Object.freeze(['corpusEndpoint','corpusState','corpusLoadedEncounter','corpusFetching','corpusDriving','corpusTargetReports','corpusNumber','sleep']);\nexport const LEGACY_RUNTIME_CORPUS_GUARDS_PHYSICALLY_RETIRED=Object.freeze(['public/corpus-ui-stability-v1.js']);\n"
text = replace_once(text, anchor, addition, 'Corpus ownership residual inventory')
anchor = "  corpusWorkflowHelpersPhysicallyRetired:LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED,\n"
addition = anchor + "  corpusResidualsPhysicallyRetired:LEGACY_RUNTIME_CORPUS_RESIDUALS_PHYSICALLY_RETIRED,\n  corpusGuardsPhysicallyRetired:LEGACY_RUNTIME_CORPUS_GUARDS_PHYSICALLY_RETIRED,\n"
text = replace_once(text, anchor, addition, 'Corpus ownership object fields')
write(path, text)

# 5) Update active-asset unit contract.
path = 'tests/unit/active-assets-manifest-v4.test.mjs'
text = read(path)
text = replace_once(text, "  assert.equal(ACTIVE_LOCAL_SCRIPTS.length,11);\n", "  assert.equal(ACTIVE_LOCAL_SCRIPTS.length,10);\n", 'active runtime count')
needle = "  assert.equal(ACTIVE_LOCAL_SCRIPTS.some(asset=>asset.id==='progress-legacy-retirement'),false,'temporary retirement guard must not survive physical source deletion');\n"
replacement = needle + "  assert.equal(ACTIVE_LOCAL_SCRIPTS.some(asset=>asset.id==='corpus-ui-stability'),false,'Corpus migration guard must be physically retired after the green post-retirement checkpoint');\n"
text = replace_once(text, needle, replacement, 'active asset guard absence')
write(path, text)

# 6) Replace the hosted Corpus guard test with source-native visibility/ownership checks.
path = 'tests/unit/corpus-v36-hosted.test.mjs'
text = read(path)
old = """test('v375 corpus stability guard is release-wiring ready',async()=>{
  const guard=await read('../../public/corpus-ui-stability-v1.js');
  assert.match(guard,/nativeCorpusRenderer/);
  assert.match(guard,/encounter-intelligence-v375/);
  assert.match(guard,/window\\.applyCorpusWorkbench = function stableCorpusWorkbench/);
  assert.match(guard,/legacyPollingRendererSuppressed: true/);
});
"""
new = """test('v375 canonical Corpus owner is source-native after migration guard retirement',async()=>{
  const owner=await read('../../public/encounter-intelligence-v375.js');
  assert.match(owner,/function ensureCorpusPanel\\(\\)/);
  assert.match(owner,/function syncCorpusVisibility\\(\\)/);
  assert.match(owner,/dataset\\.avoidPageOwner='Mechanics'/);
  assert.match(owner,/legacyRendererPolicy:'physically-retired-no-runtime-binding'/);
  assert.match(owner,/legacyCompatibilityBinding:false/);
  assert.match(owner,/window\\.addEventListener\\('popstate',syncCorpusVisibility\\)/);
  assert.doesNotMatch(owner,/window\\.applyCorpusWorkbench|shadowLegacyCorpusWriter|corpusShadowInstalled/);
});
"""
text = replace_once(text, old, new, 'hosted Corpus guard unit test')
write(path, text)

# 7) Make critical screen isolation/release wiring test the canonical owner, not the retired guard.
path = 'tests/critical/v390-screen-data-safety.test.mjs'
text = read(path)
old = """test('CRITICAL SCREEN ISOLATION: Encounter Corpus is page-owned by Mechanics and cannot be forced visible elsewhere',async()=>{
  const guard=await read('public/corpus-ui-stability-v1.js');
  assert.match(guard,/const PAGE_OWNER = 'Mechanics'/);
  assert.match(guard,/if \\(!onMechanics\\)/);
  assert.match(guard,/current\\.style\\.display = 'none'/);
  assert.match(guard,/dataset\\.avoidPageOwner/);
  assert.doesNotMatch(guard,/if \\(panel\\?\\.querySelector\\('\\.encounter-intelligence-v375'\\)\\) \\{\\s*panel\\.style\\.display = '';\\s*return;/s,'the old cross-tab visibility bug must not return');
});
"""
new = """test('CRITICAL SCREEN ISOLATION: Encounter Corpus is source-owned by Mechanics and hidden elsewhere',async()=>{
  const owner=await read('public/encounter-intelligence-v375.js');
  assert.match(owner,/function mechanicsPage\\(\\)/);
  assert.match(owner,/function syncCorpusVisibility\\(\\)/);
  assert.match(owner,/if\\(panel&&!mechanicsPage\\(\\)\\)panel\\.style\\.display='none'/);
  assert.match(owner,/dataset\\.avoidPageOwner='Mechanics'/);
  assert.match(owner,/crossPageVisibilityOwner:'encounter-intelligence-v375'/);
  assert.doesNotMatch(owner,/window\\.applyCorpusWorkbench|shadowLegacyCorpusWriter|requestAnimationFrame/,'retired compatibility visibility machinery must not return');
});
"""
text = replace_once(text, old, new, 'critical Corpus screen isolation test')
text = replace_once(
    text,
    "  const runtime=index.indexOf('/wcl-runtime.js?v=3.8.5');\n  const players=index.indexOf('/player-intelligence-v392.js?v=3.9.2');\n",
    "  const runtime=index.indexOf('/wcl-runtime.js?v=3.8.5');\n  const encounter=index.indexOf('/encounter-intelligence-v375.js?v=3.8.5');\n  const players=index.indexOf('/player-intelligence-v392.js?v=3.9.2');\n",
    'critical release encounter index',
)
text = replace_once(
    text,
    "  assert.ok(bootstrap>=0&&dataHub>bootstrap&&knowledgeReindex>dataHub&&runtime>knowledgeReindex&&players>runtime);\n  assert.ok(index.includes('/corpus-ui-stability-v1.js?v=1.1.0'));\n",
    "  assert.ok(bootstrap>=0&&dataHub>bootstrap&&knowledgeReindex>dataHub&&runtime>knowledgeReindex&&encounter>runtime&&players>encounter);\n  assert.ok(!index.includes('/corpus-ui-stability-v1.js'),'retired Corpus guard must not be transported');\n",
    'critical release guard wiring',
)
write(path, text)

# 8) Update legacy ownership verifier.
path = 'scripts/verify-legacy-runtime-ownership.mjs'
text = read(path)
text = replace_once(text, "import { readFile } from 'node:fs/promises';\n", "import { access, readFile } from 'node:fs/promises';\n", 'verifier fs import')
text = replace_once(
    text,
    "  LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED,\n} from '../config/legacy-runtime-ownership.mjs';\n",
    "  LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED,\n  LEGACY_RUNTIME_CORPUS_RESIDUALS_PHYSICALLY_RETIRED,\n  LEGACY_RUNTIME_CORPUS_GUARDS_PHYSICALLY_RETIRED,\n} from '../config/legacy-runtime-ownership.mjs';\n",
    'verifier Corpus ownership imports',
)
old = """const [legacy,progress,commandBridge,players,encounter,corpusGuard]=await Promise.all([
  readFile(new URL(LEGACY_RUNTIME_PATH,root),'utf8'),
  readFile(new URL('public/progress-runtime-v3713.js',root),'utf8'),
  readFile(new URL('public/command-center-history-bridge-v4.js',root),'utf8'),
  readFile(new URL('public/player-intelligence-v392.js',root),'utf8'),
  readFile(new URL('public/encounter-intelligence-v375.js',root),'utf8'),
  readFile(new URL('public/corpus-ui-stability-v1.js',root),'utf8'),
]);
"""
new = """const [legacy,progress,commandBridge,players,encounter]=await Promise.all([
  readFile(new URL(LEGACY_RUNTIME_PATH,root),'utf8'),
  readFile(new URL('public/progress-runtime-v3713.js',root),'utf8'),
  readFile(new URL('public/command-center-history-bridge-v4.js',root),'utf8'),
  readFile(new URL('public/player-intelligence-v392.js',root),'utf8'),
  readFile(new URL('public/encounter-intelligence-v375.js',root),'utf8'),
]);
"""
text = replace_once(text, old, new, 'verifier read set')
text = replace_once(text, "const corpusGuardAsset=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='corpus-ui-stability');\n", '', 'verifier guard asset')
text = replace_once(text, "expect(corpusGuardAsset?.authority==='guard','Corpus stability runtime must remain an explicit guard during this checkpoint');\n", "expect(!ACTIVE_LOCAL_SCRIPTS.some(asset=>asset.id==='corpus-ui-stability'),'retired Corpus stability guard must not remain active');\n", 'verifier guard manifest expectation')
text = replace_once(text, "expect(ACTIVE_LOCAL_SCRIPTS.indexOf(legacyAsset)<ACTIVE_LOCAL_SCRIPTS.indexOf(encounterAsset),'canonical Corpus owner must load after the legacy writer so it can shadow the historical global');\n", "expect(ACTIVE_LOCAL_SCRIPTS.indexOf(legacyAsset)<ACTIVE_LOCAL_SCRIPTS.indexOf(encounterAsset),'canonical Corpus owner must remain after the compatibility runtime in the reviewed load order');\n", 'verifier encounter ordering message')
text = replace_once(text, "expect(ACTIVE_LOCAL_SCRIPTS.indexOf(encounterAsset)<ACTIVE_LOCAL_SCRIPTS.indexOf(corpusGuardAsset),'Corpus stability guard must wrap the already-installed canonical shadow during validation');\n", '', 'verifier guard ordering')
start = text.index("const historicalCorpus=['applyCorpusWorkbench'];")
end = text.index("expect((legacy.match(/window\\.applyProgressCurve", start)
new_block = r"""const historicalCorpus=['applyCorpusWorkbench'];
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
expect(!/applyCorpusWorkbench|shadowLegacyCorpusWriter|corpusShadowInstalled/.test(encounter),'canonical owner must contain no executable legacy Corpus compatibility binding');
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
"""
text = text[:start] + new_block + "\n" + text[end:]
write(path, text)

# 9) Update legacy ownership unit test in lockstep.
path = 'tests/unit/legacy-runtime-ownership-v4.test.mjs'
text = read(path)
text = replace_once(text, "import { readFile } from 'node:fs/promises';\n", "import { access, readFile } from 'node:fs/promises';\n", 'unit fs import')
text = replace_once(
    text,
    "  LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED,\n} from '../../config/legacy-runtime-ownership.mjs';\n",
    "  LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED,\n  LEGACY_RUNTIME_CORPUS_RESIDUALS_PHYSICALLY_RETIRED,\n  LEGACY_RUNTIME_CORPUS_GUARDS_PHYSICALLY_RETIRED,\n} from '../../config/legacy-runtime-ownership.mjs';\n",
    'unit Corpus ownership imports',
)
start = text.index("test('Corpus presentation and legacy workflow helpers are physically retired while canonical Encounter remains sole owner'")
end = text.index("test('Command Center owns the retired curve", start)
new_test = r"""test('Corpus legacy runtime, residues and migration guard are fully retired while Encounter remains sole owner',async()=>{
  const writers=['applyCorpusWorkbench'];
  const helpers=['corpusCountdown','corpusContext','corpusRequest','refreshCorpusStatus','pollCorpus','corpusCell','corpusButton'];
  const residues=['corpusEndpoint','corpusState','corpusLoadedEncounter','corpusFetching','corpusDriving','corpusTargetReports','corpusNumber','sleep'];
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_HISTORICAL_WRITERS,writers);
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_ACTIVE_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_SHADOWED_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_PHYSICALLY_RETIRED,writers);
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_WORKFLOW_HELPERS_PHYSICALLY_RETIRED,helpers);
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_RESIDUALS_PHYSICALLY_RETIRED,residues);
  assert.deepEqual(LEGACY_RUNTIME_CORPUS_GUARDS_PHYSICALLY_RETIRED,['public/corpus-ui-stability-v1.js']);
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='corpus-presentation-shadow'),undefined);
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='corpus-workflow-bridge'),undefined);

  const [legacy,owner]=await Promise.all([read('public/wcl-runtime.js'),read('public/encounter-intelligence-v375.js')]);
  for(const name of [...writers,...helpers]) assert.doesNotMatch(legacy,new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`),`${name} must be physically absent`);
  for(const token of residues)assert.doesNotMatch(legacy,new RegExp(`\\b${token}\\b`),`${token} must be physically absent`);
  assert.doesNotMatch(legacy,/applyIntelligence\(\);applyCorpusWorkbench\(\);removeRosterIntelligenceOutsideComposition\(\)/,'applyAll no longer invokes Corpus presentation');
  assert.match(legacy,/\.roster-intelligence-panel, \.corpus-workbench/,'click isolation for the canonical Corpus card remains intact');
  assert.match(owner,/function ensureCorpusPanel\(\)/);
  assert.match(owner,/function syncCorpusVisibility\(\)/);
  assert.match(owner,/catalogue\.insertAdjacentElement\('beforebegin',panel\)/);
  assert.match(owner,/dataset\.avoidCorpusOwner='encounter-intelligence-v375'/);
  assert.doesNotMatch(owner,/window\.applyCorpusWorkbench|shadowLegacyCorpusWriter|corpusShadowInstalled/);
  assert.match(owner,/writerPolicy:'single-corpus-writer'/);
  assert.match(owner,/legacyRendererPolicy:'physically-retired-no-runtime-binding'/);
  assert.match(owner,/legacyCompatibilityBinding:false/);
  assert.match(owner,/crossPageVisibilityOwner:'encounter-intelligence-v375'/);
  assert.equal((owner.match(/setInterval\s*\(/g)||[]).length,1,'closure adds no polling beyond the existing Encounter loop');
  assert.match(owner,/setInterval\(\(\)=>tick\(false\),1500\)/);
  assert.equal((owner.match(/\bfetch\s*\(/g)||[]).length,2,'closure adds zero request call sites');
  assert.doesNotMatch(owner,/MutationObserver|requestAnimationFrame/);
  await assert.rejects(()=>access(new URL('../../public/corpus-ui-stability-v1.js',import.meta.url)),'retired Corpus migration guard must be physically absent');
});

"""
text = text[:start] + new_test + text[end:]
write(path, text)

# 10) Changelog: close the Corpus migration checkpoint explicitly.
path = 'CHANGELOG.md'
text = read(path)
anchor = "- Physically retired the eight legacy Corpus runtime functions (`corpusCountdown`, `corpusContext`, `corpusRequest`, `refreshCorpusStatus`, `pollCorpus`, `corpusCell`, `corpusButton`, `applyCorpusWorkbench`) and removed the `applyAll()` presentation call after the green shadow checkpoint and explicit approval. Encounter Intelligence remains the sole Corpus presentation/data-polling owner; its existing 1500 ms loop and two request call sites are unchanged. The Corpus stability guard remains for one additional post-retirement validation round.\n"
addition = anchor + "- Closed the Corpus migration after the additional post-retirement validation round passed at `1683baf037d50baeadb682d14e68a71eb6ecacb6`: removed the eight dead legacy Corpus state/formatting residues, physically deleted `corpus-ui-stability-v1.js`, and removed the temporary `window.applyCorpusWorkbench` shadow/binding from Encounter Intelligence. `encounter-intelligence-v375.js` now owns Corpus card creation, Mechanics-only visibility, navigation/popstate reconciliation and the single existing 1500 ms polling loop with no extra request sites, observers or animation loops.\n"
text = replace_once(text, anchor, addition, 'Corpus closure changelog')
write(path, text)

# Final executable-surface audit.
for path in (
    'public/wcl-runtime.js',
    'public/encounter-intelligence-v375.js',
    'config/active-assets.mjs',
    'index.html',
    'scripts/verify-legacy-runtime-ownership.mjs',
    'tests/unit/legacy-runtime-ownership-v4.test.mjs',
    'tests/unit/active-assets-manifest-v4.test.mjs',
    'tests/unit/corpus-v36-hosted.test.mjs',
    'tests/critical/v390-screen-data-safety.test.mjs',
):
    source = read(path)
    if path not in ('scripts/verify-legacy-runtime-ownership.mjs','tests/unit/legacy-runtime-ownership-v4.test.mjs','tests/unit/active-assets-manifest-v4.test.mjs','tests/critical/v390-screen-data-safety.test.mjs') and 'corpus-ui-stability-v1' in source:
        raise SystemExit(f'{path}: retired guard reference survived')
if (ROOT / 'public/corpus-ui-stability-v1.js').exists():
    raise SystemExit('retired Corpus guard still exists')

print('V4 CORPUS CLOSURE: APPLIED')
print(' - 8 dead legacy Corpus residues removed')
print(' - temporary Encounter shadow/global binding removed')
print(' - corpus-ui-stability-v1.js physically deleted')
print(' - active asset, ownership, critical/unit and changelog contracts updated')
