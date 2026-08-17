import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildSemanticSurgicalProbePlanV2 } from '../../server/corpus/semantic-surgical-probe-planner-v2.mjs';

const COMPLETE={enemyCasts:true,friendDamage:true,interrupts:true,debuffs:true,buffs:true,enemyBuffs:true,enemyDebuffs:true,deaths:true};

function targetModel(targetId,neighborId){
  return{
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
}

const fights=(offset=0)=>[
  {id:offset+1,kill:false,fightPercentage:12},
  {id:offset+2,kill:false,fightPercentage:48},
  {id:offset+3,kill:false,fightPercentage:84},
  {id:offset+4,kill:true,fightPercentage:0},
];

test('semantic surgical planning is portable and prefers canonical Deep target evidence before Wide fallback',()=>{
  const encounterId=9876,targetId=700001,neighborId=700002;
  const model=targetModel(targetId,neighborId);
  const aggregate={sampling:{
    selectedWideCodes:['DEEP_REPORT','WIDE_FALLBACK'],
    selectedDeepCodes:['DEEP_REPORT'],
  }};
  const wideProfiles=[
    {
      code:'DEEP_REPORT',guild:{id:424242},fights:fights(0),
      tables:{killCasts:{[String(targetId)]:{count:2}}},
    },
    {
      code:'WIDE_FALLBACK',guild:{id:434343},fights:fights(10),
      tables:{wipeDamage:{[String(targetId)]:{count:8}}},
    },
  ];
  const deepProfiles=[
    {
      code:'DEEP_REPORT',guild:{id:424242},
      originEvidence:{[String(targetId)]:{events:14,encounterOrUnknownSourceEvents:14}},
      completeness:COMPLETE,fights:fights(20),
    },
    {
      code:'UNSELECTED_DEEP',guild:{id:999999},
      originEvidence:{[String(targetId)]:{events:999,encounterOrUnknownSourceEvents:999}},
      completeness:COMPLETE,fights:fights(30),
    },
  ];

  const plan=buildSemanticSurgicalProbePlanV2({model,aggregate,wideProfiles,deepProfiles,encounterId,difficulty:5,partition:9,maxSourcesPerSignal:2});
  assert.equal(plan.version,'semantic-surgical-probe-plan-v2');
  assert.equal(plan.targetSignals,1);
  assert.equal(plan.signals[0].id,targetId);
  assert.equal(plan.signals[0].selectedSources,2);
  assert.equal(plan.canonicalDeepReportsInPool,1);
  assert.equal(plan.signals[0].candidateEvidence.canonicalDeepTargetEventReports,1);
  assert.equal(plan.signals[0].anchorRequests[0].reportCode,'DEEP_REPORT');
  assert.equal(plan.signals[0].anchorRequests[0].selectionEvidence.selectionTier,'canonical-deep-target-events');
  assert.equal(plan.signals[0].anchorRequests[0].selectionEvidence.persistedTargetEvents,14);
  assert.equal(plan.signals[0].anchorRequests[0].selectionEvidence.completeCanonicalDeep,true);
  assert.equal(plan.signals[0].anchorRequests[0].selectionEvidence.canonicalDeepSelected,true);
  assert.equal(plan.signals[0].anchorRequests[1].reportCode,'WIDE_FALLBACK');
  assert.equal(plan.signals[0].anchorRequests[1].selectionEvidence.selectionTier,'canonical-wide-report-presence');
  assert.ok(!plan.signals[0].anchorRequests.some(row=>row.reportCode==='UNSELECTED_DEEP'));
  assert.equal(plan.signals[0].anchorRequests[0].queryShape.encounterID,encounterId);
  assert.equal(plan.signals[0].anchorRequests[0].queryShape.abilityID,targetId);
  assert.match(plan.signals[0].anchorRequests[0].queryShape.filterExpression,new RegExp(String(targetId)));
  assert.deepEqual(plan.signals[0].contextAbilityIds,[neighborId]);
  assert.equal(plan.signals[0].verificationContract.minimumIndependentSources,3);
  assert.equal(plan.wclCallsExecuted,0);
  assert.equal(plan.safety.canonicalDeepLoaded,true);
  assert.equal(plan.safety.executorImplemented,false);
});

test('semantic probe v2 does not pretend Deep is canonical when selectedDeepCodes is unavailable',()=>{
  const encounterId=4321,targetId=810001,neighborId=810002;
  const model=targetModel(targetId,neighborId);
  const aggregate={sampling:{selectedWideCodes:['ONLY_WIDE'],selectedDeepCodes:[]}};
  const wideProfiles=[{code:'ONLY_WIDE',owner:{id:55},fights:fights(50),tables:{wipeCasts:{[String(targetId)]:{count:3}}}}];
  const deepProfiles=[{
    code:'ONLY_WIDE',owner:{id:55},fights:fights(60),completeness:COMPLETE,
    originEvidence:{[String(targetId)]:{events:500,encounterOrUnknownSourceEvents:500}},
  }];
  const plan=buildSemanticSurgicalProbePlanV2({model,aggregate,wideProfiles,deepProfiles,encounterId,partition:2,maxSourcesPerSignal:1});
  assert.equal(plan.canonicalDeepManifestAvailable,false);
  assert.equal(plan.canonicalDeepReportsInPool,0);
  assert.equal(plan.signals[0].anchorRequests[0].reportCode,'ONLY_WIDE');
  assert.equal(plan.signals[0].anchorRequests[0].selectionEvidence.selectionTier,'canonical-wide-report-presence');
  assert.equal(plan.signals[0].anchorRequests[0].selectionEvidence.persistedTargetEvents,0);
  assert.equal(plan.signals[0].anchorRequests[0].selectionEvidence.completeCanonicalDeep,false);
  assert.equal(plan.signals[0].anchorRequests[0].selectionEvidence.canonicalDeepSelected,false);
});

test('semantic probe API loads Wide plus Deep and remains an explicit zero-WCL planning action',async()=>{
  const route=await readFile(new URL('../../routes/api/wcl/corpus.js',import.meta.url),'utf8');
  assert.match(route,/actionFromQuery==='semantic-probe-plan'/);
  assert.match(route,/action === 'semantic-probe-plan'/);
  assert.match(route,/buildSemanticSurgicalProbePlanV2/);
  assert.match(route,/SEMANTIC_SURGICAL_PROBE_PLAN_V2_VERSION/);
  assert.match(route,/persistedProfilesAt\('deep',args\)/);
  assert.match(route,/Promise\.all\(\[persistedProfiles\(args\),persistedDeepProfiles\(args\)\]\)/);
  assert.match(route,/wideProfiles,\s*deepProfiles/);
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
    '../../server/corpus/semantic-surgical-probe-planner-v2.mjs',
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