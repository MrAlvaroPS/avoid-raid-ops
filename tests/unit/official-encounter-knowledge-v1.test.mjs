import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOfficialEncounterKnowledgePreviewV1,compileOfficialEncounterGraphV1,officialEncounterMembershipForAbilityV1,resolveOfficialEncounterKnowledgeV1 } from '../../server/knowledge/official-encounter-knowledge-v1.mjs';
import { fetchBlizzardSpellV1,resetBlizzardTokenCacheV1 } from '../../server/knowledge/providers/blizzard-game-data-v1.mjs';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

const syntheticJournal={
  id:9001,
  name:{en_US:'Synthetic Boss'},
  instance:{id:8001,name:{en_US:'Synthetic Raid'}},
  category:{type:'RAID'},
  modes:[{type:'MYTHIC',name:{en_US:'Mythic'}}],
  creatures:[{id:6001,name:{en_US:'Synthetic Boss'},creature_display:{id:5001}}],
  sections:[
    {id:100,title:{en_US:'Overview'},body_text:{en_US:'Official overview text.'}},
    {id:200,title:{en_US:'Stage One'},creature_display:{id:5001},sections:[
      {id:210,title:{en_US:'Primary Mechanic'},spell:{id:700001,name:{en_US:'Primary Mechanic'}},sections:[
        {id:211,title:{en_US:'Player State'},spell:{id:700002,name:{en_US:'Player State'}}},
      ]},
      {id:220,title:{en_US:'Branch A'},sections:[{id:221,title:{en_US:'Shared Spell A'},spell:{id:700003,name:{en_US:'Shared Spell'}}}]},
      {id:230,title:{en_US:'Branch B'},sections:[{id:231,title:{en_US:'Shared Spell B'},spell:{id:700003,name:{en_US:'Shared Spell'}}}]},
    ]},
  ],
};

test('official encounter graph preserves hierarchy, semantics and multi-parent spell membership',()=>{
  const graph=compileOfficialEncounterGraphV1({journal:syntheticJournal,locale:'en_US',namespace:'static-12.1.0_99999-eu',wclEncounterId:4321,sourceEndpoint:'https://example.test/journal/9001'});
  assert.equal(graph.encounter.journalEncounterId,9001);
  assert.equal(graph.encounter.wclEncounterId,4321);
  assert.equal(graph.encounter.name,'Synthetic Boss');
  assert.equal(graph.source.namespace,'static-12.1.0_99999-eu');
  assert.equal(graph.graph.spellCount,3);
  assert.equal(graph.graph.officialMembershipEdges,4);
  assert.equal(graph.sections.find(row=>row.sectionId===200).structuralRole,'stage');
  assert.equal(graph.sections.find(row=>row.sectionId===210).structuralRole,'mechanic');
  assert.equal(graph.sections.find(row=>row.sectionId===211).structuralRole,'submechanic');
  assert.equal(graph.sections.find(row=>row.sectionId===100).bodyText,'Official overview text.');

  const primary=officialEncounterMembershipForAbilityV1(graph,700002);
  assert.equal(primary.officialEncounterAssociation,true);
  assert.deepEqual(primary.memberships[0].path,['Stage One','Primary Mechanic','Player State']);

  const shared=officialEncounterMembershipForAbilityV1(graph,700003);
  assert.equal(shared.memberships.length,2);
  assert.deepEqual(shared.memberships.map(row=>row.path.at(-1)).sort(),['Shared Spell A','Shared Spell B']);
  assert.equal(graph.evidenceContract.observedOccurrence,false);
  assert.equal(graph.evidenceContract.causalCombatEvidence,false);
  assert.equal(graph.evidenceContract.automaticPromotion,false);
});

test('preview is zero-network and fingerprints exact official encounter request',()=>{
  const a=buildOfficialEncounterKnowledgePreviewV1({encounterName:'Synthetic Boss',wclEncounterId:4321,region:'eu',locale:'en_US'});
  const b=buildOfficialEncounterKnowledgePreviewV1({encounterName:'Synthetic Boss',wclEncounterId:4321,region:'eu',locale:'en_US'});
  assert.equal(a.fingerprint,b.fingerprint);
  assert.equal(a.networkUpperBound.wclCalls,0);
  assert.equal(a.networkUpperBound.thirdPartyCalls,0);
  assert.equal(a.networkUpperBound.blizzardGameDataCalls,2);
  assert.equal(a.safety.automaticPromotion,false);
});

test('resolver uses official search href/build and does not spend WCL',async()=>{
  resetBlizzardTokenCacheV1();
  const calls=[];
  const href='https://eu.api.blizzard.com/data/wow/journal-encounter/9001?namespace=static-12.1.0_99999-eu';
  const fetcher=async (url,options={})=>{
    calls.push({url:String(url),method:options.method||'GET'});
    if(String(url)==='https://oauth.battle.net/token')return json({access_token:'test-token',token_type:'bearer',expires_in:86399});
    if(String(url).includes('/data/wow/search/journal-encounter'))return json({results:[{key:{href},data:{id:9001,name:{en_US:'Synthetic Boss'},instance:{id:8001,name:{en_US:'Synthetic Raid'}}}}]});
    if(String(url).startsWith(href))return json(syntheticJournal);
    throw new Error(`Unexpected URL ${url}`);
  };
  const result=await resolveOfficialEncounterKnowledgeV1({encounterName:'Synthetic Boss',wclEncounterId:4321,region:'eu',locale:'en_US'},{fetcher,clientId:'id',clientSecret:'secret'});
  assert.equal(result.source.namespace,'static-12.1.0_99999-eu');
  assert.equal(result.usage.oauthCalls,1);
  assert.equal(result.usage.blizzardGameDataCalls,2);
  assert.equal(result.usage.wclCalls,0);
  assert.equal(result.resolved.matchedBy,'encounter-name');
  assert.ok(calls.some(row=>row.url===href));
});

test('Blizzard spell 403 is provider-unavailable state, never negative spell evidence',async()=>{
  const row=await fetchBlizzardSpellV1(700001,{accessToken:'token',region:'eu',locale:'en_US',fetcher:async()=>json({code:403,detail:'Forbidden'},403)});
  assert.equal(row.status,'provider-forbidden-or-unavailable');
  assert.equal(row.negativeEvidence,false);
  assert.equal(row.httpStatus,403);
});
