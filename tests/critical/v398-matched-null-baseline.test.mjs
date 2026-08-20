import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('CRITICAL v3.9.8 MATCHED NULL: preview/evaluate are zero-WCL and execution stays fingerprinted/manual',async()=>{
  const route=await read('routes/api/wcl/matched-null-baseline.js');
  assert.match(route,/action==='preview'/);
  assert.match(route,/networkExecuted:false,wclCallsExecuted:0,preview/);
  assert.match(route,/action==='evaluate'/);
  assert.match(route,/networkExecuted:false,wclCallsExecuted:0/);
  assert.match(route,/evaluation/);
  assert.match(route,/confirmExecution!==true/);
  assert.match(route,/Preview fingerprint is missing or stale/);
  assert.doesNotMatch(route,/wholeReport|startCorpus|launchCorpusExecution|improveModel/);
});

test('CRITICAL v3.9.8 MATCHED NULL: nulls are paired, cover every Episode pattern and validate the full Episode guard',async()=>{
  const [module,executor,doc]=await Promise.all([
    read('server/corpus/matched-null-baseline-v1.mjs'),
    read('server/corpus/matched-null-baseline-executor-v1.mjs'),
    read('docs/IRIS-MATCHED-NULL-BASELINE-V1.md'),
  ]);
  assert.match(module,/pairedAnchorComparison:true/);
  assert.match(module,/anchorObservedPatternKeys/);
  assert.match(module,/anchorContextCoversEpisodeRadius:true/);
  assert.match(module,/localFlankControlsUsed:false/);
  assert.match(module,/localFlankBaselineIsPromotionBaseline:false/);
  assert.match(module,/controlCoversEpisodeRadius:true/);
  assert.match(module,/Math\.max\(requestedConfig\.controlRadiusMs,episodeRadius\)/);
  assert.match(module,/targetSignalContaminationMustBeRejected:true/);
  assert.match(module,/targetSignalGuardRadiusValidated:true/);
  assert.match(module,/innerControlEventsOnly:true/);
  assert.match(executor,/pairedAnchorComparison:true/);
  assert.match(executor,/anchorObservedPatternKeys/);
  assert.match(executor,/target-signal-observed-inside-episode-guard/);
  assert.match(executor,/windowStart:control\.contaminationWindowStart/);
  assert.match(executor,/windowEnd:control\.contaminationWindowEnd/);
  assert.match(executor,/rawActorIdsPersisted:false/);
  assert.match(doc,/does \*\*not\*\* promote a mechanic/i);
  assert.match(doc,/There is no whole-report fallback/i);
  assert.match(doc,/full Episode exclusion guard/i);
  assert.match(doc,/only the inner control window/i);
  assert.match(doc,/at least the Episode temporal radius/i);
  assert.match(doc,/paired anchor/i);
  assert.match(doc,/same valid pairs/i);
});

test('CRITICAL v3.9.8 RELEASE: package overlay remains an integer v3.9 counter at or beyond v3.9.8',async()=>{
  const pkg=JSON.parse(await read('package.json'));
  assert.match(pkg.version,/^0\.3\.9-(?:[89]|\d{2,})-vercel\.0$/);
});