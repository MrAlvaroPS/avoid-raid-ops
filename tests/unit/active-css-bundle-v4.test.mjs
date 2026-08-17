import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVE_CSS_SOURCE_LAYERS, activeCssSourcePaths, compileActiveCssBundle } from '../../scripts/lib/active-css-bundle.mjs';

test('compatibility CSS compiler consumes all 17 additive layers in manifest order',()=>{
  assert.equal(ACTIVE_CSS_SOURCE_LAYERS.length,17);
  assert.deepEqual(activeCssSourcePaths(),[
    '/raidops-v34.css','/raidops-v35.css','/raidops-v37.css','/raidops-v373.css','/raidops-v374.css','/raidops-v375.css','/raidops-v376.css','/raidops-v377.css','/raidops-v378.css','/raidops-v379.css','/raidops-v3710.css','/raidops-v3711.css','/raidops-v3712.css','/raidops-v3713.css','/raidops-v386.css','/raidops-v390.css','/raidops-v392.css',
  ]);
});

test('compiled compatibility CSS preserves representative cross-domain source order',async()=>{
  const css=await compileActiveCssBundle();
  const markers=['.roster-intelligence-panel','.corpus-workbench','.progress-commandbar','.player-list-v386','--raidops-card-gap','--players-roster-max-height'];
  const positions=markers.map(marker=>css.indexOf(marker));
  assert.ok(positions.every(position=>position>=0),`missing marker positions ${positions}`);
  assert.deepEqual([...positions].sort((a,b)=>a-b),positions,'representative rules must retain source cascade order');
  assert.doesNotMatch(css,/@(?:charset|import|namespace)\b/i);
});
