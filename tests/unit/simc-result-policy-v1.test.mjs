import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyLootSimResultV1 } from '../../server/loot/simc-result-policy-v1.mjs';

test('current SimC unsupported spec is pending, never zero or failed loot value',()=>{
  const row=classifyLootSimResultV1({status:'sim-failed',gainPct:null,reason:"SimulationCraft exited 40: Trivial: Mistweaver Monk for Player 'Pandokie' is not currently supported.\nError: Initialization error: No active players in sim!"});
  assert.equal(row.status,'role-model-pending');assert.equal(row.gainPct,null);assert.equal(row.unsupportedModel,'Mistweaver Monk');assert.equal(row.simSupport,'unsupported-by-current-simc-nightly');
});

test('unrelated SimulationCraft failures remain failures',()=>{
  const row=classifyLootSimResultV1({status:'sim-failed',reason:'bad profileset syntax'});assert.equal(row.status,'sim-failed');
});
