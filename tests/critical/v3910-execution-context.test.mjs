import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL v3.9.10 EXECUTION CONTEXT: active report, HOME history and GLOBAL Iris are independent planes',async()=>{
  const [context,doc]=await Promise.all([read('server/execution/execution-context-v1.mjs'),read('docs/AVOID-EXECUTION-CONTEXT-V1.md')]);
  assert.match(context,/globalIrisIndependent:true/);
  assert.match(context,/activeReportDoesNotMutateHomeHistory:true/);
  assert.match(context,/homeHistoryRefreshExplicit:true/);
  assert.match(context,/pullSelectionIsConsumerOptIn:true/);
  assert.match(context,/firstPageWclNetworkAllowed:false/);
  assert.match(context,/waiting-for-first-combat/);
  assert.match(context,/difficultyClassifiedPerFight:true/);
  assert.match(context,/crossDifficultyAggregationForbidden:true/);
  assert.match(doc,/browser -> persisted local\/private read models only/);
  assert.match(doc,/WCL calls = 0/);
  assert.match(doc,/All pulls \(default\)/);
  assert.match(doc,/Refresh history/);
  assert.match(doc,/Live .* Load \/ Start.*Stop/s);
});
