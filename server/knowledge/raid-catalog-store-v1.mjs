import { corpusGet,corpusSet } from '../corpus/storage.mjs';

export const RAID_CATALOG_STORE_VERSION='raid-catalog-store-v1';
export const raidCatalogLatestKeyV1=()=>`knowledge/raid-catalog/wcl/latest.json`;
export const raidCatalogRevisionKeyV1=fingerprint=>`knowledge/raid-catalog/wcl/revisions/${String(fingerprint)}.json`;

export async function persistRaidCatalogV1(catalog,{fetchedAt=Date.now(),storageGet=corpusGet,storageSet=corpusSet}={}){
  if(!catalog?.fingerprint)throw new Error('raid catalog fingerprint is required');
  const latestKey=raidCatalogLatestKeyV1(),revisionKey=raidCatalogRevisionKeyV1(catalog.fingerprint);
  const previous=await storageGet(latestKey).catch(()=>null);
  const stored={...catalog,storage:{version:RAID_CATALOG_STORE_VERSION,fetchedAt:Number(fetchedAt)||Date.now(),latestKey,revisionKey,previousFingerprint:previous?.fingerprint||null,changedFromPrevious:Boolean(previous?.fingerprint&&previous.fingerprint!==catalog.fingerprint)}};
  await storageSet(revisionKey,stored);await storageSet(latestKey,stored);return stored;
}

export async function loadLatestRaidCatalogV1({storageGet=corpusGet}={}){return storageGet(raidCatalogLatestKeyV1());}
