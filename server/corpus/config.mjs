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
  maxSourceReportShareToPublish: 0.10,
  maxSourcePullShareToPublish: 0.12,
  maxDeepSourceReportShareToPublish: 0.20,
  maxDeepSourcePullShareToPublish: 0.25,
  minSourcesPerOutcomeToPublish: 8,
  minDeepSourcesPerOutcomeToPublish: 3,
  minLearnedPctToPublish: 101,
  minSemanticCoverageToPublish: 0.70,
  minSignalCoverageToPublish: 0.75,
  maxCriticalUnresolvedToPublish: 0,
  systemicFailureThreshold: 3,
});

// Fast, bounded fresh-tier reference. This is deliberately below the canonical
// publication gates: it can support an EARLY GLOBAL REFERENCE, but can never be
// mistaken for accepted/promoted GLOBAL BOSS knowledge.
export const CORPUS_FOUNDATION_PROFILE = Object.freeze({
  targetPulls: 300,
  deepTargetPulls: 60,
  maxCandidateReports: 1200,
  maxRankingPages: 8,
  maxSourcePages: 4,
  sourcePageLimit: 50,
});

const bounded=(value,fallback,min,max)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback;};
export function clampCorpusConfig(input={}){
  const profile=String(input.corpusProfile||input.profile||'full').toLowerCase();
  const base=profile==='foundation'?{...CORPUS_DEFAULTS,...CORPUS_FOUNDATION_PROFILE}:CORPUS_DEFAULTS;
  const rawTarget=Number(input.targetPulls ?? input.targetReports);
  const rawDeep=Number(input.deepTargetPulls ?? input.deepTargetReports);
  const target=Math.max(100,Math.min(base.maxTargetPulls,rawTarget||base.targetPulls));
  const deep=Math.max(20,Math.min(target,rawDeep||Math.min(base.deepTargetPulls,target)));
  return {
    ...base,
    corpusProfile:profile==='foundation'?'foundation':'full',
    targetPulls:Math.round(target),
    deepTargetPulls:Math.round(deep),
    maxCandidateReports:bounded(input.maxCandidateReports,base.maxCandidateReports,100,CORPUS_DEFAULTS.maxCandidateReports),
    maxRankingPages:bounded(input.maxRankingPages,base.maxRankingPages,1,CORPUS_DEFAULTS.maxRankingPages),
    maxSourcePages:bounded(input.maxSourcePages,base.maxSourcePages,1,CORPUS_DEFAULTS.maxSourcePages),
    sourcePageLimit:bounded(input.sourcePageLimit,base.sourcePageLimit,10,CORPUS_DEFAULTS.sourcePageLimit),
  };
}
