import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';

const read=path=>readFile(path,'utf8');
const write=(path,content)=>writeFile(path,content,'utf8');

function count(haystack,needle){
  return haystack.split(needle).length-1;
}

function replaceExact(source,before,after,label){
  const hits=count(source,before);
  assert.equal(hits,1,`${label}: expected exactly one match, found ${hits}`);
  return source.replace(before,after);
}

function removeNamedFunction(source,name){
  const signature=`function ${name}()`;
  const hits=count(source,signature);
  assert.equal(hits,1,`${name}: expected exactly one declaration, found ${hits}`);
  const start=source.indexOf(signature);
  const open=source.indexOf('{',start+signature.length);
  assert.ok(open>start,`${name}: opening brace not found`);

  let depth=0;
  let state='code';
  let escaped=false;
  for(let i=open;i<source.length;i++){
    const ch=source[i];
    const next=source[i+1];
    if(state==='line'){
      if(ch==='\n')state='code';
      continue;
    }
    if(state==='block'){
      if(ch==='*'&&next==='/'){state='code';i++;}
      continue;
    }
    if(state==='single'||state==='double'||state==='template'){
      if(escaped){escaped=false;continue;}
      if(ch==='\\'){escaped=true;continue;}
      if((state==='single'&&ch==="'")||(state==='double'&&ch==='"')||(state==='template'&&ch==='`'))state='code';
      continue;
    }
    if(ch==='/'&&next==='/'){state='line';i++;continue;}
    if(ch==='/'&&next==='*'){state='block';i++;continue;}
    if(ch==="'"){state='single';continue;}
    if(ch==='"'){state='double';continue;}
    if(ch==='`'){state='template';continue;}
    if(ch==='{')depth++;
    if(ch==='}'){
      depth--;
      if(depth===0){
        let end=i+1;
        while(source[end]==='\r'||source[end]==='\n')end++;
        return source.slice(0,start)+source.slice(end);
      }
    }
  }
  throw new Error(`${name}: closing brace not found`);
}

function replaceTestBlock(source,title,replacement){
  const startToken=`test('${title}'`;
  const start=source.indexOf(startToken);
  assert.ok(start>=0,`test block not found: ${title}`);
  const next=source.indexOf("\ntest('",start+startToken.length);
  const end=next>=0?next:source.length;
  return source.slice(0,start)+replacement.trimEnd()+'\n'+source.slice(end);
}

const legacyPath='public/wcl-runtime.js';
let legacy=await read(legacyPath);
legacy=removeNamedFunction(legacy,'applyTelemetryDefensives');
legacy=removeNamedFunction(legacy,'applyIntelligenceDefensives');
legacy=replaceExact(legacy,'applyTelemetryDefensives();','window.applyTelemetryDefensives?.();','telemetry Defensive call site');
legacy=replaceExact(legacy,'applyIntelligenceDefensives();','window.applyIntelligenceDefensives?.();','intelligence Defensive call site');
assert.equal(count(legacy,'function applyTelemetryDefensives()'),0);
assert.equal(count(legacy,'function applyIntelligenceDefensives()'),0);
assert.equal(count(legacy,'window.applyTelemetryDefensives?.();'),1);
assert.equal(count(legacy,'window.applyIntelligenceDefensives?.();'),1);
await write(legacyPath,legacy);

const sourcePath='apps/web/src/features/defensive-audit/runtime.js';
const transportPath='public/defensive-audit-runtime.js';
let defensive=await read(sourcePath);
defensive=replaceExact(defensive,"const VERSION='4.0.0-migration5-shadow1';","const VERSION='4.0.0-migration5-owner1';",'Defensive runtime version');
const shadowMarker='\n  const snapshot=()=>{';
assert.equal(count(defensive,shadowMarker),1,'Defensive parity instrumentation marker must be unique');
defensive=defensive.slice(0,defensive.indexOf(shadowMarker));
defensive+=`\n\n  window.applyTelemetryDefensives=applyTelemetryDefensives;\n  window.applyIntelligenceDefensives=applyIntelligenceDefensives;\n  window.__AVOID_DEFENSIVE_AUDIT_SOURCE_RUNTIME__=Object.freeze({\n    version:VERSION,\n    sourceOwner:'apps/web/src/features/defensive-audit/runtime.js',\n    transport:'public/defensive-audit-runtime.js',\n    mode:'single-source-owner',\n    writerPolicy:'single-defensive-audit-presentation-owner',\n    historicalWriters:Object.freeze(['applyTelemetryDefensives','applyIntelligenceDefensives']),\n    applyTelemetryDefensives,\n    applyIntelligenceDefensives,\n    directRequests:0,\n    timers:0,\n    observers:0,\n  });\n  window.__AVOID_DEFENSIVE_AUDIT_SOURCE_RUNTIME_STATE__=Object.freeze({\n    version:VERSION,\n    mode:'single-source-owner',\n    directRequests:0,\n    timers:0,\n    observers:0,\n  });\n})();\n`;
for(const forbidden of ['parity-shadow','queueMicrotask','mismatches','const snapshot','function shadow','MutationObserver','setInterval','setTimeout','requestAnimationFrame','fetch(']){
  assert.equal(defensive.includes(forbidden),false,`Defensive owner must not retain ${forbidden}`);
}
await write(sourcePath,defensive);
await write(transportPath,defensive);
assert.equal(await read(sourcePath),await read(transportPath),'Defensive source and transport must be byte-identical');

const bridgePath='public/mechanics-defensives-fallback-bridge-v4.js';
const bridge=`(() => {\n  const VERSION='4.0.0-migration5-owner1';\n\n  function applySplitFallback(){}\n\n  applySplitFallback.__avoidV4SplitFallback=true;\n  applySplitFallback.__avoidLegacyFallbackPhysicallyRetired=true;\n  window.applyMechanicsAndDefensives=applySplitFallback;\n\n  window.__AVOID_MECHANICS_DEFENSIVES_FALLBACK_OWNER__=Object.freeze({\n    version:VERSION,\n    writerPolicy:'post-owner-retirement-hold-noop',\n    activeOwner:'public/mechanics-defensives-fallback-bridge-v4.js',\n    mechanicsSourceOwner:'apps/web/src/features/mechanics/Mechanics.js',\n    mechanicsRuntimeSource:'apps/web/src/features/mechanics/runtime.js',\n    mechanicsRuntimeTransport:'public/mechanics-runtime.js',\n    mechanicsPresentationOwnerLive:true,\n    defensiveAuditSourceOwner:'apps/web/src/features/defensive-audit/DefensiveAudit.js',\n    defensiveAuditRuntimeSource:'apps/web/src/features/defensive-audit/runtime.js',\n    defensiveAuditRuntimeTransport:'public/defensive-audit-runtime.js',\n    defensiveAuditPresentationOwnerLive:true,\n    historicalWriters:Object.freeze(['applyMechanicsAndDefensives','applyTelemetryMechanics','applyIntelligenceMechanics','applyTelemetryDefensives','applyIntelligenceDefensives']),\n    fallbackLegacyPhysicallyRetired:true,\n    defensiveParityShadow:false,\n    directRequests:0,\n    timers:0,\n    observers:0,\n  });\n\n  console.info(\`[AvoiD Raid Ops] Mechanics/Defensive ownership bridge \${VERSION}\`);\n})();\n`;
for(const forbidden of ['.shadow','queueMicrotask','MutationObserver','setInterval','setTimeout','requestAnimationFrame','fetch('])assert.equal(bridge.includes(forbidden),false,`retirement-hold bridge must not retain ${forbidden}`);
await write(bridgePath,bridge);

const ownershipPath='config/legacy-runtime-ownership.mjs';
let ownership=await read(ownershipPath);
ownership=replaceExact(ownership,"export const LEGACY_RUNTIME_DEFENSIVES_ACTIVE_WRITERS=Object.freeze([...LEGACY_RUNTIME_DEFENSIVES_HISTORICAL_WRITERS]);","export const LEGACY_RUNTIME_DEFENSIVES_ACTIVE_WRITERS=Object.freeze([]);",'Defensive active writers');
ownership=replaceExact(ownership,"export const LEGACY_RUNTIME_DEFENSIVES_PHYSICALLY_RETIRED=Object.freeze([]);","export const LEGACY_RUNTIME_DEFENSIVES_PHYSICALLY_RETIRED=Object.freeze([...LEGACY_RUNTIME_DEFENSIVES_HISTORICAL_WRITERS]);",'Defensive physically retired writers');
ownership=replaceExact(ownership,"export const LEGACY_RUNTIME_DEFENSIVES_PARITY_SHADOWED_WRITERS=Object.freeze([...LEGACY_RUNTIME_DEFENSIVES_HISTORICAL_WRITERS]);","export const LEGACY_RUNTIME_DEFENSIVES_PARITY_SHADOWED_WRITERS=Object.freeze([]);",'Defensive parity writers');
ownership=replaceExact(ownership,"  responsibility('defensive-audit-presentation','defensive-audit','parity-shadow-source-runtime',LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER,'retire-legacy-writers-after-green-source-parity',[\n    ...LEGACY_RUNTIME_DEFENSIVES_WRITERS,\n  ]),\n",'', 'active Defensive responsibility');
await write(ownershipPath,ownership);

const assetsPath='config/active-assets.mjs';
let assets=await read(assetsPath);
assets=replaceExact(assets,"  asset('mechanics-defensives-fallback-bridge','/mechanics-defensives-fallback-bridge-v4.js?v=4.0.0-migration5-shadow1','split-source-owners','mechanics-defensives-fallback','defensive-source-parity-shadow-trigger','retire-after-both-source-owners-are-live',{authority:'migration-bridge'}),","  asset('mechanics-defensives-fallback-bridge','/mechanics-defensives-fallback-bridge-v4.js?v=4.0.0-migration5-owner1','split-source-owners','mechanics-defensives-fallback','post-owner-retirement-hold-noop','retire-after-post-owner-green-validation',{authority:'migration-bridge'}),",'bridge asset');
assets=replaceExact(assets,"  asset('defensive-audit-source-runtime','/defensive-audit-runtime.js?v=4.0.0-migration5-shadow1','defensive-audit-source','defensive-audit','defensive-audit-source-parity-shadow','keep-stable-source-owned-transport',{authority:'migration-source-shadow',sourceOwner:'apps/web/src/features/defensive-audit/runtime.js'}),","  asset('defensive-audit-source-runtime','/defensive-audit-runtime.js?v=4.0.0-migration5-owner1','defensive-audit-source','defensive-audit','single-source-defensive-audit-presentation','keep-stable-source-owned-transport',{authority:'source-owner',sourceOwner:'apps/web/src/features/defensive-audit/runtime.js'}),",'Defensive source asset');
await write(assetsPath,assets);

const testPath='tests/unit/mechanics-defensives-ownership-v4.test.mjs';
let tests=await read(testPath);
tests=replaceTestBlock(tests,'Defensive Audit source runtime is the exact transport and parity-shadows legacy final DOM',`test('Defensive Audit source runtime remains the exact stable transport and single presentation owner',async()=>{\n  const [source,transport]=await Promise.all([read(LEGACY_RUNTIME_DEFENSIVES_RUNTIME_SOURCE),read(LEGACY_RUNTIME_DEFENSIVES_RUNTIME_TRANSPORT)]);\n  assert.equal(transport,source,'public Defensive Audit transport must stay byte-identical to its feature-owned source');\n  assert.match(source,/mode:'single-source-owner'/);\n  assert.match(source,/writerPolicy:'single-defensive-audit-presentation-owner'/);\n  assert.match(source,/window\\.applyTelemetryDefensives=applyTelemetryDefensives/);\n  assert.match(source,/window\\.applyIntelligenceDefensives=applyIntelligenceDefensives/);\n  assert.match(source,/window\\.__AVOID_DEFENSIVE_AUDIT_SOURCE_RUNTIME__/);\n  assert.doesNotMatch(source,/parity-shadow|queueMicrotask|mismatches|const snapshot|function shadow|MutationObserver|setInterval|setTimeout|requestAnimationFrame|fetch\\s*\\(/);\n});`);
tests=replaceTestBlock(tests,'Mechanics is retired while Defensive Audit legacy writers stay active only as parity reference',`test('Mechanics and Defensive Audit legacy writers are physically retired after green source parity',async()=>{\n  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_FALLBACK_HISTORICAL_WRITERS,['applyMechanicsAndDefensives']);\n  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_FALLBACK_ACTIVE_WRITERS,[]);\n  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_FALLBACK_PHYSICALLY_RETIRED,['applyMechanicsAndDefensives']);\n  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_HISTORICAL_WRITERS,['applyTelemetryMechanics','applyIntelligenceMechanics']);\n  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_ACTIVE_WRITERS,[]);\n  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_PHYSICALLY_RETIRED,LEGACY_RUNTIME_MECHANICS_HISTORICAL_WRITERS);\n  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_SHADOWED_WRITERS,[]);\n  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_PARITY_SHADOWED_WRITERS,[]);\n\n  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_HISTORICAL_WRITERS,['applyTelemetryDefensives','applyIntelligenceDefensives']);\n  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_WRITERS,LEGACY_RUNTIME_DEFENSIVES_HISTORICAL_WRITERS);\n  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_ACTIVE_WRITERS,[]);\n  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_PHYSICALLY_RETIRED,LEGACY_RUNTIME_DEFENSIVES_HISTORICAL_WRITERS);\n  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_SHADOWED_WRITERS,[]);\n  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_PARITY_SHADOWED_WRITERS,[]);\n\n  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='mechanics-presentation'),undefined);\n  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='defensive-audit-presentation'),undefined);\n\n  const legacy=await read('public/wcl-runtime.js');\n  for(const writer of LEGACY_RUNTIME_MECHANICS_HISTORICAL_WRITERS)assert.doesNotMatch(legacy,functionDeclaration(writer));\n  assert.equal((legacy.match(/window\\.applyTelemetryMechanics\\?\\.\\(\\)/g)||[]).length,1);\n  assert.equal((legacy.match(/window\\.applyIntelligenceMechanics\\?\\.\\(\\)/g)||[]).length,1);\n  for(const writer of LEGACY_RUNTIME_DEFENSIVES_HISTORICAL_WRITERS)assert.doesNotMatch(legacy,functionDeclaration(writer),\`${'${writer}'} declaration must be physically absent\`);\n  assert.equal((legacy.match(/window\\.applyTelemetryDefensives\\?\\.\\(\\)/g)||[]).length,1);\n  assert.equal((legacy.match(/window\\.applyIntelligenceDefensives\\?\\.\\(\\)/g)||[]).length,1);\n});`);
tests=replaceTestBlock(tests,'bridge triggers Defensive parity without owning Defensive writer bindings',`test('bridge is a passive no-op retirement hold after both source owners are live',async()=>{\n  const bridgeAsset=ACTIVE_LOCAL_SCRIPTS.find(entry=>entry.id==='mechanics-defensives-fallback-bridge');\n  const defensiveAsset=ACTIVE_LOCAL_SCRIPTS.find(entry=>entry.id==='defensive-audit-source-runtime');\n  const mechanicsAsset=ACTIVE_LOCAL_SCRIPTS.find(entry=>entry.id==='mechanics-source-runtime');\n  const legacyIndex=ACTIVE_LOCAL_SCRIPTS.findIndex(entry=>entry.id==='wcl-legacy-runtime');\n  const bridgeIndex=ACTIVE_LOCAL_SCRIPTS.findIndex(entry=>entry.id==='mechanics-defensives-fallback-bridge');\n  const defensiveIndex=ACTIVE_LOCAL_SCRIPTS.findIndex(entry=>entry.id==='defensive-audit-source-runtime');\n  const mechanicsIndex=ACTIVE_LOCAL_SCRIPTS.findIndex(entry=>entry.id==='mechanics-source-runtime');\n\n  assert.equal(bridgeAsset?.authority,'migration-bridge');\n  assert.equal(bridgeAsset?.role,'post-owner-retirement-hold-noop');\n  assert.equal(defensiveAsset?.authority,'source-owner');\n  assert.equal(defensiveAsset?.role,'single-source-defensive-audit-presentation');\n  assert.equal(defensiveAsset?.sourceOwner,LEGACY_RUNTIME_DEFENSIVES_RUNTIME_SOURCE);\n  assert.equal(mechanicsAsset?.authority,'source-owner');\n  assert.equal(mechanicsAsset?.role,'single-source-mechanics-presentation');\n  assert.equal(mechanicsAsset?.sourceOwner,LEGACY_RUNTIME_MECHANICS_RUNTIME_SOURCE);\n  assert.ok(bridgeIndex>legacyIndex);\n  assert.ok(defensiveIndex>bridgeIndex);\n  assert.ok(mechanicsIndex>defensiveIndex);\n\n  const bridge=await read(LEGACY_RUNTIME_MECHANICS_DEFENSIVES_FALLBACK_OWNER);\n  assert.match(bridge,/window\\.applyMechanicsAndDefensives=applySplitFallback/);\n  assert.match(bridge,/function applySplitFallback\\(\\)\\{\\}/);\n  assert.match(bridge,/writerPolicy:'post-owner-retirement-hold-noop'/);\n  assert.match(bridge,/defensiveAuditPresentationOwnerLive:true/);\n  assert.match(bridge,/defensiveParityShadow:false/);\n  assert.doesNotMatch(bridge,/\\.shadow|window\\.applyTelemetryMechanics=|window\\.applyIntelligenceMechanics=|window\\.applyTelemetryDefensives=|window\\.applyIntelligenceDefensives=|screenWriter/);\n  assert.doesNotMatch(bridge,/queueMicrotask|MutationObserver|setInterval|setTimeout|requestAnimationFrame|fetch\\s*\\(/);\n});`);
await write(testPath,tests);

const changelogPath='CHANGELOG.md';
let changelog=await read(changelogPath);
const changelogAnchor='### Repository refactor\n\n';
assert.equal(count(changelog,changelogAnchor),1,'CHANGELOG repository refactor anchor must be unique');
changelog=changelog.replace(changelogAnchor,changelogAnchor+'- Promoted Defensive Audit to its feature-owned single presentation runtime after zero-mismatch browser parity; the two legacy Defensive writers are now physically retired while the split fallback bridge remains a temporary no-op retirement hold.\n');
await write(changelogPath,changelog);

const changed=[legacyPath,sourcePath,transportPath,bridgePath,ownershipPath,assetsPath,testPath,changelogPath];
console.log('[v4] Defensive Audit retirement prepared:',changed.join(', '));

await unlink(new URL(import.meta.url));
