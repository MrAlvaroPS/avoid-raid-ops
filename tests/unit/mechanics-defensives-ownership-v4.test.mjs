import test from 'node:test';
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
  LEGACY_RUNTIME_MECHANICS_WRITERS,
  LEGACY_RUNTIME_DEFENSIVES_WRITERS,
  LEGACY_RUNTIME_MECHANICS_SHADOWED_WRITERS,
  LEGACY_RUNTIME_MECHANICS_PARITY_SHADOWED_WRITERS,
  LEGACY_RUNTIME_DEFENSIVES_SHADOWED_WRITERS,
} from '../../config/legacy-runtime-ownership.mjs';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('Mechanics and Defensive Audit have separate canonical source owners',async()=>{
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

test('Mechanics source runtime is an exact stable transport mirror during parity shadow',async()=>{
  const [source,transport]=await Promise.all([
    read(LEGACY_RUNTIME_MECHANICS_RUNTIME_SOURCE),
    read(LEGACY_RUNTIME_MECHANICS_RUNTIME_TRANSPORT),
  ]);
  assert.equal(transport,source,'public Mechanics transport must remain byte-identical to its feature-owned source during migration');
  assert.match(source,/window\.applyTelemetryMechanics=applyTelemetryMechanics/);
  assert.match(source,/window\.applyIntelligenceMechanics=applyIntelligenceMechanics/);
  assert.match(source,/window\.__AVOID_MECHANICS_SOURCE_RUNTIME__/);
  assert.match(source,/mode:'parity-shadow'/);
  assert.match(source,/queueMicrotask/);
  assert.doesNotMatch(source,/MutationObserver|setInterval|setTimeout|requestAnimationFrame|fetch\s*\(/);
});

test('shared fallback is retired, Mechanics is parity-shadowed, and Defensive Audit remains screen-shadowed',async()=>{
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_FALLBACK_HISTORICAL_WRITERS,['applyMechanicsAndDefensives']);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_FALLBACK_ACTIVE_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_FALLBACK_PHYSICALLY_RETIRED,['applyMechanicsAndDefensives']);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_WRITERS,['applyTelemetryMechanics','applyIntelligenceMechanics']);
  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_WRITERS,['applyTelemetryDefensives','applyIntelligenceDefensives']);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_SHADOWED_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_PARITY_SHADOWED_WRITERS,LEGACY_RUNTIME_MECHANICS_WRITERS);
  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_SHADOWED_WRITERS,LEGACY_RUNTIME_DEFENSIVES_WRITERS);

  const mechanics=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='mechanics-presentation');
  const defensives=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='defensive-audit-presentation');
  assert.equal(mechanics?.status,'parity-shadow-source-runtime');
  assert.equal(mechanics?.canonicalOwner,LEGACY_RUNTIME_MECHANICS_SOURCE_OWNER);
  assert.deepEqual(mechanics?.functions,LEGACY_RUNTIME_MECHANICS_WRITERS);
  assert.equal(defensives?.canonicalOwner,LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER);
  assert.deepEqual(defensives?.functions,LEGACY_RUNTIME_DEFENSIVES_WRITERS);

  const legacy=await read('public/wcl-runtime.js');
  assert.doesNotMatch(legacy,/function\s+applyMechanicsAndDefensives\s*\(/);
  assert.equal((legacy.match(/window\.applyMechanicsAndDefensives\?\.\(\)/g)||[]).length,1);
  for(const writer of [...LEGACY_RUNTIME_MECHANICS_WRITERS,...LEGACY_RUNTIME_DEFENSIVES_WRITERS])assert.match(legacy,new RegExp(`function\\s+${writer}\\s*\\(`),`${writer} must remain physically present during the source-parity checkpoint`);
});

test('bridge delegates Mechanics parity to source runtime and shadows only Defensive Audit writers',async()=>{
  assert.equal(LEGACY_RUNTIME_MECHANICS_DEFENSIVES_FALLBACK_OWNER,'public/mechanics-defensives-fallback-bridge-v4.js');
  const asset=ACTIVE_LOCAL_SCRIPTS.find(entry=>entry.id==='mechanics-defensives-fallback-bridge');
  const sourceAsset=ACTIVE_LOCAL_SCRIPTS.find(entry=>entry.id==='mechanics-source-runtime');
  const legacyIndex=ACTIVE_LOCAL_SCRIPTS.findIndex(entry=>entry.id==='wcl-legacy-runtime');
  const bridgeIndex=ACTIVE_LOCAL_SCRIPTS.findIndex(entry=>entry.id==='mechanics-defensives-fallback-bridge');
  const sourceIndex=ACTIVE_LOCAL_SCRIPTS.findIndex(entry=>entry.id==='mechanics-source-runtime');
  assert.equal(asset?.authority,'migration-bridge');
  assert.equal(asset?.role,'mechanics-source-parity-shadow-and-defensive-writer-shadow');
  assert.equal(sourceAsset?.authority,'migration-source-shadow');
  assert.equal(sourceAsset?.sourceOwner,LEGACY_RUNTIME_MECHANICS_RUNTIME_SOURCE);
  assert.ok(bridgeIndex>legacyIndex);
  assert.ok(sourceIndex>bridgeIndex);

  const bridge=await read(LEGACY_RUNTIME_MECHANICS_DEFENSIVES_FALLBACK_OWNER);
  assert.match(bridge,/window\.applyMechanicsAndDefensives=applySplitFallback/);
  assert.match(bridge,/__AVOID_MECHANICS_SOURCE_RUNTIME__\?\.shadow\?\.\(\)/);
  assert.doesNotMatch(bridge,/window\.applyTelemetryMechanics=|window\.applyIntelligenceMechanics=/);
  assert.match(bridge,/window\.applyTelemetryDefensives=screenWriter\('applyTelemetryDefensives','Defensive Audit'\)/);
  assert.match(bridge,/window\.applyIntelligenceDefensives=screenWriter\('applyIntelligenceDefensives','Defensive Audit'\)/);
  assert.match(bridge,/writerPolicy:'mechanics-source-parity-shadow-and-defensive-writer-shadow'/);
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
