import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCanonicalDeepTopUpV378 } from '../../server/corpus/model-policy-v378.mjs';
import { filterCanonicalWideProfilesForDeep, resolveCanonicalWideTargetPulls, resolveTargetedDeepRequest } from '../../server/corpus/targeted-deep-v373.mjs';
import { QUERY_GUIDED_DEEP_POLICY_VERSION } from '../../server/corpus/query-guided-deep-v1.mjs';

function residualModel(){
  return {
    corpus:{wideReports:183,deepReports:56},
    validation:{publishChecks:{}},
    learning:{
      sampling:{checks:{
        homeSourceExcluded:true,
        scopeIsolation:true,
        sourceIdentityComplete:true,
        sourceReportBalance:true,
        sourcePullBalance:true,
        outcomeCoverage:true,
        deepSourceBalance:true,
        deepSourcePullBalance:true,
        deepOutcomeCoverage:true,
      }},
      enrichmentRecommendation:{
        priority:'high',
        mode:'targeted-deep',
        strategy:'query-guided-existing-wide',
        policyVersion:'query-guided-recommendation-v2',
        suggestedAdditionalWidePulls:0,
        suggestedAdditionalWideReports:0,
        suggestedAdditionalDeepPulls:12,
        suggestedAdditionalDeepReports:12,
        estimatedExistingWideReportsAvailableForDeep:127,
        deficits:{widePulls:920,deepPulls:4,wideReports:67,deepReports:0,validationReports:13,independentSources:0,validationSources:0},
        queryGuidance:{policyVersion:'query-guided-deep-v3',maxFightsPerReport:6},
      },
    },
  };
}

test('296/300 canonical Deep becomes an exact four-pull top-up instead of the historical 12-report floor',()=>{
  const out=applyCanonicalDeepTopUpV378(residualModel());
  const rec=out.learning.enrichmentRecommendation;
  assert.equal(out.engineVersion,'3.7.8');
  assert.equal(rec.mode,'targeted-deep');
  assert.equal(rec.strategy,'canonical-deep-top-up');
  assert.equal(rec.policyVersion,'query-guided-recommendation-v3');
  assert.equal(rec.suggestedAdditionalWidePulls,0);
  assert.equal(rec.suggestedAdditionalDeepPulls,4);
  assert.equal(rec.suggestedAdditionalDeepReports,4);
  assert.equal(rec.queryGuidance.policyVersion,QUERY_GUIDED_DEEP_POLICY_VERSION);
  assert.equal(rec.queryGuidance.canonicalWideOnly,true);
  assert.equal(rec.queryGuidance.canonicalPostRebuildGoal,true);
  assert.equal(rec.queryGuidance.maxFightsPerReport,1);
  assert.equal(rec.queryGuidance.oneFightPerSourcePreferred,true);
});

test('targeted Deep planner can honor an explicit four-pull request without inflating it to twelve reports',()=>{
  const request=resolveTargetedDeepRequest({addDeepReports:4,addDeepPulls:4,currentPulls:296,currentReports:56});
  assert.deepEqual(request,{requestedReports:4,requestedPulls:4,targetSource:'explicit-canonical-deficit'});
  const pullsOnly=resolveTargetedDeepRequest({addDeepPulls:4,currentPulls:296,currentReports:56});
  assert.equal(pullsOnly.requestedReports,4);
  assert.equal(pullsOnly.requestedPulls,4);
});

test('query-guided Deep filters persisted cache down to the current canonical Wide codes',()=>{
  const profiles=[{code:'A'},{code:'B'},{code:'C'},{code:'D'}];
  assert.deepEqual(filterCanonicalWideProfilesForDeep(profiles,['A','C']).map(x=>x.code),['A','C']);
  assert.deepEqual(filterCanonicalWideProfilesForDeep(profiles,[]).map(x=>x.code),['A','B','C','D']);
});

test('targeted Deep preserves the existing canonical Wide pull target instead of retargeting to the trimmed count',()=>{
  assert.equal(resolveCanonicalWideTargetPulls({targetPulls:1576},{killPulls:183,wipePulls:1397}),1576);
  assert.equal(resolveCanonicalWideTargetPulls({}, {killPulls:183,wipePulls:1397}),1580);
});
