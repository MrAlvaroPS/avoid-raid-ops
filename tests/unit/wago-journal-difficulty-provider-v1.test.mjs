import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWagoJournalDifficultySnapshotV1 } from '../../server/knowledge/providers/wago-db2-journal-difficulty-v1.mjs';

const csv={
  JournalSectionXDifficulty:'ID,JournalEncounterSectionID,DifficultyID\n1,7001,15\n2,7002,16\n',
  JournalEncounterXDifficulty:'ID,JournalEncounterID,DifficultyID\n10,8001,14\n11,8001,15\n12,8001,16\n',
  Difficulty:'ID,FallbackDifficultyID,InstanceType,Name_lang\n14,0,2,Normal\n15,0,2,Heroic\n16,0,2,Mythic\n',
};
function response(text){return{ok:true,status:200,headers:{get:()=>String(Buffer.byteLength(text))},text:async()=>text};}

test('provider fetches Journal restrictions plus Difficulty dictionary once per build without assuming WCL IDs equal DB2 IDs',async()=>{
  const calls=[];
  const snapshot=await fetchWagoJournalDifficultySnapshotV1({build:'99.1.0.12345',baseUrl:'https://example.test/db2',fetcher:async url=>{calls.push(url);const table=new URL(url).pathname.split('/').at(-2);return response(csv[table]);}});
  assert.equal(calls.length,3);
  assert.deepEqual(snapshot.encounterRows.map(x=>x.difficultyId),[14,15,16]);
  assert.deepEqual(snapshot.difficultyRows.map(x=>[x.difficultyId,x.name]),[[14,'Normal'],[15,'Heroic'],[16,'Mythic']]);
  assert.equal(snapshot.usage.networkCalls,3);
  assert.equal(snapshot.evidenceContract.wclDifficultyIdsAreNotDb2DifficultyIds,true);
  assert.equal(snapshot.evidenceContract.observedCombat,false);
});
