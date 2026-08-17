import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAbilityKnowledgePreviewV1,resolveAbilityKnowledgeV1 } from '../../server/knowledge/ability-knowledge-v1.mjs';
import { buildWclAbilityKnowledgeQuery,normalizeWclAbilityKnowledge } from '../../server/wcl/queries/ability-knowledge.mjs';
import { fetchParseWowheadSpell } from '../../server/knowledge/providers/parse-wowhead-client-v1.mjs';

const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});

test('v3.9.3 ability knowledge preview is fingerprinted and conservative without executing providers',()=>{
  const preview=buildAbilityKnowledgePreviewV1({abilityIds:[700001,700002],encounterId:9876,bossSlug:'synthetic-boss',providers:{lorrgs:true,parseWowhead:true,wcl:true}});
  assert.equal(preview.version,'provider-aware-ability-knowledge-preview-v1');
  assert.equal(preview.fingerprint.length,40);
  assert.deepEqual(preview.networkUpperBound,{lorrgsCalls:3,parseWowheadCalls:2,parseWowheadCredits:2,wclCalls:1,wclPointEstimate:null});
  assert.equal(preview.safety.promotionAutomatic,false);
});

test('v3.9.3 Lorrgs boss catalogue supports encounter candidacy while a global spell lookup does not',async()=>{
  const calls=[];
  const fetcher=async url=>{
    calls.push(String(url));
    if(String(url).includes('/bosses/synthetic-boss/spells'))return json({'700001':{spell_id:700001,name:'Synthetic Encounter Pulse',icon:'boss_icon',spell_type:'other-raid',tags:[]}});
    if(String(url).includes('/spells/700002'))return json({spell_id:700002,name:'Synthetic General Aura',icon:'generic_icon',spell_type:'other-buffs',event_type:'applybuff'});
    throw new Error(`unexpected URL ${url}`);
  };
  const result=await resolveAbilityKnowledgeV1({abilityIds:[700001,700002],encounterId:9876,bossSlug:'synthetic-boss',providers:{lorrgs:true,parseWowhead:false,wcl:false}},{fetcher});
  assert.equal(result.usage.lorrgsCallsSucceeded,2);
  assert.equal(calls.length,2,'boss catalogue should avoid an extra direct lookup for listed IDs');
  const boss=result.abilities.find(x=>x.abilityId===700001),general=result.abilities.find(x=>x.abilityId===700002);
  assert.equal(boss.encounterAssociation.status,'supported');
  assert.equal(boss.semanticClass,'boss-ability-candidate');
  assert.equal(boss.providerSignals.lorrgs.bossMember,true);
  assert.equal(general.encounterAssociation.status,'not-listed-by-lorrgs');
  assert.equal(general.interpretation.promotionEligible,false);
  assert.equal(result.evidenceContract.deepContribution.reports,0);
  assert.equal(result.evidenceContract.directScoreDelta,0);
});

test('v3.9.3 WCL static metadata query batches arbitrary ability IDs into one documented GameData request',()=>{
  const query=buildWclAbilityKnowledgeQuery([700001,700002],{encounterId:9876});
  assert.match(query,/gameData/);assert.match(query,/a700001:ability\(id:700001\)/);assert.match(query,/a700002:ability\(id:700002\)/);assert.match(query,/worldData\{encounter\(id:9876\)/);assert.match(query,/rateLimitData/);
  const normalized=normalizeWclAbilityKnowledge({gameData:{a700001:{id:700001,name:'A',icon:'a'},a700002:{id:700002,name:'B',icon:'b'}},worldData:{encounter:{id:9876,name:'Synthetic',journalID:8765}},rateLimitData:{limitPerHour:3600}},[700001,700002],{encounterId:9876});
  assert.equal(normalized.abilities.size,2);assert.equal(normalized.encounter.name,'Synthetic');
});

test('v3.9.3 Parse Wowhead client is optional, server-keyed and normalizes spell identity',async()=>{
  const unconfigured=await fetchParseWowheadSpell(700001,{apiKey:'',fetcher:async()=>{throw new Error('must not call network')}});
  assert.equal(unconfigured.configured,false);assert.equal(unconfigured.creditUpperBound,0);
  let header=null;
  const configured=await fetchParseWowheadSpell(700001,{apiKey:'secret',fetcher:async(url,options)=>{header=options.headers['X-API-Key'];assert.match(String(url),/get_spell\?id=700001/);return json({data:{id:700001,name:'Synthetic Spell',url:'https://www.wowhead.com/spell=700001'}});}});
  assert.equal(header,'secret');assert.equal(configured.creditUpperBound,1);assert.equal(configured.spell.name,'Synthetic Spell');
});

test('v3.9.3 generic provider-aware modules contain no current encounter regression literals',async()=>{
  const {readFile}=await import('node:fs/promises');
  const files=['server/knowledge/ability-knowledge-v1.mjs','server/knowledge/providers/lorrgs-client-v1.mjs','server/knowledge/providers/parse-wowhead-client-v1.mjs','server/wcl/queries/ability-knowledge.mjs'];
  for(const file of files){const source=await readFile(new URL(`../../${file}`,import.meta.url),'utf8');for(const literal of ['3182','1243866','1266687'])assert.equal(source.includes(literal),false,`${file} must stay boss-agnostic`);}
});
