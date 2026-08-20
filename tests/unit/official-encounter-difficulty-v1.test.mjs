import test from 'node:test';
import assert from 'node:assert/strict';
import { compileOfficialEncounterDifficultyViewV1 } from '../../server/knowledge/official-encounter-difficulty-v1.mjs';

const section=(sectionId,title,structuralRole)=>({sectionId,title,structuralRole});
const membership=(sectionId,title,path)=>({sectionId,title,structuralRole:'mechanic',path:path.map(x=>x.title),sectionPath:path});
const stage=section(880001,'Synthetic Stage','stage'),shared=section(880010,'Shared Mechanic','mechanic'),heroic=section(880020,'Heroic Mechanic','mechanic'),mythic=section(880030,'Mythic Mechanic','mechanic'),inherited=section(880040,'Heroic Parent','mechanic-group'),inheritedChild=section(880041,'Inherited Child','mechanic');
const graph={fingerprint:'a'.repeat(40),encounter:{journalEncounterId:8800,wclEncounterId:9900,name:'Synthetic Boss'},source:{namespace:'static-99.1.0_12345-eu'},abilities:[{abilityId:990001,name:'Shared Spell',memberships:[membership(shared.sectionId,shared.title,[stage,shared])]},{abilityId:990002,name:'Heroic Spell',memberships:[membership(heroic.sectionId,heroic.title,[stage,heroic])]},{abilityId:990003,name:'Mythic Spell',memberships:[membership(mythic.sectionId,mythic.title,[stage,mythic])]},{abilityId:990004,name:'Inherited Heroic Spell',memberships:[membership(inheritedChild.sectionId,inheritedChild.title,[stage,inherited,inheritedChild])]}],sections:[{sectionId:stage.sectionId,title:stage.title,depth:0},{sectionId:shared.sectionId,title:shared.title,depth:1},{sectionId:heroic.sectionId,title:heroic.title,depth:1},{sectionId:mythic.sectionId,title:mythic.title,depth:1},{sectionId:inherited.sectionId,title:inherited.title,depth:1},{sectionId:inheritedChild.sectionId,title:inheritedChild.title,depth:2}]};
// Deliberately use DB2 IDs that are different from WCL 3/4/5.
const snapshot={fingerprint:'b'.repeat(40),build:'99.1.0.12345',difficultyRows:[{difficultyId:14,name:'Normal',minPlayers:10,maxPlayers:30},{difficultyId:15,name:'Heroic',minPlayers:10,maxPlayers:30},{difficultyId:16,name:'Mythic',minPlayers:20,maxPlayers:20}],encounterRows:[],sectionRows:[{journalSectionId:heroic.sectionId,difficultyId:15},{journalSectionId:mythic.sectionId,difficultyId:16},{journalSectionId:inherited.sectionId,difficultyId:15}]};

test('official view maps WCL raid difficulty identity before applying section restrictions',()=>{
  const normal=compileOfficialEncounterDifficultyViewV1({officialGraph:graph,difficulty:{id:3,name:'Normal',sizes:[10,20,30]},journalDifficultySnapshot:snapshot}),hc=compileOfficialEncounterDifficultyViewV1({officialGraph:graph,difficulty:{id:4,name:'Heroic',sizes:[10,20,30]},journalDifficultySnapshot:snapshot}),mythicView=compileOfficialEncounterDifficultyViewV1({officialGraph:graph,difficulty:{id:5,name:'Mythic',sizes:[20]},journalDifficultySnapshot:snapshot});
  assert.equal(normal.difficulty.id,3);assert.equal(normal.difficulty.db2DifficultyId,14);
  assert.equal(hc.difficulty.id,4);assert.equal(hc.difficulty.db2DifficultyId,15);
  assert.equal(mythicView.difficulty.id,5);assert.equal(mythicView.difficulty.db2DifficultyId,16);
  assert.deepEqual(normal.abilities.map(x=>x.abilityId),[990001]);
  assert.deepEqual(hc.abilities.map(x=>x.abilityId),[990001,990002,990004]);
  assert.deepEqual(mythicView.abilities.map(x=>x.abilityId),[990001,990003]);
  assert.equal(hc.abilities.find(x=>x.abilityId===990004).difficultyApplicability.status,'explicitly-applicable');
  assert.equal(hc.applicability.difficultyVerified,true);
  assert.ok(hc.applicability.excludedMemberships>0);
  assert.notEqual(hc.fingerprint,mythicView.fingerprint);
  assert.equal(hc.evidenceContract.wclAndDb2DifficultyIdsDistinct,true);
  assert.equal(hc.evidenceContract.journalDifficultyRowsAreApplicabilityRestrictions,true);
  assert.equal(hc.evidenceContract.crossDifficultyEmpiricalReuse,false);
});

test('duplicate Difficulty names are resolved by raid-size metadata without assuming WCL and DB2 IDs match',()=>{
  const duplicate={...snapshot,difficultyRows:[{difficultyId:8,name:'Mythic',minPlayers:5,maxPlayers:5},{difficultyId:16,name:'Mythic',minPlayers:20,maxPlayers:20},{difficultyId:23,name:'Mythic Keystone',minPlayers:5,maxPlayers:5}]};
  const view=compileOfficialEncounterDifficultyViewV1({officialGraph:graph,difficulty:{id:5,name:'Mythic',sizes:[20]},journalDifficultySnapshot:duplicate});
  assert.equal(view.difficulty.db2DifficultyId,16);
  assert.equal(view.difficulty.mappingStatus,'mapped-by-boss-section-restriction');
  assert.deepEqual(view.abilities.map(x=>x.abilityId),[990001,990003]);
});

test('JournalEncounterXDifficulty is an applicability restriction, not the WCL-to-DB2 mapping catalogue',()=>{
  const restricted={...snapshot,encounterRows:[{journalEncounterId:8800,difficultyId:16}]};
  const heroicView=compileOfficialEncounterDifficultyViewV1({officialGraph:graph,difficulty:{id:4,name:'Heroic',sizes:[20]},journalDifficultySnapshot:restricted});
  const mythicView=compileOfficialEncounterDifficultyViewV1({officialGraph:graph,difficulty:{id:5,name:'Mythic',sizes:[20]},journalDifficultySnapshot:restricted});
  assert.equal(heroicView.difficulty.db2DifficultyId,15);
  assert.equal(heroicView.applicability.encounterStatus,'explicitly-not-applicable');
  assert.equal(heroicView.abilities.length,0);
  assert.equal(mythicView.applicability.encounterStatus,'explicitly-applicable');
  assert.ok(mythicView.abilities.length>0);
});

test('missing or unmappable DB2 difficulty metadata stays unresolved instead of pretending applicability',()=>{
  const missing=compileOfficialEncounterDifficultyViewV1({officialGraph:graph,difficulty:{id:5,name:'Mythic'},journalDifficultySnapshot:null});
  assert.equal(missing.applicability.encounterStatus,'difficulty-applicability-unresolved');
  assert.equal(missing.applicability.difficultyVerified,false);
  assert.equal(missing.abilities.length,4);
  assert.ok(missing.abilities.every(x=>x.difficultyApplicability.status==='difficulty-applicability-unresolved'));
  const unmappable=compileOfficialEncounterDifficultyViewV1({officialGraph:graph,difficulty:{id:5,name:'Experimental'},journalDifficultySnapshot:snapshot});
  assert.equal(unmappable.difficulty.db2DifficultyId,null);
  assert.equal(unmappable.applicability.encounterStatus,'difficulty-mapping-unresolved');
  assert.equal(unmappable.applicability.difficultyVerified,false);
  assert.ok(unmappable.abilities.every(x=>x.difficultyApplicability.status==='difficulty-applicability-unresolved'));
});
