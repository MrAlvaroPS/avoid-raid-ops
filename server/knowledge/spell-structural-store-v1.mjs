import { corpusGet,corpusSet } from '../corpus/storage.mjs';

export const SPELL_STRUCTURAL_STORE_VERSION='spell-structural-store-v1';

const positiveId=(value,label)=>{const n=Number(value);if(!Number.isInteger(n)||n<=0)throw new Error(`${label} must be a positive integer`);return n;};
const safeBuild=value=>{const text=String(value||'').trim();if(!/^\d+\.\d+\.\d+\.\d+$/.test(text))throw new Error('spell structural build is invalid');return text;};
const safeFingerprint=value=>{const text=String(value||'').trim();if(!/^[a-f0-9]{40}$/i.test(text))throw new Error('spell structural fingerprint is invalid');return text.toLowerCase();};

export const spellStructuralLatestKeyV1=wclEncounterId=>`knowledge/spell-structure/wago/by-wcl/${positiveId(wclEncounterId,'wclEncounterId')}/latest.json`;
export const spellStructuralRevisionKeyV1=(wclEncounterId,build,fingerprint)=>`knowledge/spell-structure/wago/by-wcl/${positiveId(wclEncounterId,'wclEncounterId')}/builds/${safeBuild(build)}/revisions/${safeFingerprint(fingerprint)}.json`;

export async function persistSpellStructuralKnowledgeV1(value,{fetchedAt=Date.now()}={}){
  const wclEncounterId=positiveId(value?.scope?.wclEncounterId??value?.scope?.encounterId,'wclEncounterId');
  const build=safeBuild(value?.provider?.build);
  const fingerprint=safeFingerprint(value?.fingerprint??value?.graph?.graphFingerprint);
  const latestKey=spellStructuralLatestKeyV1(wclEncounterId);
  const revisionKey=spellStructuralRevisionKeyV1(wclEncounterId,build,fingerprint);
  const previous=await corpusGet(latestKey).catch(()=>null);
  const stored={
    ...value,
    storage:{
      version:SPELL_STRUCTURAL_STORE_VERSION,
      fetchedAt:Number(fetchedAt)||Date.now(),
      latestKey,
      revisionKey,
      previousFingerprint:previous?.fingerprint||null,
      previousBuild:previous?.provider?.build||null,
      changedFromPrevious:Boolean(previous?.fingerprint&&previous.fingerprint!==fingerprint),
      buildChangedFromPrevious:Boolean(previous?.provider?.build&&previous.provider.build!==build),
    },
  };
  await corpusSet(revisionKey,stored);
  await corpusSet(latestKey,stored);
  return stored;
}

export async function loadLatestSpellStructuralKnowledgeV1(wclEncounterId){
  return corpusGet(spellStructuralLatestKeyV1(wclEncounterId));
}

export async function loadSpellStructuralKnowledgeRevisionV1(wclEncounterId,build,fingerprint){
  return corpusGet(spellStructuralRevisionKeyV1(wclEncounterId,build,fingerprint));
}
