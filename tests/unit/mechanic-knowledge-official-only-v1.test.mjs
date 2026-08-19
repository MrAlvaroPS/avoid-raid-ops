import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMechanicKnowledgeViewV1 } from '../../server/services/mechanic-knowledge-view-service.mjs';

const official={fingerprint:'a'.repeat(40),source:{namespace:'static-test'},encounter:{journalEncounterId:501,name:'Synthetic Boss'},graph:{sectionCount:3,spellCount:2,officialMembershipEdges:2},abilities:[{abilityId:9001,name:'Arc Lash',memberships:[{sectionId:11,title:'Arc Lash',structuralRole:'submechanic',path:['Stage One','Arc Storm','Arc Lash'],sectionPath:[{sectionId:1,title:'Stage One',structuralRole:'stage'},{sectionId:10,title:'Arc Storm',structuralRole:'mechanic'},{sectionId:11,title:'Arc Lash',structuralRole:'submechanic'}]}]},{abilityId:9002,name:'Arc Burst',memberships:[{sectionId:12,title:'Arc Burst',structuralRole:'submechanic',path:['Stage One','Arc Storm','Arc Burst'],sectionPath:[{sectionId:1,title:'Stage One',structuralRole:'stage'},{sectionId:10,title:'Arc Storm',structuralRole:'mechanic'},{sectionId:12,title:'Arc Burst',structuralRole:'submechanic'}]}]}]};

test('official Mechanics model renders with no report, corpus or combat event evidence',async()=>{
  const result=await loadMechanicKnowledgeViewV1({encounterId:7001,difficulty:5,partition:0},{loadModel:async()=>null,loadOfficial:async()=>official,loadStructural:async()=>null,storageGet:async()=>null,storageList:async()=>[]});
  assert.equal(result.encounter.name,'Synthetic Boss');
  assert.equal(result.bossKnowledge.status,'official-ready');
  assert.equal(result.bossKnowledge.reportRequired,false);
  assert.equal(result.executionKnowledge.status,'no-combat-corpus-yet');
  assert.equal(result.summary.officialMechanics,1);
  assert.equal(result.summary.officialAbilities,2);
  assert.equal(result.mechanics.length,0);
  assert.equal(result.evidenceContract.officialKnowledgeIndependentOfReports,true);
  assert.equal(result.evidenceContract.empiricalOverlayOptional,true);
});
