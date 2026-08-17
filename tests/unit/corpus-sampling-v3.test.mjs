import test from 'node:test';
import assert from 'node:assert/strict';
import { bossKnowledgeScope } from '../../server/knowledge/scopes.mjs';
import {
  BOSS_SAMPLING_POLICY_VERSION,
  buildBalancedBossSample,
  buildBossSamplingManifest,
  samplingPublicationChecks,
} from '../../server/corpus/sampling-v2.mjs';

const scope = bossKnowledgeScope({ encounterId:3182, difficulty:5, partition:4 });

function fights({ kill=0, deep=0, mid=0, early=0 }={}) {
  const rows=[]; let id=1;
  for(let i=0;i<kill;i++) rows.push({id:id++,kill:true,fightPercentage:0});
  for(let i=0;i<deep;i++) rows.push({id:id++,kill:false,fightPercentage:35});
  for(let i=0;i<mid;i++) rows.push({id:id++,kill:false,fightPercentage:70});
  for(let i=0;i<early;i++) rows.push({id:id++,kill:false,fightPercentage:96});
  return rows;
}

function profile(code,guildId,hist) {
  return {
    code,
    encounterId:3182,
    difficulty:5,
    partition:4,
    guild:{id:guildId,name:`Guild ${guildId}`},
    owner:{id:guildId+1000000},
    fights:fights(hist),
    startTime:Number(String(code).replace(/\D/g,''))||1,
  };
}

test('sampling v3 trims a prolific Wide source instead of filling the raw pull target from it',()=>{
  const rows=[];
  for(let report=1;report<=20;report++) rows.push(profile(`dom-${report}`,950001,{deep:5}));
  for(let source=2;source<=20;source++) rows.push(profile(`peer-${source}`,950000+source,{kill:1,deep:2,mid:5,early:2}));
  const sample=buildBalancedBossSample(rows,{scope,targetPulls:10000,mode:'wide'});
  assert.equal(BOSS_SAMPLING_POLICY_VERSION,'boss-corpus-sampling-v3');
  assert.equal(sample.balance.policy,'hard-source-concentration-caps-v1');
  assert.equal(sample.balance.hardCapsSatisfied,true);
  assert.ok(sample.balance.trimmedReports>0);
  assert.ok(sample.stats.maxSourceReportShare<=0.10+1e-12,`report share ${sample.stats.maxSourceReportShare}`);
  assert.ok(sample.stats.maxSourcePullShare<=0.12+1e-12,`pull share ${sample.stats.maxSourcePullShare}`);
  assert.ok(Number(sample.stats.sourceReports['guild:950001']||0)<=2,'dominant source should be capped even when raw pull target remains unmet');
});

test('sampling v3 also caps Deep pull concentration, not only Deep report count',()=>{
  const rows=[];
  for(let report=1;report<=5;report++) rows.push(profile(`deep-dom-${report}`,960001,{deep:30}));
  for(let source=2;source<=10;source++) rows.push(profile(`deep-peer-${source}`,960000+source,{kill:1,deep:3,mid:3,early:3}));
  const deep=buildBalancedBossSample(rows,{scope,targetPulls:10000,mode:'deep'});
  assert.equal(deep.balance.hardCapsSatisfied,true);
  assert.ok(deep.stats.maxSourceReportShare<=0.20+1e-12,`deep report share ${deep.stats.maxSourceReportShare}`);
  assert.ok(deep.stats.maxSourcePullShare<=0.25+1e-12,`deep pull share ${deep.stats.maxSourcePullShare}`);
  const manifest=buildBossSamplingManifest({scope,wideSample:deep,deepSample:deep});
  const checks=samplingPublicationChecks(manifest,{maxSourceReportShare:.20,maxSourcePullShare:.25,maxDeepSourceReportShare:.20,maxDeepSourcePullShare:.25,minSourcesPerOutcome:1,minDeepSourcesPerOutcome:1});
  assert.equal(checks.deepSourceBalance,true);
  assert.equal(checks.deepSourcePullBalance,true);
});

test('hard caps are not faked when too few independent sources exist to satisfy them',()=>{
  const rows=[];
  for(let source=1;source<=4;source++) rows.push(profile(`small-${source}`,970000+source,{deep:5,mid:5}));
  const sample=buildBalancedBossSample(rows,{scope,targetPulls:10000,mode:'wide'});
  assert.equal(sample.stats.reports,4,'sampler must not delete honest evidence just to manufacture a 10% share with four sources');
  assert.equal(sample.balance.enforcement.reportApplicable,false);
  assert.equal(sample.balance.enforcement.pullApplicable,false);
  assert.equal(sample.balance.trimmedReports,0);
});
