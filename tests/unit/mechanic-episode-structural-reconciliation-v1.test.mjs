import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichMechanicEpisodeWithStructuralKnowledgeV1 } from '../../server/corpus/mechanic-episode-structural-reconciliation-v1.mjs';

const episode={
  buildFingerprint:'1111111111111111111111111111111111111111',
  scope:{encounterId:9876,difficulty:5,partition:4},
  anchor:{patternKey:'anchor|anchor|700001|signal-anchor',abilityId:700001,roleInEpisode:'anchor',actorProvenance:{encounterOrigin:true}},
  nodes:[
    {patternKey:'anchor|anchor|700001|signal-anchor',abilityId:700001,roleInEpisode:'anchor',actorProvenance:{encounterOrigin:true}},
    {patternKey:'after|debuffs|700002|applydebuff',abilityId:700002,roleInEpisode:'aftermath',actorProvenance:{playerOrigin:true,encounterOrigin:false},officialSemantics:{status:'same-stage-different-official-branch',investigationGuidance:'deprioritize-as-native-child-unless-new-empirical-hypothesis',empiricalSupportPreserved:false}},
    {patternKey:'after|casts|700003|cast',abilityId:700003,roleInEpisode:'aftermath',actorProvenance:{playerOrigin:false,encounterOrigin:false},officialSemantics:{status:'same-stage-different-official-branch',investigationGuidance:'deprioritize-as-native-child-unless-new-empirical-hypothesis',empiricalSupportPreserved:false}},
  ],
  edges:[
    {fromPatternKey:'anchor|anchor|700001|signal-anchor',toPatternKey:'after|debuffs|700002|applydebuff',edgeClass:'temporal-association'},
    {fromPatternKey:'anchor|anchor|700001|signal-anchor',toPatternKey:'after|casts|700003|cast',edgeClass:'temporal-association'},
  ],
  summary:{},contracts:{},
};

const structural={
  fingerprint:'2222222222222222222222222222222222222222',
  scope:{wclEncounterId:9876},provider:{id:'wago-db2',build:'12.1.0.68914'},coverage:{complete:true},
  relations:[
    {sourceAbilityId:700001,targetAbilityId:700002,relationKind:'trigger-spell',relationLabel:'SpellEffect.EffectTriggerSpell',providerRowId:55,officialContext:{status:'official-source-to-unlisted-target'},structuralEvidence:{effectIndex:0}},
    {sourceAbilityId:700009,targetAbilityId:700003,relationKind:'trigger-spell',relationLabel:'SpellEffect.EffectTriggerSpell',providerRowId:56,officialContext:{status:'official-context-unresolved'},structuralEvidence:{effectIndex:1}},
  ],
};

test('direct DB2 anchor link reprioritizes a cross-branch candidate without becoming causal or promotion evidence',()=>{
  const result=enrichMechanicEpisodeWithStructuralKnowledgeV1(episode,structural);
  const node=result.nodes.find(row=>row.abilityId===700002);
  assert.equal(node.structuralSemantics.status,'direct-anchor-structural-link');
  assert.equal(node.structuralSemantics.investigationGuidance,'investigate-direct-db2-link-with-wcl');
  assert.equal(node.structuralSemantics.semanticOriginCandidate.status,'encounter-applied-player-state-candidate');
  assert.equal(node.actorProvenance.playerOrigin,true,'structural reconciliation must not rewrite observed actor provenance');
  assert.equal(node.officialSemantics.status,'same-stage-different-official-branch','structural reconciliation must preserve official hierarchy result');
  assert.equal(node.structuralSemantics.causalCombatEvidence,false);
  assert.equal(node.structuralSemantics.promotionEffect,'none');
  assert.equal(result.contracts.structuralMetadataCanPromote,false);
  assert.equal(result.contracts.structuralMetadataCanSatisfyExactPatternProvenance,false);
  assert.notEqual(result.buildFingerprint,episode.buildFingerprint);
  assert.equal(result.summary.structuralReconciliation.directAnchorLinks,1);
  assert.equal(result.summary.structuralReconciliation.encounterAppliedPlayerStateCandidates,1);
});

test('non-anchor structural context does not cancel official cross-branch deprioritization',()=>{
  const result=enrichMechanicEpisodeWithStructuralKnowledgeV1(episode,structural);
  const node=result.nodes.find(row=>row.abilityId===700003);
  assert.equal(node.structuralSemantics.status,'structurally-related');
  assert.equal(node.structuralSemantics.investigationGuidance,'deprioritize-as-native-child-unless-new-empirical-hypothesis');
  assert.equal(node.structuralSemantics.semanticOriginCandidate.status,'structurally-related-semantic-origin-unresolved');
  assert.equal(node.structuralSemantics.negativeEvidence,false);
});

test('missing structural knowledge is a zero-network unresolved state',()=>{
  const result=enrichMechanicEpisodeWithStructuralKnowledgeV1(episode,null);
  assert.equal(result.structuralReconciliation.status,'not-available');
  assert.equal(result.structuralReconciliation.providerNetworkCallsExecuted,0);
  assert.equal(result.structuralReconciliation.wclCallsExecuted,0);
});
