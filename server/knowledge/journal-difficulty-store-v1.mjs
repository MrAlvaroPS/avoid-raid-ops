import { corpusGet,corpusSet } from '../corpus/storage.mjs';
import { normalizeWagoBuildV1 } from './providers/wago-db2-spell-effect-v1.mjs';
import { WAGO_DB2_JOURNAL_DIFFICULTY_PROVIDER_VERSION } from './providers/wago-db2-journal-difficulty-v1.mjs';

export const JOURNAL_DIFFICULTY_STORE_VERSION='journal-difficulty-store-v2';
const buildKey=build=>normalizeWagoBuildV1(build).replaceAll('.','_');
export const journalDifficultyLatestKeyV1=build=>`knowledge/journal-difficulty/wago/${buildKey(build)}/latest.json`;
export const journalDifficultyRevisionKeyV1=(build,fingerprint)=>`knowledge/journal-difficulty/wago/${buildKey(build)}/revisions/${String(fingerprint)}.json`;

export async function persistJournalDifficultySnapshotV1(snapshot,{fetchedAt=Date.now(),storageGet=corpusGet,storageSet=corpusSet}={}){
  const build=normalizeWagoBuildV1(snapshot?.build),fingerprint=String(snapshot?.fingerprint||'');if(!/^[a-f0-9]{40}$/i.test(fingerprint))throw new Error('journal difficulty fingerprint is invalid');
  if(snapshot?.version!==WAGO_DB2_JOURNAL_DIFFICULTY_PROVIDER_VERSION)throw new Error(`journal difficulty provider version ${snapshot?.version||'missing'} is not current ${WAGO_DB2_JOURNAL_DIFFICULTY_PROVIDER_VERSION}`);
  const latestKey=journalDifficultyLatestKeyV1(build),revisionKey=journalDifficultyRevisionKeyV1(build,fingerprint),previous=await storageGet(latestKey).catch(()=>null);
  const stored={...snapshot,storage:{version:JOURNAL_DIFFICULTY_STORE_VERSION,fetchedAt:Number(fetchedAt)||Date.now(),latestKey,revisionKey,previousFingerprint:previous?.fingerprint||null,changedFromPrevious:Boolean(previous?.fingerprint&&previous.fingerprint!==fingerprint)}};
  await storageSet(revisionKey,stored);await storageSet(latestKey,stored);return stored;
}
export async function loadLatestJournalDifficultySnapshotV1(build,{storageGet=corpusGet}={}){const value=await storageGet(journalDifficultyLatestKeyV1(build));return value?.version===WAGO_DB2_JOURNAL_DIFFICULTY_PROVIDER_VERSION?value:null;}
