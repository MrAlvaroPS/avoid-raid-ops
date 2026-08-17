import test from 'node:test';
import assert from 'node:assert/strict';
import { applyQueryGuidedDeepRecommendationV377 } from '../../server/corpus/model-policy-v377.mjs';

function model({sourceIdentityComplete=true}={}){
  return {
    corpus:{wideReports:210,deepReports:0},
    learning:{
      actionBottleneck:'relationUnderstandingPct',
      enrichmentFocusAbilityIds:[1243852,1243854],
      sampling:{checks:{
        homeSourceExcluded:true,
        sourceIdentityComplete,
        sourceReportBalance:true,
        sourcePullBalance:true,
        outcomeCoverage:true,
        deepSourceBalance:true,
        deepSourcePullBalance:true,
        deepOutcomeCoverage:false,
      }},
      enrichmentRecommendation:{
        priority:'high',
        mode:'diversity-first',
        suggestedAdditionalWidePulls:500,
        // This deliberately matches the stale broad v3.7.6 recommendation observed
        // on the real zero-Deep Belo'ren model. Query-guided v3.7.7 must not inherit it.
        suggestedAdditionalDeepPulls:400,
        suggestedAdditionalWideReports:0,
        suggestedAdditionalDeepReports:50,
        estimatedExistingWideReportsAvailableForDeep:210,
        deficits:{widePulls:924,deepPulls:300,wideReports:40,deepReports:50,validationReports:13,independentSources:0,validationSources:0},
      },
    },
  };
}

test('zero/under-covered Deep routes to query-guided cached Wide and sizes from canonical deficits',()=>{
  const out=applyQueryGuidedDeepRecommendationV377(model());
  const rec=out.learning.enrichmentRecommendation;
  assert.equal(out.engineVersion,'3.7.7');
  assert.equal(rec.mode,'targeted-deep');
  assert.equal(rec.strategy,'query-guided-existing-wide');
  assert.equal(rec.suggestedAdditionalWidePulls,0);
  assert.equal(rec.suggestedAdditionalWideReports,0);
  assert.equal(rec.suggestedAdditionalDeepReports,50);
  assert.equal(rec.suggestedAdditionalDeepPulls,300);
  assert.equal(rec.queryGuidance.exactFightIDs,true);
  assert.equal(rec.queryGuidance.surgicalProbesCountTowardDeepCoverage,false);
});

test('explicit zero canonical deficits are not replaced by stale previous suggestions',()=>{
  const input=model();
  input.learning.enrichmentRecommendation.deficits.deepPulls=0;
  input.learning.enrichmentRecommendation.deficits.deepReports=0;
  const out=applyQueryGuidedDeepRecommendationV377(input);
  assert.equal(out.learning.enrichmentRecommendation.mode,'diversity-first');
  assert.equal(out.learning.enrichmentRecommendation.suggestedAdditionalDeepPulls,400);
});

test('real Wide sampling blockers still prevent query-guided Deep from pretending the source pool is trustworthy',()=>{
  const out=applyQueryGuidedDeepRecommendationV377(model({sourceIdentityComplete:false}));
  assert.equal(out.learning.enrichmentRecommendation.mode,'diversity-first');
});
