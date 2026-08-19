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
  LEGACY_RUNTIME_DEFENSIVES_RUNTIME_SOURCE,
  LEGACY_RUNTIME_DEFENSIVES_RUNTIME_TRANSPORT,
  LEGACY_RUNTIME_MECHANICS_DEFENSIVES_FALLBACK_OWNER,
  LEGACY_RUNTIME_MECHANICS_FALLBACK_HISTORICAL_WRITERS,
  LEGACY_RUNTIME_MECHANICS_FALLBACK_ACTIVE_WRITERS,
  LEGACY_RUNTIME_MECHANICS_FALLBACK_PHYSICALLY_RETIRED,
  LEGACY_RUNTIME_MECHANICS_HISTORICAL_WRITERS,
  LEGACY_RUNTIME_MECHANICS_ACTIVE_WRITERS,
  LEGACY_RUNTIME_MECHANICS_PHYSICALLY_RETIRED,
  LEGACY_RUNTIME_DEFENSIVES_HISTORICAL_WRITERS,
  LEGACY_RUNTIME_DEFENSIVES_ACTIVE_WRITERS,
  LEGACY_RUNTIME_DEFENSIVES_PHYSICALLY_RETIRED,
  LEGACY_RUNTIME_DEFENSIVES_WRITERS,
  LEGACY_RUNTIME_MECHANICS_SHADOWED_WRITERS,
  LEGACY_RUNTIME_MECHANICS_PARITY_SHADOWED_WRITERS,
  LEGACY_RUNTIME_DEFENSIVES_SHADOWED_WRITERS,
  LEGACY_RUNTIME_DEFENSIVES_PARITY_SHADOWED_WRITERS,
} from '../../config/legacy-runtime-ownership.mjs';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');
const functionDeclaration=writer=>new RegExp(String.raw`function\s+${writer}\s*\(`);

test('Mechanics and Defensive Audit retain separate canonical source owners',async()=>{
  assert.equal(LEGACY_RUNTIME_MECHANICS_SOURCE_OWNER,'apps/web/src/features/mechanics/Mechanics.js');
  assert.equal(LEGACY_RUNTIME_MECHANICS_RUNTIME_SOURCE,'apps/web/src/features/mechanics/runtime.js');
  assert.equal(LEGACY_RUNTIME_MECHANICS_RUNTIME_TRANSPORT,'public/mechanics-runtime.js');
  assert.equal(LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER,'apps/web/src/features/defensive-audit/DefensiveAudit.js');
  assert.equal(LEGACY_RUNTIME_DEFENSIVES_RUNTIME_SOURCE,'apps/web/src/features/defensive-audit/runtime.js');
  assert.equal(LEGACY_RUNTIME_DEFENSIVES_RUNTIME_TRANSPORT,'public/defensive-audit-runtime.js');
  assert.notEqual(LEGACY_RUNTIME_MECHANICS_SOURCE_OWNER,LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER);
  await Promise.all([
    access(new URL(`../../${LEGACY_RUNTIME_MECHANICS_SOURCE_OWNER}`,import.meta.url)),
    access(new URL(`../../${LEGACY_RUNTIME_MECHANICS_RUNTIME_SOURCE}`,import.meta.url)),
    access(new URL(`../../${LEGACY_RUNTIME_MECHANICS_RUNTIME_TRANSPORT}`,import.meta.url)),
    access(new URL(`../../${LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER}`,import.meta.url)),
    access(new URL(`../../${LEGACY_RUNTIME_DEFENSIVES_RUNTIME_SOURCE}`,import.meta.url)),
    access(new URL(`../../${LEGACY_RUNTIME_DEFENSIVES_RUNTIME_TRANSPORT}`,import.meta.url)),
  ]);
});

test('Mechanics source runtime remains the exact stable transport and single presentation owner',async()=>{
  const [source,transport]=await Promise.all([read(LEGACY_RUNTIME_MECHANICS_RUNTIME_SOURCE),read(LEGACY_RUNTIME_MECHANICS_RUNTIME_TRANSPORT)]);
  assert.equal(transport,source,'public Mechanics transport must stay byte-identical to its feature-owned source');
  assert.match(source,/mode:'single-source-owner'/);
  assert.match(source,/writerPolicy:'single-mechanics-presentation-owner'/);
  assert.match(source,/window\.applyTelemetryMechanics=applyTelemetryMechanics/);
  assert.match(source,/window\.applyIntelligenceMechanics=applyIntelligenceMechanics/);
  assert.doesNotMatch(source,/parity-shadow|queueMicrotask|MutationObserver|setInterval|setTimeout|requestAnimationFrame|fetch\s*\(/);
});

test('Defensive Audit source runtime remains the exact stable transport and single presentation owner',async()=>{
  const [source,transport]=await Promise.all([read(LEGACY_RUNTIME_DEFENSIVES_RUNTIME_SOURCE),read(LEGACY_RUNTIME_DEFENSIVES_RUNTIME_TRANSPORT)]);
  assert.equal(transport,source,'public Defensive Audit transport must stay byte-identical to its feature-owned source');
  assert.match(source,/mode:'single-source-owner'/);
  assert.match(source,/writerPolicy:'single-defensive-audit-presentation-owner'/);
  assert.match(source,/window\.applyTelemetryDefensives=applyTelemetryDefensives/);
  assert.match(source,/window\.applyIntelligenceDefensives=applyIntelligenceDefensives/);
  assert.match(source,/window\.__AVOID_DEFENSIVE_AUDIT_SOURCE_RUNTIME__/);
  assert.doesNotMatch(source,/parity-shadow|queueMicrotask|mismatches|const snapshot|function shadow|MutationObserver|setInterval|setTimeout|requestAnimationFrame|fetch\s*\(/);
});

test('Mechanics and Defensive Audit legacy writers are physically retired after green source parity',async()=>{
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_FALLBACK_HISTORICAL_WRITERS,['applyMechanicsAndDefensives']);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_FALLBACK_ACTIVE_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_FALLBACK_PHYSICALLY_RETIRED,['applyMechanicsAndDefensives']);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_HISTORICAL_WRITERS,['applyTelemetryMechanics','applyIntelligenceMechanics']);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_ACTIVE_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_PHYSICALLY_RETIRED,LEGACY_RUNTIME_MECHANICS_HISTORICAL_WRITERS);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_SHADOWED_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_PARITY_SHADOWED_WRITERS,[]);

  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_HISTORICAL_WRITERS,['applyTelemetryDefensives','applyIntelligenceDefensives']);
  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_WRITERS,LEGACY_RUNTIME_DEFENSIVES_HISTORICAL_WRITERS);
  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_ACTIVE_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_PHYSICALLY_RETIRED,LEGACY_RUNTIME_DEFENSIVES_HISTORICAL_WRITERS);
  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_SHADOWED_WRITERS,[]);
  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_PARITY_SHADOWED_WRITERS,[]);

  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='mechanics-presentation'),undefined);
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='defensive-audit-presentation'),undefined);

  const legacy=await read('public/wcl-runtime.js');
  for(const writer of LEGACY_RUNTIME_MECHANICS_HISTORICAL_WRITERS)assert.doesNotMatch(legacy,functionDeclaration(writer));
  assert.equal((legacy.match(/window\.applyTelemetryMechanics\?\.\(\)/g)||[]).length,1);
  assert.equal((legacy.match(/window\.applyIntelligenceMechanics\?\.\(\)/g)||[]).length,1);
  for(const writer of LEGACY_RUNTIME_DEFENSIVES_HISTORICAL_WRITERS)assert.doesNotMatch(legacy,functionDeclaration(writer),`${writer} declaration must be physically absent`);
  assert.equal((legacy.match(/window\.applyTelemetryDefensives\?\.\(\)/g)||[]).length,1);
  assert.equal((legacy.match(/window\.applyIntelligenceDefensives\?\.\(\)/g)||[]).length,1);
});

test('bridge is a passive no-op retirement hold after both source owners are live',async()=>{
  const bridgeAsset=ACTIVE_LOCAL_SCRIPTS.find(entry=>entry.id==='mechanics-defensives-fallback-bridge');
  const defensiveAsset=ACTIVE_LOCAL_SCRIPTS.find(entry=>entry.id==='defensive-audit-source-runtime');
  const mechanicsAsset=ACTIVE_LOCAL_SCRIPTS.find(entry=>entry.id==='mechanics-source-runtime');
  const legacyIndex=ACTIVE_LOCAL_SCRIPTS.findIndex(entry=>entry.id==='wcl-legacy-runtime');
  const bridgeIndex=ACTIVE_LOCAL_SCRIPTS.findIndex(entry=>entry.id==='mechanics-defensives-fallback-bridge');
  const defensiveIndex=ACTIVE_LOCAL_SCRIPTS.findIndex(entry=>entry.id==='defensive-audit-source-runtime');
  const mechanicsIndex=ACTIVE_LOCAL_SCRIPTS.findIndex(entry=>entry.id==='mechanics-source-runtime');

  assert.equal(bridgeAsset?.authority,'migration-bridge');
  assert.equal(bridgeAsset?.role,'post-owner-retirement-hold-noop');
  assert.equal(defensiveAsset?.authority,'source-owner');
  assert.equal(defensiveAsset?.role,'single-source-defensive-audit-presentation');
  assert.equal(defensiveAsset?.sourceOwner,LEGACY_RUNTIME_DEFENSIVES_RUNTIME_SOURCE);
  assert.equal(mechanicsAsset?.authority,'source-owner');
  assert.equal(mechanicsAsset?.role,'single-source-mechanics-presentation');
  assert.equal(mechanicsAsset?.sourceOwner,LEGACY_RUNTIME_MECHANICS_RUNTIME_SOURCE);
  assert.ok(bridgeIndex>legacyIndex);
  assert.ok(defensiveIndex>bridgeIndex);
  assert.ok(mechanicsIndex>defensiveIndex);

  const bridge=await read(LEGACY_RUNTIME_MECHANICS_DEFENSIVES_FALLBACK_OWNER);
  assert.match(bridge,/window\.applyMechanicsAndDefensives=applySplitFallback/);
  assert.match(bridge,/function applySplitFallback\(\)\{\}/);
  assert.match(bridge,/writerPolicy:'post-owner-retirement-hold-noop'/);
  assert.match(bridge,/defensiveAuditPresentationOwnerLive:true/);
  assert.match(bridge,/defensiveParityShadow:false/);
  assert.doesNotMatch(bridge,/\.shadow|window\.applyTelemetryMechanics=|window\.applyIntelligenceMechanics=|window\.applyTelemetryDefensives=|window\.applyIntelligenceDefensives=|screenWriter/);
  assert.doesNotMatch(bridge,/queueMicrotask|MutationObserver|setInterval|setTimeout|requestAnimationFrame|fetch\s*\(/);
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
