import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');
const CURRENT_TIER_FORBIDDEN=/The Venomous Abyss|Nek.?zali|Twin Fangs|Entombed Sentinels|Vashnik|Lost Explorers|Sszorak|Coiled Altar|Ula.?tek/i;

test('CRITICAL v3.9.10 RAID-FIRST: catalog is WorldData metadata, journal-linked and combat-log independent',async()=>{
  const [query,catalog,bootstrap,route]=await Promise.all([
    read('server/wcl/queries/raid-catalog.mjs'),read('server/knowledge/raid-catalog-v1.mjs'),read('server/knowledge/raid-official-bootstrap-v1.mjs'),read('routes/api/knowledge/raid-catalog.js'),
  ]);
  assert.match(query,/worldData/);assert.match(query,/zones/);assert.match(query,/journalID/);assert.match(query,/difficulties/);assert.match(query,/partitions/);
  assert.match(catalog,/hardcodedZoneId:false/);assert.match(catalog,/usesCombatLogs:false/);assert.match(catalog,/wclCombatEventCalls:0/);assert.match(catalog,/reportRequired:false/);
  assert.match(bootstrap,/journalEncounterId:encounter\.journalEncounterId/);assert.match(bootstrap,/wclCombatEventCalls:0/);assert.match(bootstrap,/reportRequired:false/);
  assert.match(route,/officialKnowledgeAvailableDuringCombatLogEmbargo:true/);
  assert.doesNotMatch(`${query}\n${catalog}\n${bootstrap}\n${route}`,CURRENT_TIER_FORBIDDEN,'current raid/boss names must come from providers, never production constants');
});

test('CRITICAL v3.9.10 RAID-FIRST: Mechanics selector comes from raid catalog, not selected report',async()=>{
  const [runtime,service,react]=await Promise.all([read('public/iris-mechanics-knowledge-v3910.js'),read('server/services/mechanic-knowledge-view-service.mjs'),read('apps/web/src/features/mechanics/IrisKnowledge.js')]);
  assert.match(runtime,/\/api\/knowledge\/raid-catalog/);assert.match(runtime,/data-iris-boss-select/);assert.match(runtime,/OFFICIAL FIRST · REPORT OPTIONAL/);assert.match(runtime,/NO COMBAT EVIDENCE YET/);
  assert.match(service,/officialKnowledgeIndependentOfReports:true/);assert.match(service,/empiricalOverlayOptional:true/);assert.match(service,/no-combat-corpus-yet/);
  assert.match(react,/raidOpsClient\.raidCatalog/);assert.match(react,/OFFICIAL FIRST · REPORT OPTIONAL/);
  assert.doesNotMatch(`${runtime}\n${service}\n${react}`,CURRENT_TIER_FORBIDDEN,'Mechanics UI must remain tier-agnostic');
});
