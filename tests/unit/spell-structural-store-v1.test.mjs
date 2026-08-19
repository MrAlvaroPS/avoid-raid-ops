import test from 'node:test';
import assert from 'node:assert/strict';
import { persistSpellStructuralKnowledgeV1,loadLatestSpellStructuralKnowledgeV1,loadSpellStructuralKnowledgeRevisionV1 } from '../../server/knowledge/spell-structural-store-v1.mjs';

function relation(sourceAbilityId,targetAbilityId,rowId,build){
  return{
    provider:'wago-db2',
    retrievalMode:'build-pinned-filtered-csv',
    providerBuild:build,
    providerTable:'SpellEffect',
    providerRowId:rowId,
    sourceUrl:`https://wago.tools/db2/SpellEffect/csv?build=${build}&filter%5BSpellID%5D=${sourceAbilityId}`,
    sourceAbilityId,
    targetAbilityId,
    relationKind:'trigger-spell',
    relationLabel:'SpellEffect.EffectTriggerSpell',
    sourceEncounterAssociation:{status:'unknown',encounterId:9901,basis:'test'},
    officialContext:{status:'official-context-unresolved',negativeEvidence:false,promotionEffect:'none'},
    structuralEvidence:{effectIndex:0,effect:64},
  };
}

function requestValue({fingerprint,build,seedAbilityIds,relations,queryValue}){
  return{
    version:'spell-structural-knowledge-v1',
    fingerprint,
    previewFingerprint:fingerprint,
    scope:{wclEncounterId:9901},
    provider:{id:'wago-db2',build,table:'SpellEffect',retrievalMode:'build-pinned-filtered-csv',officialBlizzardApi:false},
    officialGraph:{journalEncounterId:8801,fingerprint:'f'.repeat(40),namespace:`static-${build.replace(/\.(\d+)$/, '_$1')}-eu`,build},
    seedAbilityIds,
    directions:'both',
    relations,
    usage:{wagoCalls:1,wagoCallsSucceeded:1,wagoCallsFailed:0,partial:false,blizzardCalls:0,wclCalls:0,queries:[{field:'SpellID',value:queryValue,status:'resolved',matchedRows:relations.length,serverFilterVerified:true}]},
    coverage:{requestedCalls:1,successfulCalls:1,failedCalls:0,partial:false,failedQueries:[]},
    summary:{relations:relations.length},
    evidenceContract:{observedCombat:false,automaticPromotion:false},
  };
}

function memoryStorage(){
  const values=new Map();
  return{
    values,
    storageGet:async key=>values.get(String(key))??null,
    storageSet:async(key,value)=>{values.set(String(key),value);},
  };
}

test('spell structural latest accumulates same-build knowledge but resets cleanly on a new Blizzard build',async()=>{
  const storage=memoryStorage();
  const options={storageGet:storage.storageGet,storageSet:storage.storageSet};
  const buildA='12.1.0.68914';
  const firstRequest=requestValue({fingerprint:'a'.repeat(40),build:buildA,seedAbilityIds:[700001],relations:[relation(700001,700002,1,buildA)],queryValue:700001});
  const first=await persistSpellStructuralKnowledgeV1(firstRequest,{...options,fetchedAt:1000});
  assert.equal(first.aggregation.requestCount,1);
  assert.equal(first.aggregation.relationCount,1);
  assert.deepEqual(first.seedAbilityIds,[700001]);
  assert.equal(first.storage.resetForNewBuild,false);

  const secondRequest=requestValue({fingerprint:'b'.repeat(40),build:buildA,seedAbilityIds:[700003],relations:[relation(700003,700004,2,buildA)],queryValue:700003});
  const second=await persistSpellStructuralKnowledgeV1(secondRequest,{...options,fetchedAt:2000});
  assert.equal(second.aggregation.requestCount,2);
  assert.equal(second.aggregation.relationCount,2);
  assert.deepEqual(second.seedAbilityIds,[700001,700003]);
  assert.deepEqual(second.relations.map(row=>[row.sourceAbilityId,row.targetAbilityId]),[[700001,700002],[700003,700004]]);
  assert.equal(second.storage.buildChangedFromPrevious,false);
  assert.equal(second.storage.resetForNewBuild,false);

  const exactFirst=await loadSpellStructuralKnowledgeRevisionV1(9901,buildA,'a'.repeat(40),{storageGet:storage.storageGet});
  assert.equal(exactFirst.storage.kind,'request-revision');
  assert.equal(exactFirst.relations.length,1,'immutable request revision must not be rewritten by later accumulation');

  const buildB='12.1.0.70000';
  const thirdRequest=requestValue({fingerprint:'c'.repeat(40),build:buildB,seedAbilityIds:[800001],relations:[relation(800001,800002,3,buildB)],queryValue:800001});
  const third=await persistSpellStructuralKnowledgeV1(thirdRequest,{...options,fetchedAt:3000});
  assert.equal(third.storage.buildChangedFromPrevious,true);
  assert.equal(third.storage.resetForNewBuild,true);
  assert.equal(third.aggregation.requestCount,1);
  assert.equal(third.aggregation.relationCount,1);
  assert.deepEqual(third.seedAbilityIds,[800001]);
  assert.deepEqual(third.relations.map(row=>[row.sourceAbilityId,row.targetAbilityId]),[[800001,800002]]);

  const latest=await loadLatestSpellStructuralKnowledgeV1(9901,{storageGet:storage.storageGet});
  assert.equal(latest.provider.build,buildB);
  assert.equal(latest.relations.length,1);

  assert.ok([...storage.values.keys()].some(key=>key.includes('/revisions/')),'test should verify immutable revision writes without external storage');
});
