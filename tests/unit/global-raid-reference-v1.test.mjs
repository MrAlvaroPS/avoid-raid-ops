import test from 'node:test';
import assert from 'node:assert/strict';
import { getGlobalRaidReferenceV1 } from '../../server/services/global-raid-reference-service.mjs';

test('GLOBAL reference is exact-difficulty and zero-network when no corpus exists',async()=>{
  let input=null;const result=await getGlobalRaidReferenceV1({encounterId:8100,difficulty:3,partition:2},{getStatus:async value=>{input=value;return null;}});
  assert.deepEqual(input,{encounterId:8100,difficulty:3,partition:2});
  assert.equal(result.status,'not-started');assert.equal(result.maturity,'none');assert.equal(result.networkExecuted,false);
  assert.equal(result.evidenceContract.sameDifficultyOnly,true);assert.equal(result.evidenceContract.crossDifficultyComparisonForbidden,true);assert.equal(result.evidenceContract.foundationIsAcceptedKnowledge,false);
});

test('building and ready foundation corpora expose maturity without becoming accepted knowledge',async()=>{
  const building=await getGlobalRaidReferenceV1({encounterId:8100,difficulty:4,partition:2},{getStatus:async()=>({corpusId:'8100/d4/p2',status:'running',phase:'wide',partition:2,pullCount:144,deepPullCount:0,sourceStats:{total:17,guilds:15,personalUploaders:2},progress:{wide:.48}})});
  assert.equal(building.status,'building');assert.equal(building.maturity,'foundation-building');assert.equal(building.reference.pulls,144);assert.equal(building.reference.sources,17);
  const ready=await getGlobalRaidReferenceV1({encounterId:8100,difficulty:4,partition:2},{getStatus:async()=>({corpusId:'8100/d4/p2',status:'ready',phase:'complete',partition:2,pullCount:330,deepPullCount:62,sourceStats:{total:31,guilds:28,personalUploaders:3}})});
  assert.equal(ready.status,'ready');assert.equal(ready.maturity,'foundation-ready');assert.equal(ready.evidenceContract.foundationCanSupportOperationalComparison,true);assert.equal(ready.evidenceContract.foundationIsAcceptedKnowledge,false);assert.equal(ready.evidenceContract.automaticPromotion,false);
});

test('GLOBAL reference rejects a missing difficulty instead of defaulting to Mythic',async()=>{
  await assert.rejects(()=>getGlobalRaidReferenceV1({encounterId:8100},{getStatus:async()=>null}),/difficulty is required/);
});
