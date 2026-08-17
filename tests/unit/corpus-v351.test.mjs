import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CORPUS_REPORT_HEADER_QUERY,CORPUS_WIDE_TABLES_QUERY,CORPUS_DEEP_EVENTS_QUERY,CORPUS_SOURCE_REPORTS_QUERY } from '../../server/wcl/queries/corpus.mjs';
import { sourceFromIdentity,sourceKey } from '../../server/corpus/source-expansion.mjs';
import { corpusAliasKey,corpusId } from '../../server/corpus/keys.mjs';
import { clampCorpusConfig } from '../../server/corpus/config.mjs';
import { createAggregate,mergeDeepProfile } from '../../server/corpus/aggregate.mjs';

test('v3.5.1 profiles exact fightIDs before table/event data',()=>{
  assert.match(CORPUS_REPORT_HEADER_QUERY,/fights\(encounterID:\$encounter,difficulty:\$difficulty/);
  assert.match(CORPUS_WIDE_TABLES_QUERY,/fightIDs:\$killFightIDs/);
  assert.match(CORPUS_WIDE_TABLES_QUERY,/fightIDs:\$wipeFightIDs/);
  assert.doesNotMatch(CORPUS_WIDE_TABLES_QUERY,/table\([^)]*encounterID:/);
  assert.match(CORPUS_DEEP_EVENTS_QUERY,/fightIDs:\$fightIDs/);
  assert.doesNotMatch(CORPUS_DEEP_EVENTS_QUERY,/events\([^)]*encounterID:/);
});

test('source expansion is zone/time scoped and can expand guild or personal logs',()=>{
  assert.match(CORPUS_SOURCE_REPORTS_QUERY,/reports\(guildID:\$guildID,userID:\$userID,zoneID:\$zoneID/);
  assert.match(CORPUS_SOURCE_REPORTS_QUERY,/startTime:\$startTime,endTime:\$endTime/);
  const guild=sourceFromIdentity({guild:{id:42,name:'Raiders'},owner:{id:99}});
  assert.deepEqual(guild,{type:'guild',id:42,name:'Raiders',ownerId:99,page:1});
  assert.equal(sourceKey(guild),'guild:42');
  const personal=sourceFromIdentity({guild:null,owner:{id:99}});
  assert.deepEqual(personal,{type:'user',id:99,name:null,ownerId:99,page:1});
});

test('corpus keys lock persistence to the resolved partition',()=>{
  assert.equal(corpusId({encounterId:3182,difficulty:5,partition:4}),'3182/d5/p4');
  assert.equal(corpusAliasKey({encounterId:3182,difficulty:5}),'aliases/3182/d5.json');
});

test('legacy targetReports input is interpreted as pull target for compatibility',()=>{
  const config=clampCorpusConfig({targetReports:5000,deepTargetReports:600});
  assert.equal(config.targetPulls,5000);
  assert.equal(config.deepTargetPulls,600);
});

test('deep aggregate tracks deep pulls separately from wide pulls',()=>{
  const aggregate=createAggregate({encounterId:3182,difficulty:5,partition:4});
  mergeDeepProfile(aggregate,{code:'abcdefghijklmnop',fights:[{kill:true},{kill:false},{kill:false}],completeness:{},abilities:{},abilityStats:{},statePairs:[]});
  assert.equal(aggregate.deepKillPulls,1);
  assert.equal(aggregate.deepWipePulls,2);
  assert.equal(aggregate.killPulls,0);
  assert.equal(aggregate.wipePulls,0);
});

test('deploy runtime labels corpus targets as pulls, not ranked reports',async()=>{
  const runtime=await readFile(new URL('../../public/wcl-runtime.js',import.meta.url),'utf8');
  assert.match(runtime,/target pulls/);
  assert.match(runtime,/ENRICH \+/);
  assert.doesNotMatch(runtime,/ranked reports/);
});


test('corpus health endpoint exposes v3.5.1 storage readiness before spending WCL points',async()=>{
  const service=await readFile(new URL('../../server/services/corpus-service.mjs',import.meta.url),'utf8');
  const engine=await readFile(new URL('../../server/corpus/service.mjs',import.meta.url),'utf8');
  assert.match(service,/action==='health'/);
  assert.match(engine,/engineVersion:ENGINE_VERSION/);
  assert.match(engine,/storage:await corpusStorageStatus\(\)/);
});
