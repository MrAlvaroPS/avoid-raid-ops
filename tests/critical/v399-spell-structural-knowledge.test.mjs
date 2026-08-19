import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileOfficialEncounterGraphV1 } from '../../server/knowledge/official-encounter-knowledge-v1.mjs';
import { buildSpellStructuralKnowledgePreviewV1 } from '../../server/knowledge/spell-structural-knowledge-v1.mjs';
import { wagoBuildFromBlizzardNamespaceV1,WAGO_DB2_MAX_SEEDS,WAGO_DB2_MAX_RESPONSE_BYTES } from '../../server/knowledge/providers/wago-db2-spell-effect-v1.mjs';
import { findIrisCapability } from '../../server/iris/capability-contract-v390.mjs';
import { findIrisSource } from '../../server/iris/external-source-registry-v390.mjs';

const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');
const journal={id:1,name:{en_US:'Portable'},sections:[{id:2,title:{en_US:'Stage'},creature_display:{id:3},sections:[{id:4,title:{en_US:'State'},spell:{id:740002,name:{en_US:'State'}}}]}]};
const official=compileOfficialEncounterGraphV1({journal,locale:'en_US',namespace:'static-12.1.0_68914-eu',wclEncounterId:9901});

test('CRITICAL v3.9.9 STRUCTURAL BUILD: Wago build must derive from persisted Blizzard namespace, never latest',()=>{
  assert.equal(wagoBuildFromBlizzardNamespaceV1('static-12.1.0_68914-eu'),'12.1.0.68914');
  assert.throws(()=>wagoBuildFromBlizzardNamespaceV1('latest'),/Unsupported/);
  const preview=buildSpellStructuralKnowledgePreviewV1({wclEncounterId:9901,seedAbilityIds:[740001,740002],directions:'both'},official);
  assert.equal(preview.officialGraph.build,'12.1.0.68914');
  assert.equal(preview.networkUpperBound.wagoCalls,4);
  assert.equal(preview.networkUpperBound.blizzardCalls,0);
  assert.equal(preview.networkUpperBound.wclCalls,0);
});

test('CRITICAL v3.9.9 STRUCTURAL BOUNDS: runtime cannot become a bulk DB2 crawler',async()=>{
  const provider=await read('server/knowledge/providers/wago-db2-spell-effect-v1.mjs');
  assert.equal(WAGO_DB2_MAX_SEEDS,12);
  assert.equal(WAGO_DB2_MAX_RESPONSE_BYTES,2_000_000);
  assert.match(provider,/WAGO_DB2_MAX_ROWS=5000/);
  assert.match(provider,/filter\[SpellID\]/);
  assert.match(provider,/EffectTriggerSpell/);
  assert.match(provider,/text\.trim\(\)/,'empty-body handling must remain explicit');
  assert.match(provider,/rows:\[\],responseRows:0,matchedRows:0,serverFilterVerified:true,emptyResponse:true/,'HTTP-200 empty CSV must remain successful zero-row coverage');
  assert.doesNotMatch(provider,/downloadAll|recursiveCrawl|wholeTableFallback/);
});

test('CRITICAL v3.9.9 STRUCTURAL EVIDENCE: DB2 relation never becomes combat truth or promotion evidence',async()=>{
  const [contract,doc]=await Promise.all([read('server/knowledge/spell-structural-knowledge-v1.mjs'),read('docs/IRIS-SPELL-STRUCTURAL-KNOWLEDGE-V1.md')]);
  assert.match(contract,/providerRelationsCannotSatisfyExactPatternProvenance:true/);
  assert.match(contract,/providerRelationsCannotPromoteMechanic:true/);
  assert.match(contract,/causalCombatEvidence:false/);
  assert.match(contract,/rawCsvPersisted:false/);
  assert.match(contract,/canonicalDeepContribution:\{reports:0,pulls:0\}/);
  assert.match(doc,/does \*\*not\*\* answer whether an event occurred in a pull/i);
  assert.match(doc,/automaticPromotion = false/);
});

test('CRITICAL v3.9.9 STRUCTURAL PERSISTENCE: latest accumulates only within one exact build and preserves immutable request/aggregate revisions',async()=>{
  const [store,doc]=await Promise.all([read('server/knowledge/spell-structural-store-v1.mjs'),read('docs/IRIS-SPELL-STRUCTURAL-KNOWLEDGE-V1.md')]);
  assert.match(store,/SPELL_STRUCTURAL_STORE_VERSION='spell-structural-store-v2'/);
  assert.match(store,/sameBuild=previous\?\.provider\?\.build===build/);
  assert.match(store,/aggregate-revisions/);
  assert.match(store,/request-revision/);
  assert.match(store,/resetForNewBuild/);
  assert.match(store,/A later failure must not erase a previously successful coverage proof/);
  assert.match(doc,/cumulative \*\*within one exact client build\*\*/i);
  assert.match(doc,/new latest snapshot starts from the new build/i);
});

test('CRITICAL v3.9.9 STRUCTURAL API: preview/latest remain zero-network and resolve stays explicit/fingerprinted',async()=>{
  const service=await read('server/services/spell-structural-knowledge-service.mjs');
  assert.match(service,/action:'preview',networkExecuted:false,preview/);
  assert.match(service,/action:'latest',networkExecuted:false,wagoCallsExecuted:0,blizzardCallsExecuted:0,wclCallsExecuted:0,result/);
  assert.match(service,/confirmExecution!==true/);
  assert.match(service,/previewFingerprint/);
  assert.match(service,/Wago DB2 network execution requires confirmExecution:true/);
});

test('CRITICAL v3.9.9 STRUCTURAL SOURCE/CAPABILITY: Wago is discoverable only as bounded structural metadata',()=>{
  const source=findIrisSource('wago-db2');
  assert.equal(source.trust,'community-exported-client-structural-metadata');
  assert.equal(source.runtimeIntegration,'available-bounded');
  assert.ok(source.prohibited.includes('bulk-db2-mirroring'));
  assert.ok(source.prohibited.includes('treating-db2-relation-as-observed-combat'));
  const provider=findIrisCapability('knowledge.provider-wago-db2');assert.equal(provider.autonomy,'bounded');
  const preview=findIrisCapability('knowledge.spell-structure.preview');assert.equal(preview.autonomy,'automatic');
  const resolve=findIrisCapability('knowledge.spell-structure.resolve');assert.equal(resolve.autonomy,'bounded');
  const latest=findIrisCapability('knowledge.spell-structure.latest');assert.equal(latest.autonomy,'automatic');
});

test('CRITICAL v3.9.9 ABILITY KNOWLEDGE: stored DB2 wiring is read-only context and stale builds are rejected',async()=>{
  const source=await read('server/knowledge/ability-knowledge-v1.mjs');
  assert.match(source,/loadLatestSpellStructuralKnowledgeV1/);
  assert.match(source,/structuralStoredLookupNetworkCalls:0/);
  assert.match(source,/spellStructure:structuralSignal/);
  assert.match(source,/Stored structural build .* does not match current official Blizzard build/);
  assert.match(source,/observedOccurrence:false/);
  assert.match(source,/causalCombatEvidence:false/);
  assert.match(source,/promotionEffect:'none'/);
});

test('CRITICAL v3.9.9 EPISODE STRUCTURE: DB2 may reprioritize a hypothesis but never becomes causality/provenance/promotion',async()=>{
  const [reconciler,route]=await Promise.all([
    read('server/corpus/mechanic-episode-structural-reconciliation-v1.mjs'),
    read('routes/api/wcl/mechanic-episode.js'),
  ]);
  assert.match(reconciler,/investigate-direct-db2-link-with-wcl/);
  assert.match(reconciler,/encounter-applied-player-state-candidate/);
  assert.match(reconciler,/structuralMetadataCanPromote:false/);
  assert.match(reconciler,/structuralMetadataCanSatisfyExactPatternProvenance:false/);
  assert.match(reconciler,/structuralMetadataCanOverrideActorProvenance:false/);
  assert.match(reconciler,/structuralDirectLinkIsCausalCombatEvidence:false/);
  assert.match(route,/loadLatestSpellStructuralKnowledgeV1/);
  assert.match(route,/stale-build-rejected/);
  assert.match(route,/enrichMechanicEpisodeWithStructuralKnowledgeV1/);
});