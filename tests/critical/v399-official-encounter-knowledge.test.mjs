import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileOfficialEncounterGraphV1,buildOfficialEncounterKnowledgePreviewV1 } from '../../server/knowledge/official-encounter-knowledge-v1.mjs';
import { buildSpellRelationGraphV1 } from '../../server/knowledge/spell-relation-graph-v1.mjs';
import { classifyBlizzardFailure } from '../../server/knowledge/providers/blizzard-game-data-v1.mjs';
import { officialEncounterWclAliasKeyV1 } from '../../server/knowledge/official-encounter-store-v1.mjs';
import { findIrisCapability } from '../../server/iris/capability-contract-v390.mjs';
import { findIrisSource } from '../../server/iris/external-source-registry-v390.mjs';
import officialEncounterService from '../../server/services/official-encounter-knowledge-service.mjs';

const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

const journal={
  id:9100,
  name:{en_US:'Portable Encounter'},
  instance:{id:9200,name:{en_US:'Portable Raid'}},
  category:{type:'RAID'},
  modes:[{type:'MYTHIC',name:{en_US:'Mythic'}}],
  sections:[
    {id:1,title:{en_US:'Overview'},body_text:{en_US:'Official provider semantics.'}},
    {id:2,title:{en_US:'Stage Alpha'},creature_display:{id:9300},sections:[
      {id:3,title:{en_US:'Mechanic One'},spell:{id:740001,name:{en_US:'Mechanic One'}},sections:[
        {id:4,title:{en_US:'State One'},spell:{id:740002,name:{en_US:'State One'}}},
      ]},
      {id:5,title:{en_US:'Other Branch'},sections:[
        {id:6,title:{en_US:'Shared State'},spell:{id:740002,name:{en_US:'State One'}}},
      ]},
    ]},
  ],
};

test('CRITICAL v3.9.9 GRAPH: Blizzard Journal compiles generically without converting semantics into combat facts',()=>{
  const graph=compileOfficialEncounterGraphV1({journal,locale:'en_US',namespace:'static-99.9.9_12345-eu',wclEncounterId:9901});
  assert.equal(graph.schema,'official-encounter-semantic-graph-v1');
  assert.equal(graph.encounter.wclEncounterId,9901);
  assert.equal(graph.source.authority,'official-published-game-metadata');
  assert.equal(graph.source.namespace,'static-99.9.9_12345-eu');
  assert.equal(graph.sections.find(row=>row.sectionId===2).structuralRole,'stage');
  assert.equal(graph.sections.find(row=>row.sectionId===3).structuralRole,'mechanic');
  assert.equal(graph.sections.find(row=>row.sectionId===4).structuralRole,'submechanic');
  const shared=graph.abilities.find(row=>row.abilityId===740002);
  assert.equal(shared.memberships.length,2,'one spell may retain multiple official Journal paths');
  assert.equal(graph.evidenceContract.observedOccurrence,false);
  assert.equal(graph.evidenceContract.causalCombatEvidence,false);
  assert.equal(graph.evidenceContract.directScoreDelta,0);
  assert.equal(graph.evidenceContract.automaticPromotion,false);
});

test('CRITICAL v3.9.9 SPELL GRAPH: structural provider relation can explain player ownership without satisfying provenance or promotion',()=>{
  const graph=buildSpellRelationGraphV1({
    scope:{encounterId:9901,difficulty:5,partition:4},
    seedAbilityIds:[740010,740002],
    actorProvenance:[
      {abilityId:740010,status:'encounter-origin',granularity:'signal'},
      {abilityId:740002,status:'player-origin',granularity:'pattern',sourceRole:'friendly-player'},
    ],
    observations:[{
      provider:'wow-client-db2',retrievalMode:'versioned-structural-metadata',sourceUrl:'https://example.test/db2/build-12345',
      sourceAbilityId:740010,sourceName:'Encounter Trigger',targetAbilityId:740002,targetName:'Player State',
      relationKind:'trigger-spell',relationLabel:'EffectTriggerSpell',
      sourceEncounterAssociation:{status:'provider-supported',encounterId:9901,basis:'official encounter membership'},
    }],
  });
  const target=graph.nodes.find(row=>row.abilityId===740002);
  assert.equal(target.actorProvenance.status,'player-origin');
  assert.equal(target.semanticOrigin.status,'encounter-applied-player-state-candidate');
  assert.equal(target.semanticOrigin.providerDerived,true);
  assert.equal(target.semanticOrigin.promotionEligible,false);
  assert.equal(graph.edges[0].empiricalCombatEvidence,false);
  assert.equal(graph.edges[0].exactPatternProvenance,false);
  assert.equal(graph.evidenceContract.providerRelationsCannotSatisfyExactPatternProvenance,true);
  assert.equal(graph.evidenceContract.providerRelationsCannotPromoteMechanic,true);
  assert.equal(graph.evidenceContract.automaticPromotion,false);
});

test('CRITICAL v3.9.9 PREVIEW: official encounter planning is zero-WCL and zero-third-party',()=>{
  const preview=buildOfficialEncounterKnowledgePreviewV1({encounterName:'Portable Encounter',wclEncounterId:9901,region:'eu',locale:'en_US'});
  assert.equal(preview.networkUpperBound.wclCalls,0);
  assert.equal(preview.networkUpperBound.thirdPartyCalls,0);
  assert.equal(preview.networkUpperBound.blizzardGameDataCalls,2);
  assert.equal(preview.safety.automaticPromotion,false);
});

test('CRITICAL v3.9.9 API: GET preview is network-free and latest contract cannot spend WCL/provider calls',async()=>{
  const previewResponse=await officialEncounterService(new Request('http://localhost/api/knowledge/encounter?encounterName=Portable%20Encounter&wclEncounterId=9901'));
  assert.equal(previewResponse.status,200);
  const preview=await previewResponse.json();
  assert.equal(preview.networkExecuted,false);
  assert.equal(preview.preview.networkUpperBound.wclCalls,0);

  const serviceSource=await read('server/services/official-encounter-knowledge-service.mjs');
  assert.match(serviceSource,/action:'latest',networkExecuted:false,wclCallsExecuted:0,providerCallsExecuted:0,result/);
  assert.match(serviceSource,/No persisted official encounter graph found/);
  assert.match(serviceSource,/loadLatestOfficialEncounterGraphByWclIdV1/);
});

test('CRITICAL v3.9.9 FAILURE: Blizzard spell endpoint failures never become encounter-negative evidence',()=>{
  for(const status of [401,403,404,500]){
    const state=classifyBlizzardFailure(status);
    assert.equal(state.negativeEvidence,false,`${status} must remain non-negative`);
  }
});

test('CRITICAL v3.9.9 INDEX: WCL encounter IDs have a deterministic official-knowledge alias key',()=>{
  assert.equal(officialEncounterWclAliasKeyV1(9901),'knowledge/official-encounters/blizzard/by-wcl/9901.json');
});

test('CRITICAL v3.9.9 CONTRACTS: Blizzard is official published metadata while WCL remains combat truth',async()=>{
  const source=findIrisSource('blizzard-game-data');
  assert.equal(source.trust,'official-published-game-metadata');
  assert.ok(source.prohibited.includes('treating-journal-as-observed-pull-evidence'));
  assert.equal(findIrisCapability('knowledge.encounter.preview').autonomy,'automatic');
  assert.equal(findIrisCapability('knowledge.encounter.resolve').status,'available');
  const [architecture,operations,pipeline,pkg]=await Promise.all([read('IRIS-ARCHITECTURE.md'),read('IRIS-OPERATIONS.md'),read('docs/IRIS-BOSS-AGNOSTIC-LEARNING-PIPELINE-V1.md'),read('package.json')]);
  assert.match(architecture,/Blizzard Encounter Journal/);
  assert.match(architecture,/Warcraft Logs is combat truth/);
  assert.match(operations,/official-encounter-semantic-graph-v1/);
  assert.match(pipeline,/Official encounter knowledge resolution/);
  assert.match(pkg,/"version": "0\.3\.9-9-vercel\.0"/);
});
