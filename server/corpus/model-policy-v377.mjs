import { applyBossSamplingPolicyV376, modelDiagnosticsV376 } from './model-policy-v376.mjs';
import { QUERY_GUIDED_DEEP_POLICY_VERSION } from './query-guided-deep-v1.mjs';

const num=value=>Number.isFinite(Number(value))?Number(value):0;

export const QUERY_GUIDED_RECOMMENDATION_POLICY_VERSION='query-guided-recommendation-v1';

function wideSamplingBlocked(model={}){
  const checks=model?.learning?.sampling?.checks||model?.validation?.publishChecks||{};
  return !checks.homeSourceExcluded
    || !checks.sourceIdentityComplete
    || !checks.sourceReportBalance
    || !checks.sourcePullBalance
    || !checks.outcomeCoverage;
}

export function applyQueryGuidedDeepRecommendationV377(model){
  if(!model)return null;
  const previous=model?.learning?.enrichmentRecommendation||{};
  const deficits=previous.deficits||{};
  const corpus=model?.corpus||{};
  const existingWideForDeep=Math.max(
    0,
    num(previous.estimatedExistingWideReportsAvailableForDeep),
    num(corpus.wideReports)-num(corpus.deepReports),
  );
  const deepReportDeficit=Math.max(0,num(deficits.deepReports||previous.suggestedAdditionalDeepReports));
  const deepPullDeficit=Math.max(0,num(deficits.deepPulls||previous.suggestedAdditionalDeepPulls));

  // A missing/unbalanced Deep sample is not a reason to buy more Wide diversity when
  // the canonical Wide pool itself is already clean. Deep balance is created by Deep
  // acquisition. This specifically avoids the v3.7.6 loop where deepOutcomeCoverage=false
  // forced `diversity-first` even with hundreds of trusted Wide reports ready to upgrade.
  if(!wideSamplingBlocked(model)&&existingWideForDeep>0&&(deepReportDeficit>0||deepPullDeficit>0)){
    const requestedReports=Math.min(existingWideForDeep,Math.max(1,deepReportDeficit||num(previous.suggestedAdditionalDeepReports)||12));
    const requestedPulls=Math.max(requestedReports,deepPullDeficit,num(previous.suggestedAdditionalDeepPulls));
    const recommendation={
      ...previous,
      priority:'high',
      mode:'targeted-deep',
      strategy:'query-guided-existing-wide',
      policyVersion:QUERY_GUIDED_RECOMMENDATION_POLICY_VERSION,
      reason:'Canonical Wide sampling is already trustworthy, while Deep evidence is missing or under-covered. Upgrade cached Wide reports by querying exact fightIDs before discovering more broad reports; ability/time-window probes remain diagnostic-only.',
      suggestedAdditionalWidePulls:0,
      suggestedAdditionalWideReports:0,
      suggestedAdditionalDeepPulls:requestedPulls,
      suggestedAdditionalDeepReports:requestedReports,
      estimatedExistingWideReportsAvailableForDeep:existingWideForDeep,
      queryGuidance:{
        policyVersion:QUERY_GUIDED_DEEP_POLICY_VERSION,
        exactFightIDs:true,
        outcomeDeficitAware:true,
        independentSourceFirst:true,
        maxFightsPerReport:6,
        focusAbilityIds:model?.learning?.enrichmentFocusAbilityIds||[],
        surgicalAbilityFiltersAllowed:true,
        surgicalTimeWindowsAllowed:true,
        surgicalActorFiltersAllowed:true,
        surgicalProbesCountTowardDeepCoverage:false,
      },
    };
    model.learning={...(model.learning||{}),enrichmentRecommendation:recommendation,actionBottleneck:'relationUnderstandingPct'};
  }
  model.engineVersion='3.7.7';
  model.policyVersion='relation-provenance-v2+boss-sampling-v3+query-guided-rec-v1';
  model.evaluatedAt=Date.now();
  return model;
}

export function applyBossSamplingPolicyV377(input,aggregate=null){
  return applyQueryGuidedDeepRecommendationV377(applyBossSamplingPolicyV376(input,aggregate));
}

export function modelDiagnosticsV377(input,aggregate=null){
  const base=modelDiagnosticsV376(input,aggregate)||{};
  const model=applyBossSamplingPolicyV377(input,aggregate);
  if(!model)return null;
  return{
    ...base,
    engineVersion:model.engineVersion,
    enrichmentRecommendation:model.learning?.enrichmentRecommendation||null,
    actionBottleneck:model.learning?.actionBottleneck||base.actionBottleneck||null,
    policyVersion:model.policyVersion,
    evaluatedAt:model.evaluatedAt,
  };
}
