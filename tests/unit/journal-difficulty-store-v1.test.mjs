import test from 'node:test';
import assert from 'node:assert/strict';
import { persistJournalDifficultySnapshotV1,loadLatestJournalDifficultySnapshotV1 } from '../../server/knowledge/journal-difficulty-store-v1.mjs';
import { persistOfficialEncounterDifficultyViewV1,loadLatestOfficialEncounterDifficultyViewV1 } from '../../server/knowledge/official-encounter-difficulty-store-v1.mjs';
import { WAGO_DB2_JOURNAL_DIFFICULTY_PROVIDER_VERSION } from '../../server/knowledge/providers/wago-db2-journal-difficulty-v1.mjs';
import { OFFICIAL_ENCOUNTER_DIFFICULTY_VERSION } from '../../server/knowledge/official-encounter-difficulty-v1.mjs';

const memory=()=>{const rows=new Map();return{rows,get:async key=>rows.get(key)??null,set:async(key,value)=>{rows.set(key,value);return value;}};};

test('Journal difficulty latest rejects stale provider snapshots while preserving current revisions',async()=>{
  const store=memory(),build='99.1.0.12345';
  store.rows.set('knowledge/journal-difficulty/wago/99_1_0_12345/latest.json',{version:'wago-db2-journal-difficulty-v2',build,fingerprint:'a'.repeat(40)});
  assert.equal(await loadLatestJournalDifficultySnapshotV1(build,{storageGet:store.get}),null);
  const snapshot={version:WAGO_DB2_JOURNAL_DIFFICULTY_PROVIDER_VERSION,provider:'wago-db2',build,fingerprint:'b'.repeat(40),sectionRows:[],encounterRows:[],difficultyRows:[]};
  const saved=await persistJournalDifficultySnapshotV1(snapshot,{storageGet:store.get,storageSet:store.set,fetchedAt:123});
  assert.equal(saved.version,WAGO_DB2_JOURNAL_DIFFICULTY_PROVIDER_VERSION);
  assert.equal((await loadLatestJournalDifficultySnapshotV1(build,{storageGet:store.get})).fingerprint,'b'.repeat(40));
});

test('official difficulty latest rejects stale compiler views instead of serving old unresolved semantics',async()=>{
  const store=memory(),latest='knowledge/official-encounters/blizzard/8800/difficulty/d5/latest.json';
  store.rows.set(latest,{version:'official-encounter-difficulty-v2',encounter:{journalEncounterId:8800},difficulty:{id:5},fingerprint:'c'.repeat(40)});
  assert.equal(await loadLatestOfficialEncounterDifficultyViewV1(8800,5,{storageGet:store.get}),null);
  const view={version:OFFICIAL_ENCOUNTER_DIFFICULTY_VERSION,encounter:{journalEncounterId:8800},difficulty:{id:5},fingerprint:'d'.repeat(40),abilities:[],sections:[],graph:{sectionCount:0,spellCount:0,officialMembershipEdges:0,maxDepth:0},applicability:{difficultyVerified:false},evidenceContract:{automaticPromotion:false}};
  const saved=await persistOfficialEncounterDifficultyViewV1(view,{storageGet:store.get,storageSet:store.set,fetchedAt:456});
  assert.equal(saved.version,OFFICIAL_ENCOUNTER_DIFFICULTY_VERSION);
  assert.equal((await loadLatestOfficialEncounterDifficultyViewV1(8800,5,{storageGet:store.get})).fingerprint,'d'.repeat(40));
});
