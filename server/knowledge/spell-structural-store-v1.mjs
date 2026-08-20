import { createHash } from 'node:crypto';
import { corpusGet,corpusSet } from '../corpus/storage.mjs';
import { buildSpellRelationGraphV1 } from './spell-relation-graph-v1.mjs';

export const SPELL_STRUCTURAL_STORE_VERSION='spell-structural-store-v2';
export const SPELL_STRUCTURAL_REQUEST_HISTORY_LIMIT=50;

const positiveId=(value,label)=>{const n=Number(value);if(!Number.isInteger(n)||n<=0)throw new Error(`${label} must be a positive integer`);return n;};
const safeBuild=value=>{const text=String(value||'').trim();if(!/^\d+\.\d+\.\d+\.\d+$/.test(text))throw new Error('spell structural build is invalid');return text;};
const safeFingerprint=value=>{const text=String(value||'').trim();if(!/^[a-f0-9]{40}$/i.test(text))throw new Error('spell structural fingerprint is invalid');return text.toLowerCase();};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=value=>createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');

export const spellStructuralLatestKeyV1=wclEncounterId=>`knowledge/spell-structure/wago/by-wcl/${positiveId(wclEncounterId,'wclEncounterId')}/latest.json`;
export const spellStructuralRevisionKeyV1=(wclEncounterId,build,fingerprint)=>`knowledge/spell-structure/wago/by-wcl/${positiveId(wclEncounterId,'wclEncounterId')}/builds/${safeBuild(build)}/revisions/${safeFingerprint(fingerprint)}.json`;
export const spellStructuralAggregateRevisionKeyV1=(wclEncounterId,build,fingerprint)=>`knowledge/spell-structure/wago/by-wcl/${positiveId(wclEncounterId,'wclEncounterId')}/builds/${safeBuild(build)}/aggregate-revisions/${safeFingerprint(fingerprint)}.json`;

function relationKey(row={}){
  return [
    row.provider||'wago-db2',
    row.providerBuild||'',
    row.providerTable||'',
    row.providerRowId??'',
    row.sourceAbilityId??'',
    row.relationKind||'',
    row.targetAbilityId??'',
    row.structuralEvidence?.effectIndex??'',
  ].join('|');
}

function mergeRelations(previous=[],current=[]){
  const map=new Map();
  for(const row of [...previous,...current]){
    const key=relationKey(row);
    if(!map.has(key))map.set(key,row);
    else map.set(key,{...map.get(key),...row});
  }
  return [...map.values()].sort((a,b)=>Number(a.sourceAbilityId)-Number(b.sourceAbilityId)||Number(a.targetAbilityId)-Number(b.targetAbilityId)||String(a.relationKind||'').localeCompare(String(b.relationKind||''))||Number(a.providerRowId||0)-Number(b.providerRowId||0));
}

function queryKey(row={}){return`${row.field||''}|${Number(row.value)||0}`;}

function mergeQueryCoverage(previous={},queries=[]){
  const out={...previous};
  for(const row of queries||[]){
    const key=queryKey(row);if(key==='|0')continue;
    const previousRow=out[key]||null;
    const next={
      field:row.field||null,
      value:Number(row.value)||null,
      status:row.status||'unknown',
      matchedRows:Number.isFinite(Number(row.matchedRows))?Number(row.matchedRows):null,
      serverFilterVerified:row.serverFilterVerified===true,
      error:row.error||null,
      negativeEvidence:false,
    };
    // A later failure must not erase a previously successful coverage proof for the same build/query.
    out[key]=previousRow?.status==='resolved'&&next.status!=='resolved'?previousRow:next;
  }
  return Object.fromEntries(Object.entries(out).sort(([a],[b])=>a.localeCompare(b)));
}

function summarizeRelations(relations=[]){
  return{
    relations:relations.length,
    officialToOfficial:relations.filter(row=>row.officialContext?.status==='official-to-official-structural-link').length,
    unlistedSourceToOfficial:relations.filter(row=>row.officialContext?.status==='unlisted-source-to-official-target').length,
    officialSourceToUnlisted:relations.filter(row=>row.officialContext?.status==='official-source-to-unlisted-target').length,
    unresolved:relations.filter(row=>row.officialContext?.status==='official-context-unresolved').length,
  };
}

function aggregateGraph(value,seedAbilityIds,relations){
  return buildSpellRelationGraphV1({
    scope:{encounterId:value?.scope?.wclEncounterId??value?.scope?.encounterId,stateScope:'global'},
    seedAbilityIds,
    observations:relations,
    actorProvenance:[],
  });
}

export async function persistSpellStructuralKnowledgeV1(value,{fetchedAt=Date.now(),storageGet=corpusGet,storageSet=corpusSet}={}){
  const wclEncounterId=positiveId(value?.scope?.wclEncounterId??value?.scope?.encounterId,'wclEncounterId');
  const build=safeBuild(value?.provider?.build);
  const requestFingerprint=safeFingerprint(value?.fingerprint??value?.graph?.graphFingerprint);
  const latestKey=spellStructuralLatestKeyV1(wclEncounterId);
  const requestRevisionKey=spellStructuralRevisionKeyV1(wclEncounterId,build,requestFingerprint);
  const previous=await storageGet(latestKey).catch(()=>null);
  const sameBuild=previous?.provider?.build===build;
  const fetchedAtMs=Number(fetchedAt)||Date.now();

  const requestRevision={
    ...value,
    fingerprint:requestFingerprint,
    storage:{
      version:SPELL_STRUCTURAL_STORE_VERSION,
      kind:'request-revision',
      fetchedAt:fetchedAtMs,
      revisionKey:requestRevisionKey,
      latestKey,
      rawCsvPersisted:false,
    },
  };
  await storageSet(requestRevisionKey,requestRevision);

  const seedAbilityIds=[...new Set([...(sameBuild?previous?.seedAbilityIds||[]:[]),...(value?.seedAbilityIds||[])].map(Number).filter(id=>Number.isInteger(id)&&id>0))].sort((a,b)=>a-b);
  const relations=mergeRelations(sameBuild?previous?.relations||[]:[],value?.relations||[]);
  const queryCoverage=mergeQueryCoverage(sameBuild?previous?.aggregation?.queryCoverage||{}:{},value?.usage?.queries||[]);
  const requestHistory=[...(sameBuild?previous?.aggregation?.requestHistory||[]:[]),{
    requestFingerprint,
    previewFingerprint:value?.previewFingerprint||null,
    fetchedAt:fetchedAtMs,
    seedAbilityIds:[...(value?.seedAbilityIds||[])],
    directions:value?.directions||'both',
    requestedCalls:Number(value?.coverage?.requestedCalls??value?.usage?.wagoCalls??0),
    successfulCalls:Number(value?.coverage?.successfulCalls??value?.usage?.wagoCallsSucceeded??0),
    failedCalls:Number(value?.coverage?.failedCalls??value?.usage?.wagoCallsFailed??0),
    partial:Boolean(value?.coverage?.partial??value?.usage?.partial),
    requestRevisionKey,
  }].slice(-SPELL_STRUCTURAL_REQUEST_HISTORY_LIMIT);

  const graph=aggregateGraph(value,seedAbilityIds,relations);
  const coverageEntries=Object.values(queryCoverage);
  const aggregateCoverage={
    queryCount:coverageEntries.length,
    resolvedQueries:coverageEntries.filter(row=>row.status==='resolved').length,
    unresolvedQueries:coverageEntries.filter(row=>row.status!=='resolved').length,
    complete:coverageEntries.length>0&&coverageEntries.every(row=>row.status==='resolved'),
    queryCoverage,
  };
  const aggregateFingerprint=digest({
    version:SPELL_STRUCTURAL_STORE_VERSION,
    wclEncounterId,
    build,
    officialGraphFingerprint:value?.officialGraph?.fingerprint||null,
    seedAbilityIds,
    relations:relations.map(row=>({
      key:relationKey(row),
      sourceAbilityId:row.sourceAbilityId,
      targetAbilityId:row.targetAbilityId,
      relationKind:row.relationKind,
      providerRowId:row.providerRowId??null,
      structuralEvidence:row.structuralEvidence||null,
      officialContext:row.officialContext?.status||null,
    })),
    queryCoverage,
  });
  const aggregateRevisionKey=spellStructuralAggregateRevisionKeyV1(wclEncounterId,build,aggregateFingerprint);
  const stored={
    ...value,
    fingerprint:aggregateFingerprint,
    requestFingerprint,
    seedAbilityIds,
    relations,
    graph,
    coverage:aggregateCoverage,
    summary:summarizeRelations(relations),
    aggregation:{
      accumulatedWithinBuild:true,
      build,
      requestCount:requestHistory.length,
      relationCount:relations.length,
      seedAbilityCount:seedAbilityIds.length,
      queryCoverage,
      requestHistory,
    },
    storage:{
      version:SPELL_STRUCTURAL_STORE_VERSION,
      kind:'aggregate-latest',
      fetchedAt:fetchedAtMs,
      latestKey,
      requestRevisionKey,
      aggregateRevisionKey,
      previousFingerprint:previous?.fingerprint||null,
      previousBuild:previous?.provider?.build||null,
      changedFromPrevious:Boolean(previous?.fingerprint&&previous.fingerprint!==aggregateFingerprint),
      buildChangedFromPrevious:Boolean(previous?.provider?.build&&previous.provider.build!==build),
      resetForNewBuild:Boolean(previous?.provider?.build&&previous.provider.build!==build),
      rawCsvPersisted:false,
    },
  };
  await storageSet(aggregateRevisionKey,stored);
  await storageSet(latestKey,stored);
  return stored;
}

export async function loadLatestSpellStructuralKnowledgeV1(wclEncounterId,{storageGet=corpusGet}={}){
  return storageGet(spellStructuralLatestKeyV1(wclEncounterId));
}

export async function loadSpellStructuralKnowledgeRevisionV1(wclEncounterId,build,fingerprint,{storageGet=corpusGet}={}){
  return storageGet(spellStructuralRevisionKeyV1(wclEncounterId,build,fingerprint));
}

export async function loadSpellStructuralAggregateRevisionV1(wclEncounterId,build,fingerprint,{storageGet=corpusGet}={}){
  return storageGet(spellStructuralAggregateRevisionKeyV1(wclEncounterId,build,fingerprint));
}
