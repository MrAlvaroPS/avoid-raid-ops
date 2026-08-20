import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSimcNightlyIndexV1 } from '../../server/loot/simc-manager-v1.mjs';

test('SimulationCraft nightly parser accepts current Windows x64 filename families and excludes arm64/nonetwork',()=>{
  const html=`
    <a href="simc-1205-01-win64-abcdef1.7z">new style A</a>
    <a href="simc-1205.01.1234567-win64.7z">new style B</a>
    <a href="simc-1205.01.2222222-winarm64.7z">arm</a>
    <a href="simc-1205-01-win64-nonetwork-3333333.7z">no network</a>
    <a href="simc-1205-01-macos-4444444.dmg">mac</a>`;
  const rows=parseSimcNightlyIndexV1(html,'https://downloads.simulationcraft.org/nightly/?C=M;O=D');
  assert.equal(rows.length,2);
  assert.equal(rows[0].commit,'abcdef1');
  assert.equal(rows[1].commit,'1234567');
  assert.equal(rows[0].transport,'https');
  assert.match(rows[0].url,/downloads\.simulationcraft\.org\/nightly\/simc-/);
});

test('SimulationCraft nightly parser records official HTTP fallback explicitly',()=>{
  const rows=parseSimcNightlyIndexV1('<a href="simc-1210.01.ce7b1a2-win64.7z">nightly</a>','http://downloads.simulationcraft.org/nightly/');
  assert.equal(rows[0].transport,'http');
  assert.equal(rows[0].commit,'ce7b1a2');
});
