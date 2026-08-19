import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL v3.9.10 RAID LEARNING: availability is metadata-only and every query is boss+difficulty scoped',async()=>{
  const [plan,route,ranking,smoke]=await Promise.all([
    read('server/knowledge/raid-learning-plan-v1.mjs'),
    read('routes/api/knowledge/raid-learning-plan.js'),
    read('server/corpus/ranking-source.mjs'),
    read('scripts/iris-raid-learning-plan-smoke.mjs'),
  ]);
  assert.match(plan,/difficulty:scope\.difficulty\.id/);
  assert.match(plan,/rankingOutcomeDiscarded:true/);
  assert.match(plan,/wclCombatEventCalls:0/);
  assert.match(plan,/normalHeroicCannotCountAsMythicEvidence:true/);
  assert.doesNotMatch(plan,/events\s*\{|table\s*\(/);
  assert.match(route,/previewFingerprint/);
  assert.match(route,/confirmExecution:true/);
  assert.match(route,/wclCombatEventCalls:0/);
  assert.match(ranking,/difficulty is required for ranking discovery; cross-difficulty fallback is forbidden/);
  assert.doesNotMatch(ranking,/difficulty=5|difficulty\s*=\s*5|difficulty:\s*5/);
  assert.match(smoke,/one ranking metadata page per published boss\+difficulty/i);
});

test('CRITICAL v3.9.10 ABILITY KNOWLEDGE: encounter-scoped spell knowledge requires difficulty and filters official/structural inputs',async()=>{
  const [wrapper,service]=await Promise.all([
    read('server/knowledge/ability-knowledge-difficulty-v1.mjs'),
    read('server/services/ability-knowledge-service.mjs'),
  ]);
  assert.match(wrapper,/difficulty is required for encounter-scoped Ability Knowledge/);
  assert.match(wrapper,/loadLatestOfficialEncounterDifficultyViewV1/);
  assert.match(wrapper,/buildSpellStructuralDifficultyViewV1/);
  assert.match(wrapper,/Cross-difficulty official Ability Knowledge view rejected/);
  assert.match(wrapper,/crossDifficultyEmpiricalReuse:false/);
  assert.match(service,/buildDifficultyAwareAbilityKnowledgePreviewV1/);
  assert.match(service,/resolveDifficultyAwareAbilityKnowledgeV1/);
  assert.match(service,/previewFingerprint/);
});
