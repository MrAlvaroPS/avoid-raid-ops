import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMechanicEpisodeGraphV1 } from '../../server/corpus/mechanic-episode-graph-v1.mjs';

const scope={encounterId:9001,difficulty:5,partition:4};
const signal={id:5000,name:'Synthetic Anchor',origin:{classification:'encounter',encounterRate:1}};
const abilityKnowledge={abilities:[
  {abilityId:5000,identity:{name:'Synthetic Anchor'}},
  {abilityId:6001,identity:{name:'Player Marker'}},
  {abilityId:6002,identity:{name:'Encounter State'}},
  {abilityId:6003,identity:{name:'Mixed Marker'}},
]};

function assessment({id,key,relation='before-2.5s',mechanical,origin,granularity='pattern',sourceRole,topology='unrelated'}){
  return{
    pattern:{key:key||`${relation}|buffs|${id}|applybuff`,relation,stream:'buffs',abilityId:id,eventType:'applybuff',independentSources:5,windows:9,rawEvents:12,medianDeltaMs:-1200,temporalSpreadP80P20Ms:450},
    structurallyEligible:true,
    specificity:{status:'specificity-supported',anchorPrevalence:.9,backgroundPrevalence:.2,lift:3.1,prevalenceDelta:.7},
    actorProvenance:{status:origin,granularity,sourceRole,sourceShare:1,targetRole:'friendly-player',targetShare:1,encounterOrigin:origin==='encounter-origin',playerOrigin:origin==='player-origin'},
    topology:{dominant:topology,share:topology==='unrelated'?1:.9,consistent:topology!=='unrelated'},
    provider:{status:'unresolved'},
    mechanical:{status:mechanical},
  };
}

function baseVerification(rows){
  return{
    version:'synthetic-verifier',signalId:5000,candidateAssessments:rows,
    selectionDiagnostics:{backgroundNoiseCandidates:2,structuralTopRejectedAsNoise:true},
  };
}

const anchorActorProvenance={
  version:'semantic-actor-provenance-v2',previewFingerprint:'abc',patterns:[
    {abilityId:5000,events:10,sourceRoles:{'encounter-boss':10}},
  ],
};

test('builds a diagnostic episode with player context markers but never promotes them',()=>{
  const verification=baseVerification([
    assessment({id:6001,mechanical:'player-origin-context-marker',origin:'player-origin',sourceRole:'friendly-player'}),
    assessment({id:6003,mechanical:'provenance-required',origin:'mixed-or-unknown',sourceRole:'unknown'}),
  ]);
  const episode=buildMechanicEpisodeGraphV1({scope,signal,verification,abilityKnowledge,actorProvenance:anchorActorProvenance,actorProvenanceFingerprint:'abc'});
  assert.equal(episode.version,'mechanic-episode-graph-v1');
  assert.equal(episode.nodes.length,3);
  assert.equal(episode.summary.contextOnlyNodes,1);
  assert.equal(episode.summary.provenanceRequiredNodes,1);
  assert.equal(episode.summary.mechanicallySupportedEdges,0);
  assert.equal(episode.promotion.lifecycle,'promotion-pending');
  assert.equal(episode.promotion.eligible,false);
  assert.ok(episode.promotion.blockers.includes('exact-encounter-origin-edge'));
  assert.equal(episode.contracts.causalClaims,false);
  assert.equal(episode.safety.wclCallsExecuted,0);
});

test('exact pattern encounter-origin can create mechanical support but episode v1 still cannot promote',()=>{
  const verification=baseVerification([
    assessment({id:6002,mechanical:'mechanically-supported',origin:'encounter-origin',sourceRole:'encounter-boss',topology:'same-source'}),
  ]);
  const episode=buildMechanicEpisodeGraphV1({scope,signal,verification,abilityKnowledge,actorProvenance:anchorActorProvenance});
  assert.equal(episode.summary.exactPatternEncounterOriginNodes,1);
  assert.equal(episode.summary.mechanicallySupportedEdges,1);
  assert.equal(episode.edges[0].edgeClass,'mechanically-supported');
  assert.equal(episode.edges[0].promotionRelevant,true);
  assert.equal(episode.promotion.eligible,false);
  assert.ok(!episode.promotion.blockers.includes('exact-encounter-origin-edge'));
  assert.ok(episode.promotion.blockers.includes('matched-null-baseline'));
  assert.ok(episode.promotion.blockers.includes('independent-evidence-groups'));
  assert.ok(episode.promotion.blockers.includes('statistical-stability'));
  assert.ok(episode.promotion.blockers.includes('untouched-holdout'));
});

test('ability-level encounter-looking provenance cannot become a mechanically-supported edge',()=>{
  const row=assessment({id:6002,mechanical:'mechanically-supported',origin:'encounter-origin',granularity:'ability-fallback',sourceRole:'encounter-boss',topology:'same-source'});
  const verification=baseVerification([row]);
  const episode=buildMechanicEpisodeGraphV1({scope,signal,verification,abilityKnowledge,actorProvenance:anchorActorProvenance});
  assert.equal(episode.summary.exactPatternEncounterOriginNodes,0);
  assert.equal(episode.summary.mechanicallySupportedEdges,0);
  assert.equal(episode.edges[0].edgeClass,'actor-linked');
  assert.equal(episode.edges[0].promotionRelevant,false);
  assert.ok(episode.promotion.blockers.includes('exact-encounter-origin-edge'));
});

test('episode identity is stable when context patterns change',()=>{
  const one=buildMechanicEpisodeGraphV1({scope,signal,verification:baseVerification([]),abilityKnowledge,actorProvenance:anchorActorProvenance});
  const two=buildMechanicEpisodeGraphV1({scope,signal,verification:baseVerification([
    assessment({id:6001,mechanical:'player-origin-context-marker',origin:'player-origin',sourceRole:'friendly-player'}),
  ]),abilityKnowledge,actorProvenance:anchorActorProvenance});
  assert.equal(one.episodeId,two.episodeId);
  assert.equal(one.mechanicSeedKey,two.mechanicSeedKey);
  assert.notEqual(one.buildFingerprint,two.buildFingerprint);
});

test('background noise and specificity-partial rows are not admitted as episode nodes',()=>{
  const noise=assessment({id:6001,mechanical:'background-noise',origin:'player-origin',sourceRole:'friendly-player'});
  noise.specificity.status='background-noise';
  const partial=assessment({id:6003,mechanical:'specificity-partial',origin:'mixed-or-unknown',sourceRole:'unknown'});
  partial.specificity.status='specificity-partial';
  const supported=assessment({id:6002,mechanical:'provenance-required',origin:'mixed-or-unknown',sourceRole:'unknown'});
  const episode=buildMechanicEpisodeGraphV1({scope,signal,verification:baseVerification([noise,partial,supported]),abilityKnowledge,actorProvenance:anchorActorProvenance});
  assert.equal(episode.summary.specificitySupportedNodes,1);
  assert.equal(episode.nodes.length,2);
  assert.equal(episode.nodes[1].abilityId,6002);
});
