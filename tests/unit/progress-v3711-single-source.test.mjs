import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProgressModel, PROGRESS_METRIC_POLICY, PROGRESS_METRICS_VERSION } from '../../server/analysis/progression/progress-metrics-v1.mjs';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

function pull({session='n1',sessionIndex=1,start=0,duration=60_000,pct=100,stage=1,kill=false,report='AAA'}={}){
  return {
    sessionId:session,
    sessionIndex,
    sessionTitle:session,
    absoluteStartTime:start,
    absoluteEndTime:start+duration,
    durationMs:duration,
    fightPercentage:pct,
    bossPercentage:pct,
    stageCount:stage,
    kill,
    reportCodes:[report]
  };
}

test('progress-model-v1 is one canonical population for totals, nights and matrix', () => {
  const rows=[];
  for(let i=0;i<10;i++)rows.push(pull({session:'n1',sessionIndex:1,start:i*180_000,pct:95-i*2,stage:i>=7?2:1,report:'A'}));
  for(let i=0;i<28;i++)rows.push(pull({session:'n2',sessionIndex:2,start:4_000_000+i*180_000,pct:80-i,stage:i>=12?2:1,report:'B'}));
  for(let i=0;i<13;i++)rows.push(pull({session:'n3',sessionIndex:3,start:10_000_000+i*180_000,pct:60-i*1.2,stage:i>=6?3:2,report:'C'}));
  const model=buildProgressModel(rows);
  assert.equal(model.modelVersion,'progress-model-v1');
  assert.equal(model.metricsVersion,PROGRESS_METRICS_VERSION);
  assert.equal(model.totals.pulls,51);
  assert.equal(model.totals.nights,3);
  assert.deepEqual(model.nights.map(n=>n.pulls),[10,28,13]);
  assert.equal(model.nights.reduce((sum,n)=>sum+n.pulls,0),51);
  assert.equal(model.diagnostics.nightPullTotal,51);
  assert.equal(model.diagnostics.invariants.nightPullsMatch,true);
  assert.equal(model.diagnostics.invariants.globalPullNumbersContiguous,true);
  assert.deepEqual(model.canonicalPulls.map(p=>p.pullNumber),Array.from({length:51},(_,i)=>i+1));
  assert.equal(model.matrix.windows.reduce((sum,w)=>sum+w.pulls,0),51);
  assert.equal(model.nights[2].firstGlobalPull,39);
  assert.equal(model.nights[2].lastGlobalPull,51);
});

test('100% closing progress is not treated as a meaningful retained level', () => {
  const rows=[];
  for(let i=0;i<6;i++)rows.push(pull({session:'n1',sessionIndex:1,start:i*180_000,pct:100,stage:1,report:'A'}));
  for(let i=0;i<6;i++)rows.push(pull({session:'n2',sessionIndex:2,start:4_000_000+i*180_000,pct:70-i,stage:2,report:'B'}));
  const model=buildProgressModel(rows);
  assert.equal(model.health.retention.available,false);
  assert.equal(model.health.retention.reason,'weak-closing-baseline');
  assert.equal(model.health.retention.previousClosingPct,100);
  assert.equal(model.diagnostics.hundredPctPulls,6);
});

test('raid throughput excludes long breaks from active time', () => {
  const rows=[
    pull({session:'n1',start:0,pct:80}),
    pull({session:'n1',start:11*60_000,pct:75}),
    pull({session:'n1',start:57*60_000,pct:70}) // 45m after pull 2 ends: excluded gap
  ];
  const model=buildProgressModel(rows);
  const t=model.health.throughput.current;
  assert.ok(t.activeMinutes>12.9&&t.activeMinutes<13.1,`active minutes ${t.activeMinutes}`);
  assert.ok(t.pullsPerHour>13&&t.pullsPerHour<14,`pulls/h ${t.pullsPerHour}`);
  assert.equal(t.medianDowntimeMinutes,10);
});

test('progress state is multi-dimensional rather than stage-rate only', () => {
  const rows=[];
  for(let i=0;i<20;i++)rows.push(pull({session:'n1',start:i*180_000,pct:95,stage:3}));
  const model=buildProgressModel(rows);
  assert.equal(model.block.currentStageConversionPct,100);
  assert.notEqual(model.state.key,'stabilizing');
  assert.ok(model.block.consistencyGapPp===0||model.block.consistencyGapPp!=null);
});

test('policy values are centralized and technically stable', () => {
  assert.equal(PROGRESS_METRIC_POLICY.currentBlockPulls,20);
  assert.equal(PROGRESS_METRIC_POLICY.deepPullMarginPp,10);
  assert.equal(PROGRESS_METRIC_POLICY.breakthroughDepthPp,2);
  assert.equal(PROGRESS_METRIC_POLICY.retentionBaselineMaxPct,97.5);
  assert.equal(PROGRESS_METRIC_POLICY.throughputGapCapMinutes,30);
  assert.equal(PROGRESS_METRIC_POLICY.matrixWindowPulls,20);
});

test('v3.7.11 browser runtime has one Progress writer and no strategic formula copies', async () => {
  const runtime=await read('public/progress-runtime-v3711.js');
  assert.match(runtime,/dataOwner:'history\.progressModel'/);
  assert.match(runtime,/writerPolicy:'single-progress-writer'/);
  for(const fn of ['applyProgressPage','applyProgressCurve','applyHistoryData','applyRealProgressMatrix']) assert.match(runtime,new RegExp(`wrap\\('${fn}'\\)`));
  assert.match(runtime,/progressModel/);
  assert.doesNotMatch(runtime,/function blockMetrics\(/);
  assert.doesNotMatch(runtime,/function breakthroughMetrics\(/);
  assert.doesNotMatch(runtime,/function retentionMetrics\(/);
  assert.doesNotMatch(runtime,/function throughputMetrics\(/);
  assert.doesNotMatch(runtime,/function progressionState\(/);
  assert.doesNotMatch(runtime,/\bfetch\s*\(/);
});

test('chart range is presentation-only in v3.7.11', async () => {
  const runtime=await read('public/progress-runtime-v3711.js');
  const handler=runtime.match(/qsa\('\[data-progress-range\]'[\s\S]*?renderChart\(pulls,m\);\}\)\);/);
  assert.ok(handler,'range handler exists');
  assert.match(handler[0],/state\.range=btn\.dataset\.progressRange/);
  assert.match(handler[0],/renderChart\(pulls,m\)/);
  assert.doesNotMatch(handler[0],/renderNights|renderMatrix|renderHealth|renderBannerAndStats/);
});

test('History builds and returns the canonical Progress model', async () => {
  const history=await read('server/engines/history-engine.mjs');
  assert.match(history,/import \{ buildProgressModel \}/);
  assert.match(history,/const built=buildProgressModel\(rawProgressionPulls\)/);
  assert.match(history,/progressModel/);
  assert.match(history,/engineVersion:'3\.7\.11'/);
  assert.match(history,/server-derived-single-source-v1/);
});

test('technical contract documents shared formulas, parameters and invariants', async () => {
  const doc=await read('docs/PROGRESS-METRICS-CONTRACT.md');
  for(const id of ['progress.total_pulls.v1','progress.deep_pull_rate.v1','progress.consistency_gap.v1','progress.night_retention.v1','progress.raid_throughput.v1','progress.state.v1']) assert.match(doc,new RegExp(id.replaceAll('.','\\.')));
  assert.match(doc,/sum\(progressModel\.nights\[\]\.pulls\) === progressModel\.totals\.pulls/);
  assert.match(doc,/must not copy a formula/i);
  assert.match(doc,/100\.0%/);
});
