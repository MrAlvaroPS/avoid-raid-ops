import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Docker Loot sims keep /work cwd while invoking SimC with an absolute entrypoint',async()=>{
  const source=await readFile(new URL('../../server/loot/simc-runner-v1.mjs',import.meta.url),'utf8');
  assert.match(source,/['\"]-w['\"],['\"]\/work['\"]/);
  assert.match(source,/['\"]--entrypoint['\"],['\"]\/app\/SimulationCraft\/simc['\"]/);
  assert.match(source,/['\"]\/work\/loot\.simc['\"]/);
  assert.doesNotMatch(source,/['\"]-w['\"],['\"]\/work['\"],worker\.imageTag/);
});
