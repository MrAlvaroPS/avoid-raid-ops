import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveOfficialEncounterKnowledgeV1 } from '../../server/knowledge/official-encounter-knowledge-v1.mjs';
import { loadLatestOfficialEncounterGraphByWclIdV1 } from '../../server/knowledge/official-encounter-store-v1.mjs';
import { resolveAbilityKnowledgeV1 } from '../../server/knowledge/ability-knowledge-v1.mjs';
import { resetBlizzardTokenCacheV1 } from '../../server/knowledge/providers/blizzard-game-data-v1.mjs';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

const journal={
  id:6100,
  name:{en_US:'Persisted Encounter'},
  instance:{id:6200,name:{en_US:'Persisted Raid'}},
  sections:[
    {id:1,title:{en_US:'Stage One'},creature_display:{id:99},sections:[
      {id:2,title:{en_US:'Mechanic A'},spell:{id:810001,name:{en_US:'Mechanic A'}},sections:[
        {id:3,title:{en_US:'State A'},spell:{id:810002,name:{en_US:'State A'}}},
      ]},
    ]},
  ],
};

test('resolved Blizzard graph persists by WCL alias and feeds Ability Knowledge with zero provider/WCL calls',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'avoid-official-flow-'));
  const previous=process.env.IRIS_DATA_DIR;
  process.env.IRIS_DATA_DIR=dir;
  resetBlizzardTokenCacheV1();
  let providerCalls=0;
  try{
    const href='https://eu.api.blizzard.com/data/wow/journal-encounter/6100?namespace=static-test-eu';
    const fetcher=async url=>{
      providerCalls++;
      const text=String(url);
      if(text==='https://oauth.battle.net/token')return json({access_token:'test-token',token_type:'bearer',expires_in:86399});
      if(text.includes('/data/wow/search/journal-encounter'))return json({results:[{key:{href},data:{id:6100,name:{en_US:'Persisted Encounter'},instance:{id:6200,name:{en_US:'Persisted Raid'}}}}]});
      if(text.startsWith(href))return json(journal);
      throw new Error(`Unexpected provider URL: ${text}`);
    };

    const resolved=await resolveOfficialEncounterKnowledgeV1({encounterName:'Persisted Encounter',wclEncounterId:7100,region:'eu',locale:'en_US'},{fetcher,clientId:'id',clientSecret:'secret'});
    assert.equal(resolved.encounter.wclEncounterId,7100);
    assert.equal(resolved.storage.changedFromPrevious,false);

    const stored=await loadLatestOfficialEncounterGraphByWclIdV1(7100);
    assert.equal(stored.fingerprint,resolved.fingerprint);
    assert.equal(stored.resolvedAlias.wclEncounterId,7100);

    const callsAfterPersist=providerCalls;
    const knowledge=await resolveAbilityKnowledgeV1({encounterId:7100,abilityIds:[810002,899999],providers:{lorrgs:false,parseWowhead:false,wcl:false}},{fetcher:async()=>{throw new Error('Ability Knowledge must not call network providers in this test');}});
    assert.equal(providerCalls,callsAfterPersist);
    assert.equal(knowledge.usage.officialJournalReadsAttempted,1);
    assert.equal(knowledge.usage.officialJournalCacheHit,true);
    assert.equal(knowledge.usage.lorrgsCallsAttempted,0);
    assert.equal(knowledge.usage.wclCallsAttempted,0);

    const official=knowledge.abilities.find(row=>row.abilityId===810002);
    assert.equal(official.semanticClass,'official-encounter-ability');
    assert.equal(official.providerSignals.blizzardJournal.status,'resolved');
    assert.deepEqual(official.providerSignals.blizzardJournal.memberships[0].path,['Stage One','Mechanic A','State A']);
    assert.equal(official.interpretation.canonicalCombatEvidence,false);
    assert.equal(official.interpretation.automaticPromotion,false);

    const missing=knowledge.abilities.find(row=>row.abilityId===899999);
    assert.equal(missing.providerSignals.blizzardJournal.status,'not-listed-in-journal');
    assert.equal(missing.providerSignals.blizzardJournal.negativeEvidence,false);
  }finally{
    if(previous===undefined)delete process.env.IRIS_DATA_DIR;else process.env.IRIS_DATA_DIR=previous;
    await rm(dir,{recursive:true,force:true});
    resetBlizzardTokenCacheV1();
  }
});
