from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def read(path): return (ROOT/path).read_text()
def write(path,text): (ROOT/path).write_text(text)
def replace_once(text,old,new,label):
    count=text.count(old)
    if count!=1: raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old,new,1)

# 1. Physically retire only the shared fallback writer from the monolith.
path=Path('public/wcl-runtime.js')
src=read(path)
pattern=r'\nfunction applyMechanicsAndDefensives\(\) \{.*?\n\}\n\nfunction applyComposition\(\) \{'
src,count=re.subn(pattern,'\nfunction applyComposition() {',src,count=1,flags=re.S)
if count!=1: raise SystemExit(f'wcl fallback declaration: expected one match, found {count}')
src=replace_once(src,'applyDamageHealing();applyMechanicsAndDefensives();applyComposition();','applyDamageHealing();window.applyMechanicsAndDefensives?.();applyComposition();','wcl applyAll fallback call')
if re.search(r'function\s+applyMechanicsAndDefensives\s*\(',src): raise SystemExit('fallback declaration survived')
write(path,src)

# 2. Make the bridge the real fallback owner while retaining screen-scoped shadows for four writers.
bridge="""(() => {
  const VERSION='4.0.0-migration3';
  const shadowedNames=[
    'applyTelemetryMechanics',
    'applyIntelligenceMechanics',
    'applyTelemetryDefensives',
    'applyIntelligenceDefensives',
  ];
  const legacy=Object.fromEntries(shadowedNames.map(name=>[name,typeof window[name]==='function'?window[name]:null]));

  if(shadowedNames.some(name=>typeof legacy[name]!=='function')){
    const missing=shadowedNames.filter(name=>typeof legacy[name]!=='function');
    console.warn(`[AvoiD v4] Mechanics/Defensive bridge missing legacy writers: ${missing.join(', ')}`);
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

  function applyMechanicsFallback(){
    if(!active('Mechanics'))return;
    stats().forEach(card=>setPending(card,'Encounter rule pack required'));
  }

  function applyDefensiveAuditFallback(){
    if(!active('Defensive Audit'))return;
    stats().forEach(card=>setPending(card,'Cooldown reconstruction required'));
  }

  function applySplitFallback(){
    applyMechanicsFallback();
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
  window.applyTelemetryMechanics=screenWriter('applyTelemetryMechanics','Mechanics Library');
  window.applyIntelligenceMechanics=screenWriter('applyIntelligenceMechanics','Mechanics Library');
  window.applyTelemetryDefensives=screenWriter('applyTelemetryDefensives','Defensive Audit');
  window.applyIntelligenceDefensives=screenWriter('applyIntelligenceDefensives','Defensive Audit');

  window.__AVOID_MECHANICS_DEFENSIVES_FALLBACK_OWNER__=Object.freeze({
    version:VERSION,
    writerPolicy:'split-fallback-owner-and-screen-writer-shadow',
    activeOwner:'public/mechanics-defensives-fallback-bridge-v4.js',
    mechanicsSourceOwner:'apps/web/src/features/mechanics/Mechanics.js',
    defensiveAuditSourceOwner:'apps/web/src/features/defensive-audit/DefensiveAudit.js',
    historicalWriters:Object.freeze(['applyMechanicsAndDefensives',...shadowedNames]),
    fallbackLegacyPhysicallyRetired:true,
    directRequests:0,
    timers:0,
    observers:0,
  });

  console.info(`[AvoiD Raid Ops] Mechanics/Defensive ownership bridge ${VERSION}`);
})();
"""
write(Path('public/mechanics-defensives-fallback-bridge-v4.js'),bridge)

# 3. Ownership manifest: fallback is historical/retired, four screen writers remain shadowed.
path=Path('config/legacy-runtime-ownership.mjs')
src=read(path)
src=replace_once(src,"export const LEGACY_RUNTIME_MECHANICS_FALLBACK_WRITERS=Object.freeze(['applyMechanicsAndDefensives']);", "export const LEGACY_RUNTIME_MECHANICS_FALLBACK_HISTORICAL_WRITERS=Object.freeze(['applyMechanicsAndDefensives']);\nexport const LEGACY_RUNTIME_MECHANICS_FALLBACK_ACTIVE_WRITERS=Object.freeze([]);\nexport const LEGACY_RUNTIME_MECHANICS_FALLBACK_PHYSICALLY_RETIRED=Object.freeze(['applyMechanicsAndDefensives']);",'fallback ownership constants')
block="""  responsibility('mechanics-defensives-fallback','mechanics-defensives-fallback','migration-bridge',LEGACY_RUNTIME_MECHANICS_DEFENSIVES_FALLBACK_OWNER,'retire-after-both-source-owners-are-live',[
    'applyMechanicsAndDefensives',
  ]),
"""
src=replace_once(src,block,'','fallback active responsibility')
src=replace_once(src,'  mechanicsFallbackWriters:LEGACY_RUNTIME_MECHANICS_FALLBACK_WRITERS,',"  mechanicsFallbackHistoricalWriters:LEGACY_RUNTIME_MECHANICS_FALLBACK_HISTORICAL_WRITERS,\n  mechanicsFallbackActiveWriters:LEGACY_RUNTIME_MECHANICS_FALLBACK_ACTIVE_WRITERS,\n  mechanicsFallbackPhysicallyRetired:LEGACY_RUNTIME_MECHANICS_FALLBACK_PHYSICALLY_RETIRED,",'fallback ownership object')
write(path,src)

# 4. Transport cache busting.
for filename in ['config/active-assets.mjs','index.html']:
    path=Path(filename); src=read(path)
    src=replace_once(src,'mechanics-defensives-fallback-bridge-v4.js?v=4.0.0-migration2','mechanics-defensives-fallback-bridge-v4.js?v=4.0.0-migration3',f'{filename} bridge version')
    if filename.endswith('active-assets.mjs'):
        src=replace_once(src,"'screen-scoped-writer-shadow'","'fallback-owner-and-screen-writer-shadow'",'active asset role')
    write(path,src)

# 5. Verifier declaration count and explicit retirement checks.
path=Path('scripts/verify-legacy-runtime-ownership.mjs'); src=read(path)
src=replace_once(src,'declared.length===67','declared.length===66','legacy declaration count')
anchor="expect(!LEGACY_RUNTIME_RESPONSIBILITIES.some(entry=>entry.id==='players-presentation-shadow'),'physically retired Players presentation functions must not remain active ownership responsibilities');"
addition=anchor+"\nexpect(!declaredSet.has('applyMechanicsAndDefensives'),'shared Mechanics/Defensive fallback declaration must be physically retired');\nexpect(!LEGACY_RUNTIME_RESPONSIBILITIES.some(entry=>entry.id==='mechanics-defensives-fallback'),'retired shared fallback cannot remain an active legacy responsibility');\nexpect((legacy.match(/window\\.applyMechanicsAndDefensives\\?\\.\\(\\)/g)||[]).length===1,'legacy orchestration must delegate to exactly one optional bridge-owned fallback binding');"
src=replace_once(src,anchor,addition,'verifier fallback retirement assertions')
write(path,src)

# 6. Dedicated ownership test now requires physical retirement of the fallback only.
test="""import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { ACTIVE_LOCAL_SCRIPTS } from '../../config/active-assets.mjs';
import {
  LEGACY_RUNTIME_RESPONSIBILITIES,
  LEGACY_RUNTIME_MECHANICS_SOURCE_OWNER,
  LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER,
  LEGACY_RUNTIME_MECHANICS_DEFENSIVES_FALLBACK_OWNER,
  LEGACY_RUNTIME_MECHANICS_DEFENSIVES_SHADOW_OWNER,
  LEGACY_RUNTIME_MECHANICS_FALLBACK_HISTORICAL_WRITERS,
  LEGACY_RUNTIME_MECHANICS_FALLBACK_ACTIVE_WRITERS,
  LEGACY_RUNTIME_MECHANICS_FALLBACK_PHYSICALLY_RETIRED,
  LEGACY_RUNTIME_MECHANICS_WRITERS,
  LEGACY_RUNTIME_DEFENSIVES_WRITERS,
  LEGACY_RUNTIME_MECHANICS_SHADOWED_WRITERS,
  LEGACY_RUNTIME_DEFENSIVES_SHADOWED_WRITERS,
} from '../../config/legacy-runtime-ownership.mjs';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('Mechanics and Defensive Audit have separate canonical source owners',async()=>{
  assert.equal(LEGACY_RUNTIME_MECHANICS_SOURCE_OWNER,'apps/web/src/features/mechanics/Mechanics.js');
  assert.equal(LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER,'apps/web/src/features/defensive-audit/DefensiveAudit.js');
  assert.notEqual(LEGACY_RUNTIME_MECHANICS_SOURCE_OWNER,LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER);
  await Promise.all([
    access(new URL(`../../${LEGACY_RUNTIME_MECHANICS_SOURCE_OWNER}`,import.meta.url)),
    access(new URL(`../../${LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER}`,import.meta.url)),
  ]);
});

test('shared fallback is physically retired while four screen writers remain shadowed',async()=>{
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_FALLBACK_HISTORICAL_WRITERS,['applyMechanicsAndDefensives']);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_FALLBACK_ACTIVE_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_FALLBACK_PHYSICALLY_RETIRED,['applyMechanicsAndDefensives']);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_WRITERS,['applyTelemetryMechanics','applyIntelligenceMechanics']);
  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_WRITERS,['applyTelemetryDefensives','applyIntelligenceDefensives']);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_SHADOWED_WRITERS,LEGACY_RUNTIME_MECHANICS_WRITERS);
  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_SHADOWED_WRITERS,LEGACY_RUNTIME_DEFENSIVES_WRITERS);
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='mechanics-defensives'),undefined);
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='mechanics-defensives-fallback'),undefined);

  const mechanics=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='mechanics-presentation');
  const defensives=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='defensive-audit-presentation');
  assert.equal(mechanics?.canonicalOwner,LEGACY_RUNTIME_MECHANICS_SOURCE_OWNER);
  assert.deepEqual(mechanics?.functions,LEGACY_RUNTIME_MECHANICS_WRITERS);
  assert.equal(defensives?.canonicalOwner,LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER);
  assert.deepEqual(defensives?.functions,LEGACY_RUNTIME_DEFENSIVES_WRITERS);

  const legacy=await read('public/wcl-runtime.js');
  assert.doesNotMatch(legacy,/function\\s+applyMechanicsAndDefensives\\s*\\(/);
  assert.equal((legacy.match(/window\\.applyMechanicsAndDefensives\\?\\.\\(\\)/g)||[]).length,1);
  for(const writer of [...mechanics.functions,...defensives.functions])assert.match(legacy,new RegExp(`function\\\\s+${writer}\\\\s*\\\\(`),`${writer} remains physically present until its independent source-owner checkpoint passes`);
});

test('bridge owns fallback and shadows four writers without liveness side effects',async()=>{
  assert.equal(LEGACY_RUNTIME_MECHANICS_DEFENSIVES_FALLBACK_OWNER,'public/mechanics-defensives-fallback-bridge-v4.js');
  assert.equal(LEGACY_RUNTIME_MECHANICS_DEFENSIVES_SHADOW_OWNER,LEGACY_RUNTIME_MECHANICS_DEFENSIVES_FALLBACK_OWNER);
  const asset=ACTIVE_LOCAL_SCRIPTS.find(entry=>entry.id==='mechanics-defensives-fallback-bridge');
  const legacyIndex=ACTIVE_LOCAL_SCRIPTS.findIndex(entry=>entry.id==='wcl-legacy-runtime');
  const bridgeIndex=ACTIVE_LOCAL_SCRIPTS.findIndex(entry=>entry.id==='mechanics-defensives-fallback-bridge');
  assert.equal(asset?.authority,'migration-bridge');
  assert.equal(asset?.owner,'split-source-owners');
  assert.equal(asset?.role,'fallback-owner-and-screen-writer-shadow');
  assert.ok(bridgeIndex>legacyIndex);

  const bridge=await read(LEGACY_RUNTIME_MECHANICS_DEFENSIVES_SHADOW_OWNER);
  assert.match(bridge,/window\\.applyMechanicsAndDefensives=applySplitFallback/);
  assert.match(bridge,/window\\.applyTelemetryMechanics=screenWriter\\('applyTelemetryMechanics','Mechanics Library'\\)/);
  assert.match(bridge,/window\\.applyIntelligenceMechanics=screenWriter\\('applyIntelligenceMechanics','Mechanics Library'\\)/);
  assert.match(bridge,/window\\.applyTelemetryDefensives=screenWriter\\('applyTelemetryDefensives','Defensive Audit'\\)/);
  assert.match(bridge,/window\\.applyIntelligenceDefensives=screenWriter\\('applyIntelligenceDefensives','Defensive Audit'\\)/);
  assert.match(bridge,/writerPolicy:'split-fallback-owner-and-screen-writer-shadow'/);
  assert.match(bridge,/fallbackLegacyPhysicallyRetired:true/);
  assert.doesNotMatch(bridge,/__avoidLegacyFallback=|typeof window\\.applyMechanicsAndDefensives/);
  assert.doesNotMatch(bridge,/MutationObserver|setInterval|setTimeout|requestAnimationFrame|fetch\\s*\\(/);
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
write(Path('tests/unit/mechanics-defensives-ownership-v4.test.mjs'),test)

# 7. Align fixed transport/safety tests.
path=Path('tests/unit/active-assets-manifest-v4.test.mjs'); src=read(path)
src=replace_once(src,'mechanics-defensives-fallback-bridge-v4.js?v=4.0.0-migration2','mechanics-defensives-fallback-bridge-v4.js?v=4.0.0-migration3','asset test bridge version')
src=replace_once(src,"'screen-scoped-writer-shadow'","'fallback-owner-and-screen-writer-shadow'",'asset test bridge role')
write(path,src)

path=Path('tests/unit/runtime-dom-safety-v389.test.mjs'); src=read(path)
src=replace_once(src,"writerPolicy:'split-screen-writer-shadow'","writerPolicy:'split-fallback-owner-and-screen-writer-shadow'",'DOM safety writer policy')
src=replace_once(src,'mechanics-defensives-fallback-bridge-v4.js?v=4.0.0-migration2','mechanics-defensives-fallback-bridge-v4.js?v=4.0.0-migration3','DOM safety bridge version')
write(path,src)

# 8. Record the checkpoint in the single changelog.
path=Path('CHANGELOG.md'); src=read(path)
anchor='- Closed the Corpus migration after the additional post-retirement validation round passed at `1683baf037d50baeadb682d14e68a71eb6ecacb6`: removed the eight dead legacy Corpus state/formatting residues, physically deleted `corpus-ui-stability-v1.js`, and removed the temporary `window.applyCorpusWorkbench` shadow/binding from Encounter Intelligence. `encounter-intelligence-v375.js` now owns Corpus card creation, Mechanics-only visibility, navigation/popstate reconciliation and the single existing 1500 ms polling loop with no extra request sites, observers or animation loops.\n'
entry=anchor+'- Split Mechanics and Defensive Audit into independent ownership domains. After a green five-writer screen-scoped shadow checkpoint, physically retired only the shared `applyMechanicsAndDefensives` fallback from `wcl-runtime.js`; the passive migration bridge now owns that fallback and continues to shadow the four screen-specific writers without adding requests, timers, observers or animation loops. The final source owners remain `Mechanics.js` and `DefensiveAudit.js`.\n'
src=replace_once(src,anchor,entry,'changelog Mechanics/Defensive checkpoint')
write(path,src)

print('one-shot Mechanics/Defensive fallback retirement prepared')
