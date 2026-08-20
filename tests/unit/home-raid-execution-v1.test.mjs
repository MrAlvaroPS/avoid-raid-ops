import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateHomeRaidExecutionV1 } from '../../server/home/raid-execution-store-v1.mjs';

const mechanic=(overrides={})=>({
  key:'soak',name:'Soul Soak',category:'positioning',severity:'major',expectedAction:'Stack in the assigned soak.',
  opportunities:10,failedOccurrences:2,failures:2,playerExposures:2,observedIncidents:2,unresolvedAssignments:0,
  cleanOccurrences:8,executionSuccessPct:80,denominatorStatus:'normalized',linkedDeaths:0,firstDeaths:0,confidence:'high',
  ...overrides,
});
const snapshot=({reportCode,encounterId=3470,difficulty=3,fights,mechanics=[mechanic()],failures=[],generatedAt=1})=>({
  version:'home-raid-execution-v1',guildId:788166,reportCode,report:{code:reportCode,startTime:generatedAt*100000},generatedAt,
  encounter:{id:encounterId,name:'Synthetic Boss',difficulty,difficultyName:difficulty===3?'Normal':'Heroic'},
  analysisPopulation:{eligibleFightIds:fights},mechanics,failures,nextPullCalls:[],
});

test('longitudinal execution aggregates all persisted HOME report pulls instead of replacing history with the latest report',()=>{
  const a=snapshot({reportCode:'A',fights:[1,2,3],generatedAt:1,mechanics:[mechanic({opportunities:10,failedOccurrences:2})],failures:[{mechanicKey:'soak',fightId:2},{mechanicKey:'soak',fightId:3}]});
  const b=snapshot({reportCode:'B',fights:[4,5],generatedAt:2,mechanics:[mechanic({opportunities:6,failedOccurrences:1})],failures:[{mechanicKey:'soak',fightId:5}]});
  const result=aggregateHomeRaidExecutionV1([a,b],{guildId:788166,encounterId:3470,difficulty:3,recentWindow:3});
  assert.equal(result.population.reports,2);
  assert.equal(result.population.pulls,5);
  assert.equal(result.mechanics[0].opportunities,16);
  assert.equal(result.mechanics[0].failedOccurrences,3);
  assert.equal(result.state.mechanicalAccuracyPct,81.25);
  assert.match(result.state.scoreSemantics,/aggregate clean mechanic occurrences/);
  assert.equal(result.evidenceContract.singlePullCannotReplaceAggregate,true);
});

test('current mechanic state uses a recent-vs-previous recurrence window while preserving all-time denominators',()=>{
  const a=snapshot({reportCode:'A',fights:[1,2,3,4,5,6,7,8],generatedAt:1,mechanics:[mechanic({opportunities:24,failedOccurrences:6})],failures:[
    {mechanicKey:'soak',fightId:1},{mechanicKey:'soak',fightId:2},{mechanicKey:'soak',fightId:3},{mechanicKey:'soak',fightId:4},{mechanicKey:'soak',fightId:5},{mechanicKey:'soak',fightId:7},
  ]});
  const result=aggregateHomeRaidExecutionV1([a],{guildId:788166,encounterId:3470,difficulty:3,recentWindow:4});
  const soak=result.mechanics.find(row=>row.key==='soak');
  assert.equal(soak.previousFailedPulls,4);
  assert.equal(soak.recentFailedPulls,2);
  assert.equal(soak.trend,'improving');
  assert.equal(soak.opportunities,24);
});

test('less than three pulls is BASELINE and mechanically stable never claims overall boss killability',()=>{
  const a=snapshot({reportCode:'A',fights:[1,2],generatedAt:1,mechanics:[mechanic({opportunities:6,failedOccurrences:0})]});
  const baseline=aggregateHomeRaidExecutionV1([a],{guildId:788166,encounterId:3470,difficulty:3});
  assert.equal(baseline.state.label,'BASELINE');
  assert.equal(baseline.evidenceContract.mechanicallyReadyIsNotOverallKillability,true);
  assert.doesNotMatch(JSON.stringify(baseline.state),/killable/i);
});

test('cross-difficulty snapshots never enter the same longitudinal aggregate',()=>{
  const normal=snapshot({reportCode:'N',difficulty:3,fights:[1,2,3],mechanics:[mechanic({opportunities:9,failedOccurrences:1})]});
  const heroic=snapshot({reportCode:'H',difficulty:4,fights:[4,5,6],mechanics:[mechanic({opportunities:99,failedOccurrences:99})]});
  const result=aggregateHomeRaidExecutionV1([normal,heroic],{guildId:788166,encounterId:3470,difficulty:3});
  assert.equal(result.population.reports,1);
  assert.equal(result.population.pulls,3);
  assert.equal(result.mechanics[0].opportunities,9);
  assert.equal(result.mechanics[0].failedOccurrences,1);
});
