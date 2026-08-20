import { corpusGet,corpusSet } from '../corpus/storage.mjs';

export const RAID_LEARNING_PLAN_STORE_VERSION='raid-learning-plan-store-v1';
const safe=value=>String(value||'unknown').replace(/[^a-z0-9_-]/gi,'_');
const positive=(value,label)=>{const n=Number(value);if(!Number.isInteger(n)||n<=0)throw new Error(`${label} must be a positive integer`);return n;};
export const raidLearningLatestKeyV1=catalogFingerprint=>`knowledge/raid-learning/${safe(catalogFingerprint)}/latest.json`;
export const raidLearningRevisionKeyV1=(catalogFingerprint,fingerprint)=>`knowledge/raid-learning/${safe(catalogFingerprint)}/revisions/${safe(fingerprint)}.json`;
export const raidLearningScopeKeyV1=(wclEncounterId,difficultyId)=>`knowledge/raid-learning/by-wcl/${positive(wclEncounterId,'wclEncounterId')}/d${positive(difficultyId,'difficultyId')}.json`;

export async function persistRaidLearningPlanV1(plan,{fetchedAt=Date.now(),storageGet=corpusGet,storageSet=corpusSet}={}){
  const catalogFingerprint=String(plan?.catalogFingerprint||'').trim(),fingerprint=String(plan?.fingerprint||'').trim();if(!catalogFingerprint||!fingerprint)throw new Error('raid learning plan fingerprints are required');
  const latestKey=raidLearningLatestKeyV1(catalogFingerprint),revisionKey=raidLearningRevisionKeyV1(catalogFingerprint,fingerprint),previous=await storageGet(latestKey).catch(()=>null);
  const stored={...plan,storage:{version:RAID_LEARNING_PLAN_STORE_VERSION,fetchedAt:Number(fetchedAt)||Date.now(),latestKey,revisionKey,previousFingerprint:previous?.fingerprint||null,changedFromPrevious:Boolean(previous?.fingerprint&&previous.fingerprint!==fingerprint)}};
  await storageSet(revisionKey,stored);await storageSet(latestKey,stored);
  for(const scope of stored.scopes||[])if(scope.wclEncounterId&&scope.difficulty?.id)await storageSet(raidLearningScopeKeyV1(scope.wclEncounterId,scope.difficulty.id),{version:RAID_LEARNING_PLAN_STORE_VERSION,updatedAt:stored.storage.fetchedAt,planFingerprint:stored.fingerprint,catalogFingerprint,scope});
  return stored;
}
export async function loadLatestRaidLearningPlanV1(catalogFingerprint,{storageGet=corpusGet}={}){return storageGet(raidLearningLatestKeyV1(catalogFingerprint));}
export async function loadRaidLearningScopeV1(wclEncounterId,difficultyId,{storageGet=corpusGet}={}){return storageGet(raidLearningScopeKeyV1(wclEncounterId,difficultyId));}
