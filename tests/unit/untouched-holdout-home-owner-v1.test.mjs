import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGlobalBossLearningSourceLineageV1,buildUntouchedHoldoutSourcePoolV1 } from '../../server/corpus/untouched-holdout-source-pool-v1.mjs';

test('external guild report uploaded by configured HOME owner is excluded from GLOBAL BOSS Holdout',()=>{
  const previous=process.env.AVOID_HOME_WCL_OWNER_IDS;
  process.env.AVOID_HOME_WCL_OWNER_IDS='765001';
  try{
    const stability={fingerprint:'9'.repeat(40),patterns:[]};
    const lineage=buildGlobalBossLearningSourceLineageV1({aggregate:{sourceReports:{},splits:{}},job:{sourceSeen:[],sourceQueue:[]},stability});
    const pool=buildUntouchedHoldoutSourcePoolV1({
      scope:{encounterId:5432,difficulty:5,partition:6},stability,lineage,
      discoveredSources:[{type:'guild',id:888001,name:'External Guild',ownerId:765001,reportCode:'SYNTHETIC001',metadataOnlyDiscovery:true}],
    });
    assert.equal(pool.candidates.length,1);
    assert.equal(pool.candidates[0].source,'guild:888001');
    assert.equal(pool.candidates[0].homeSource,true);
    assert.equal(pool.candidates[0].eligible,false);
    assert.equal(pool.candidates[0].reportCode,'SYNTHETIC001');
    assert.ok(pool.candidates[0].ineligibilityReasons.includes('home-source'));
  }finally{
    if(previous===undefined)delete process.env.AVOID_HOME_WCL_OWNER_IDS;else process.env.AVOID_HOME_WCL_OWNER_IDS=previous;
  }
});
