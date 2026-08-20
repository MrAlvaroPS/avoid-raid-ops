import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyLootSimResultV1 } from '../../server/loot/simc-result-policy-v1.mjs';

test('current SimC unsupported spec is pending, never zero or failed loot value',()=>{
  const row=classifyLootSimResultV1({status:'sim-failed',gainPct:null,exitCode:40,reason:"SimulationCraft exited 40: Trivial: Mistweaver Monk for Player 'Pandokie' is not currently supported.\nError: Initialization error: No active players in sim!"});
  assert.equal(row.status,'role-model-pending');assert.equal(row.gainPct,null);assert.equal(row.unsupportedModel,'Mistweaver Monk');assert.equal(row.simSupport,'unsupported-by-current-simc-nightly');
});

test('exit 40 from current nightly is an upstream model error, never zero loot value',()=>{
  const row=classifyLootSimResultV1({status:'sim-failed',gainPct:null,exitCode:40,reason:"SimulationCraft exited 40 via docker: Trivial: Buff 'fury_mid2_4pc_crit' initialized incorrectly"});
  assert.equal(row.status,'simc-upstream-model-error');assert.equal(row.gainPct,null);assert.equal(row.simSupport,'upstream-nightly-model-error');assert.equal(row.retryableAfterEngineUpdate,true);
});

test('unrelated SimulationCraft failures remain failures',()=>{
  const row=classifyLootSimResultV1({status:'sim-failed',gainPct:null,reason:'bad profileset syntax'});assert.equal(row.status,'sim-failed');assert.equal(row.gainPct,null);
});
