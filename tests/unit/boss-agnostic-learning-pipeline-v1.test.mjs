import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildSemanticSurgicalProbePlanV1 } from '../../server/corpus/semantic-surgical-probe-planner-v1.mjs';

const COMPLETE={enemyCasts:true,friendDamage:true,interrupts:true,debuffs:true,buffs:true,enemyBuffs:true,enemyDebuffs:true,deaths:true};

test('semantic surgical planning is portable to arbitrary encounters and ability ids',()=>{
  const encounterId=9876,targetId=700001,neighborId=700002;
  const model={
    learning:{
      localMechanicSynthesis:{
        signals:[
          {
            id:targetId,
            name:'Synthetic Encounter Signal',
            importance:.91,
            state:'external-evidence-needed',
            missingEvidence:['deterministic-structural-pattern'],
            nextQuestion:'Resolve only the missing semantic structure.',
            origin:{classification:'encounter'},
            context:{accepted:[],rejected:[],variantFamilies:[]},
          },
          {
            id:700099,
            name:'Already Solved Synthetic Signal',
            state:'local-evidence-sufficient',
            origin:{classification:'encounter'},
          },
        ],
      },
    },
    discovery:{
      variantFamilies:[{memberIds:[targetId,neighborId],encounterSupported:true}],
      relationCandidates:[],
      filteredRelationCandidates:[],
    },
    rejected:[],
  };
  const aggregate={sampling:{selectedWideCodes:['GENERIC_REPORT']}};
  const profiles=[{
    code:'GENERIC_REPORT',
    guild:{id:424242},
    originEvidence:{[String(targetId)]:{events:14,encounterOrUnknownSourceEvents:14}},
    completeness:COMPLETE,
    fights:[
      {id:1,kill:false,fightPercentage:12},
      {id:2,kill:false,fightPercentage:48},
      {id:3,kill:false,fightPercentage:84},
      {id:4,kill:true,fightPercentage:0},
    ],
  }];

  const plan=buildSemanticSurgicalProbePlanV1({model,aggregate,profiles,encounterId,difficulty:5,partition:9});
  assert.equal(plan.targetSignals,1);
  assert.equal(plan.signals[0].id,targetId);
  assert.equal(plan.signals[0].selectedSources,1);
  assert.equal(plan.signals[0].anchorRequests[0].queryShape.encounterID,encounterId);
  assert.equal(plan.signals[0].anchorRequests[0].queryShape.abilityID,targetId);
  assert.match(plan.signals[0].anchorRequests[0].queryShape.filterExpression,new RegExp(String(targetId)));
  assert.deepEqual(plan.signals[0].contextAbilityIds,[neighborId]);
  assert.equal(plan.signals[0].verificationContract.minimumIndependentSources,3);
  assert.equal(plan.wclCallsExecuted,0);
  assert.equal(plan.safety.executorImplemented,false);
});

test('semantic probe API remains an explicit zero-WCL planning action',async()=>{
  const route=await readFile(new URL('../../routes/api/wcl/corpus.js',import.meta.url),'utf8');
  assert.match(route,/actionFromQuery==='semantic-probe-plan'/);
  assert.match(route,/action === 'semantic-probe-plan'/);
  assert.match(route,/buildSemanticSurgicalProbePlanV1/);
  assert.match(route,/semanticProbePlanVersion:SEMANTIC_SURGICAL_PROBE_PLAN_VERSION/);
  assert.match(route,/bossAgnosticLearningContract:'iris-boss-agnostic-learning-pipeline-v1'/);
  assert.doesNotMatch(route,/semantic-probe-execute/);
});

test('generic Iris learning modules contain no current validation-boss constants',async()=>{
  const paths=[
    '../../server/corpus/model-policy-v379.mjs',
    '../../server/corpus/model-policy-v380.mjs',
    '../../server/corpus/local-mechanic-synthesis-v1.mjs',
    '../../server/corpus/surgical-probe-planner-v1.mjs',
    '../../server/corpus/semantic-surgical-probe-planner-v1.mjs',
  ];
  const banned=[
    /Belo['’]?ren/i,
    /Voidlight Rupture/i,
    /Light Blast/i,
    /Void Flames/i,
    /Light Quill/i,
    /Void Quill/i,
    /\b3182\b/,
    /\b1243866\b/,
    /\b1264696\b/,
    /\b1242815\b/,
    /\b1242093\b/,
    /\b1241313\b/,
    /\b1242094\b/,
  ];
  for(const path of paths){
    const source=await readFile(new URL(path,import.meta.url),'utf8');
    for(const pattern of banned)assert.doesNotMatch(source,pattern,`${path} must remain boss-agnostic`);
  }
});