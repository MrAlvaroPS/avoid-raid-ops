import { applyEncounterPolicyV375, modelDiagnosticsV375 } from './model-policy-v375.mjs';
import { CORPUS_DEFAULTS } from './config.mjs';
import { IRIS_KNOWLEDGE_CONTRACT_VERSION, homeGuildId } from '../knowledge/scopes.mjs';
import { BOSS_SAMPLING_POLICY_VERSION, OUTCOME_STRATA, samplingPublicationChecks } from './sampling-v2.mjs';

const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const clamp = value => Math.max(0, Math.min(1, num(value)));
const grade = score => score >= 95 ? 'VERIFIED' : score >= 85 ? 'MATURE' : score >= 70 ? 'STRONG' : score >= 50 ? 'PARTIAL' : score >= 25 ? 'LEARNING' : 'DISCOVERY';
const uniq = values => [...new Set((values || []).filter(Boolean))];

function coverageScore(strata = {}, target = 1) {
  if (!OUTCOME_STRATA.length) return 1;
  return OUTCOME_STRATA.reduce((sum, key) => sum + clamp(num(strata?.[key]?.sources) / Math.max(1, target)), 0) / OUTCOME_STRATA.length;
}

function samplingScore(manifest) {
  if (!manifest) return { score: 0, balance: 0, outcomes: 0, deepOutcomes: 0 };
  const wide = manifest.wide || {};
  const deep = manifest.deep || {};
  const reportBalance = clamp(1 - Math.max(0, num(wide.maxSourceReportShare) - CORPUS_DEFAULTS.maxSourceReportShareToPublish) / Math.max(.01, 1 - CORPUS_DEFAULTS.maxSourceReportShareToPublish));
  const pullBalance = clamp(1 - Math.max(0, num(wide.maxSourcePullShare) - CORPUS_DEFAULTS.maxSourcePullShareToPublish) / Math.max(.01, 1 - CORPUS_DEFAULTS.maxSourcePullShareToPublish));
  const deepBalance = clamp(1 - Math.max(0, num(deep.maxSourceReportShare) - CORPUS_DEFAULTS.maxDeepSourceReportShareToPublish) / Math.max(.01, 1 - CORPUS_DEFAULTS.maxDeepSourceReportShareToPublish));
  const outcomes = coverageScore(wide.strata, CORPUS_DEFAULTS.minSourcesPerOutcomeToPublish);
  const deepOutcomes = coverageScore(deep.strata, CORPUS_DEFAULTS.minDeepSourcesPerOutcomeToPublish);
  const balance = .4 * reportBalance + .4 * pullBalance + .2 * deepBalance;
  return { score: .55 * balance + .30 * outcomes + .15 * deepOutcomes, balance, outcomes, deepOutcomes };
}

export function applyBossSamplingPolicyV376(input, aggregate = null) {
  if (!input) return null;
  const model = applyEncounterPolicyV375(input, aggregate);
  const manifest = aggregate?.sampling || input?.sampling || null;
  const thresholds = {
    ...(model?.validation?.thresholds || {}),
    maxSourceReportShare: CORPUS_DEFAULTS.maxSourceReportShareToPublish,
    maxSourcePullShare: CORPUS_DEFAULTS.maxSourcePullShareToPublish,
    maxDeepSourceReportShare: CORPUS_DEFAULTS.maxDeepSourceReportShareToPublish,
    minSourcesPerOutcome: CORPUS_DEFAULTS.minSourcesPerOutcomeToPublish,
    minDeepSourcesPerOutcome: CORPUS_DEFAULTS.minDeepSourcesPerOutcomeToPublish,
  };
  const samplingChecks = manifest ? samplingPublicationChecks(manifest, {
    maxSourceReportShare: thresholds.maxSourceReportShare,
    maxSourcePullShare: thresholds.maxSourcePullShare,
    maxDeepSourceReportShare: thresholds.maxDeepSourceReportShare,
    minSourcesPerOutcome: thresholds.minSourcesPerOutcome,
    minDeepSourcesPerOutcome: thresholds.minDeepSourcesPerOutcome,
  }) : {
    homeGuildExcluded: false,
    homeSourceExcluded: false,
    scopeIsolation: false,
    sourceIdentityComplete: false,
    sourceReportBalance: false,
    sourcePullBalance: false,
    deepSourceBalance: false,
    outcomeCoverage: false,
    deepOutcomeCoverage: false,
  };
  const q = samplingScore(manifest);
  const components = { ...(model?.learning?.components || {}), samplingBalancePct: Math.round(q.score * 1000) / 10 };
  let scorePct = num(model?.learning?.scorePct);
  const caps = [...(model?.learning?.caps || [])];
  if (!manifest) { scorePct = Math.min(scorePct, 49); caps.push('sampling-manifest-missing'); }
  if (!samplingChecks.sourceIdentityComplete) { scorePct = Math.min(scorePct, 49); caps.push('source-identity-incomplete'); }
  if (!samplingChecks.sourceReportBalance || !samplingChecks.sourcePullBalance) { scorePct = Math.min(scorePct, 74); caps.push('source-concentration'); }
  if (!samplingChecks.outcomeCoverage) { scorePct = Math.min(scorePct, 69); caps.push('outcome-strata-under-covered'); }
  if (!samplingChecks.deepSourceBalance || !samplingChecks.deepOutcomeCoverage) { scorePct = Math.min(scorePct, 79); caps.push('deep-sample-under-balanced'); }
  if (!samplingChecks.homeSourceExcluded || Number(manifest?.homeSourceSelectedReports || 0) > 0) { scorePct = 0; caps.push('home-source-contamination'); }

  const previousRec = model?.learning?.enrichmentRecommendation || {};
  const samplingBlocked = !samplingChecks.homeSourceExcluded || !samplingChecks.sourceIdentityComplete || !samplingChecks.sourceReportBalance || !samplingChecks.sourcePullBalance || !samplingChecks.outcomeCoverage || !samplingChecks.deepOutcomeCoverage;
  const recommendation = samplingBlocked ? {
    ...previousRec,
    priority: 'high',
    mode: 'diversity-first',
    suggestedAdditionalWidePulls: Math.max(500, num(previousRec.suggestedAdditionalWidePulls)),
    suggestedAdditionalDeepPulls: Math.max(100, num(previousRec.suggestedAdditionalDeepPulls)),
    reason: 'Canonical boss sampling is not yet clean and balanced across trusted independent sources and progression outcomes. AvoiD/home sources remain evaluation-only.',
  } : previousRec;

  const checks = {
    ...(model?.validation?.publishChecks || {}),
    samplingManifest: Boolean(manifest),
    homeGuildExcluded: Boolean(samplingChecks.homeGuildExcluded) && Number(manifest?.homeGuildSelectedReports || 0) === 0,
    homeSourceExcluded: Boolean(samplingChecks.homeSourceExcluded) && Number(manifest?.homeSourceSelectedReports || 0) === 0,
    scopeIsolation: Boolean(samplingChecks.scopeIsolation),
    sourceIdentityComplete: Boolean(samplingChecks.sourceIdentityComplete),
    sourceReportBalance: Boolean(samplingChecks.sourceReportBalance),
    sourcePullBalance: Boolean(samplingChecks.sourcePullBalance),
    deepSourceBalance: Boolean(samplingChecks.deepSourceBalance),
    outcomeCoverage: Boolean(samplingChecks.outcomeCoverage),
    deepOutcomeCoverage: Boolean(samplingChecks.deepOutcomeCoverage),
  };

  model.engineVersion = '3.7.6-sampling-v2';
  model.policyVersion = 'relation-provenance-v2+boss-sampling-v2';
  model.status = 'candidate';
  model.knowledgeContract = {
    version: IRIS_KNOWLEDGE_CONTRACT_VERSION,
    globalBossScope: 'encounter+difficulty+partition',
    homeGuildId: homeGuildId(),
    homeGuildParticipatesInBossTrainOrHoldout: false,
    knownHomeUploadersParticipateInBossTrainOrHoldout: false,
    externalPlayersParticipateInHomeRaidLedger: false,
  };
  model.sampling = manifest ? {
    policyVersion: BOSS_SAMPLING_POLICY_VERSION,
    scope: manifest.scope,
    wide: manifest.wide,
    deep: manifest.deep,
    outcomePolicy: manifest.outcomePolicy,
    homeGuildId: manifest.homeGuildId,
    homeOwnerIds: manifest.homeOwnerIds,
    homeSourceExcluded: manifest.homeSourceExcluded,
    homeGuildExcluded: manifest.homeGuildExcluded,
    homeOwnerExcluded: manifest.homeOwnerExcluded,
    homeSourceSelectedReports: Number(manifest.homeSourceSelectedReports || 0),
    homeGuildSelectedReports: Number(manifest.homeGuildSelectedReports || 0),
    homeOwnerSelectedReports: Number(manifest.homeOwnerSelectedReports || 0),
    wrongScopeExcluded: manifest.wrongScopeExcluded,
    missingSourceExcluded: manifest.missingSourceExcluded,
    cachedWideReports: manifest.cachedWideReports,
    cachedDeepReports: manifest.cachedDeepReports,
  } : null;
  model.validation = { ...(model.validation || {}), thresholds, publishChecks: checks, publicationMode: 'manual-review-hold-v3.7.6-sampling-v2' };
  model.learning = {
    ...(model.learning || {}),
    scorePct,
    grade: grade(scorePct),
    components,
    caps: uniq(caps),
    enrichmentRecommendation: recommendation,
    sampling: {
      scorePct: components.samplingBalancePct,
      balancePct: Math.round(q.balance * 1000) / 10,
      outcomeCoveragePct: Math.round(q.outcomes * 1000) / 10,
      deepOutcomeCoveragePct: Math.round(q.deepOutcomes * 1000) / 10,
      checks: samplingChecks,
      meaning: 'Measures trusted independent-source balance plus actual kill/deep-wipe/mid-wipe/early-wipe pull coverage in the canonical global boss sample.',
    },
  };
  model.evaluatedAt = Date.now();
  return model;
}

export function modelDiagnosticsV376(input, aggregate = null) {
  const base = modelDiagnosticsV375(input, aggregate);
  const model = applyBossSamplingPolicyV376(input, aggregate);
  if (!model) return null;
  return {
    ...(base || {}),
    engineVersion: model.engineVersion,
    learnedPct: model.learning.scorePct,
    learningGrade: model.learning.grade,
    learningComponents: model.learning.components,
    enrichmentRecommendation: model.learning.enrichmentRecommendation,
    publishChecks: model.validation.publishChecks,
    thresholds: model.validation.thresholds,
    publicationMode: model.validation.publicationMode,
    sampling: model.sampling,
    knowledgeContract: model.knowledgeContract,
  };
}
