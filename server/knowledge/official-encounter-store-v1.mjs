import { corpusGet,corpusSet } from '../corpus/storage.mjs';

export const OFFICIAL_ENCOUNTER_STORE_VERSION='official-encounter-store-v1';

const positiveId=(value,label)=>{const n=Number(value);if(!Number.isInteger(n)||n<=0)throw new Error(`${label} must be a positive integer`);return n;};
const optionalPositiveId=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
const safeFingerprint=value=>{const text=String(value||'').trim();if(!/^[a-f0-9]{40}$/i.test(text))throw new Error('official encounter fingerprint is invalid');return text.toLowerCase();};

export const officialEncounterLatestKeyV1=journalEncounterId=>`knowledge/official-encounters/blizzard/${positiveId(journalEncounterId,'journalEncounterId')}/latest.json`;
export const officialEncounterRevisionKeyV1=(journalEncounterId,fingerprint)=>`knowledge/official-encounters/blizzard/${positiveId(journalEncounterId,'journalEncounterId')}/revisions/${safeFingerprint(fingerprint)}.json`;
export const officialEncounterWclAliasKeyV1=wclEncounterId=>`knowledge/official-encounters/blizzard/by-wcl/${positiveId(wclEncounterId,'wclEncounterId')}.json`;

export async function persistOfficialEncounterGraphV1(graph,{fetchedAt=Date.now()}={}){
  const journalEncounterId=positiveId(graph?.encounter?.journalEncounterId,'journalEncounterId');
  const wclEncounterId=optionalPositiveId(graph?.encounter?.wclEncounterId);
  const fingerprint=safeFingerprint(graph?.fingerprint);
  const revisionKey=officialEncounterRevisionKeyV1(journalEncounterId,fingerprint);
  const latestKey=officialEncounterLatestKeyV1(journalEncounterId);
  const previous=await corpusGet(latestKey).catch(()=>null);
  const stored={...graph,storage:{version:OFFICIAL_ENCOUNTER_STORE_VERSION,fetchedAt:Number(fetchedAt)||Date.now(),revisionKey,latestKey,wclAliasKey:wclEncounterId?officialEncounterWclAliasKeyV1(wclEncounterId):null,previousFingerprint:previous?.fingerprint||null,changedFromPrevious:Boolean(previous?.fingerprint&&previous.fingerprint!==fingerprint)}};
  await corpusSet(revisionKey,stored);
  await corpusSet(latestKey,stored);
  if(wclEncounterId){
    await corpusSet(officialEncounterWclAliasKeyV1(wclEncounterId),{
      version:OFFICIAL_ENCOUNTER_STORE_VERSION,
      provider:'blizzard-game-data',
      wclEncounterId,
      journalEncounterId,
      fingerprint,
      latestKey,
      revisionKey,
      updatedAt:stored.storage.fetchedAt,
    });
  }
  return stored;
}

export async function loadLatestOfficialEncounterGraphV1(journalEncounterId){
  return corpusGet(officialEncounterLatestKeyV1(journalEncounterId));
}

export async function loadLatestOfficialEncounterGraphByWclIdV1(wclEncounterId){
  const alias=await corpusGet(officialEncounterWclAliasKeyV1(wclEncounterId));
  if(!alias?.journalEncounterId)return null;
  const graph=await loadLatestOfficialEncounterGraphV1(alias.journalEncounterId);
  return graph?{...graph,resolvedAlias:alias}:null;
}

export async function loadOfficialEncounterGraphRevisionV1(journalEncounterId,fingerprint){
  return corpusGet(officialEncounterRevisionKeyV1(journalEncounterId,fingerprint));
}
