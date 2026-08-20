import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL v3.9.10 LIVE MANIFEST: polling classifies fights without combat-event acquisition',async()=>{
  const [query,engine,service,route,context]=await Promise.all([
    read('server/wcl/queries/active-report-manifest.mjs'),
    read('server/engines/active-report-manifest-engine.mjs'),
    read('server/services/active-report-manifest-service.mjs'),
    read('routes/api/wcl/active-report-manifest.js'),
    read('server/execution/execution-context-v1.mjs'),
  ]);
  assert.match(query,/fights\(killType:\s*Encounters\)/);
  assert.doesNotMatch(query,/events\s*\(|table\s*\(/i);
  assert.match(engine,/wclCombatEventCalls:0/);
  assert.match(engine,/heavyRefreshOnlyWhenFingerprintChanges:true/);
  assert.match(service,/normalizeWclReportReferenceV1/);
  assert.match(service,/private, no-store/);
  assert.match(route,/active-report-manifest-service/);
  assert.match(context,/waiting-for-first-combat/);
  assert.match(context,/emptyLiveReportIsNotFailure:true/);
});
