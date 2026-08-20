import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileOfficialEncounterGraphV1 } from '../../server/knowledge/official-encounter-knowledge-v1.mjs';
import { enrichMechanicEpisodeWithOfficialKnowledgeV1 } from '../../server/corpus/mechanic-episode-official-reconciliation-v1.mjs';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

const graph=compileOfficialEncounterGraphV1({
  journal:{id:1,name:{en_US:'Portable Boss'},sections:[
    {id:10,title:{en_US:'Stage'},creature_display:{id:1},sections:[
      {id:11,title:{en_US:'Anchor Branch'},spell:{id:100,name:{en_US:'Anchor'}}},
      {id:12,title:{en_US:'Sibling Branch'},spell:{id:200,name:{en_US:'Sibling'}}},
    ]},
  ]},
  locale:'en_US',namespace:'static-test-eu',wclEncounterId:999,
});

const episode={
  version:'mechanic-episode-graph-v1',buildFingerprint:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',scope:{encounterId:999,difficulty:5,partition:4},
  anchor:{patternKey:'anchor',abilityId:100,roleInEpisode:'anchor'},
  nodes:[{patternKey:'anchor',abilityId:100,roleInEpisode:'anchor'},{patternKey:'candidate',abilityId:200,roleInEpisode:'aftermath'}],
  edges:[{fromPatternKey:'anchor',toPatternKey:'candidate',edgeClass:'mechanically-supported',promotionRelevant:true}],
  summary:{mechanicallySupportedEdges:1},contracts:{causalClaims:false},safety:{wclCallsExecuted:0,providerNetworkCallsExecuted:0},
};

test('CRITICAL v3.9.9 EPISODE OFFICIAL RECONCILIATION: cross-branch semantics guide investigation but cannot erase exact empirical support',()=>{
  const result=enrichMechanicEpisodeWithOfficialKnowledgeV1(episode,graph);
  const node=result.nodes.find(row=>row.abilityId===200);
  assert.equal(node.officialSemantics.status,'same-stage-different-official-branch');
  assert.equal(node.officialSemantics.negativeEvidence,false);
  assert.equal(node.officialSemantics.promotionEffect,'none');
  assert.equal(node.officialSemantics.investigationGuidance,'retain-empirical-support');
  assert.equal(result.edges[0].edgeClass,'mechanically-supported');
  assert.equal(result.edges[0].promotionRelevant,true);
  assert.equal(result.contracts.officialSemanticsCanPromote,false);
  assert.equal(result.contracts.officialSemanticsCanOverrideEmpiricalSupport,false);
  assert.equal(result.contracts.officialCrossBranchIsNegativeEvidence,false);
});

test('CRITICAL v3.9.9 EPISODE ROUTE: stored Blizzard graph is read by WCL encounter alias with zero provider/WCL network execution',async()=>{
  const route=await read('routes/api/wcl/mechanic-episode.js');
  assert.match(route,/loadLatestOfficialEncounterGraphByWclIdV1/);
  assert.match(route,/enrichMechanicEpisodeWithOfficialKnowledgeV1/);
  assert.match(route,/officialEncounterSemantics:official\.source/);
  assert.match(route,/networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0/);
});
