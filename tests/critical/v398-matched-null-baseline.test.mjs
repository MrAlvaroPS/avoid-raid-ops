import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('CRITICAL v3.9.8 MATCHED NULL: preview/evaluate are zero-WCL and execution stays fingerprinted/manual',async()=>{
  const route=await read('routes/api/wcl/matched-null-baseline.js');
  assert.match(route,/action==='preview'/);
  assert.match(route,/networkExecuted:false,wclCallsExecuted:0,preview/);
  assert.match(route,/action==='evaluate'/);
  assert.match(route,/networkExecuted:false,wclCallsExecuted:0,evaluation/);
  assert.match(route,/confirmExecution!==true/);
  assert.match(route,/Preview fingerprint is missing or stale/);
  assert.doesNotMatch(route,/wholeReport|startCorpus|launchCorpusExecution|improveModel/);
});

test('CRITICAL v3.9.8 MATCHED NULL: local flank evidence cannot masquerade as Promotion baseline',async()=>{
  const [module,executor,doc]=await Promise.all([
    read('server/corpus/matched-null-baseline-v1.mjs'),
    read('server/corpus/matched-null-baseline-executor-v1.mjs'),
    read('docs/IRIS-MATCHED-NULL-BASELINE-V1.md'),
  ]);
  assert.match(module,/localFlankControlsUsed:false/);
  assert.match(module,/localFlankBaselineIsPromotionBaseline:false/);
  assert.match(module,/targetSignalContaminationMustBeRejected:true/);
  assert.match(executor,/target-signal-observed-inside-control/);
  assert.match(executor,/rawActorIdsPersisted:false/);
  assert.match(doc,/does \*\*not\*\* promote a mechanic/i);
  assert.match(doc,/There is no whole-report fallback/i);
});

test('CRITICAL v3.9.8 RELEASE: package overlay remains the integer v3.9 counter',async()=>{
  const pkg=JSON.parse(await read('package.json'));
  assert.equal(pkg.version,'0.3.9-8-vercel.0');
});
