import test from 'node:test';
import assert from 'node:assert/strict';
import { clampCorpusConfig,CORPUS_FOUNDATION_PROFILE,CORPUS_DEFAULTS } from '../../server/corpus/config.mjs';
import { corpusId,corpusAliasKey } from '../../server/corpus/keys.mjs';

test('foundation profile is materially bounded below the full corpus defaults',()=>{
  const config=clampCorpusConfig({corpusProfile:'foundation'});
  assert.equal(config.corpusProfile,'foundation');
  assert.equal(config.targetPulls,CORPUS_FOUNDATION_PROFILE.targetPulls);
  assert.equal(config.deepTargetPulls,CORPUS_FOUNDATION_PROFILE.deepTargetPulls);
  assert.ok(config.targetPulls<CORPUS_DEFAULTS.targetPulls);
  assert.ok(config.maxRankingPages<CORPUS_DEFAULTS.maxRankingPages);
  assert.ok(config.maxSourcePages<CORPUS_DEFAULTS.maxSourcePages);
});

test('corpus keys require explicit difficulty and never silently become Mythic',()=>{
  assert.throws(()=>corpusId({encounterId:9999}),/difficulty is required/);
  assert.throws(()=>corpusAliasKey({encounterId:9999}),/difficulty is required/);
  assert.equal(corpusId({encounterId:9999,difficulty:3,partition:1}),'9999/d3/p1');
  assert.equal(corpusId({encounterId:9999,difficulty:4,partition:1}),'9999/d4/p1');
});
