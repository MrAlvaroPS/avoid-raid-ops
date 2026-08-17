import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSurgicalProbePlanV1, SURGICAL_PROBE_PLAN_VERSION } from '../../server/corpus/surgical-probe-planner-v1.mjs';

function profile(code,guildId,abilityIds,fights=[1,2,3]){
  const table={};
  for(const id of abilityIds)table[String(id)]={count:1,total:1,rows:1};
  return{
    code,
    guild:{id:guildId},
    fights:fights.map((id,i)=>({id,kill:i===fights.length-1,fightPercentage:i===0?30:70+i})),
    tables:{wipeCasts:table},
  };
}

const model={
  learning:{
    signalTriage:{
      criticalProbeQueue:[
        {id:1242815,name:'Void Flames',importance:.57,critical:true,origin:{classification:'mixed'},actionReason:'mixed provenance'},
        {id:1241313,name:'Rebirth',importance:.50,critical:true,origin:{classification:'unknown'},actionReason:'unknown provenance'},
      ],
      criticalLocalQueue:[{id:1243866,name:'Voidlight Rupture',importance:.62,origin:{classification:'encounter'}}],
    },
  },
};

test('planner uses canonical Wide, independent sources and exact fightIDs without executing WCL',()=>{
  const aggregate={sampling:{selectedWideCodes:['A','B','C','D']}};
  const profiles=[
    profile('A',10,[1242815,1241313],[1,2,3]),
    profile('B',20,[1242815],[4,5,6]),
    profile('C',20,[1242815],[7,8,9]), // duplicate source; must not add a second source for the same signal
    profile('D',30,[1241313],[10,11]),
    profile('NONCANON',40,[1242815,1241313],[12,13]),
  ];
  const plan=buildSurgicalProbePlanV1({model,aggregate,profiles,encounterId:3182,difficulty:5,partition:4,maxSourcesPerSignal:5,maxFightsPerSource:2});
  assert.equal(plan.version,SURGICAL_PROBE_PLAN_VERSION);
  assert.equal(plan.dryRun,true);
  assert.equal(plan.executesWcl,false);
  assert.equal(plan.wclCallsExecuted,0);
  assert.equal(plan.canonicalWideOnly,true);
  assert.equal(plan.targetSignals,2);
  assert.equal(plan.evidenceContract.countsTowardDeepReports,false);
  assert.equal(plan.evidenceContract.countsTowardDeepPulls,false);
  assert.equal(plan.safety.executorImplemented,false);
  const flames=plan.signals.find(row=>row.id===1242815);
  assert.deepEqual(flames.requests.map(row=>row.reportCode),['A','B']);
  assert.deepEqual(flames.requests.map(row=>row.source),['guild:10','guild:20']);
  assert.ok(flames.requests.every(row=>row.fightIDs.length>0&&row.fightIDs.length<=2));
  assert.ok(flames.requests.every(row=>row.queryShape.abilityID===1242815));
  assert.ok(flames.requests.every(row=>row.queryShape.filterExpression==='ability.id IN (1242815)'));
  assert.ok(flames.requests.every(row=>row.executesWcl===false));
  assert.ok(!flames.requests.some(row=>row.reportCode==='NONCANON'));
});

test('planner does not probe encounter-classified local-synthesis signals',()=>{
  const plan=buildSurgicalProbePlanV1({model,aggregate:{sampling:{selectedWideCodes:['A']}},profiles:[profile('A',10,[1243866,1242815],[1,2])],encounterId:3182,difficulty:5,partition:4});
  assert.ok(!plan.signals.some(row=>row.id===1243866));
});
