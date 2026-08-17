import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  summarizeAbilityStructureV1,
  buildLocalMechanicSynthesisV1,
} from '../../server/corpus/local-mechanic-synthesis-v1.mjs';
import { applyLocalMechanicSynthesisOverlayV380 } from '../../server/corpus/model-policy-v380.mjs';

function ability(id,name,{castKill=0,castWipe=0,damageKill=0,damageWipe=0,beginsKill=0,beginsWipe=0,castsKill=0,castsWipe=0,intsKill=0,intsWipe=0,damageOccKill=0,damageOccWipe=0,damageTargetsKill=0,damageTargetsWipe=0,deathLinksWipe=0}={}){
  return{
    id,name,
    wide:{
      kill:{Casts:{reportsWith:castKill},Damage:{reportsWith:damageKill},Buffs:{reportsWith:0},Debuffs:{reportsWith:0}},
      wipe:{Casts:{reportsWith:castWipe},Damage:{reportsWith:damageWipe},Buffs:{reportsWith:0},Debuffs:{reportsWith:0}},
    },
    deep:{
      kill:{begins:beginsKill,casts:castsKill,interrupts:intsKill,damageOccurrences:damageOccKill,damageTargets:damageTargetsKill,deathLinks:0,phaseBoundaryCasts:0,enemyBuffApplications:0,enemyDebuffApplications:0},
      wipe:{begins:beginsWipe,casts:castsWipe,interrupts:intsWipe,damageOccurrences:damageOccWipe,damageTargets:damageTargetsWipe,deathLinks:deathLinksWipe,phaseBoundaryCasts:0,enemyBuffApplications:0,enemyDebuffApplications:0},
    },
    stateAlignment:{},
  };
}

function split({wideReports=20,killReports=10,wipeReports=10,abilities={}}={}){
  return{wideReports,deepReports:10,killReports,wipeReports,abilities,relations:{castToEnemyAura:{},castToDamage:{}}};
}

function signal(id,name){return{id,name,importance:.6,origin:{classification:'encounter'}};}

function modelWithQueue(queue){
  return{
    pack:{mechanics:[]},rejected:[],discovery:{relationCandidates:[],filteredRelationCandidates:[],variantFamilies:[]},
    learning:{
      scorePct:79,grade:'STRONG',bottleneck:'validationConfidencePct',lowestDimension:'validationConfidencePct',actionBottleneck:'validationConfidencePct',
      signalTriage:{criticalLocalQueue:queue,criticalUnresolved:queue},
      recommendations:{learningNext:{mode:'local-mechanic-synthesis'},publicationNext:{mode:'reports-first'}},
      learningRecommendation:{mode:'local-mechanic-synthesis'},publicationRecommendation:{mode:'reports-first'},
    },
    validation:{publicationMode:'manual-review-hold'},
  };
}

test('ability structure preserves kill/wipe and Deep cast outcomes',()=>{
  const a=ability(1,'Interrupt Me',{castKill:8,castWipe:9,beginsKill:20,castsKill:3,intsKill:15});
  const summary=summarizeAbilityStructureV1(split({abilities:{'1':a}}),1);
  assert.equal(summary.presence.casts.kill,.8);
  assert.equal(summary.deep.interruptRate.kill,.75);
  assert.equal(summary.deep.completionRate.kill,.15);
});

test('local synthesis marks reproduced interrupt structure as locally sufficient without promoting it',()=>{
  const trainAbility=ability(1,'Interrupt Me',{castKill:8,castWipe:9,beginsKill:24,castsKill:4,intsKill:17});
  const validationAbility=ability(1,'Interrupt Me',{castKill:4,castWipe:4,beginsKill:10,castsKill:3,intsKill:5});
  const aggregate={splits:{train:split({abilities:{'1':trainAbility}}),validation:split({wideReports:10,killReports:5,wipeReports:5,abilities:{'1':validationAbility}})}};
  const model=modelWithQueue([signal(1,'Interrupt Me')]);
  const synthesis=buildLocalMechanicSynthesisV1({model,aggregate});
  assert.equal(synthesis.wclCallsExecuted,0);
  assert.equal(synthesis.modifiesAcceptedMechanics,false);
  assert.equal(synthesis.modifiesScores,false);
  assert.equal(synthesis.signals[0].primaryHypothesis.type,'interrupt-candidate');
  assert.equal(synthesis.signals[0].primaryHypothesis.validation.status,'supports');
  assert.equal(synthesis.signals[0].state,'local-evidence-sufficient');
});

test('wipe-enriched damage stays partial when validation cannot reproduce it yet',()=>{
  const trainAbility=ability(2,'Damage Signal',{damageKill:1,damageWipe:8,damageOccWipe:30,deathLinksWipe:3});
  const aggregate={splits:{train:split({abilities:{'2':trainAbility}}),validation:split({wideReports:2,killReports:1,wipeReports:1,abilities:{}})}};
  const model=modelWithQueue([signal(2,'Damage Signal')]);
  const row=buildLocalMechanicSynthesisV1({model,aggregate}).signals[0];
  assert.equal(row.primaryHypothesis.type,'damage-signal');
  assert.equal(row.primaryHypothesis.validation.status,'unknown');
  assert.equal(row.state,'local-evidence-partial');
  assert.ok(row.missingEvidence.includes('decisive-validation-reproduction'));
});

test('no deterministic local structure escalates only the explicit signal to external semantic evidence',()=>{
  const trainAbility=ability(3,'Opaque Signal',{});
  const aggregate={splits:{train:split({abilities:{'3':trainAbility}}),validation:split({abilities:{}})}};
  const model=modelWithQueue([signal(3,'Opaque Signal')]);
  const synthesis=buildLocalMechanicSynthesisV1({model,aggregate});
  assert.equal(synthesis.signals[0].state,'external-evidence-needed');
  assert.deepEqual(synthesis.externalEvidenceTargetAbilityIds,[3]);
  assert.ok(synthesis.signals[0].missingEvidence.includes('deterministic-structural-pattern'));
});

test('v3.7.10 separates numeric bottleneck from hard-gate learning action',()=>{
  const trainAbility=ability(1,'Interrupt Me',{castKill:8,castWipe:9,beginsKill:24,castsKill:4,intsKill:17});
  const validationAbility=ability(1,'Interrupt Me',{castKill:4,castWipe:4,beginsKill:10,castsKill:3,intsKill:5});
  const aggregate={splits:{train:split({abilities:{'1':trainAbility}}),validation:split({wideReports:10,killReports:5,wipeReports:5,abilities:{'1':validationAbility}})}};
  const out=applyLocalMechanicSynthesisOverlayV380(modelWithQueue([signal(1,'Interrupt Me')]),aggregate);
  assert.equal(out.engineVersion,'3.7.10');
  assert.equal(out.learning.numericBottleneck,'validationConfidencePct');
  assert.equal(out.learning.actionBottleneck,'signalDiscoveryPct');
  assert.equal(out.learning.blockingGate,'critical-unresolved-signals');
  assert.equal(out.learning.recommendations.learningNext.mode,'local-mechanic-synthesis-review');
  assert.equal(out.learning.recommendations.publicationNext.mode,'reports-first');
});

test('corpus route exposes local synthesis as an explicit zero-WCL read path',async()=>{
  const route=await readFile(new URL('../../routes/api/wcl/corpus.js',import.meta.url),'utf8');
  assert.match(route,/applyBossSamplingPolicyV380/);
  assert.match(route,/actionFromQuery==='synthesis'/);
  assert.match(route,/wclCallsExecuted:0,synthesis/);
  assert.match(route,/ENGINE_VERSION = '3\.7\.10'/);
});
