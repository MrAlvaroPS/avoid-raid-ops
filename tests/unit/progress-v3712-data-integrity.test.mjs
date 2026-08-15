import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import {
  buildProgressModel,
  classifyProgressMetricEligibility,
  PROGRESS_METRIC_POLICY,
  PROGRESS_METRICS_VERSION
} from '../../server/analysis/progression/progress-metrics-v2.mjs';
import { PROGRESS_METRIC_IDS, PROGRESS_METRIC_REGISTRY } from '../../server/analysis/progression/progress-metric-registry-v2.mjs';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

function pull({session='n1',sessionIndex=1,start=0,duration=60_000,pct=80,boss=pct,stage=1,kill=false,report='A',fightId=1}={}){
  return {
    sessionId:session,sessionIndex,sessionTitle:session,
    absoluteStartTime:start,absoluteEndTime:start+duration,durationMs:duration,
    fightPercentage:pct,bossPercentage:boss,stageCount:stage,kill,
    reportCodes:[report],fightIds:[fightId]
  };
}

test('metric eligibility preserves raw pulls and excludes hard contradictions only',()=>{
  const exact100=classifyProgressMetricEligibility(pull({pct:100,boss:100,stage:1}));
  assert.equal(exact100.eligible,true);
  assert.ok(exact100.flags.includes('exact-100-fight-progress'));

  const contradiction=classifyProgressMetricEligibility(pull({pct:100,boss:80,stage:2}));
  assert.equal(contradiction.eligible,false);
  assert.equal(contradiction.reason,'fight-progress-100-after-stage-transition');
  assert.ok(contradiction.flags.includes('fight-progress-contradicts-stage'));

  const missing=classifyProgressMetricEligibility(pull({pct:null,boss:90,stage:1}));
  assert.equal(missing.eligible,false);
  assert.equal(missing.reason,'missing-or-invalid-fight-percentage');
});

test('progress-model-v2 reconciles raw and eligible populations across nights and matrix',()=>{
  const rows=[];
  // Two explicit hard contradictions: an exact 100% progress value while WCL also
  // says the pull reached Stage 2. They remain raw but are not strategic evidence.
  for(let i=0;i<10;i++)rows.push(pull({session:'n1',sessionIndex:1,start:i*180_000,pct:i<6?100:90-i,stage:i===5||i===8?2:1,report:'A',fightId:i+1}));
  for(let i=0;i<28;i++)rows.push(pull({session:'n2',sessionIndex:2,start:4_000_000+i*180_000,pct:i===5?100:82-i*.8,stage:i===5?2:(i>=16?2:1),report:'B',fightId:100+i}));
  for(let i=0;i<13;i++)rows.push(pull({session:'n3',sessionIndex:3,start:10_000_000+i*180_000,pct:62-i*1.1,stage:i>=6?3:2,report:'C',fightId:200+i}));

  const model=buildProgressModel(rows);
  assert.equal(model.modelVersion,'progress-model-v2');
  assert.equal(model.metricsVersion,PROGRESS_METRICS_VERSION);
  assert.equal(model.totals.rawPulls,51);
  assert.equal(model.nights.reduce((n,x)=>n+x.pulls,0),51);
  assert.equal(model.nights.reduce((n,x)=>n+x.metricEligiblePulls,0),model.totals.metricEligiblePulls);
  assert.equal(model.totals.metricExcludedPulls,2);
  assert.equal(model.block.currentBlock.metricEligiblePulls,20);
  assert.equal(model.matrix.windows.reduce((n,w)=>n+w.pulls,0),model.totals.metricEligiblePulls);
  assert.ok(Object.values(model.diagnostics.invariants).every(Boolean));
  assert.deepEqual(model.canonicalPulls.map(p=>p.pullNumber),Array.from({length:51},(_,i)=>i+1));
});

test('CURRENT FORM metrics share exactly the latest 20 metric-eligible pulls',()=>{
  const rows=[];
  for(let i=0;i<50;i++)rows.push(pull({session:i<25?'n1':'n2',sessionIndex:i<25?1:2,start:i*180_000,pct:90-i,stage:i>=30?3:2,fightId:i+1}));
  rows.push(pull({session:'n2',sessionIndex:2,start:51*180_000,pct:100,boss:75,stage:3,fightId:90}));
  rows.push(pull({session:'n2',sessionIndex:2,start:52*180_000,pct:null,boss:80,stage:2,fightId:91}));
  const model=buildProgressModel(rows);
  assert.equal(model.block.scope,'latest-20-metric-eligible-pulls');
  assert.equal(model.block.currentBlock.metricEligiblePulls,20);
  assert.equal(model.block.previousBlock.metricEligiblePulls,20);
  assert.equal(model.health.phaseConversionPct,model.block.currentStageConversionPct);
  assert.equal(model.population.currentForm,'latest 20 metric-eligible pulls');
});

test('high exact-100 share holds strategic synthesis at DATA REVIEW without deleting source rows',()=>{
  const rows=[];
  for(let i=0;i<30;i++)rows.push(pull({session:'n1',start:i*180_000,pct:i<18?100:80-i,stage:1,fightId:i+1}));
  const model=buildProgressModel(rows);
  assert.equal(model.dataQuality.grade,'REVIEW');
  assert.equal(model.dataQuality.holdStrategicState,true);
  assert.equal(model.state.key,'data-review');
  assert.ok(model.candidateState);
  assert.equal(model.totals.rawPulls,30);
  assert.equal(model.totals.metricExcludedPulls,0);
  assert.equal(model.dataQuality.exactHundredPulls,18);
  assert.equal(model.dataQuality.auditRows.length,18);
});

test('metric registry v2 gives shared semantic IDs and explicit scopes',()=>{
  assert.equal(PROGRESS_METRIC_REGISTRY.version,'2.0.0');
  assert.equal(PROGRESS_METRIC_REGISTRY.populationContract.currentForm,'latest 20 metric-eligible pulls');
  assert.equal(PROGRESS_METRIC_REGISTRY.metrics[PROGRESS_METRIC_IDS.deepPullRate].scope,'current-form');
  assert.equal(PROGRESS_METRIC_REGISTRY.metrics[PROGRESS_METRIC_IDS.stageConversion].scope,'current-form');
  assert.equal(PROGRESS_METRIC_REGISTRY.metrics[PROGRESS_METRIC_IDS.raidThroughput].scope,'latest-raw-timestamped-night');
  assert.equal(PROGRESS_METRIC_POLICY.currentFormPulls,20);
});

test('v3.7.12 runtime renders model v2 and exposes only explicit data-quality disclosure',async()=>{
  const source=await read('public/progress-runtime-v3712.js');
  assert.doesNotThrow(()=>new vm.Script(source,{filename:'progress-runtime-v3712.js'}));
  assert.match(source,/REQUIRED_MODEL='progress-model-v2'/);
  assert.match(source,/metricPopulation:'progressMetricEligible'/);
  assert.match(source,/DATA QUALITY/);
  assert.match(source,/progressMetricEligible===true/);
  assert.match(source,/renderChart\(raw,eligible,m\)/);
  assert.doesNotMatch(source,/function blockMetrics\(/);
  assert.doesNotMatch(source,/function progressionState\(/);
  assert.doesNotMatch(source,/\bfetch\s*\(/);
});

test('v2 contract documents population, formulas, auditability and reuse',async()=>{
  const [contract,integrity]=await Promise.all([
    read('docs/PROGRESS-METRICS-CONTRACT-V2.md'),
    read('docs/PROGRESS-DATA-INTEGRITY-V2.md')
  ]);
  for(const id of ['progress.deep_pull_rate.v2','progress.consistency_gap.v2','progress.stage_conversion.v2','progress.data_quality.v2']){
    assert.match(contract,new RegExp(id.replaceAll('.','\\.')));
  }
  assert.match(contract,/latest \*\*20 metric-eligible pulls\*\*/i);
  assert.match(contract,/must not invent alternative formulas/i);
  assert.match(integrity,/reportCodes\[\]/);
  assert.match(integrity,/fightIds\[\]/);
  assert.match(integrity,/No component may independently decide/i);
});
