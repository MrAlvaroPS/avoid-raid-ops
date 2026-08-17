import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bossKnowledgeScope,
  homeGuildId,
  raidKnowledgeScope,
  sanitizeGlobalBossProfile,
} from '../../server/knowledge/scopes.mjs';
import { globalBossKnowledgeId } from '../../server/knowledge/keys.mjs';
import { writeHomeRaidEvidence } from '../../server/knowledge/raid-ledger.mjs';
import {
  OUTCOME_STRATA,
  buildBalancedBossSample,
  buildBossSamplingManifest,
  bossProfileOutcomeHistogram,
  samplingPublicationChecks,
} from '../../server/corpus/sampling-v2.mjs';

const scope = bossKnowledgeScope({ encounterId:3182, difficulty:5, partition:4 });

function fights({ kill=0, deep=0, mid=0, early=0 }={}) {
  const out=[];let id=1;
  for(let i=0;i<kill;i++)out.push({id:id++,kill:true,fightPercentage:0,friendlyPlayers:[1,2,3]});
  for(let i=0;i<deep;i++)out.push({id:id++,kill:false,fightPercentage:35,friendlyPlayers:[1,2,3]});
  for(let i=0;i<mid;i++)out.push({id:id++,kill:false,fightPercentage:70,friendlyPlayers:[1,2,3]});
  for(let i=0;i<early;i++)out.push({id:id++,kill:false,fightPercentage:96,friendlyPlayers:[1,2,3]});
  return out;
}

function profile(code,guildId,hist={deep:2,mid:2,early:1}) {
  return {
    code,
    encounterId:3182,
    difficulty:5,
    partition:4,
    guild:guildId?{id:guildId,name:`Guild ${guildId}`}:null,
    owner:guildId?{id:guildId+100000}:null,
    fights:fights(hist),
    startTime:Number(String(code).replace(/\D/g,''))||1,
  };
}

test('global boss identity hard-separates difficulty and partition',()=>{
  assert.equal(globalBossKnowledgeId({encounterId:3182,difficulty:5,partition:4}),'3182/d5/p4');
  assert.notEqual(globalBossKnowledgeId({encounterId:3182,difficulty:5,partition:4}),globalBossKnowledgeId({encounterId:3182,difficulty:4,partition:4}));
  assert.notEqual(globalBossKnowledgeId({encounterId:3182,difficulty:5,partition:4}),globalBossKnowledgeId({encounterId:3182,difficulty:5,partition:3}));
});

test('home raid scope rejects every external guild',()=>{
  assert.equal(raidKnowledgeScope({guildId:homeGuildId(),encounterId:3182,difficulty:5,partition:4}).kind,'home-raid');
  assert.throws(()=>raidKnowledgeScope({guildId:homeGuildId()+1,encounterId:3182,difficulty:5,partition:4}),/home-guild only/i);
});

test('home raid persistence guard rejects external report guild before touching storage',async()=>{
  await assert.rejects(()=>writeHomeRaidEvidence({guildId:homeGuildId(),reportGuildId:homeGuildId()+1,encounterId:3182,difficulty:5,partition:4,reportCode:'external-report'}),/cannot enter the AvoiD raid\/player knowledge ledger/i);
});

test('persisted global profile sanitization removes friendly player actor ids',()=>{
  const clean=sanitizeGlobalBossProfile(profile('safe1',900001,{kill:1,deep:1}));
  assert.equal(clean.knowledgeScope,'global-boss');
  assert.equal(clean.partition,4);
  assert.ok(clean.fights.every(f=>!Object.hasOwn(f,'friendlyPlayers')));
});

test('canonical sampler excludes home guild, wrong difficulty, wrong partition and unknown source identity',()=>{
  const external=profile('ext1',900001,{deep:2,mid:1});
  const home=profile('home1',homeGuildId(),{deep:4});
  const wrongDifficulty={...profile('wrongd1',900002,{mid:3}),difficulty:4};
  const wrongPartition={...profile('wrongp1',900003,{mid:3}),partition:3};
  const missing={...profile('missing1',null,{early:3}),owner:null};
  const sample=buildBalancedBossSample([external,home,wrongDifficulty,wrongPartition,missing],{scope,targetPulls:100});
  assert.deepEqual(sample.selectedCodes,['ext1']);
  assert.equal(sample.excluded.homeGuild,1);
  assert.equal(sample.excluded.wrongScope,2);
  assert.equal(sample.excluded.missingSource,1);
});

test('source round-robin prevents a prolific guild taking a second report first',()=>{
  const rows=[];
  for(let source=1;source<=6;source++)for(let report=1;report<=3;report++)rows.push(profile(`s${source}r${report}`,910000+source,{deep:2,mid:2,early:1}));
  const sample=buildBalancedBossSample(rows,{scope,targetPulls:10000,targetReports:12});
  const counts=Object.values(sample.stats.sourceReports);
  assert.equal(sample.stats.sources,6);
  assert.equal(sample.stats.reports,12);
  assert.ok(Math.max(...counts)-Math.min(...counts)<=1,`source report counts are not round-robin: ${counts.join(',')}`);
});

test('outcome stratification counts actual pulls in mixed reports instead of report labels',()=>{
  const mixed=profile('mixed1',920001,{kill:1,deep:20,mid:7,early:10});
  const histogram=bossProfileOutcomeHistogram(mixed);
  assert.deepEqual(histogram,{kill:1,deepWipe:20,midWipe:7,earlyWipe:10});
  const sample=buildBalancedBossSample([mixed],{scope,targetPulls:100});
  assert.equal(sample.stats.strata.kill.pulls,1);
  assert.equal(sample.stats.strata.deepWipe.pulls,20);
  assert.equal(sample.stats.strata.midWipe.pulls,7);
  assert.equal(sample.stats.strata.earlyWipe.pulls,10);
});

test('balanced sample actively covers all pull outcome strata when evidence exists',()=>{
  const rows=[];
  for(let source=1;source<=12;source++){
    const gid=930000+source;
    rows.push(profile(`k${source}`,gid,{kill:2}));
    rows.push(profile(`d${source}`,gid,{deep:3}));
    rows.push(profile(`m${source}`,gid,{mid:3}));
    rows.push(profile(`e${source}`,gid,{early:2}));
  }
  const sample=buildBalancedBossSample(rows,{scope,targetPulls:80,targetReports:40});
  for(const key of OUTCOME_STRATA)assert.ok(sample.stats.strata[key].pulls>0,`${key} missing`);
  assert.ok(sample.stats.maxSourceReportShare<=0.15);
});

test('publication checks require source balance and outcome-source coverage',()=>{
  const rows=[];
  for(let source=1;source<=16;source++){
    const gid=940000+source;
    rows.push(profile(`k${source}`,gid,{kill:2}));
    rows.push(profile(`d${source}`,gid,{deep:3}));
    rows.push(profile(`m${source}`,gid,{mid:3}));
    rows.push(profile(`e${source}`,gid,{early:2}));
  }
  const wide=buildBalancedBossSample(rows,{scope,targetPulls:120,targetReports:64,mode:'wide'});
  const deep=buildBalancedBossSample(rows,{scope,targetPulls:80,targetReports:40,mode:'deep'});
  const manifest=buildBossSamplingManifest({scope,wideSample:wide,deepSample:deep});
  const checks=samplingPublicationChecks(manifest,{maxSourceReportShare:.20,maxSourcePullShare:.20,maxDeepSourceReportShare:.25,minSourcesPerOutcome:4,minDeepSourcesPerOutcome:3});
  assert.equal(checks.homeGuildExcluded,true);
  assert.equal(checks.scopeIsolation,true);
  assert.equal(checks.sourceIdentityComplete,true);
  assert.equal(checks.sourceReportBalance,true);
  assert.equal(checks.sourcePullBalance,true);
  assert.equal(checks.outcomeCoverage,true);
  assert.equal(checks.deepOutcomeCoverage,true);
});
