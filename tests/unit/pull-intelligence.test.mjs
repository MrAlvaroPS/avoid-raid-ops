import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPullIntelligence } from '../../server/analysis/pulls/pull-intelligence.mjs';

const summary=(damage,healing)=>({data:{damageDone:[{id:1,total:damage}],healingDone:[{id:2,total:healing}]}});
const fight=(id,start,pct,stage=3)=>({id,startTime:start,endTime:start+100000,fightPercentage:pct,bossPercentage:pct,kill:false,inProgress:false,lastPhaseAsAbsoluteIndex:stage-1,phaseTransitions:Array.from({length:stage},(_,i)=>({id:i===1?2:1,startTime:start+i*30000})),friendlyPlayers:[1,2]});

test('latest pull is compared with previous and lower fightPercentage is improvement',()=>{
  const fights=[fight(1,0,70,3),fight(2,200000,50,3)];
  const summaries=new Map([[1,summary(10000000,5000000)],[2,summary(11000000,5200000)]]);
  const deaths={rawByFight:{1:[{fightRelativeMs:60000}],2:[{fightRelativeMs:80000}]},meaningfulByFight:{1:[{},{}],2:[{}]}};
  const x=buildPullIntelligence({fights,summaryTables:summaries,deathAnalysis:deaths});
  assert.equal(x.latest.pullNumber,2);
  assert.equal(x.currentVsPrevious.signals.find(s=>s.key==='progress').status,'improved');
  assert.equal(x.currentVsPrevious.signals.find(s=>s.key==='firstDeath').status,'improved');
  assert.equal(x.currentVsPrevious.signals.find(s=>s.key==='meaningfulDeaths').status,'improved');
});

test('raid DPS is directional only for pulls that reached the same absolute stage and HPS stays observational',()=>{
  const fights=[fight(1,0,70,2),fight(2,200000,50,3)];
  const summaries=new Map([[1,summary(10000000,5000000)],[2,summary(20000000,9000000)]]);
  const x=buildPullIntelligence({fights,summaryTables:summaries,deathAnalysis:{rawByFight:{},meaningfulByFight:{}}});
  const dps=x.currentVsPrevious.signals.find(s=>s.key==='raidDps');
  const hps=x.currentVsPrevious.signals.find(s=>s.key==='raidHps');
  assert.equal(x.currentVsPrevious.sameStage,false);
  assert.equal(dps.status,'observed');
  assert.equal(hps.status,'observed');
});


test('latest comparison skips an early reset and uses the previous meaningful pull',()=>{
  const fights=[
    {id:12,startTime:0,endTime:180136,fightPercentage:66.46,bossPercentage:85.16,lastPhaseAsAbsoluteIndex:2,friendlyPlayers:[1],phaseTransitions:[{id:1,startTime:0},{id:2,startTime:100000},{id:1,startTime:140000}]},
    {id:13,startTime:200000,endTime:228257,fightPercentage:100,bossPercentage:97.06,lastPhaseAsAbsoluteIndex:0,friendlyPlayers:[1],phaseTransitions:[{id:1,startTime:200000}]},
    {id:14,startTime:300000,endTime:489788,fightPercentage:47.99,bossPercentage:70.94,lastPhaseAsAbsoluteIndex:2,friendlyPlayers:[1],phaseTransitions:[{id:1,startTime:300000},{id:2,startTime:403000},{id:1,startTime:443000}]}
  ];
  const deaths={rawByFight:{12:[{fightRelativeMs:98045}],13:[{fightRelativeMs:7647}],14:[{fightRelativeMs:96437}]},meaningfulByFight:{12:[],13:[],14:[]}};
  const pi=buildPullIntelligence({fights,deathAnalysis:deaths});
  assert.equal(pi.latest.pullNumber,3);
  assert.equal(pi.previous.pullNumber,1);
  assert.equal(pi.latest.fightId,14);
  assert.equal(pi.previous.fightId,12);
  assert.equal(pi.excludedPulls.length,1);
  assert.equal(pi.excludedPulls[0].fightId,13);
  assert.equal(pi.excludedPulls[0].classification,'called-wipe');
  assert.equal(pi.currentVsPrevious.skippedRawPulls,1);
  assert.deepEqual(pi.analysisPopulation.eligibleFightIds,[12,14]);
  assert.match(pi.analysisPopulation.policy,/excluded from product analytics/);
});
