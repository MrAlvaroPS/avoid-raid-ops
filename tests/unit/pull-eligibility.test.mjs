import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPullForAnalysis, splitAnalyticalPulls } from '../../server/analysis/pulls/pull-eligibility.mjs';

test('obvious 28s stage-1 reset at 97% boss is excluded',()=>{
  const fight={id:13,startTime:1000,endTime:29257,kill:false,fightPercentage:100,bossPercentage:97.06,lastPhaseAsAbsoluteIndex:0};
  const r=classifyPullForAnalysis(fight,{firstDeathMs:7647});
  assert.equal(r.eligible,false);
  assert.match(r.reason,/reset/);
});

test('meaningful 189s stage-3 pull remains eligible',()=>{
  const fight={id:14,startTime:1000,endTime:190788,kill:false,fightPercentage:47.99,bossPercentage:70.94,lastPhaseAsAbsoluteIndex:2};
  assert.equal(classifyPullForAnalysis(fight).eligible,true);
});

test('explicit early Companion wipe is excluded',()=>{
  const fight={id:2,startTime:100000,endTime:150000,kill:false,fightPercentage:100,bossPercentage:99,lastPhaseAsAbsoluteIndex:0,wipeCalledTime:111000};
  assert.equal(classifyPullForAnalysis(fight).eligible,false);
});

test('split keeps original fight identity while excluding resets',()=>{
  const fights=[
    {id:12,startTime:0,endTime:180000,kill:false,fightPercentage:66,bossPercentage:85,lastPhaseAsAbsoluteIndex:2},
    {id:13,startTime:200000,endTime:228000,kill:false,fightPercentage:100,bossPercentage:97,lastPhaseAsAbsoluteIndex:0},
    {id:14,startTime:300000,endTime:490000,kill:false,fightPercentage:48,bossPercentage:71,lastPhaseAsAbsoluteIndex:2}
  ];
  const split=splitAnalyticalPulls(fights);
  assert.deepEqual(split.eligible.map(x=>x.id),[12,14]);
  assert.equal(split.excluded[0].originalPullNumber,2);
});
