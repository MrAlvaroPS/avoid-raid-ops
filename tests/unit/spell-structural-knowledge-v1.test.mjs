import test from 'node:test';
import assert from 'node:assert/strict';
import { compileOfficialEncounterGraphV1 } from '../../server/knowledge/official-encounter-knowledge-v1.mjs';
import { buildSpellStructuralKnowledgePreviewV1,resolveSpellStructuralKnowledgeV1 } from '../../server/knowledge/spell-structural-knowledge-v1.mjs';
import { normalizeWagoBuildV1,resolveWagoTriggerRelationsV1,wagoBuildFromBlizzardNamespaceV1 } from '../../server/knowledge/providers/wago-db2-spell-effect-v1.mjs';

const journal={
  id:9001,
  name:{en_US:'Synthetic Boss'},
  sections:[{id:100,title:{en_US:'Stage One'},creature_display:{id:1},sections:[
    {id:110,title:{en_US:'Official State'},spell:{id:700002,name:{en_US:'Official State'}}},
  ]}],
};

const officialGraph=compileOfficialEncounterGraphV1({journal,locale:'en_US',namespace:'static-12.1.0_68914-eu',wclEncounterId:4321});

const csv=[
  'ID,EffectIndex,Effect,EffectAura,EffectAuraPeriod,EffectMiscValue_0,EffectMiscValue_1,EffectTriggerSpell,ImplicitTarget_0,ImplicitTarget_1,SpellID',
  '555,0,64,0,0,0,0,700002,1,0,700001',
].join('\n');

const fetcher=async url=>{
  const parsed=new URL(String(url));
  const spellId=parsed.searchParams.get('filter[SpellID]');
  const triggerId=parsed.searchParams.get('filter[EffectTriggerSpell]');
  if(spellId==='700001'||triggerId==='700002')return new Response(csv,{status:200,headers:{'content-type':'text/csv'}});
  return new Response('ID,EffectTriggerSpell,SpellID\n',{status:200,headers:{'content-type':'text/csv'}});
};

test('Blizzard build namespace pins Wago DB2 to the same client build',()=>{
  assert.equal(wagoBuildFromBlizzardNamespaceV1('static-12.1.0_68914-eu'),'12.1.0.68914');
  assert.equal(normalizeWagoBuildV1('12.1.0.68914'),'12.1.0.68914');
  assert.throws(()=>normalizeWagoBuildV1('latest'),/Unsupported/);
});

test('Wago SpellEffect resolution discovers and deduplicates trigger relations bidirectionally',async()=>{
  const result=await resolveWagoTriggerRelationsV1([700001,700002],{build:'12.1.0.68914',directions:'both',fetcher});
  assert.equal(result.usage.networkCalls,4);
  assert.equal(result.relations.length,1);
  assert.equal(result.relations[0].sourceAbilityId,700001);
  assert.equal(result.relations[0].targetAbilityId,700002);
  assert.equal(result.relations[0].relationKind,'trigger-spell');
  assert.equal(result.relations[0].relationLabel,'SpellEffect.EffectTriggerSpell');
  assert.equal(result.relations[0].providerBuild,'12.1.0.68914');
  assert.equal(result.relations[0].providerRowId,555);
  assert.equal(result.evidenceContract.rawCsvPersisted,false);
  assert.equal(result.evidenceContract.automaticPromotion,false);
});

test('spell structural preview spends zero Blizzard/WCL and derives exact Wago budget from official build',()=>{
  const preview=buildSpellStructuralKnowledgePreviewV1({wclEncounterId:4321,seedAbilityIds:[700001,700002],directions:'both'},officialGraph);
  assert.equal(preview.officialGraph.build,'12.1.0.68914');
  assert.equal(preview.networkUpperBound.wagoCalls,4);
  assert.equal(preview.networkUpperBound.blizzardCalls,0);
  assert.equal(preview.networkUpperBound.wclCalls,0);
  assert.equal(preview.safety.causalCombatEvidence,false);
  assert.equal(preview.safety.automaticPromotion,false);
});

test('structural resolver links an unlisted DB2 helper to an official Journal spell without inventing combat causality',async()=>{
  const result=await resolveSpellStructuralKnowledgeV1({wclEncounterId:4321,seedAbilityIds:[700001,700002],directions:'both'},{officialGraph,fetcher,persist:false});
  assert.equal(result.provider.build,'12.1.0.68914');
  assert.equal(result.usage.wagoCalls,4);
  assert.equal(result.usage.blizzardCalls,0);
  assert.equal(result.usage.wclCalls,0);
  assert.equal(result.relations.length,1);
  assert.equal(result.relations[0].officialContext.status,'unlisted-source-to-official-target');
  assert.equal(result.relations[0].officialContext.target.name,'Official State');
  assert.equal(result.relations[0].officialContext.negativeEvidence,false);
  assert.equal(result.relations[0].officialContext.promotionEffect,'none');
  assert.equal(result.evidenceContract.providerRelationsCannotSatisfyExactPatternProvenance,true);
  assert.equal(result.evidenceContract.providerRelationsCannotPromoteMechanic,true);
  assert.equal(result.evidenceContract.rawCsvPersisted,false);
});
