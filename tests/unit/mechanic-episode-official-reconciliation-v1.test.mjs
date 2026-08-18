import test from 'node:test';
import assert from 'node:assert/strict';
import { compileOfficialEncounterGraphV1 } from '../../server/knowledge/official-encounter-knowledge-v1.mjs';
import { enrichMechanicEpisodeWithOfficialKnowledgeV1 } from '../../server/corpus/mechanic-episode-official-reconciliation-v1.mjs';

const journal={
  id:9001,
  name:{en_US:'Synthetic Boss'},
  sections:[
    {id:100,title:{en_US:'Stage One'},creature_display:{id:1},sections:[
      {id:110,title:{en_US:'Anchor Branch'},spell:{id:5000,name:{en_US:'Anchor'}},sections:[
        {id:111,title:{en_US:'Same Branch State'},spell:{id:6001,name:{en_US:'Same Branch State'}}},
      ]},
      {id:120,title:{en_US:'Sibling Branch'},spell:{id:6002,name:{en_US:'Sibling Branch'}}},
    ]},
    {id:200,title:{en_US:'Stage Two'},creature_display:{id:2},sections:[
      {id:210,title:{en_US:'Later Mechanic'},spell:{id:6003,name:{en_US:'Later Mechanic'}}},
    ]},
  ],
};

function episode(edgeClass='temporal-association'){
  return {
    version:'mechanic-episode-graph-v1',
    buildFingerprint:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    episodeId:'episode:9000:5:4:test',
    scope:{encounterId:9000,difficulty:5,partition:4},
    anchor:{patternKey:'anchor|anchor|5000|signal-anchor',abilityId:5000,roleInEpisode:'anchor'},
    nodes:[
      {patternKey:'anchor|anchor|5000|signal-anchor',abilityId:5000,roleInEpisode:'anchor'},
      {patternKey:'p1',abilityId:6001,roleInEpisode:'aftermath'},
      {patternKey:'p2',abilityId:6002,roleInEpisode:'aftermath'},
      {patternKey:'p3',abilityId:6003,roleInEpisode:'aftermath'},
      {patternKey:'p4',abilityId:6999,roleInEpisode:'aftermath'},
    ],
    edges:[
      {fromPatternKey:'anchor|anchor|5000|signal-anchor',toPatternKey:'p1',edgeClass:'temporal-association',promotionRelevant:false},
      {fromPatternKey:'anchor|anchor|5000|signal-anchor',toPatternKey:'p2',edgeClass,promotionRelevant:edgeClass==='mechanically-supported'},
      {fromPatternKey:'anchor|anchor|5000|signal-anchor',toPatternKey:'p3',edgeClass:'temporal-association',promotionRelevant:false},
      {fromPatternKey:'anchor|anchor|5000|signal-anchor',toPatternKey:'p4',edgeClass:'temporal-association',promotionRelevant:false},
    ],
    summary:{mechanicallySupportedEdges:edgeClass==='mechanically-supported'?1:0},
    contracts:{causalClaims:false},
    safety:{wclCallsExecuted:0,providerNetworkCallsExecuted:0},
  };
}

const graph=compileOfficialEncounterGraphV1({journal,locale:'en_US',namespace:'static-1.2.3_12345-eu',wclEncounterId:9000});

test('official hierarchy guides episode hypothesis priority without becoming negative evidence',()=>{
  const enriched=enrichMechanicEpisodeWithOfficialKnowledgeV1(episode(),graph);
  const same=enriched.nodes.find(row=>row.abilityId===6001).officialSemantics;
  const sibling=enriched.nodes.find(row=>row.abilityId===6002).officialSemantics;
  const later=enriched.nodes.find(row=>row.abilityId===6003).officialSemantics;
  const unresolved=enriched.nodes.find(row=>row.abilityId===6999).officialSemantics;

  assert.equal(same.status,'same-official-mechanic-branch');
  assert.equal(same.investigationGuidance,'officially-aligned-hypothesis');
  assert.equal(sibling.status,'same-stage-different-official-branch');
  assert.equal(sibling.investigationGuidance,'deprioritize-as-native-child-unless-new-empirical-hypothesis');
  assert.equal(later.status,'different-official-stage');
  assert.equal(later.investigationGuidance,'deprioritize-across-stage-unless-new-empirical-hypothesis');
  assert.equal(unresolved.status,'official-membership-unresolved');
  assert.equal(sibling.negativeEvidence,false);
  assert.equal(sibling.promotionEffect,'none');
  assert.notEqual(enriched.buildFingerprint,enriched.empiricalBuildFingerprint);
  assert.equal(enriched.summary.officialReconciliation.crossBranch,2);
  assert.equal(enriched.contracts.officialSemanticsCanPromote,false);
  assert.equal(enriched.contracts.officialSemanticsCanOverrideEmpiricalSupport,false);
});

test('exact empirical mechanical support is preserved even across a different official branch',()=>{
  const enriched=enrichMechanicEpisodeWithOfficialKnowledgeV1(episode('mechanically-supported'),graph);
  const node=enriched.nodes.find(row=>row.abilityId===6002);
  const edge=enriched.edges.find(row=>row.toPatternKey==='p2');
  assert.equal(node.officialSemantics.status,'same-stage-different-official-branch');
  assert.equal(node.officialSemantics.investigationGuidance,'retain-empirical-support');
  assert.equal(node.officialSemantics.empiricalSupportPreserved,true);
  assert.equal(edge.edgeClass,'mechanically-supported');
  assert.equal(edge.promotionRelevant,true);
  assert.equal(edge.officialSemantics.promotionEffect,'none');
});

test('missing official graph leaves the empirical episode intact and performs no network work',()=>{
  const raw=episode();
  const enriched=enrichMechanicEpisodeWithOfficialKnowledgeV1(raw,null);
  assert.equal(enriched.buildFingerprint,raw.buildFingerprint);
  assert.equal(enriched.officialReconciliation.status,'not-available');
  assert.equal(enriched.officialReconciliation.providerNetworkCallsExecuted,0);
  assert.equal(enriched.officialReconciliation.wclCallsExecuted,0);
});
