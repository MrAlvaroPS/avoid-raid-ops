import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGlobalBossLearningSourceLineageV1,buildUntouchedHoldoutSourcePoolV1,reservationCandidatesFromSourcePoolV1 } from '../../server/corpus/untouched-holdout-source-pool-v1.mjs';

test('arbitrary GLOBAL BOSS scope derives unseen Holdout candidates from lineage rather than boss constants',()=>{
  const aggregate={
    sourceReports:{'guild:41001':3,'user:42001':1},deepSourceReports:{'guild:41001':1},
    splits:{train:{sourceReports:{'guild:41001':3}},validation:{sourceReports:{'user:42001':1}}},
  };
  const job={sourceSeen:['guild:41001','user:42001','guild:43001'],sourceQueue:[{type:'guild',id:43001}],candidateSourceByCode:{seedA:'guild:41001'}};
  const controls=[{source:'guild:41001'}];
  const evidenceGroups={patterns:[{independentGroups:[{source:'user:42001'}]}]};
  const stability={fingerprint:'b'.repeat(40),patterns:[{sourceEffects:[{source:'guild:41001'}]}]};
  const lineage=buildGlobalBossLearningSourceLineageV1({aggregate,job,matchedNullControls:controls,evidenceGroups,stability});
  assert.equal(lineage.complete,true);
  assert.deepEqual(lineage.observedCombatSourceKeys,['guild:41001','user:42001']);
  assert.deepEqual(lineage.priorLearningSourceKeys,['guild:41001','guild:43001','user:42001']);

  const pool=buildUntouchedHoldoutSourcePoolV1({
    scope:{encounterId:7777,difficulty:5,partition:9},stability,lineage,discoveredAt:123456,
    discoveredSources:[
      {type:'guild',id:41001,name:'Previously Used'},
      {type:'guild',id:43001,name:'Previously Discovered'},
      {type:'guild',id:44001,name:'Unseen Alpha'},
      {type:'user',id:45001,name:'Unseen Beta'},
    ],
  });
  assert.equal(pool.summary.discoveredSources,4);
  assert.equal(pool.summary.eligibleUnseenSources,2);
  assert.equal(pool.candidates.find(row=>row.source==='guild:41001').preexistingCorpusMember,true);
  assert.equal(pool.candidates.find(row=>row.source==='guild:43001').priorLearningUse,true);
  assert.equal(pool.candidates.find(row=>row.source==='guild:44001').eligible,true);
  assert.equal(pool.candidates.find(row=>row.source==='user:45001').eligible,true);
  assert.deepEqual(reservationCandidatesFromSourcePoolV1(pool).map(row=>row.source),['guild:44001','user:45001']);
});

test('incomplete lineage never assumes an apparently new source is untouched',()=>{
  const stability={fingerprint:'c'.repeat(40),patterns:[]};
  const lineage=buildGlobalBossLearningSourceLineageV1({aggregate:null,job:null,stability,lineageComplete:false});
  assert.equal(lineage.complete,false);
  const pool=buildUntouchedHoldoutSourcePoolV1({scope:{encounterId:8800,difficulty:4,partition:2},stability,lineage,discoveredSources:[{type:'guild',id:99001}]});
  const candidate=pool.candidates[0];
  assert.equal(candidate.eligible,false);
  assert.equal(candidate.priorLearningUse,null);
  assert.equal(candidate.combatEvidenceObservedBeforeReservation,null);
  assert.ok(candidate.ineligibilityReasons.includes('lineage-incomplete'));
});

test('metadata discovery marked as combat-inspected cannot enter untouched reservation',()=>{
  const stability={fingerprint:'d'.repeat(40),patterns:[]};
  const lineage=buildGlobalBossLearningSourceLineageV1({aggregate:{sourceReports:{},splits:{}},job:{sourceSeen:[],sourceQueue:[]},stability});
  const pool=buildUntouchedHoldoutSourcePoolV1({scope:{encounterId:9911,difficulty:5,partition:3},stability,lineage,discoveredSources:[{type:'guild',id:99002,metadataOnlyDiscovery:false}]});
  assert.equal(pool.candidates[0].eligible,false);
  assert.ok(pool.candidates[0].ineligibilityReasons.includes('combat-inspected-during-source-discovery'));
});

test('external guild owned by a configured HOME uploader is rejected',()=>{
  const previous=process.env.AVOID_HOME_WCL_OWNER_IDS;
  process.env.AVOID_HOME_WCL_OWNER_IDS='765001';
  try{
    const stability={fingerprint:'e'.repeat(40),patterns:[]};
    const lineage=buildGlobalBossLearningSourceLineageV1({aggregate:{sourceReports:{},splits:{}},job:{sourceSeen:[],sourceQueue:[]},stability});
    const pool=buildUntouchedHoldoutSourcePoolV1({scope:{encounterId:7711,difficulty:5,partition:8},stability,lineage,discoveredSources:[{type:'guild',id:888001,ownerId:765001,metadataOnlyDiscovery:true}]});
    assert.equal(pool.candidates[0].homeSource,true);
    assert.equal(pool.candidates[0].eligible,false);
    assert.ok(pool.candidates[0].ineligibilityReasons.includes('home-source'));
  }finally{
    if(previous===undefined)delete process.env.AVOID_HOME_WCL_OWNER_IDS;else process.env.AVOID_HOME_WCL_OWNER_IDS=previous;
  }
});
