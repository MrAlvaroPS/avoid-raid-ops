import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildQueryGuidedDeepPlan, QUERY_GUIDED_DEEP_POLICY_VERSION } from '../../server/corpus/query-guided-deep-v1.mjs';
import { resolveTargetedDeepRequest } from '../../server/corpus/targeted-deep-v373.mjs';
import { isCanonicalDeepComplete, CANONICAL_DEEP_REQUIRED_STREAMS } from '../../server/corpus/canonical-rebuild-v2.mjs';

const fight=(id,fightPercentage=100,kill=false)=>({id,kill,fightPercentage});
const profile=(code,guildId,fights,{abilityId=1243852}={})=>({
  code,
  guild:{id:guildId},
  owner:{id:guildId+100000},
  fights,
  tables:{wipeCasts:{[String(abilityId)]:{count:1,total:0,rows:1}}},
});

test('query-guided Deep spends exact fightIDs across independent sources before repeats',()=>{
  const rows=[
    profile('a1',1,[fight(1,45),fight(2,65),fight(3,95),fight(4,20),fight(5,75),fight(6,30),fight(7,100,true)]),
    profile('a2',1,[fight(11,40),fight(12,70),fight(13,92)]),
    profile('b1',2,[fight(21,42),fight(22,72),fight(23,94),fight(24,100,true)]),
    profile('c1',3,[fight(31,48),fight(32,68),fight(33,96),fight(34,100,true)]),
  ];
  const plan=buildQueryGuidedDeepPlan(rows,{requestedReports:3,requestedPulls:12,focusAbilityIds:[1243852]});
  assert.equal(plan.policyVersion,QUERY_GUIDED_DEEP_POLICY_VERSION);
  assert.equal(plan.selectedReports,3);
  assert.equal(plan.selectedSources,3);
  assert.equal(new Set(plan.selected.map(row=>row.source)).size,3);
  assert.ok(plan.selected.every(row=>row.fightIDs.length<=6));
  assert.equal(plan.selectedPulls,12);
  assert.equal(Object.values(plan.outcomeCounts).reduce((a,b)=>a+b,0),12);
});

test('explicit canonical Deep deficit is authoritative and is not inflated by the cold-start average',()=>{
  const target=resolveTargetedDeepRequest({addDeepReports:50,addDeepPulls:300,currentPulls:0,currentReports:0});
  assert.equal(target.requestedReports,50);
  assert.equal(target.requestedPulls,300);
  assert.equal(target.targetSource,'explicit-canonical-deficit');

  const estimated=resolveTargetedDeepRequest({addDeepReports:50,currentPulls:0,currentReports:0});
  assert.equal(estimated.requestedPulls,400);
  assert.equal(estimated.targetSource,'estimated-from-existing-deep');
});

test('query-guided Deep keeps surgical ability expressions diagnostic-only',()=>{
  const rows=[profile('a1',1,[fight(1,45),fight(2,65),fight(3,95),fight(4,100,true)])];
  const focus=[1,2,3,4,5,6,7,8,9,10];
  const plan=buildQueryGuidedDeepPlan(rows,{requestedReports:1,requestedPulls:4,focusAbilityIds:focus});
  assert.equal(plan.surgicalProbeExpressions.length,2);
  assert.match(plan.surgicalProbeExpressions[0].filterExpression,/ability\.id IN \(1,2,3,4,5,6,7,8\)/);
  assert.equal(plan.queryPolicy.canonicalDeepUsesExactFightIDs,true);
  assert.equal(plan.queryPolicy.surgicalAbilityProbesCountAsDeepReports,false);
  assert.equal(plan.queryPolicy.surgicalAbilityProbesCountAsDeepPulls,false);
});

test('canonical Deep coverage rejects any profile with an incomplete required stream',()=>{
  const complete={completeness:Object.fromEntries(CANONICAL_DEEP_REQUIRED_STREAMS.map(key=>[key,true]))};
  assert.equal(isCanonicalDeepComplete(complete),true);
  const partial=structuredClone(complete);
  partial.completeness.friendDamage=false;
  assert.equal(isCanonicalDeepComplete(partial),false);
  assert.equal(isCanonicalDeepComplete({completeness:{}}),false);
});

test('query-guided execution requires BOTH Deep pull and report targets before compile',()=>{
  const source=fs.readFileSync(new URL('../../server/corpus/corpus-step-v376.mjs',import.meta.url),'utf8');
  assert.match(source,/const pullsMet =/);
  assert.match(source,/const reportsMet =/);
  assert.match(source,/if \(pullsMet && reportsMet\)/);
});