import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { ACTIVE_LOCAL_SCRIPTS } from '../../config/active-assets.mjs';
import {
  LEGACY_RUNTIME_RESPONSIBILITIES,
  LEGACY_RUNTIME_MECHANICS_SOURCE_OWNER,
  LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER,
  LEGACY_RUNTIME_MECHANICS_DEFENSIVES_FALLBACK_OWNER,
  LEGACY_RUNTIME_MECHANICS_DEFENSIVES_SHADOW_OWNER,
  LEGACY_RUNTIME_MECHANICS_FALLBACK_WRITERS,
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

test('legacy writers are partitioned by screen instead of one mechanics-defensives bucket',async()=>{
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_FALLBACK_WRITERS,['applyMechanicsAndDefensives']);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_WRITERS,['applyTelemetryMechanics','applyIntelligenceMechanics']);
  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_WRITERS,['applyTelemetryDefensives','applyIntelligenceDefensives']);
  assert.deepEqual(LEGACY_RUNTIME_MECHANICS_SHADOWED_WRITERS,LEGACY_RUNTIME_MECHANICS_WRITERS);
  assert.deepEqual(LEGACY_RUNTIME_DEFENSIVES_SHADOWED_WRITERS,LEGACY_RUNTIME_DEFENSIVES_WRITERS);
  assert.equal(LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='mechanics-defensives'),undefined);

  const fallback=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='mechanics-defensives-fallback');
  const mechanics=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='mechanics-presentation');
  const defensives=LEGACY_RUNTIME_RESPONSIBILITIES.find(entry=>entry.id==='defensive-audit-presentation');

  assert.equal(fallback?.status,'migration-bridge');
  assert.equal(fallback?.canonicalOwner,LEGACY_RUNTIME_MECHANICS_DEFENSIVES_FALLBACK_OWNER);
  assert.deepEqual(fallback?.functions,['applyMechanicsAndDefensives']);
  assert.equal(mechanics?.canonicalOwner,LEGACY_RUNTIME_MECHANICS_SOURCE_OWNER);
  assert.deepEqual(mechanics?.functions,LEGACY_RUNTIME_MECHANICS_WRITERS);
  assert.equal(defensives?.canonicalOwner,LEGACY_RUNTIME_DEFENSIVES_SOURCE_OWNER);
  assert.deepEqual(defensives?.functions,LEGACY_RUNTIME_DEFENSIVES_WRITERS);

  const classified=[...fallback.functions,...mechanics.functions,...defensives.functions];
  assert.equal(new Set(classified).size,5,'each remaining writer must have exactly one ownership classification');

  const legacy=await read('public/wcl-runtime.js');
  for(const writer of classified)assert.match(legacy,new RegExp(`function\\s+${writer}\\s*\\(`),`${writer} remains physically present until its own shadow checkpoint passes`);
});

test('all five legacy bindings are shadowed by one passive split-screen bridge',async()=>{
  assert.equal(LEGACY_RUNTIME_MECHANICS_DEFENSIVES_FALLBACK_OWNER,'public/mechanics-defensives-fallback-bridge-v4.js');
  assert.equal(LEGACY_RUNTIME_MECHANICS_DEFENSIVES_SHADOW_OWNER,LEGACY_RUNTIME_MECHANICS_DEFENSIVES_FALLBACK_OWNER);
  const asset=ACTIVE_LOCAL_SCRIPTS.find(entry=>entry.id==='mechanics-defensives-fallback-bridge');
  const legacyIndex=ACTIVE_LOCAL_SCRIPTS.findIndex(entry=>entry.id==='wcl-legacy-runtime');
  const bridgeIndex=ACTIVE_LOCAL_SCRIPTS.findIndex(entry=>entry.id==='mechanics-defensives-fallback-bridge');
  assert.equal(asset?.authority,'migration-bridge');
  assert.equal(asset?.owner,'split-source-owners');
  assert.equal(asset?.role,'screen-scoped-writer-shadow');
  assert.ok(bridgeIndex>legacyIndex,'bridge must load after all legacy declarations it shadows');

  const bridge=await read(LEGACY_RUNTIME_MECHANICS_DEFENSIVES_SHADOW_OWNER);
  assert.match(bridge,/window\.applyMechanicsAndDefensives=applySplitFallback/);
  assert.match(bridge,/window\.applyTelemetryMechanics=screenWriter\('applyTelemetryMechanics','Mechanics Library'\)/);
  assert.match(bridge,/window\.applyIntelligenceMechanics=screenWriter\('applyIntelligenceMechanics','Mechanics Library'\)/);
  assert.match(bridge,/window\.applyTelemetryDefensives=screenWriter\('applyTelemetryDefensives','Defensive Audit'\)/);
  assert.match(bridge,/window\.applyIntelligenceDefensives=screenWriter\('applyIntelligenceDefensives','Defensive Audit'\)/);
  assert.match(bridge,/writerPolicy:'split-screen-writer-shadow'/);
  assert.match(bridge,/mechanicsSourceOwner:'apps\/web\/src\/features\/mechanics\/Mechanics\.js'/);
  assert.match(bridge,/defensiveAuditSourceOwner:'apps\/web\/src\/features\/defensive-audit\/DefensiveAudit\.js'/);
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
