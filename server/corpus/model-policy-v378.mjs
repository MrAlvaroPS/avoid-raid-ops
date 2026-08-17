import { applyBossSamplingPolicyV377, modelDiagnosticsV377 } from './model-policy-v377.mjs';
import { QUERY_GUIDED_DEEP_POLICY_VERSION } from './query-guided-deep-v1.mjs';

const num=value=>Number.isFinite(Number(value))?Number(value):0;
const clampInt=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Math.max(min,Math.min(max,Math.ceil(num(value))));

export const QUERY_GUIDED_RECOMMENDATION_POLICY_VERSION_V378='query-guided-recommendation-v3';
export const CANONICAL_DEEP_TOPUP_MAX_PULLS=12;

function trustedWideSample(model={}){
  const checks=model?.learning?.sampling?.checks||model?.validation?.publishChecks||{};
  return Boolean(
    checks.homeSourceExcluded
    && checks.scopeIsolation
    && checks.sourceIdentityComplete
    && checks.sourceReportBalance
    && checks.sourcePullBalance
    && checks.outcomeCoverage
  );
}

function canonicalDeepDeficits(model={}){
  const rec=model?.learning?.enrichmentRecommendation||{};
  const deficits=rec.deficits||{};
  return {
    pulls:Math.max(0,num(deficits.deepPulls)),
    reports:Math.max(0,num(deficits.deepReports)),
    existingWideForDeep:Math.max(
      0,
      num(rec.estimatedExistingWideReportsAvailableForDeep),
      num(model?.corpus?.wideReports)-num(model?.corpus?.deepReports),
    ),
  };
}

export function applyCanonicalDeepTopUpV378(model){
  if(!model)return null;
  const learning=model.learning||{};
  const previous=learning.enrichmentRecommendation||{};
  const d=canonicalDeepDeficits(model);

  if(trustedWideSample(model)
      && d.reports===0
      && d.pulls>0
      && d.pulls<=CANONICAL_DEEP_TOPUP_MAX_PULLS
      && d.existingWideForDeep>0){
    // Residual canonical deficits after a successful acquisition/rebuild should be closed
    // with the smallest trustworthy query, not by falling back to the historical 12-report
    // default. Prefer one exact fight from each independent canonical Wide report so the
    // top-up adds flexibility to the canonical sampler without concentrating one raid night.
    const requestedPulls=clampInt(d.pulls,1,CANONICAL_DEEP_TOPUP_MAX_PULLS);
    const requestedReports=Math.min(d.existingWideForDeep,requestedPulls);
    model.learning={
      ...learning,
      actionBottleneck:'dataDepthPct',
      enrichmentRecommendation:{
        ...previous,
        priority:'high',
        mode:'targeted-deep',
        strategy:'canonical-deep-top-up',
        policyVersion:QUERY_GUIDED_RECOMMENDATION_POLICY_VERSION_V378,
        reason:`Canonical Deep is only ${requestedPulls} pull${requestedPulls===1?'':'s'} below its publication minimum while the Deep report gate already passes. Query only canonical Wide reports, prefer one exact fight per independent source, then rebuild and judge the post-sampling canonical count.`,
        suggestedAdditionalWidePulls:0,
        suggestedAdditionalWideReports:0,
        suggestedAdditionalDeepPulls:requestedPulls,
        suggestedAdditionalDeepReports:requestedReports,
        estimatedExistingWideReportsAvailableForDeep:d.existingWideForDeep,
        queryGuidance:{
          ...(previous.queryGuidance||{}),
          policyVersion:QUERY_GUIDED_DEEP_POLICY_VERSION,
          exactFightIDs:true,
          canonicalWideOnly:true,
          canonicalPostRebuildGoal:true,
          independentSourceFirst:true,
          oneFightPerSourcePreferred:true,
          maxFightsPerReport:1,
          goalSemantics:'minimum-both',
          surgicalProbesCountTowardDeepCoverage:false,
        },
      },
    };
  } else if(previous.mode==='targeted-deep'&&previous.strategy==='query-guided-existing-wide'){
    model.learning={
      ...learning,
      enrichmentRecommendation:{
        ...previous,
        policyVersion:QUERY_GUIDED_RECOMMENDATION_POLICY_VERSION_V378,
        queryGuidance:{
          ...(previous.queryGuidance||{}),
          policyVersion:QUERY_GUIDED_DEEP_POLICY_VERSION,
          canonicalWideOnly:true,
          canonicalPostRebuildGoal:true,
        },
      },
    };
  }

  model.engineVersion='3.7.8';
  model.policyVersion='relation-provenance-v2+boss-sampling-v3+query-guided-rec-v3';
  model.evaluatedAt=Date.now();
  return model;
}

export function applyBossSamplingPolicyV378(input,aggregate=null){
  return applyCanonicalDeepTopUpV378(applyBossSamplingPolicyV377(input,aggregate));
}

export function modelDiagnosticsV378(input,aggregate=null){
  const base=modelDiagnosticsV377(input,aggregate)||{};
  const model=applyBossSamplingPolicyV378(input,aggregate);
  if(!model)return null;
  return {
    ...base,
    engineVersion:model.engineVersion,
    enrichmentRecommendation:model.learning?.enrichmentRecommendation||null,
    actionBottleneck:model.learning?.actionBottleneck||base.actionBottleneck||null,
    policyVersion:model.policyVersion,
    evaluatedAt:model.evaluatedAt,
  };
}
