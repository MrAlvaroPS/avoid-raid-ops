import test from 'node:test';
import assert from 'node:assert/strict';
import { bossKnowledgeScope, homeGuildId, isHomeSourceProfile } from '../../server/knowledge/scopes.mjs';
import { buildBalancedBossSample } from '../../server/corpus/sampling-v2.mjs';
import { sourceFromIdentity } from '../../server/corpus/source-expansion.mjs';

const scope=bossKnowledgeScope({encounterId:3182,difficulty:5,partition:4});
const profile=(code,{guildId=null,ownerId=null}={})=>({
  code,encounterId:3182,difficulty:5,partition:4,
  guild:guildId?{id:guildId}:null,owner:ownerId?{id:ownerId}:null,
  fights:[{id:1,kill:false,fightPercentage:60}],
});

test('canonical sampler excludes an un-guilded report from a discovered home uploader',()=>{
  const external=profile('external',{ownerId:700001});
  const personalHome=profile('personal-home',{ownerId:700002});
  const sample=buildBalancedBossSample([external,personalHome],{scope,targetPulls:10,homeOwnerIds:[700002]});
  assert.deepEqual(sample.selectedCodes,['external']);
  assert.equal(sample.excluded.homeSource,1);
  assert.equal(sample.excluded.homeOwner,1);
});

test('guild identity discovery retains uploader id so it can become a home-source guard',()=>{
  const source=sourceFromIdentity({guild:{id:homeGuildId(),name:'AvoiD'},owner:{id:700003}});
  assert.equal(source.type,'guild');
  assert.equal(source.id,homeGuildId());
  assert.equal(source.ownerId,700003);
});

test('configured personal uploader ids classify an un-guilded report as home evidence',()=>{
  const before=process.env.AVOID_HOME_WCL_OWNER_IDS;
  process.env.AVOID_HOME_WCL_OWNER_IDS='700004, 700005';
  try{
    assert.equal(isHomeSourceProfile({guild:null,owner:{id:700005}}),true);
    assert.equal(isHomeSourceProfile({guild:null,owner:{id:700006}}),false);
  }finally{
    if(before==null)delete process.env.AVOID_HOME_WCL_OWNER_IDS;else process.env.AVOID_HOME_WCL_OWNER_IDS=before;
  }
});
