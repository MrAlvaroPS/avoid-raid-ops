import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMechanicKnowledgeViewV1 } from '../../server/corpus/mechanic-knowledge-view-v1.mjs';

function membership(sectionId,title,mechanicId,mechanicTitle){return{sectionId,title,structuralRole:'submechanic',path:['Synthetic Stage',mechanicTitle,title],sectionPath:[{sectionId:70001,title:'Synthetic Stage',structuralRole:'stage'},{sectionId:mechanicId,title:mechanicTitle,structuralRole:'mechanic'},{sectionId,title,structuralRole:'submechanic'}]};}

test('arbitrary boss IDs render persisted evidence and stop at Matched Null without fixture-specific logic',()=>{
  const scope={encounterId:8765,difficulty:5,partition:11},anchorId=910001,candidateId=910002,patternKey=`after-2.5s|debuffs|${candidateId}|applydebuff`;
  const officialGraph={fingerprint:'a'.repeat(40),encounter:{name:'Synthetic Encounter'},abilities:[
    {abilityId:anchorId,name:'Synthetic Anchor',memberships:[membership(70101,'Synthetic Anchor',70011,'Mechanic Alpha')]},
    {abilityId:candidateId,name:'Synthetic Candidate',memberships:[membership(70102,'Synthetic Candidate',70012,'Mechanic Beta')]},
  ]};
  const structuralKnowledge={relations:[{sourceAbilityId:anchorId,targetAbilityId:candidateId,relationKind:'EffectTriggerSpell',providerRowId:42}]};
  const episode={
    episodeId:'episode:8765:5:11:test',buildFingerprint:'b'.repeat(40),empiricalBuildFingerprint:'c'.repeat(40),scope,
    anchor:{abilityId:anchorId,displayName:'Synthetic Anchor',actorProvenance:{status:'encounter-origin'}},
    nodes:[
      {roleInEpisode:'anchor',abilityId:anchorId,patternKey:`anchor|anchor|${anchorId}|signal-anchor`},
      {roleInEpisode:'aftermath',abilityId:candidateId,displayName:'Synthetic Candidate',patternKey,relation:'after-2.5s',eventType:'applydebuff',stream:'debuffs',disposition:'specificity-supported',specificity:{status:'specificity-supported',anchorPrevalence:.8,backgroundPrevalence:.1,lift:4,prevalenceDelta:.7},actorProvenance:{status:'player-origin',granularity:'pattern',playerOrigin:true,encounterOrigin:false,sourceRole:'friendly-player',sourceShare:.9}},
    ],
    summary:{candidateAssessmentsAvailable:3,specificitySupportedNodes:1,provenanceRequiredNodes:1,exactPatternEncounterOriginNodes:0,mechanicallySupportedEdges:0},
    promotion:{lifecycle:'promotion-pending',reason:'Synthetic pending'},
  };
  const matchedNull={baselineSufficient:true,matchedPairs:6,matchedSources:3,summary:{supported:0,noise:1,partial:0,insufficient:0},patternAssessments:[{patternKey,abilityId:candidateId,status:'matched-background-noise',matchedPairs:6,anchorPrevalence:.8,matchedBackgroundPrevalence:.75,lift:1.05,prevalenceDelta:.05}]};
  const evidenceGroups={summary:{patternsWithIndependentGroupCoverage:0},promotionContribution:{independentEvidenceGroupsGate:'not-eligible-no-matched-supported-pattern',reason:'none survived'}};
  const stability={summary:{stabilitySupportedPatterns:0},holdoutContribution:{statisticalStabilityGate:'not-eligible-no-independent-evidence-pattern',reason:'no eligible pattern'}};
  const holdoutReservation={status:'not-eligible-no-stability-supported-pattern',reservedSources:[]};

  const view=buildMechanicKnowledgeViewV1({scope,encounterName:'Synthetic Encounter',officialGraph,structuralKnowledge,episode,matchedNull,evidenceGroups,stability,holdoutReservation});
  assert.equal(view.scope.encounterId,8765);
  assert.equal(view.anchor.name,'Synthetic Anchor');
  assert.equal(view.status.code,'matched-null-no-supported-pattern');
  assert.match(view.status.why,/No candidate relation survived/i);
  assert.equal(view.candidates.length,1);
  assert.equal(view.candidates[0].state.code,'rejected-noise');
  assert.equal(view.candidates[0].official.status,'same-stage-different-official-branch');
  assert.equal(view.candidates[0].structural.direct,true);
  assert.equal(view.contracts.automaticPromotion,false);
  assert.equal(view.evidenceLadder.find(row=>row.code==='matched-null').status,'no-supported-pattern');
});
