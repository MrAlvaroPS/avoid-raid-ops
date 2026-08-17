import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getIrisSourceRegistry,findIrisSource } from '../../server/iris/external-source-registry-v390.mjs';
import { findIrisCapability } from '../../server/iris/capability-contract-v390.mjs';
import irisSourcesService from '../../server/services/iris-sources-service.mjs';

const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL IRIS SOURCES: reviewed registry contains every approved development reference with explicit API posture',()=>{
  const registry=getIrisSourceRegistry();
  assert.equal(registry.version,'iris-source-registry-v2');
  assert.equal(registry.reviewedAt,'2026-08-17');
  for(const id of ['warcraftlogs','wowanalyzer','wipefest','archon','lorrgs','parse-wowhead','mythictrap'])assert.ok(findIrisSource(id),`${id} must remain classified`);
  assert.equal(registry.policy.primaryCombatTruth,'warcraftlogs');
  assert.equal(registry.policy.doNotInventEndpoints,true);
});

test('CRITICAL WCL SOURCE: official OAuth/GraphQL surfaces stay canonical without imposing a permanent-storage guard',()=>{
  const wcl=findIrisSource('warcraftlogs');
  assert.equal(wcl.status,'official-api');assert.equal(wcl.runtimeIntegration,'available');assert.equal(wcl.trust,'canonical-observed-combat');
  assert.equal(wcl.api.publicGraphql,'https://www.warcraftlogs.com/api/v2/client');assert.equal(wcl.api.userGraphql,'https://www.warcraftlogs.com/api/v2/user');
  for(const root of ['reportData','characterData','guildData','gameData','worldData','rateLimitData'])assert.ok(wcl.api.roots[root],`${root} must remain documented for Iris`);
  assert.equal(Object.hasOwn(wcl,'persistence'),false,'the removed permanent-storage guard must not silently return as a source-registry contract');
  assert.equal(wcl.prohibited.includes('assuming-public-readability-permits-permanent-copy'),false);assert.ok(wcl.prohibited.includes('website-scraping-to-bypass-api'));
});

test('CRITICAL THIRD-PARTY SOURCES: Wipefest/WoWAnalyzer/Mythic Trap/Archon cannot silently become production APIs',()=>{
  const wipefest=findIrisSource('wipefest'),wow=findIrisSource('wowanalyzer'),mythic=findIrisSource('mythictrap'),archon=findIrisSource('archon');
  assert.equal(wipefest.publicApi,false);assert.equal(wipefest.fallback,'warcraftlogs');assert.match(wipefest.notes,/no API/i);
  assert.equal(wow.publicApi,false);assert.equal(wow.runtimeIntegration,'reference-only');assert.ok(wow.prohibited.includes('copying-AGPL-code-without-license-decision'));
  assert.equal(mythic.publicApi,false);assert.equal(mythic.runtimeIntegration,'reference-only');
  assert.equal(archon.publicApi,false);assert.ok(archon.prohibited.includes('undocumented-ArchonViewModels-production-dependency'));
});

test('CRITICAL LORRGS SOURCE: public read API is executable read-only while provider mutation/queue surfaces stay forbidden',()=>{
  const lorrgs=findIrisSource('lorrgs');
  assert.equal(lorrgs.publicApi,true);assert.equal(lorrgs.runtimeIntegration,'available-readonly');assert.equal(lorrgs.trust,'secondary-derived-from-warcraftlogs');
  for(const path of ['/spec_ranking/{spec_slug}/{boss_slug}','/comp_ranking/{boss_slug}','/bosses/{boss_slug}/spells','/specs/{spec_slug}/spells'])assert.ok(lorrgs.readEndpoints.some(x=>x.path===path),`${path} must remain discoverable`);
  for(const path of ['/spec_ranking/load','/comp_ranking/load/{boss_slug}','/user_reports/{report_id}/load'])assert.ok(lorrgs.forbiddenEndpoints.some(x=>x.path===path),`${path} must remain prohibited`);
});

test('CRITICAL PARSE WOWHEAD SOURCE: wrapper is optional reference enrichment, never official or canonical combat truth',()=>{
  const parse=findIrisSource('parse-wowhead');
  assert.equal(parse.publicApi,true);assert.equal(parse.runtimeIntegration,'available-optional');assert.equal(parse.trust,'reference-identity-enrichment');
  assert.ok(parse.readEndpoints.some(x=>x.path==='/get_spell'));assert.ok(parse.prohibited.includes('treating-wrapper-as-official-wowhead-api'));assert.ok(parse.prohibited.includes('client-side-api-key'));
});

test('CRITICAL IRIS SOURCE API: registry and single-provider lookup are actually callable through the service contract',async()=>{
  const allResponse=await irisSourcesService(new Request('http://localhost/api/iris/sources'));assert.equal(allResponse.status,200);
  const all=await allResponse.json();assert.equal(all.ok,true);assert.equal(all.version,'iris-source-registry-v2');assert.equal(all.sources.length,7);
  const oneResponse=await irisSourcesService(new Request('http://localhost/api/iris/sources?id=lorrgs'));assert.equal(oneResponse.status,200);
  const one=await oneResponse.json();assert.equal(one.ok,true);assert.equal(one.source.id,'lorrgs');assert.equal(one.source.runtimeIntegration,'available-readonly');
  const parseResponse=await irisSourcesService(new Request('http://localhost/api/iris/sources?id=parse-wowhead'));assert.equal(parseResponse.status,200);
  const missingResponse=await irisSourcesService(new Request('http://localhost/api/iris/sources?id=does-not-exist'));assert.equal(missingResponse.status,404);
});

test('CRITICAL IRIS SOURCE DOCS: source directory records provider-specific API and evidence boundaries',async()=>{
  const [index,wcl,wow,wipe,archon,lorrgs,parse,mythic,agents]=await Promise.all([read('docs/iris-sources/README.md'),read('docs/iris-sources/WARCRAFT-LOGS.md'),read('docs/iris-sources/WOWANALYZER.md'),read('docs/iris-sources/WIPEFEST.md'),read('docs/iris-sources/ARCHON.md'),read('docs/iris-sources/LORRGS.md'),read('docs/iris-sources/PARSE-WOWHEAD.md'),read('docs/iris-sources/MYTHIC-TRAP.md'),read('AGENTS.md')]);
  assert.match(index,/Warcraft Logs observed evidence remains the combat source of truth/);assert.match(wcl,/Operational API safety/);assert.match(wcl,/no permanent-storage prohibition/i);assert.doesNotMatch(wcl,/API terms and persistence guard/i);assert.match(wcl,/rateLimitData/);
  assert.match(wow,/AGPL-3\.0-or-later/);assert.match(wipe,/answers \*\*no\*\*/i);assert.match(archon,/ArchonViewModels/);assert.match(lorrgs,/Safe read-only endpoint catalogue/);assert.match(parse,/not an official Wowhead developer API/i);assert.match(mythic,/No supported public developer API/);assert.match(agents,/docs\/iris-sources\/README\.md/);
});

test('CRITICAL IRIS CAPABILITY: source registry and provider-aware knowledge are discoverable without upgrading trust',()=>{
  const capability=findIrisCapability('sources.inspect');assert.ok(capability);assert.equal(capability.status,'available');assert.equal(capability.autonomy,'automatic');assert.equal(capability.endpoint,'GET /api/iris/sources');
  assert.equal(findIrisSource('lorrgs').runtimeIntegration,'available-readonly');assert.equal(findIrisCapability('knowledge.ability.resolve').autonomy,'explicitApproval');
});
