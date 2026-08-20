import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDifficultyAwareAbilityKnowledgePreviewV1,resolveDifficultyAwareAbilityKnowledgeV1 } from '../../server/knowledge/ability-knowledge-difficulty-v1.mjs';

const baseOfficial={fingerprint:'a'.repeat(40),source:{namespace:'static-99.1.0_12345-eu'},encounter:{journalEncounterId:8001,wclEncounterId:7001,name:'Synthetic Boss'},abilities:[{abilityId:910001,name:'Shared',memberships:[]},{abilityId:910002,name:'Heroic Only',memberships:[]},{abilityId:910003,name:'Mythic Only',memberships:[]}]};
const heroicOfficial={fingerprint:'b'.repeat(40),encounter:baseOfficial.encounter,difficulty:{id:4,name:'Heroic',db2DifficultyId:15},applicability:{sectionDifficultyMetadataAvailable:true},abilities:[{abilityId:910001,name:'Shared',memberships:[]},{abilityId:910002,name:'Heroic Only',memberships:[]}]};
const structural={fingerprint:'c'.repeat(40),scope:{wclEncounterId:7001},provider:{build:'99.1.0.12345'},seedAbilityIds:[910001,910002,910003],relations:[{sourceAbilityId:910002,targetAbilityId:920002,relationKind:'trigger-spell',providerRowId:1},{sourceAbilityId:910003,targetAbilityId:920003,relationKind:'trigger-spell',providerRowId:2}],coverage:{resolvedQueries:6,queryCount:6}};

test('encounter Ability Knowledge preview requires difficulty and fingerprints it',()=>{
  assert.throws(()=>buildDifficultyAwareAbilityKnowledgePreviewV1({encounterId:7001,abilityIds:[910001]}),/difficulty is required/i);
  const heroic=buildDifficultyAwareAbilityKnowledgePreviewV1({encounterId:7001,difficulty:4,abilityIds:[910001],providers:{lorrgs:false,parseWowhead:false,wcl:false}});
  const mythic=buildDifficultyAwareAbilityKnowledgePreviewV1({encounterId:7001,difficulty:5,abilityIds:[910001],providers:{lorrgs:false,parseWowhead:false,wcl:false}});
  assert.notEqual(heroic.fingerprint,mythic.fingerprint);
  assert.equal(heroic.request.difficulty,4);
  assert.equal(heroic.safety.crossDifficultyComparisonForbidden,true);
});

test('encounter Ability Knowledge resolves only the persisted official/structural view for the requested difficulty',async()=>{
  const result=await resolveDifficultyAwareAbilityKnowledgeV1({encounterId:7001,difficulty:4,abilityIds:[910002,910003],providers:{lorrgs:false,parseWowhead:false,wcl:false}},{
    loadBaseOfficial:async()=>baseOfficial,
    loadDifficultyOfficial:async(_journal,difficulty)=>difficulty===4?heroicOfficial:null,
    loadStructural:async()=>structural,
  });
  assert.equal(result.difficulty.id,4);
  const heroic=result.abilities.find(row=>row.abilityId===910002),mythic=result.abilities.find(row=>row.abilityId===910003);
  assert.equal(heroic.providerSignals.blizzardJournal.status,'official-encounter-ability');
  assert.equal(mythic.providerSignals.blizzardJournal.status,'not-listed-in-journal');
  assert.equal(result.evidenceContract.crossDifficultyEmpiricalReuse,false);
});
