import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpellStructuralDifficultyViewV1 } from '../../server/knowledge/spell-structural-difficulty-v1.mjs';

const structural={
  fingerprint:'a'.repeat(40),scope:{wclEncounterId:7700},provider:{build:'99.1.0.12345'},seedAbilityIds:[910001,910002,910003],coverage:{resolvedQueries:6,queryCount:6},
  relations:[
    {sourceAbilityId:910001,targetAbilityId:920001,relationKind:'trigger-spell',providerRowId:1},
    {sourceAbilityId:920001,targetAbilityId:920002,relationKind:'trigger-spell',providerRowId:2},
    {sourceAbilityId:910002,targetAbilityId:930001,relationKind:'trigger-spell',providerRowId:3},
    {sourceAbilityId:910003,targetAbilityId:940001,relationKind:'trigger-spell',providerRowId:4},
  ],
};
const baseOfficial={abilities:[{abilityId:910001,name:'Shared'},{abilityId:910002,name:'Heroic Only'},{abilityId:910003,name:'Mythic Only'}]};

test('difficulty structural view keeps connected helpers but excludes official abilities from another difficulty',()=>{
  const heroicOfficial={fingerprint:'b'.repeat(40),difficulty:{id:4,name:'Heroic',db2DifficultyId:15},applicability:{sectionDifficultyMetadataAvailable:true},abilities:[{abilityId:910001},{abilityId:910002}]};
  const view=buildSpellStructuralDifficultyViewV1({structuralKnowledge:structural,baseOfficialGraph:baseOfficial,difficultyOfficialView:heroicOfficial});
  assert.equal(view.scope.difficulty,4);
  assert.deepEqual(view.relations.map(row=>row.providerRowId),[1,3,2].sort((a,b)=>a-b).sort(()=>0));
  const ids=new Set(view.relations.flatMap(row=>[row.sourceAbilityId,row.targetAbilityId]));
  assert.ok(ids.has(920001));
  assert.ok(ids.has(920002));
  assert.ok(ids.has(930001));
  assert.ok(!ids.has(910003));
  assert.ok(!ids.has(940001));
  assert.equal(view.summary.excludedOtherDifficultyOfficialAbilities,1);
  assert.equal(view.evidenceContract.crossDifficultyEmpiricalReuse,false);
});

test('unresolved difficulty applicability remains an explicitly unverified interpretation',()=>{
  const unresolved={fingerprint:'c'.repeat(40),difficulty:{id:5,name:'Mythic',db2DifficultyId:null},applicability:{sectionDifficultyMetadataAvailable:false},abilities:[{abilityId:910001},{abilityId:910002},{abilityId:910003}]};
  const view=buildSpellStructuralDifficultyViewV1({structuralKnowledge:structural,baseOfficialGraph:baseOfficial,difficultyOfficialView:unresolved});
  assert.equal(view.difficultyApplicabilityVerified,false);
  assert.equal(view.relations.length,4);
  assert.equal(view.evidenceContract.observedCombat,false);
});
