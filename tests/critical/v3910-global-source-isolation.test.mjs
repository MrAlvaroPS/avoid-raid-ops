import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL v3.9.10 GLOBAL CORPUS: HOME isolation is fail-closed before expensive evidence acquisition',async()=>{
  const [scopes,sourceExpansion,wide,deep,bootstrap]=await Promise.all([
    read('server/knowledge/scopes.mjs'),
    read('server/corpus/source-expansion.mjs'),
    read('server/corpus/wide-profile.mjs'),
    read('server/corpus/deep-profile-v373.mjs'),
    read('server/corpus/raid-corpus-bootstrap-v1.mjs'),
  ]);
  assert.match(scopes,/GLOBAL_BOSS_SOURCE_ISOLATION_VERSION/);
  assert.match(scopes,/external-origin-unverified/);
  assert.match(scopes,/not proof of[\s\S]{0,60}independence/i);
  assert.match(sourceExpansion,/classifyGlobalBossSourceProfile/);
  assert.match(sourceExpansion,/source\.type!==['"]guild['"]\|\|source\.independenceProven!==true/);
  assert.doesNotMatch(sourceExpansion,/return\{type:['"]user['"]/);
  assert.match(wide,/sourceIsolation=classifyGlobalBossSourceProfile\(header\)/);
  assert.match(wide,/if\(sourceIsolation\.eligible!==true\)return null/);
  assert.match(deep,/sourceIsolation=classifyGlobalBossSourceProfile\(header\)/);
  assert.match(deep,/if\(sourceIsolation\.eligible!==true\)return null/);
  assert.match(bootstrap,/homeAvoidExcludedByCorpusSourcePolicy:true/);
});
