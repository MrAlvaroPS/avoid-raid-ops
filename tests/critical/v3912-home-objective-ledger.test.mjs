import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL v3.9.12 HOME OBJECTIVE LEDGER: active HOME report persists pull facts without mechanic readiness',async()=>{
  const [query,context,manifestService,facts,raidService]=await Promise.all([
    read('server/wcl/queries/active-report-manifest.mjs'),
    read('server/execution/execution-context-v1.mjs'),
    read('server/services/active-report-manifest-service.mjs'),
    read('server/home/raid-pull-facts-store-v1.mjs'),
    read('server/services/raid-execution-service.mjs'),
  ]);
  assert.match(query,/owner \{ id \}/,'manifest must retain owner identity for HOME proof when guild is absent');
  assert.match(context,/owner:report\.owner\?/);
  assert.match(manifestService,/isHomeSourceProfile/);
  assert.match(manifestService,/buildHomePullFactsSnapshotV1/);
  assert.match(manifestService,/persistHomePullFactsSnapshotV1/);
  assert.match(manifestService,/mechanicClassificationRequired:false/);
  assert.match(manifestService,/activeReportDoesNotMutateHomeHistory:true/);
  assert.match(facts,/objectivePullFactsOnly:true/);
  assert.match(facts,/mechanicClassificationRequired:false/);
  assert.match(facts,/killAndProgressIndependentOfMechanicReadiness:true/);
  assert.match(facts,/home\/raid-pull-facts/);
  assert.doesNotMatch(facts,/global-boss|automaticPromotion:true/);
  assert.match(raidService,/listHomePullFactsSnapshotsV1/);
  assert.match(raidService,/objectiveFactsIndependentOfMechanicReadiness:true/);
  assert.match(raidService,/progressionMayIncludeUnclassifiedHomePulls:true/);
  assert.match(raidService,/mechanicStateUsesOnlyClassifiedPulls:true/);
});
