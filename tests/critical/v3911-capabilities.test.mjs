import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL v3.9.11 CAPABILITIES: Iris exposes HOME history and Active Report as isolated evidence planes',async()=>{
  const [contract,service]=await Promise.all([read('server/iris/capability-contract-v3911.mjs'),read('server/services/iris-capabilities-service.mjs')]);
  assert.match(contract,/iris-capabilities-v3\.9\.11/);
  for(const id of ['home.history.read','home.history.refresh','execution.active-report.manifest','execution.active-report.rich-data','execution.pull-selection'])assert.match(contract,new RegExp(id.replaceAll('.','\\.')));
  assert.match(contract,/firstPageWclNetwork/);assert.match(contract,/executionContextIsolation/);assert.match(contract,/liveEmptySemantics/);assert.match(contract,/globalHomeSourceIsolation/);
  assert.match(service,/getIrisCapabilityContractV3911/);
  assert.doesNotMatch(service,/getIrisCapabilityContractV3910\(\)/);
});
