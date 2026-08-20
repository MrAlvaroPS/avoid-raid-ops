import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GLOBAL_BOSS_SOURCE_ISOLATION_VERSION,
  classifyGlobalBossSourceProfile,
  assertProfileAllowedInGlobalBossKnowledge,
  sanitizeGlobalBossProfile,
} from '../../server/knowledge/scopes.mjs';
import { globalBossSourceDecisionFromIdentity,sourceFromIdentity,fetchSourceReports } from '../../server/corpus/source-expansion.mjs';

const previousGuild=process.env.AVOID_HOME_GUILD_ID;
const previousOwners=process.env.AVOID_HOME_WCL_OWNER_IDS;
process.env.AVOID_HOME_GUILD_ID='111';
process.env.AVOID_HOME_WCL_OWNER_IDS='222';

test.after(()=>{
  if(previousGuild==null)delete process.env.AVOID_HOME_GUILD_ID;else process.env.AVOID_HOME_GUILD_ID=previousGuild;
  if(previousOwners==null)delete process.env.AVOID_HOME_WCL_OWNER_IDS;else process.env.AVOID_HOME_WCL_OWNER_IDS=previousOwners;
});

test('GLOBAL source isolation proves independence from a concrete external guild only',()=>{
  const external=classifyGlobalBossSourceProfile({guild:{id:333},owner:{id:444}});
  assert.equal(external.version,GLOBAL_BOSS_SOURCE_ISOLATION_VERSION);
  assert.equal(external.eligible,true);
  assert.equal(external.independenceProven,true);
  assert.equal(external.status,'verified-external-guild');

  const home=classifyGlobalBossSourceProfile({guild:{id:111},owner:{id:444}});
  assert.equal(home.eligible,false);
  assert.equal(home.status,'home-source');

  const homeOwner=classifyGlobalBossSourceProfile({guild:{id:333},owner:{id:222}});
  assert.equal(homeOwner.eligible,false);
  assert.equal(homeOwner.status,'home-source');

  const ownerOnly=classifyGlobalBossSourceProfile({guild:null,owner:{id:444}});
  assert.equal(ownerOnly.eligible,false);
  assert.equal(ownerOnly.status,'external-origin-unverified');
  assert.equal(ownerOnly.independenceProven,false);

  const anonymous=classifyGlobalBossSourceProfile({});
  assert.equal(anonymous.eligible,false);
  assert.equal(anonymous.status,'external-origin-unverified');
});

test('source expansion never creates HOME, anonymous or owner-only GLOBAL sources',()=>{
  const external={guild:{id:333,name:'External'},owner:{id:444}};
  const decision=globalBossSourceDecisionFromIdentity(external);
  assert.equal(decision.eligible,true);
  assert.deepEqual(sourceFromIdentity(external),{
    type:'guild',id:333,name:'External',ownerId:444,page:1,independenceProven:true,sourceIsolationVersion:GLOBAL_BOSS_SOURCE_ISOLATION_VERSION,
  });
  assert.equal(sourceFromIdentity({guild:{id:111},owner:{id:444}}),null);
  assert.equal(sourceFromIdentity({guild:null,owner:{id:444}}),null);
  assert.equal(sourceFromIdentity({}),null);
});

test('source report expansion fails before network for anything except a proven external guild',async()=>{
  await assert.rejects(()=>fetchSourceReports({source:{type:'user',id:444,independenceProven:true},zoneId:900}),/verified external guild/);
  await assert.rejects(()=>fetchSourceReports({source:{type:'guild',id:333,independenceProven:false},zoneId:900}),/verified external guild/);
});

test('GLOBAL profile assertion is fail-closed and persisted profiles carry isolation but no uploader identity',()=>{
  const scope={encounterId:8001,difficulty:3,partition:7};
  assert.equal(assertProfileAllowedInGlobalBossKnowledge({encounterId:8001,difficulty:3,partition:7,guild:{id:333},owner:{id:444}},scope),true);
  assert.throws(()=>assertProfileAllowedInGlobalBossKnowledge({encounterId:8001,difficulty:3,partition:7,guild:{id:111}},scope),/Home source/);
  assert.throws(()=>assertProfileAllowedInGlobalBossKnowledge({encounterId:8001,difficulty:3,partition:7,owner:{id:444}},scope),/independence is unverified/);
  const clean=sanitizeGlobalBossProfile({code:'synthetic',guild:{id:333},owner:{id:444},fights:[{id:1,friendlyPlayers:[1,2,3]}]});
  assert.equal(clean.sourceIsolationVersion,GLOBAL_BOSS_SOURCE_ISOLATION_VERSION);
  assert.equal('friendlyPlayers' in clean.fights[0],false);
  assert.equal('owner' in clean,false);
  assert.equal(clean.guild.id,333);
});
