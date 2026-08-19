import test from 'node:test';
import assert from 'node:assert/strict';
import { bossKnowledgeScope, homeGuildId, isHomeSourceProfile, classifyGlobalBossSourceProfile } from '../../server/knowledge/scopes.mjs';
import { buildBalancedBossSample } from '../../server/corpus/sampling-v2.mjs';
import { sourceFromIdentity,globalBossSourceDecisionFromIdentity } from '../../server/corpus/source-expansion.mjs';

const scope=bossKnowledgeScope({encounterId:3182,difficulty:5,partition:4});
const profile=(code,{guildId=null,ownerId=null}={})=>({
  code,encounterId:3182,difficulty:5,partition:4,
  guild:guildId?{id:guildId}:null,owner:ownerId?{id:ownerId}:null,
  fights:[{id:1,kill:false,fightPercentage:60}],
});

test('canonical sampler excludes a discovered home uploader while external guild evidence remains usable',()=>{
  const external=profile('external',{guildId:homeGuildId()+1000,ownerId:700001});
  const personalHome=profile('personal-home',{ownerId:700002});
  const sample=buildBalancedBossSample([external,personalHome],{scope,targetPulls:10,homeOwnerIds:[700002]});
  assert.deepEqual(sample.selectedCodes,['external']);
  assert.equal(sample.excluded.homeSource,1);
  assert.equal(sample.excluded.homeOwner,1);
});

test('GLOBAL source discovery rejects HOME guilds instead of retaining them for later filtering',()=>{
  const identity={guild:{id:homeGuildId(),name:'AvoiD'},owner:{id:700003}};
  const decision=globalBossSourceDecisionFromIdentity(identity);
  assert.equal(decision.eligible,false);
  assert.equal(decision.isolation.status,'home-source');
  assert.equal(sourceFromIdentity(identity),null);
});

test('configured personal uploader ids classify an un-guilded report as home evidence',()=>{
  const before=process.env.AVOID_HOME_WCL_OWNER_IDS;
  process.env.AVOID_HOME_WCL_OWNER_IDS='700004, 700005';
  try{
    assert.equal(isHomeSourceProfile({guild:null,owner:{id:700005}}),true);
    assert.equal(isHomeSourceProfile({guild:null,owner:{id:700006}}),false);
    assert.equal(classifyGlobalBossSourceProfile({guild:null,owner:{id:700006}}).status,'external-origin-unverified');
  }finally{
    if(before==null)delete process.env.AVOID_HOME_WCL_OWNER_IDS;else process.env.AVOID_HOME_WCL_OWNER_IDS=before;
  }
});
