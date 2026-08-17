import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('runtime intelligence cannot consume a legacy published boss model',async()=>{
  const engine=await read('../../server/engines/intelligence-engine.mjs');
  const service=await read('../../server/corpus/service-v2.mjs');
  assert.match(engine,/loadPublishedEncounterModelV2/);
  assert.doesNotMatch(engine,/from '\.\.\/corpus\/service\.mjs'/);
  assert.match(service,/sampling\.policyVersion !== BOSS_SAMPLING_POLICY_VERSION/);
  assert.match(service,/homeSourceSelectedReports/);
  assert.match(service,/homeGuildSelectedReports/);
  assert.match(service,/homeOwnerSelectedReports/);
  assert.match(service,/selectedWrongScopeReports/);
  assert.match(service,/selectedMissingSourceReports/);
});

test('external reports cannot produce AvoiD player Reliability or player-focus output',async()=>{
  const query=await read('../../server/wcl/queries/telemetry.mjs');
  const engine=await read('../../server/engines/intelligence-engine.mjs');
  assert.match(query,/guild\{id name\}/);
  assert.match(query,/owner\{id\}/);
  assert.match(engine,/homeRaidEligible=isHomeSourceProfile/);
  assert.match(engine,/reportOwnerId/);
  assert.match(engine,/homeRaidEligible\?buildReliabilityShadow/);
  assert.match(engine,/homeRaidEligible\?buildPlayerMatrix/);
  assert.match(engine,/externalReliabilityDisabled/);
  assert.match(engine,/disabled-external-source/);
});

test('new global Wide and Deep profiles carry exact partition and scrub friendly actor ids',async()=>{
  const wide=await read('../../server/corpus/wide-profile.mjs');
  const deep=await read('../../server/corpus/deep-profile-v373.mjs');
  const scopes=await read('../../server/knowledge/scopes.mjs');
  assert.match(wide,/partition:Number\(partition\|\|0\)/);
  assert.match(deep,/normalized\.partition=Number\(partition\|\|header\.partition\|\|0\)/);
  assert.match(scopes,/Number\(profile\?\.partition\) === Number\(scope\?\.partition\)/);
  assert.match(scopes,/const \{ friendlyPlayers, \.\.\.rest \} = fight/);
});

test('legacy cached profiles are migrated from their partition-scoped storage key without WCL',async()=>{
  const rebuild=await read('../../server/corpus/canonical-rebuild-v2.mjs');
  assert.match(rebuild,/partition-scoped-storage-key-v1/);
  assert.match(rebuild,/migratedLegacyPartitionProfiles/);
  assert.doesNotMatch(rebuild,/wclGraphql|fetchRankingPage|fetchWideProfile|fetchDeepProfile/);
});

test('discovery retains home guild uploader provenance and future acquisition skips mapped home sources',async()=>{
  const source=await read('../../server/corpus/source-expansion.mjs');
  const step=await read('../../server/corpus/corpus-step-v376.mjs');
  assert.match(source,/ownerId,page:1/);
  assert.match(step,/current\.homeOwnerIds/);
  assert.match(step,/mappedHomeSource/);
  assert.match(step,/skipMappedHomeCandidates/);
  assert.match(step,/before WCL profiling/);
});
