import { corpusGet,corpusSet } from '../corpus/storage.mjs';
import { OFFICIAL_ENCOUNTER_DIFFICULTY_VERSION } from './official-encounter-difficulty-v1.mjs';

export const OFFICIAL_ENCOUNTER_DIFFICULTY_STORE_VERSION='official-encounter-difficulty-store-v2';
const positive=(value,label)=>{const n=Number(value);if(!Number.isInteger(n)||n<=0)throw new Error(`${label} must be a positive integer`);return n;};
const fp=value=>{const text=String(value||'');if(!/^[a-f0-9]{40}$/i.test(text))throw new Error('difficulty view fingerprint is invalid');return text.toLowerCase();};
export const officialEncounterDifficultyLatestKeyV1=(journalEncounterId,difficultyId)=>`knowledge/official-encounters/blizzard/${positive(journalEncounterId,'journalEncounterId')}/difficulty/d${positive(difficultyId,'difficultyId')}/latest.json`;
export const officialEncounterDifficultyRevisionKeyV1=(journalEncounterId,difficultyId,fingerprint)=>`knowledge/official-encounters/blizzard/${positive(journalEncounterId,'journalEncounterId')}/difficulty/d${positive(difficultyId,'difficultyId')}/revisions/${fp(fingerprint)}.json`;

export async function persistOfficialEncounterDifficultyViewV1(view,{fetchedAt=Date.now(),storageGet=corpusGet,storageSet=corpusSet}={}){
  const journalEncounterId=positive(view?.encounter?.journalEncounterId,'journalEncounterId'),difficultyId=positive(view?.difficulty?.id,'difficultyId'),fingerprint=fp(view?.fingerprint);
  if(view?.version!==OFFICIAL_ENCOUNTER_DIFFICULTY_VERSION)throw new Error(`difficulty view version ${view?.version||'missing'} is not current ${OFFICIAL_ENCOUNTER_DIFFICULTY_VERSION}`);
  const latestKey=officialEncounterDifficultyLatestKeyV1(journalEncounterId,difficultyId),revisionKey=officialEncounterDifficultyRevisionKeyV1(journalEncounterId,difficultyId,fingerprint),previous=await storageGet(latestKey).catch(()=>null);
  const stored={...view,storage:{version:OFFICIAL_ENCOUNTER_DIFFICULTY_STORE_VERSION,fetchedAt:Number(fetchedAt)||Date.now(),latestKey,revisionKey,previousFingerprint:previous?.fingerprint||null,changedFromPrevious:Boolean(previous?.fingerprint&&previous.fingerprint!==fingerprint)}};
  await storageSet(revisionKey,stored);await storageSet(latestKey,stored);return stored;
}
export async function loadLatestOfficialEncounterDifficultyViewV1(journalEncounterId,difficultyId,{storageGet=corpusGet}={}){const value=await storageGet(officialEncounterDifficultyLatestKeyV1(journalEncounterId,difficultyId));return value?.version===OFFICIAL_ENCOUNTER_DIFFICULTY_VERSION?value:null;}
