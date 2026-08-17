import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAbilityKnowledgeV1 } from '../../server/knowledge/ability-knowledge-v1.mjs';

const jsonResponse=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

test('successful keyed Lorrgs boss catalogue distinguishes tracked marker from weak absence',async()=>{
  const calls=[];
  const fetcher=async url=>{
    calls.push(String(url));
    if(String(url).endsWith('/bosses/synthetic-boss/spells')){
      return jsonResponse({
        '700001':{spell_id:700001,name:'Synthetic Boss Cast',spell_type:'synthetic-boss',show:true,duration:6,color:'rgb(1, 2, 3)'},
      });
    }
    if(String(url).endsWith('/spells/700002')){
      return jsonResponse({detail:'Spell not found.'},404);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result=await resolveAbilityKnowledgeV1({
    abilityIds:[700001,700002],
    encounterId:9876,
    bossSlug:'synthetic-boss',
    providers:{lorrgs:true,parseWowhead:false,wcl:false},
  },{fetcher});

  assert.equal(result.providers.lorrgs.bossCatalogResolved,true);
  assert.equal(result.providers.lorrgs.catalogSemantics,'curated-boss-timeline-markers-not-exhaustive');
  assert.equal(result.usage.lorrgsBossCatalogResolved,true);
  assert.equal(result.usage.lorrgsCallsAttempted,2);
  assert.equal(result.usage.lorrgsCallsSucceeded,1);

  const listed=result.abilities.find(row=>row.abilityId===700001);
  assert.equal(listed.encounterAssociation.status,'supported');
  assert.equal(listed.semanticClass,'boss-ability-candidate');
  assert.equal(listed.providerSignals.lorrgs.status,'resolved');
  assert.equal(listed.providerSignals.lorrgs.bossMember,true);
  assert.equal(listed.providerSignals.lorrgs.catalogSemantics,'curated-boss-timeline-markers-not-exhaustive');
  assert.match(listed.interpretation.structuralUse,/timeline\/analysis marker/i);

  const missing=result.abilities.find(row=>row.abilityId===700002);
  assert.equal(missing.encounterAssociation.status,'not-listed-by-lorrgs');
  assert.equal(missing.providerSignals.lorrgs.status,'not-listed-by-boss-catalog');
  assert.equal(missing.providerSignals.lorrgs.bossCatalogResolved,true);
  assert.equal(missing.providerSignals.lorrgs.bossMember,false);
  assert.equal(missing.providerSignals.lorrgs.catalogSemantics,'curated-boss-timeline-markers-not-exhaustive');
  assert.match(missing.interpretation.structuralUse,/curated and non-exhaustive/i);

  assert.equal(calls.length,2);
  assert.ok(result.errors.some(row=>row.provider==='lorrgs'&&row.scope==='spell:700002'));
});

test('failed boss catalogue remains unknown rather than claiming absence',async()=>{
  const fetcher=async url=>{
    if(String(url).includes('/bosses/'))return jsonResponse({detail:'temporary failure'},503);
    return jsonResponse({detail:'Spell not found.'},404);
  };
  const result=await resolveAbilityKnowledgeV1({
    abilityIds:[700003],encounterId:9876,bossSlug:'synthetic-boss',providers:{lorrgs:true,parseWowhead:false,wcl:false},
  },{fetcher});
  const row=result.abilities[0];
  assert.equal(result.providers.lorrgs.bossCatalogResolved,false);
  assert.equal(row.encounterAssociation.status,'unknown');
  assert.equal(row.providerSignals.lorrgs.status,'not-requested-or-unresolved');
});
