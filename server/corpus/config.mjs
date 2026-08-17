export const CORPUS_DEFAULTS = Object.freeze({
  targetPulls: 1000,
  deepTargetPulls: 200,
  maxTargetPulls: 25000,
  maxCandidateReports: 12000,
  maxRankingPages: 500,
  maxSourcePages: 20,
  sourcePageLimit: 100,
  seedIdentityBatch: 1,
  minimumRateLimitReservePct: 0.18,
  minimumRateLimitReservePoints: 600,
  validationFraction: 0.2,
  minWideReportsToCompile: 100,
  minWideReportsToPublish: 250,
  minDeepReportsToPublish: 50,
  minValidationReportsToPublish: 50,
  minWidePullsToPublish: 2500,
  minDeepPullsToPublish: 300,
  minIndependentSourcesToPublish: 50,
  minValidationSourcesToPublish: 12,
  minValidationMeanToPublish: 0.66,
  // Canonical global-boss sampling gates. These are evaluated after cached reports
  // are rebalanced by independent source and progression outcome.
  maxSourceReportShareToPublish: 0.10,
  maxSourcePullShareToPublish: 0.12,
  maxDeepSourceReportShareToPublish: 0.20,
  maxDeepSourcePullShareToPublish: 0.25,
  minSourcesPerOutcomeToPublish: 8,
  minDeepSourcesPerOutcomeToPublish: 3,
  // v3.7.1 safety hold: the legacy compiler persists candidates, while the
  // encounter-origin policy is applied by the corpus API. Keep auto-publish
  // disabled until the policy layer moves into the persisted compiler path.
  minLearnedPctToPublish: 101,
  minSemanticCoverageToPublish: 0.70,
  minSignalCoverageToPublish: 0.75,
  maxCriticalUnresolvedToPublish: 0,
  systemicFailureThreshold: 3,
});

export function clampCorpusConfig(input={}){
  // v3.5 compatibility: targetReports/deepTargetReports are accepted but interpreted
  // as pull targets. The UI sends targetPulls/deepTargetPulls from v3.5.1 onward.
  const rawTarget=Number(input.targetPulls ?? input.targetReports);
  const rawDeep=Number(input.deepTargetPulls ?? input.deepTargetReports);
  const target=Math.max(100,Math.min(CORPUS_DEFAULTS.maxTargetPulls,rawTarget||CORPUS_DEFAULTS.targetPulls));
  const deep=Math.max(20,Math.min(target,rawDeep||Math.min(CORPUS_DEFAULTS.deepTargetPulls,target)));
  return {...CORPUS_DEFAULTS,targetPulls:Math.round(target),deepTargetPulls:Math.round(deep)};
}
