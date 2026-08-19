import { corpusGet,corpusSet } from '../corpus/storage.mjs';
import { normalizeWagoBuildV1 } from './providers/wago-db2-spell-effect-v1.mjs';

export const JOURNAL_DIFFICULTY_STORE_VERSION='journal-difficulty-store-v1';
const buildKey=build=>normalizeWagoBuildV1(build).replaceAll('.','_');
export const journalDifficultyLatestKeyV1=build=>`knowledge/journal-difficulty/wago/${buildKey(build)}/latest.json`;
export const journalDifficultyRevisionKeyV1=(build,fingerprint)=>`knowledge/journal-difficulty/wago/${buildKey(build)}/revisions/${String(fingerprint)}.json`;

export async function persistJournalDifficultySnapshotV1(snapshot,{fetchedAt=Date.now(),storageGet=corpusGet,storageSet=corpusSet}={}){
  const build=normalizeWagoBuildV1(snapshot?.build),fingerprint=String(snapshot?.fingerprint||'');if(!/^[a-f0-9]{40}$/i.test(fingerprint))throw new Error('journal difficulty fingerprint is invalid');
  const latestKey=journalDifficultyLatestKeyV1(build),revisionKey=journalDifficultyRevisionKeyV1(build,fingerprint),previous=await storageGet(latestKey).catch(()=>null);
  const stored={...snapshot,storage:{version:JOURNAL_DIFFICULTY_STORE_VERSION,fetchedAt:Number(fetchedAt)||Date.now(),latestKey,revisionKey,previousFingerprint:previous?.fingerprint||null,changedFromPrevious:Boolean(previous?.fingerprint&&previous.fingerprint!==fingerprint)}};
  await storageSet(revisionKey,stored);await storageSet(latestKey,stored);return stored;
}
export async function loadLatestJournalDifficultySnapshotV1(build,{storageGet=corpusGet}={}){return storageGet(journalDifficultyLatestKeyV1(build));}
