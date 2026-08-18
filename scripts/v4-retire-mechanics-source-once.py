from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def read(path): return (ROOT/path).read_text()
def write(path,text): (ROOT/path).write_text(text)
def replace_once(text,old,new,label):
    count=text.count(old)
    if count!=1: raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old,new,1)
def sub_once(text,pattern,new,label,flags=0):
    text,count=re.subn(pattern,new,text,count=1,flags=flags)
    if count!=1: raise SystemExit(f'{label}: expected one match, found {count}')
    return text

# 1. Retire only the two Mechanics presentation declarations and delegate orchestration to the source owner.
path=Path('public/wcl-runtime.js'); src=read(path)
src=sub_once(src,r'\nfunction applyTelemetryMechanics\(\) \{.*?\n\}\n\nfunction applyTelemetryDamageHealing\(\) \{','\nfunction applyTelemetryDamageHealing() {','telemetry Mechanics declaration',re.S)
src=sub_once(src,r'\nfunction applyIntelligenceMechanics\(\) \{.*?\n\}\n\nfunction applyIntelligenceDefensives\(\) \{','\nfunction applyIntelligenceDefensives() {','intelligence Mechanics declaration',re.S)
src=replace_once(src,'  applyIntelligenceMechanics();','  window.applyIntelligenceMechanics?.();','intelligence Mechanics delegation')
src=replace_once(src,'  applyTelemetryMechanics();','  window.applyTelemetryMechanics?.();','telemetry Mechanics delegation')
for name in ['applyTelemetryMechanics','applyIntelligenceMechanics']:
    if re.search(rf'function\s+{name}\s*\(',src): raise SystemExit(f'{name}: declaration survived retirement')
    calls=len(re.findall(rf'window\.{name}\?\.\(\)',src))
    if calls!=1: raise SystemExit(f'{name}: expected one optional source-owner call, found {calls}')
write(path,src)

# 2. Promote the feature-owned source runtime from parity shadow to sole Mechanics presentation owner.
path=Path('apps/web/src/features/mechanics/runtime.js'); runtime=read(path)
runtime=replace_once(runtime,"const VERSION='4.0.0-migration4-shadow1';","const VERSION='4.0.0-migration4-owner1';",'Mechanics runtime version')
owner_tail="""
  window.applyTelemetryMechanics=applyTelemetryMechanics;
  window.applyIntelligenceMechanics=applyIntelligenceMechanics;
  window.__AVOID_MECHANICS_SOURCE_RUNTIME__=Object.freeze({
    version:VERSION,
    sourceOwner:'apps/web/src/features/mechanics/runtime.js',
    transport:'public/mechanics-runtime.js',
    mode:'single-source-owner',
    writerPolicy:'single-mechanics-presentation-owner',
    historicalWriters:Object.freeze(['applyTelemetryMechanics','applyIntelligenceMechanics']),
    applyTelemetryMechanics,
    applyIntelligenceMechanics,
    directRequests:0,
    timers:0,
    observers:0,
  });
  window.__AVOID_MECHANICS_SOURCE_RUNTIME_STATE__=Object.freeze({
    version:VERSION,
    mode:'single-source-owner',
    directRequests:0,
    timers:0,
    observers:0,
  });
})();
"""
runtime=sub_once(runtime,r'\n  const snapshot=\(\)=>\{.*?\n  publish\(\);\n\}\)\(\);\n',owner_tail,'Mechanics parity-shadow tail',re.S)
if 'queueMicrotask' in runtime or "mode:'parity-shadow'" in runtime: raise SystemExit('Mechanics parity shadow survived promotion')
if runtime.count('window.applyTelemetryMechanics=applyTelemetryMechanics')!=1 or runtime.count('window.applyIntelligenceMechanics=applyIntelligenceMechanics')!=1: raise SystemExit('Mechanics source bindings are not singular')
write(path,runtime)
write(Path('public/mechanics-runtime.js'),runtime)

# 3. The split bridge now owns only the remaining Defensive fallback/shadow responsibilities.
bridge="""(() => {
  const VERSION='4.0.0-migration4-owner1';
  const defensiveWriters=[
    'applyTelemetryDefensives',
    'applyIntelligenceDefensives',
  ];
  const legacy=Object.fromEntries(defensiveWriters.map(name=>[name,typeof window[name]==='function'?window[name]:null]));

  if(defensiveWriters.some(name=>typeof legacy[name]!=='function')){
    const missing=defensiveWriters.filter(name=>typeof legacy[name]!=='function');
    console.warn(`[AvoiD v4] Defensive bridge missing legacy writers: ${missing.join(', ')}`);
    return;
  }

  const headings=()=>Array.from(document.querySelectorAll('.page-banner h2'));
  const active=label=>headings().some(node=>node.textContent.trim()===label);
  const stats=()=>Array.from(document.querySelectorAll('.stats-row .stat'));

  function setPending(card,reason){
    const label=card.querySelector('label')?.textContent.trim();
    if(!label)return;
    const value=card.querySelector('div > b');
    const delta=card.querySelector('div > em');
    const meta=card.querySelector(':scope > small');
    if(value)value.textContent='—';
    if(delta)delta.textContent='PENDING';
    if(meta)meta.textContent=reason;
  }

  function applyDefensiveAuditFallback(){
    if(!active('Defensive Audit'))return;
    stats().forEach(card=>setPending(card,'Cooldown reconstruction required'));
  }

  function applySplitFallback(){
    applyDefensiveAuditFallback();
  }

  function screenWriter(name,label){
    return function(...args){
      if(!active(label))return;
      return legacy[name].apply(this,args);
    };
  }

  applySplitFallback.__avoidV4SplitFallback=true;
  applySplitFallback.__avoidLegacyFallbackPhysicallyRetired=true;
  window.applyMechanicsAndDefensives=applySplitFallback;
  window.applyTelemetryDefensives=screenWriter('applyTelemetryDefensives','Defensive Audit');
  window.applyIntelligenceDefensives=screenWriter('applyIntelligenceDefensives','Defensive Audit');

  window.__AVOID_MECHANICS_DEFENSIVES_FALLBACK_OWNER__=Object.freeze({
    version:VERSION,
    writerPolicy:'defensive-fallback-and-writer-shadow',
    activeOwner:'public/mechanics-defensives-fallback-bridge-v4.js',
    mechanicsSourceOwner:'apps/web/src/features/mechanics/Mechanics.js',
    mechanicsRuntimeSource:'apps/web/src/features/mechanics/runtime.js',
    mechanicsRuntimeTransport:'public/mechanics-runtime.js',
    mechanicsPresentationOwnerLive:true,
    defensiveAuditSourceOwner:'apps/web/src/features/defensive-audit/DefensiveAudit.js',
    historicalWriters:Object.freeze(['applyMechanicsAndDefensives','applyTelemetryMechanics','applyIntelligenceMechanics',...defensiveWriters]),
    fallbackLegacyPhysicallyRetired:true,
    defensiveWriterShadow:true,
    directRequests:0,
    timers:0,
    observers:0,
  });

  console.info(`[AvoiD Raid Ops] Mechanics/Defensive ownership bridge ${VERSION}`);
})();
"""
write(Path('public/mechanics-defensives-fallback-bridge-v4.js'),bridge)

# 4. Ownership inventory: Mechanics presentation is now historical/retired in the monolith.
path=Path('config/legacy-runtime-ownership.mjs'); own=read(path)
old="""export const LEGACY_RUNTIME_MECHANICS_WRITERS=Object.freeze(['applyTelemetryMechanics','applyIntelligenceMechanics']);
export const LEGACY_RUNTIME_DEFENSIVES_WRITERS=Object.freeze(['applyTelemetryDefensives','applyIntelligenceDefensives']);
export const LEGACY_RUNTIME_MECHANICS_SHADOWED_WRITERS=Object.freeze([]);
export const LEGACY_RUNTIME_MECHANICS_PARITY_SHADOWED_WRITERS=Object.freeze([...LEGACY_RUNTIME_MECHANICS_WRITERS]);
export const LEGACY_RUNTIME_DEFENSIVES_SHADOWED_WRITERS=Object.freeze([...LEGACY_RUNTIME_DEFENSIVES_WRITERS]);
"""
new="""export const LEGACY_RUNTIME_MECHANICS_HISTORICAL_WRITERS=Object.freeze(['applyTelemetryMechanics','applyIntelligenceMechanics']);
export const LEGACY_RUNTIME_MECHANICS_ACTIVE_WRITERS=Object.freeze([]);
export const LEGACY_RUNTIME_MECHANICS_PHYSICALLY_RETIRED=Object.freeze([...LEGACY_RUNTIME_MECHANICS_HISTORICAL_WRITERS]);
export const LEGACY_RUNTIME_MECHANICS_WRITERS=LEGACY_RUNTIME_MECHANICS_HISTORICAL_WRITERS;
export const LEGACY_RUNTIME_DEFENSIVES_WRITERS=Object.freeze(['applyTelemetryDefensives','applyIntelligenceDefensives']);
export const LEGACY_RUNTIME_MECHANICS_SHADOWED_WRITERS=Object.freeze([]);
export const LEGACY_RUNTIME_MECHANICS_PARITY_SHADOWED_WRITERS=Object.freeze([]);
export const LEGACY_RUNTIME_DEFENSIVES_SHADOWED_WRITERS=Object.freeze([...LEGACY_RUNTIME_DEFENSIVES_WRITERS]);
"""
own=replace_once(own,old,new,'Mechanics retirement inventories')
own=sub_once(own,r"  responsibility\('mechanics-presentation','mechanics','parity-shadow-source-runtime',LEGACY_RUNTIME_MECHANICS_SOURCE_OWNER,'physically-retire-after-green-source-parity',\[\n    \.\.\.LEGACY_RUNTIME_MECHANICS_WRITERS,\n  \]\),\n",'', 'Mechanics active responsibility')
own=replace_once(own,'  mechanicsWriters:LEGACY_RUNTIME_MECHANICS_WRITERS,',"  mechanicsHistoricalWriters:LEGACY_RUNTIME_MECHANICS_HISTORICAL_WRITERS,\n  mechanicsActiveWriters:LEGACY_RUNTIME_MECHANICS_ACTIVE_WRITERS,\n  mechanicsPhysicallyRetired:LEGACY_RUNTIME_MECHANICS_PHYSICALLY_RETIRED,\n  mechanicsWriters:LEGACY_RUNTIME_MECHANICS_WRITERS,",'Mechanics ownership object')
write(path,own)

# 5. Active assets use stable file names; only the cache key and authority state change.
path=Path('config/active-assets.mjs'); assets=read(path)
assets=replace_once(assets,"/mechanics-defensives-fallback-bridge-v4.js?v=4.0.0-migration4-shadow1","/mechanics-defensives-fallback-bridge-v4.js?v=4.0.0-migration4-owner1",'bridge cache key')
assets=replace_once(assets,"'mechanics-source-parity-shadow-and-defensive-writer-shadow'","'defensive-fallback-and-writer-shadow'",'bridge role')
assets=replace_once(assets,"/mechanics-runtime.js?v=4.0.0-migration4-shadow1","/mechanics-runtime.js?v=4.0.0-migration4-owner1",'Mechanics runtime cache key')
assets=replace_once(assets,"'source-owned-presentation-parity-shadow'","'single-source-mechanics-presentation'",'Mechanics runtime role')
assets=replace_once(assets,"'promote-after-green-parity-checkpoint'","'keep-stable-source-owned-transport'",'Mechanics runtime retirement')
assets=replace_once(assets,"authority:'migration-source-shadow'","authority:'source-owner'",'Mechanics runtime authority')
write(path,assets)

path=Path('index.html'); index=read(path)
index=replace_once(index,'/mechanics-defensives-fallback-bridge-v4.js?v=4.0.0-migration4-shadow1','/mechanics-defensives-fallback-bridge-v4.js?v=4.0.0-migration4-owner1','index bridge cache key')
index=replace_once(index,'/mechanics-runtime.js?v=4.0.0-migration4-shadow1','/mechanics-runtime.js?v=4.0.0-migration4-owner1','index Mechanics cache key')
write(path,index)

# 6. Legacy verifier tracks the reduced monolith and optional source-owner call sites.
path=Path('scripts/verify-legacy-runtime-ownership.mjs'); verifier=read(path)
verifier=replace_once(verifier,"expect(declared.length===66,`wcl-runtime.js must contain exactly 67 active function declarations after Progress, Players and Corpus retirement; found ${declared.length}`);","expect(declared.length===64,`wcl-runtime.js must contain exactly 64 active function declarations after Progress, Players, Corpus and Mechanics presentation retirement; found ${declared.length}`);",'legacy function count')
anchor="expect((legacy.match(/window\\.applyMechanicsAndDefensives\\?\\.\\(\\)/g)||[]).length===1,'legacy orchestration must delegate to exactly one optional bridge-owned fallback binding');"
addition=anchor+"\nfor(const fn of ['applyTelemetryMechanics','applyIntelligenceMechanics'])expect(!declaredSet.has(fn),`${fn} declaration must be physically retired from the legacy monolith`);\nexpect((legacy.match(/window\\.applyTelemetryMechanics\\?\\.\\(\\)/g)||[]).length===1,'supplemental orchestration must delegate Mechanics telemetry to exactly one source-owned binding');\nexpect((legacy.match(/window\\.applyIntelligenceMechanics\\?\\.\\(\\)/g)||[]).length===1,'intelligence orchestration must delegate Mechanics intelligence to exactly one source-owned binding');"
verifier=replace_once(verifier,anchor,addition,'Mechanics retirement verifier')
write(path,verifier)

# 7. Dedicated tests move from parity-shadow expectations to physical-retirement/source-owner expectations.
mechanics_test="""import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { ACTIVE_LOCAL_SCRIPTS } from '../../config/active-assets.mjs';
import {
  LEGACY_RUNTIME_RESPONSIBILITIES,
  LEGACY_RUNTIME_MECHANICS_SOURCE_OWNER,
  LEGACY_RUNTIME_MECHANICS_RUNTIME_SOURCE,
  LEGACY_RUNTIME_MECHANICS_RUNTIME_TRANSPORT,
  LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER,
  LEGACY_RUNTIME_MECHANICS_DEFENSIVES_FALLBACK_OWNER,
  LEGACY_RUNTIME_MECHANICS_FALLBACK_HISTORICAL_WRITERS,
  LEGACY_RUNTIME_MECHANICS_FALLBACK_ACTIVE_WRITERS,
  LEGACY_RUNTIME_MECHANICS_FALLBACK_PHYSICALLY_RETIRED,
  LEGACY_RUNTIME_MECHANICS_HISTORICAL_WRITERS,
  LEGACY_RUNTIME_MECHANICS_ACTIVE_WRITERS,
  LEGACY_RUNTIME_MECHANICS_PHYSICALLY_RETIRED,
  LEGACY_RUNTIME_DEFENSIVES_WRITERS,
  LEGACY_RUNTIME_MECHANICS_SHADOWED_WRITERS,
  LEGACY_RUNTIME_MECHANICS_PARITY_SHADOWED_WRITERS,
  LEGACY_RUNTIME_DEFENSIVES_SHADOWED_WRITERS,
} from '../../config/legacy-runtime-ownership.mjs';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('Mechanics and Defensive Audit retain separate canonical source owners',async()=>{
  assert.equal(LEGACY_RUNTIME_MECHANICS_SOURCE_OWNER,'apps/web/src/features/mechanics/Mechanics.js');
  assert.equal(LEGACY_RUNTIME_MECHANICS_RUNTIME_SOURCE,'apps/web/src/features/mechanics/runtime.js');
  assert.equal(LEGACY_RUNTIME_MECHANICS_RUNTIME_TRANSPORT,'public/mechanics-runtime.js');
  assert.equal(LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER,'apps/web/src/features/defensive-audit/DefensiveAudit.js');
  assert.notEqual(LEGACY_RUNTIME_MECHANICS_SOURCE_OWNER,LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER);
  await Promise.all([
    access(new URL(`../../${LEGACY_RUNTIME_MECHANICS_SOURCE_OWNER}`,import.meta.url)),
    access(new URL(`../../${LEGACY_RUNTIME_MECHANICS_RUNTIME_SOURCE}`,import.meta.url)),
    access(new URL(`../../${LEGACY_RUNTIME_MECHANICS_RUNTIME_TRANSPORT}`,import.meta.url)),
    access(new URL(`../../${LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER}`,import.meta.url)),
  ]);
});

test('Mechanics source runtime is the exact stable transport and single presentation owner',async()=>{
  const [source,transport]=await Promise.all([read(LEGACY_RUNTIME_MECHANICS_RUNTIME_SOURCE),read(LEGACY_RUNTIME_MECHANICS_RUNTIME_TRANSPORT)]);
  assert.equal(transport,source,'public Mechanics transport must stay byte-identical to its feature-owned source');
  assert.match(source,/mode:'single-source-owner'/);
  assert.match(source,/writerPolicy:'single-mechanics-presentation-owner'/);
  assert.match(source,/window\.applyTelemetryMechanics=applyTelemetryMechanics/);
  assert.match(source,/window\.applyIntelligenceMechanics=applyIntelligenceMechanics/);
  assert.doesNotMatch(source,/parity-shadow|queueMicrotask|MutationObserver|setInterval|setTimeout|requestAnimationFrame|fetch\s*\(/);
});

test('Mechanics presentation is physically retired while Defensive Audit remains shadowed',async()=>{
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_FALLBACK_HISTORICAL_WRITERS,['applyMechanicsAndDefensives']);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_FALLBACK_ACTIVE_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_FALLBACK_PHYSICALLY_RETIRED,['applyMechanicsAndDefensives']);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_HISTORICAL_WRITERS,['applyTelemetryMechanics','applyIntelligenceMechanics']);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_ACTIVE_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_PHYSICALLY_RETIRED,LEGACY_RUNTIME_MECHANICS_HISTORICAL_WRITERS);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_SHADOWED_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_PARITY_SHADOWED_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_WRITERS,['applyTelemetryDefensives','applyIntelligenceDefensives']);
  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_SHADOWED_WRITERS,LEGACY_RUNTIME_DEFENSIVES_WRITERS);
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='mechanics-presentation'),undefined);
  const defensives=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='defensive-audit-presentation');
  assert.equal(defensives?.canonicalOwner,LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER);

  const legacy=await read('public/wcl-runtime.js');
  for(const writer of LEGACY_RUNTIME_MECHANICS_HISTORICAL_WRITERS)assert.doesNotMatch(legacy,new RegExp(`function\\s+${writer}\\s*\\(`));
  assert.equal((legacy.match(/window\.applyTelemetryMechanics\?\.\(\)/g)||[]).length,1);
  assert.equal((legacy.match(/window\.applyIntelligenceMechanics\?\.\(\)/g)||[]).length,1);
  for(const writer of LEGACY_RUNTIME_DEFENSIVES_WRITERS)assert.match(legacy,new RegExp(`function\\s+${writer}\\s*\\(`),`${writer} stays until Defensive Audit has its own green source-owner checkpoint`);
});

test('bridge owns only the remaining Defensive fallback/shadow responsibilities',async()=>{
  const bridgeAsset=ACTIVE_LOCAL_SCRIPTS.find(entry=>entry.id==='mechanics-defensives-fallback-bridge');
  const sourceAsset=ACTIVE_LOCAL_SCRIPTS.find(entry=>entry.id==='mechanics-source-runtime');
  assert.equal(bridgeAsset?.authority,'migration-bridge');
  assert.equal(bridgeAsset?.role,'defensive-fallback-and-writer-shadow');
  assert.equal(sourceAsset?.authority,'source-owner');
  assert.equal(sourceAsset?.role,'single-source-mechanics-presentation');
  assert.equal(sourceAsset?.sourceOwner,LEGACY_RUNTIME_MECHANICS_RUNTIME_SOURCE);
  const bridge=await read(LEGACY_RUNTIME_MECHANICS_DEFENSIVES_FALLBACK_OWNER);
  assert.match(bridge,/window\.applyMechanicsAndDefensives=applySplitFallback/);
  assert.doesNotMatch(bridge,/__AVOID_MECHANICS_SOURCE_RUNTIME__\?\.shadow|window\.applyTelemetryMechanics=|window\.applyIntelligenceMechanics=/);
  assert.match(bridge,/window\.applyTelemetryDefensives=screenWriter\('applyTelemetryDefensives','Defensive Audit'\)/);
  assert.match(bridge,/window\.applyIntelligenceDefensives=screenWriter\('applyIntelligenceDefensives','Defensive Audit'\)/);
  assert.match(bridge,/writerPolicy:'defensive-fallback-and-writer-shadow'/);
  assert.doesNotMatch(bridge,/MutationObserver|setInterval|setTimeout|requestAnimationFrame|fetch\s*\(/);
});

test('Encounter Corpus owner cannot become Defensive Audit owner by implication',async()=>{
  const [encounter,mechanicsSource,defensivesSource]=await Promise.all([
    read('public/encounter-intelligence-v375.js'),
    read(LEGACY_RUNTIME_MECHANICS_SOURCE_OWNER),
    read(LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER),
  ]);
  assert.match(encounter,/owner:'encounter-intelligence-v375'/);
  assert.doesNotMatch(encounter,/Defensive Audit source owner|single-defensive-audit-writer/);
  assert.match(mechanicsSource,/Mechanics/);
  assert.match(defensivesSource,/Defensive Audit/);
});
"""
write(Path('tests/unit/mechanics-defensives-ownership-v4.test.mjs'),mechanics_test)

# Active-asset contract transitions only the Mechanics state/version.
path=Path('tests/unit/active-assets-manifest-v4.test.mjs'); test=read(path)
test=replace_once(test,'/mechanics-defensives-fallback-bridge-v4.js?v=4.0.0-migration4-shadow1','/mechanics-defensives-fallback-bridge-v4.js?v=4.0.0-migration4-owner1','active-assets bridge version')
test=replace_once(test,"'mechanics-source-parity-shadow-and-defensive-writer-shadow'","'defensive-fallback-and-writer-shadow'",'active-assets bridge role')
test=replace_once(test,'/mechanics-runtime.js?v=4.0.0-migration4-shadow1','/mechanics-runtime.js?v=4.0.0-migration4-owner1','active-assets Mechanics version')
test=replace_once(test,"assert.equal(mechanicsSource?.authority,'migration-source-shadow');","assert.equal(mechanicsSource?.authority,'source-owner');\n  assert.equal(mechanicsSource?.role,'single-source-mechanics-presentation');\n  assert.equal(mechanicsSource?.retirement,'keep-stable-source-owned-transport');",'active-assets Mechanics authority')
write(path,test)

# Browser liveness inventory must treat source runtime as passive owner rather than parity shadow.
path=Path('tests/unit/runtime-dom-safety-v389.test.mjs'); test=read(path)
test=replace_once(test,"test('CRITICAL MECHANICS SOURCE SHADOW: feature source and stable public transport are identical and passive'","test('CRITICAL MECHANICS SOURCE OWNER: feature source and stable public transport are identical and passive'",'runtime safety Mechanics title')
test=replace_once(test,"  assert.match(source,/queueMicrotask/);","  assert.match(source,/mode:'single-source-owner'/);\n  assert.match(source,/writerPolicy:'single-mechanics-presentation-owner'/);\n  assert.doesNotMatch(source,/queueMicrotask|parity-shadow/);",'runtime safety Mechanics mode')
test=replace_once(test,"test('CRITICAL MECHANICS/DEFENSIVES BRIDGE: source parity delegation and Defensive shadow are passive'","test('CRITICAL MECHANICS/DEFENSIVES BRIDGE: only Defensive fallback/shadow remains active'",'runtime safety bridge title')
test=replace_once(test,"  assert.match(source,/__AVOID_MECHANICS_SOURCE_RUNTIME__\\?\\.shadow\\?\\.\\(\\)/);","  assert.doesNotMatch(source,/__AVOID_MECHANICS_SOURCE_RUNTIME__\\?\\.shadow/);",'runtime safety bridge source delegation')
test=replace_once(test,"writerPolicy:'mechanics-source-parity-shadow-and-defensive-writer-shadow'","writerPolicy:'defensive-fallback-and-writer-shadow'",'runtime safety bridge policy')
test=replace_once(test,'/mechanics-defensives-fallback-bridge-v4.js?v=4.0.0-migration4-shadow1','/mechanics-defensives-fallback-bridge-v4.js?v=4.0.0-migration4-owner1','runtime safety bridge version')
test=replace_once(test,'/mechanics-runtime.js?v=4.0.0-migration4-shadow1','/mechanics-runtime.js?v=4.0.0-migration4-owner1','runtime safety Mechanics version')
test=replace_once(test,"assert.ok(mechanicsSource > fallbackBridge, 'Mechanics source runtime must replace only its global presentation bindings after the split bridge');","assert.ok(mechanicsSource > fallbackBridge, 'Mechanics source owner must install after the split bridge and own the two retired presentation bindings');",'runtime safety wiring message')
write(path,test)

# 8. Consolidated changelog: no release-specific sidecar files.
path=Path('CHANGELOG.md'); changelog=read(path)
marker='\n### Mainline integration — v3.9.0 to v3.9.2\n'
entry="""
- Validated the feature-owned Mechanics parity shadow at `330526c31a5fd979012f587fe2dca18d5f4da3db`, then physically retired `applyTelemetryMechanics` and `applyIntelligenceMechanics` from `wcl-runtime.js`. The stable `public/mechanics-runtime.js` transport is byte-identical to `apps/web/src/features/mechanics/runtime.js`, owns both Mechanics presentation bindings, adds zero requests/timers/observers, and leaves Defensive Audit on its independent legacy-shadow path.
"""
if marker not in changelog: raise SystemExit('changelog insertion marker missing')
changelog=changelog.replace(marker,'\n'+entry+marker,1)
write(path,changelog)

# 9. Restore canonical validator inside the functional commit so no temporary CI state survives.
path=Path('.github/workflows/validate.yml'); wf=read(path)
wf=replace_once(wf,'  contents: write\n','  contents: read\n','validator permissions restore')
wf=sub_once(wf,r'        with:\n          fetch-depth: 0\n      - name: Apply one-shot Mechanics source-owner retirement\n        run: \|\n.*?      - name: Node 22\n','      - name: Node 22\n','validator one-shot restore',re.S)
write(path,wf)

# Final migration assertions before the shell commits anything.
assertions={
  'public/wcl-runtime.js':['window.applyTelemetryMechanics?.();','window.applyIntelligenceMechanics?.();'],
  'apps/web/src/features/mechanics/runtime.js':["mode:'single-source-owner'","writerPolicy:'single-mechanics-presentation-owner'"],
  'public/mechanics-defensives-fallback-bridge-v4.js':["writerPolicy:'defensive-fallback-and-writer-shadow'"],
}
for filename,tokens in assertions.items():
    content=read(Path(filename))
    for token in tokens:
        if token not in content: raise SystemExit(f'{filename}: final assertion missing {token}')
if read(Path('apps/web/src/features/mechanics/runtime.js'))!=read(Path('public/mechanics-runtime.js')): raise SystemExit('Mechanics source/public transport drift')
print('Mechanics source-owner retirement migration assertions passed')
