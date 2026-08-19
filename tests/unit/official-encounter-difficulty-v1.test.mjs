import test from 'node:test';
import assert from 'node:assert/strict';
import { compileOfficialEncounterDifficultyViewV1 } from '../../server/knowledge/official-encounter-difficulty-v1.mjs';

const section=(sectionId,title,structuralRole)=>({sectionId,title,structuralRole});
const membership=(sectionId,title,path)=>({sectionId,title,structuralRole:'mechanic',path:path.map(x=>x.title),sectionPath:path});
const stage=section(880001,'Synthetic Stage','stage');
const shared=section(880010,'Shared Mechanic','mechanic');
const heroic=section(880020,'Heroic Mechanic','mechanic');
const mythic=section(880030,'Mythic Mechanic','mechanic');
const inherited=section(880040,'Heroic Parent','mechanic-group');
const inheritedChild=section(880041,'Inherited Child','mechanic');
const graph={
  fingerprint:'a'.repeat(40),encounter:{journalEncounterId:8800,wclEncounterId:9900,name:'Synthetic Boss'},source:{namespace:'static-99.1.0_12345-eu'},
  abilities:[
    {abilityId:990001,name:'Shared Spell',memberships:[membership(shared.sectionId,shared.title,[stage,shared])]},
    {abilityId:990002,name:'Heroic Spell',memberships:[membership(heroic.sectionId,heroic.title,[stage,heroic])]},
    {abilityId:990003,name:'Mythic Spell',memberships:[membership(mythic.sectionId,mythic.title,[stage,mythic])]},
    {abilityId:990004,name:'Inherited Heroic Spell',memberships:[membership(inheritedChild.sectionId,inheritedChild.title,[stage,inherited,inheritedChild])]},
  ],
  sections:[
    {sectionId:stage.sectionId,title:stage.title,depth:0},{sectionId:shared.sectionId,title:shared.title,depth:1},{sectionId:heroic.sectionId,title:heroic.title,depth:1},{sectionId:mythic.sectionId,title:mythic.title,depth:1},{sectionId:inherited.sectionId,title:inherited.title,depth:1},{sectionId:inheritedChild.sectionId,title:inheritedChild.title,depth:2},
  ],
};
const snapshot={fingerprint:'b'.repeat(40),build:'99.1.0.12345',sectionRows:[{journalSectionId:heroic.sectionId,difficultyId:4},{journalSectionId:mythic.sectionId,difficultyId:5},{journalSectionId:inherited.sectionId,difficultyId:4}],encounterRows:[]};

test('official encounter difficulty view never borrows explicitly restricted abilities from another difficulty',()=>{
  const normal=compileOfficialEncounterDifficultyViewV1({officialGraph:graph,difficulty:{id:3,name:'Normal'},journalDifficultySnapshot:snapshot});
  const hc=compileOfficialEncounterDifficultyViewV1({officialGraph:graph,difficulty:{id:4,name:'Heroic'},journalDifficultySnapshot:snapshot});
  const mythicView=compileOfficialEncounterDifficultyViewV1({officialGraph:graph,difficulty:{id:5,name:'Mythic'},journalDifficultySnapshot:snapshot});
  assert.deepEqual(normal.abilities.map(x=>x.abilityId),[990001]);
  assert.deepEqual(hc.abilities.map(x=>x.abilityId),[990001,990002,990004]);
  assert.deepEqual(mythicView.abilities.map(x=>x.abilityId),[990001,990003]);
  assert.equal(hc.abilities.find(x=>x.abilityId===990004).difficultyApplicability.status,'explicitly-applicable');
  assert.notEqual(hc.fingerprint,mythicView.fingerprint);
  assert.equal(hc.evidenceContract.crossDifficultyEmpiricalReuse,false);
});

test('missing DB2 difficulty metadata stays unresolved instead of pretending published Journal content is verified for that difficulty',()=>{
  const view=compileOfficialEncounterDifficultyViewV1({officialGraph:graph,difficulty:{id:5,name:'Mythic'},journalDifficultySnapshot:null});
  assert.equal(view.applicability.encounterStatus,'difficulty-applicability-unresolved');
  assert.equal(view.applicability.sectionDifficultyMetadataAvailable,false);
  assert.equal(view.abilities.length,4);
  assert.ok(view.abilities.every(x=>x.difficultyApplicability.status==='difficulty-applicability-unresolved'));
  assert.equal(view.evidenceContract.difficultyApplicabilityMayBeUnresolved,true);
});
