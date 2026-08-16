import {
  IRIS_KNOWLEDGE_CONTRACT_VERSION,
  homeGuildId,
  isHomeGuildProfile,
  profileMatchesBossScope,
  sanitizeGlobalBossProfile,
} from '../knowledge/scopes.mjs';

export const BOSS_SAMPLING_POLICY_VERSION = 'boss-corpus-sampling-v2';
export const OUTCOME_STRATA = Object.freeze(['kill', 'deepWipe', 'midWipe', 'earlyWipe']);
export const OUTCOME_TARGET_WEIGHTS = Object.freeze({ kill: 0.20, deepWipe: 0.30, midWipe: 0.30, earlyWipe: 0.20 });
// Retained as an auditable human-readable policy order; selection itself is pull-deficit aware.
export const OUTCOME_ROUND_ROBIN = Object.freeze(['deepWipe', 'midWipe', 'kill', 'deepWipe', 'midWipe', 'earlyWipe']);

const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
const stableHash = value => {
  let h = 2166136261;
  for (const ch of String(value || '')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export function bossProfileSourceKey(profile = {}) {
  const guildId = num(profile?.guild?.id);
  if (guildId && guildId > 0) return `guild:${guildId}`;
  const ownerId = num(profile?.owner?.id);
  if (ownerId && ownerId > 0) return `user:${ownerId}`;
  return null;
}

export function classifyBossFightOutcome(fight = {}) {
  if (fight?.kill) return 'kill';
  const progress = num(fight?.fightPercentage);
  if (progress != null && progress < 50) return 'deepWipe';
  if (progress != null && progress < 90) return 'midWipe';
  return 'earlyWipe';
}

export function bossProfileOutcomeHistogram(profile = {}) {
  const histogram = Object.fromEntries(OUTCOME_STRATA.map(key => [key, 0]));
  const fights = Array.isArray(profile?.fights) ? profile.fights : [];
  if (fights.length) {
    for (const fight of fights) histogram[classifyBossFightOutcome(fight)]++;
    return histogram;
  }
  histogram.kill = Math.max(0, Number(profile?.kills || 0));
  histogram.earlyWipe = Math.max(0, Number(profile?.wipes || 0));
  return histogram;
}

export function bossProfilePullCount(profile = {}) {
  return Object.values(bossProfileOutcomeHistogram(profile)).reduce((sum, count) => sum + Number(count || 0), 0);
}

// Compatibility helper for callers that need one label. The canonical sampler itself
// uses the complete pull histogram, so a report containing a kill plus 40 wipes does
// not get treated as 100% "kill" evidence.
export function classifyBossOutcome(profile = {}) {
  const histogram = bossProfileOutcomeHistogram(profile);
  return OUTCOME_STRATA.slice().sort((a, b) => histogram[b] - histogram[a] || OUTCOME_STRATA.indexOf(a) - OUTCOME_STRATA.indexOf(b))[0];
}

function emptyStrataStats() {
  return Object.fromEntries(OUTCOME_STRATA.map(key => [key, { reports: 0, pulls: 0, sources: 0 }]));
}

function selectionStats(selected = []) {
  const sourceReports = new Map();
  const sourcePulls = new Map();
  const stratumSources = Object.fromEntries(OUTCOME_STRATA.map(key => [key, new Set()]));
  const strata = emptyStrataStats();
  let pulls = 0;
  for (const profile of selected) {
    const source = bossProfileSourceKey(profile);
    if (!source) continue;
    const histogram = bossProfileOutcomeHistogram(profile);
    const count = Object.values(histogram).reduce((sum, value) => sum + Number(value || 0), 0);
    pulls += count;
    sourceReports.set(source, (sourceReports.get(source) || 0) + 1);
    sourcePulls.set(source, (sourcePulls.get(source) || 0) + count);
    for (const key of OUTCOME_STRATA) {
      const n = Number(histogram[key] || 0);
      if (!n) continue;
      strata[key].reports++;
      strata[key].pulls += n;
      stratumSources[key].add(source);
    }
  }
  for (const key of OUTCOME_STRATA) strata[key].sources = stratumSources[key].size;
  const reports = selected.length;
  const maxSourceReports = Math.max(0, ...sourceReports.values());
  const maxSourcePulls = Math.max(0, ...sourcePulls.values());
  return {
    reports,
    pulls,
    sources: sourceReports.size,
    maxSourceReportShare: reports ? maxSourceReports / reports : 0,
    maxSourcePullShare: pulls ? maxSourcePulls / pulls : 0,
    sourceReports: Object.fromEntries([...sourceReports].sort(([a], [b]) => a.localeCompare(b))),
    sourcePulls: Object.fromEntries([...sourcePulls].sort(([a], [b]) => a.localeCompare(b))),
    strata,
  };
}

function normalizeProfiles(profiles = [], scope = {}) {
  const accepted = [];
  const excluded = { homeGuild: 0, wrongScope: 0, missingSource: 0, duplicateCode: 0 };
  const seen = new Set();
  for (const raw of profiles || []) {
    if (!raw || !raw.code) continue;
    const code = String(raw.code);
    if (seen.has(code)) { excluded.duplicateCode++; continue; }
    seen.add(code);
    if (!profileMatchesBossScope(raw, scope)) { excluded.wrongScope++; continue; }
    if (isHomeGuildProfile(raw)) { excluded.homeGuild++; continue; }
    const clean = sanitizeGlobalBossProfile(raw);
    if (!bossProfileSourceKey(clean)) { excluded.missingSource++; continue; }
    accepted.push(clean);
  }
  return { accepted, excluded };
}

function buildSourceQueues(profiles = []) {
  const queues = new Map();
  for (const profile of profiles) {
    const source = bossProfileSourceKey(profile);
    if (!source) continue;
    if (!queues.has(source)) queues.set(source, []);
    queues.get(source).push(profile);
  }
  for (const queue of queues.values()) {
    queue.sort((a, b) => (num(a?.startTime) || 0) - (num(b?.startTime) || 0) || String(a.code).localeCompare(String(b.code)));
  }
  return queues;
}

function desiredPulls(pullGoal, availableStats) {
  const base = Number.isFinite(Number(pullGoal)) ? Math.max(0, Number(pullGoal)) : Number(availableStats?.pulls || 0);
  return Object.fromEntries(OUTCOME_STRATA.map(key => [key, base * OUTCOME_TARGET_WEIGHTS[key]]));
}

function profileDeficitGain(profile, currentStrata, desired) {
  const histogram = bossProfileOutcomeHistogram(profile);
  let gain = 0;
  for (const key of OUTCOME_STRATA) {
    const deficit = Math.max(0, Number(desired[key] || 0) - Number(currentStrata[key] || 0));
    if (!deficit) continue;
    const covered = Math.min(deficit, Number(histogram[key] || 0));
    gain += covered / Math.max(1, Number(desired[key] || 1));
  }
  return gain;
}

function bestProfileForSource(queue, currentStrata, desired) {
  if (!queue?.length) return null;
  return queue.slice().sort((a, b) =>
    profileDeficitGain(b, currentStrata, desired) - profileDeficitGain(a, currentStrata, desired)
    || bossProfilePullCount(a) - bossProfilePullCount(b)
    || stableHash(a.code) - stableHash(b.code)
  )[0];
}

export function buildBalancedBossSample(profiles = [], {
  scope,
  targetPulls = Number.POSITIVE_INFINITY,
  targetReports = Number.POSITIVE_INFINITY,
  mode = 'wide',
} = {}) {
  const normalized = normalizeProfiles(profiles, scope);
  const queues = buildSourceQueues(normalized.accepted);
  const available = selectionStats(normalized.accepted);
  const selected = [];
  const sourceReportCount = new Map();
  const sourcePullCount = new Map();
  const currentStrata = Object.fromEntries(OUTCOME_STRATA.map(key => [key, 0]));
  const pullGoal = Number.isFinite(Number(targetPulls)) ? Math.max(0, Number(targetPulls)) : Number.POSITIVE_INFINITY;
  const reportGoal = Number.isFinite(Number(targetReports)) ? Math.max(0, Number(targetReports)) : Number.POSITIVE_INFINITY;
  const desired = desiredPulls(pullGoal, available);
  let selectedPulls = 0;

  while (selected.length < reportGoal && selectedPulls < pullGoal) {
    const activeSources = [...queues.entries()].filter(([, queue]) => queue.length > 0).map(([source]) => source);
    if (!activeSources.length) break;
    // Strict source round-robin: a source cannot take its second canonical report while
    // another still-active source has taken fewer reports.
    const minReports = Math.min(...activeSources.map(source => sourceReportCount.get(source) || 0));
    const sourceRound = activeSources.filter(source => (sourceReportCount.get(source) || 0) === minReports);
    const ranked = sourceRound.map(source => {
      const profile = bestProfileForSource(queues.get(source), currentStrata, desired);
      return { source, profile, gain: profile ? profileDeficitGain(profile, currentStrata, desired) : -1 };
    }).filter(row => row.profile).sort((a, b) =>
      b.gain - a.gain
      || (sourcePullCount.get(a.source) || 0) - (sourcePullCount.get(b.source) || 0)
      || stableHash(a.source) - stableHash(b.source)
      || a.source.localeCompare(b.source)
    );
    const pick = ranked[0];
    if (!pick) break;
    const queue = queues.get(pick.source);
    const index = queue.findIndex(profile => profile.code === pick.profile.code);
    const [profile] = queue.splice(index, 1);
    const histogram = bossProfileOutcomeHistogram(profile);
    const pulls = bossProfilePullCount(profile);
    selected.push(profile);
    selectedPulls += pulls;
    sourceReportCount.set(pick.source, (sourceReportCount.get(pick.source) || 0) + 1);
    sourcePullCount.set(pick.source, (sourcePullCount.get(pick.source) || 0) + pulls);
    for (const key of OUTCOME_STRATA) currentStrata[key] += Number(histogram[key] || 0);
  }

  const stats = selectionStats(selected);
  return {
    policyVersion: BOSS_SAMPLING_POLICY_VERSION,
    contractVersion: IRIS_KNOWLEDGE_CONTRACT_VERSION,
    mode,
    scope: { encounterId: Number(scope?.encounterId), difficulty: Number(scope?.difficulty), partition: Number(scope?.partition) },
    homeGuildId: homeGuildId(),
    selected,
    selectedCodes: selected.map(profile => String(profile.code)),
    stats,
    available,
    excluded: normalized.excluded,
    targetPullWeights: { ...OUTCOME_TARGET_WEIGHTS },
  };
}

export function buildBossSamplingManifest({ scope, wideSample, deepSample, createdAt = Date.now() } = {}) {
  const wide = wideSample || { stats: selectionStats([]), available: selectionStats([]), excluded: {}, selected:[] };
  const deep = deepSample || { stats: selectionStats([]), available: selectionStats([]), excluded: {}, selected:[] };
  const selected = [...(wide.selected || []), ...(deep.selected || [])];
  const homeGuildSelectedReports = selected.filter(isHomeGuildProfile).length;
  const selectedWrongScopeReports = selected.filter(profile => !profileMatchesBossScope(profile, scope)).length;
  const selectedMissingSourceReports = selected.filter(profile => !bossProfileSourceKey(profile)).length;
  return {
    schemaVersion: 1,
    policyVersion: BOSS_SAMPLING_POLICY_VERSION,
    contractVersion: IRIS_KNOWLEDGE_CONTRACT_VERSION,
    scope: { kind: 'global-boss', encounterId: Number(scope?.encounterId), difficulty: Number(scope?.difficulty), partition: Number(scope?.partition) },
    homeGuildId: homeGuildId(),
    homeGuildExcluded: Number(wide?.excluded?.homeGuild || 0) + Number(deep?.excluded?.homeGuild || 0),
    homeGuildSelectedReports,
    wrongScopeExcluded: Number(wide?.excluded?.wrongScope || 0) + Number(deep?.excluded?.wrongScope || 0),
    selectedWrongScopeReports,
    missingSourceExcluded: Number(wide?.excluded?.missingSource || 0) + Number(deep?.excluded?.missingSource || 0),
    selectedMissingSourceReports,
    wide: { ...wide.stats, available: wide.available, excluded: wide.excluded },
    deep: { ...deep.stats, available: deep.available, excluded: deep.excluded },
    outcomePolicy: {
      strata: [...OUTCOME_STRATA],
      targetPullWeights: { ...OUTCOME_TARGET_WEIGHTS },
      roundRobin: [...OUTCOME_ROUND_ROBIN],
      meaning: 'Canonical sampling is source-round-robin first and fills deficits using actual pull outcomes. A mixed report contributes each fight to its real kill/deep/mid/early stratum.',
    },
    identityPolicy: {
      globalBossStoresPlayerIdentity: false,
      homeGuildParticipatesInBossTrainOrHoldout: false,
      homeRaidPlayerKnowledgeScope: 'home-guild-only',
    },
    createdAt,
  };
}

export function samplingPublicationChecks(manifest, {
  maxSourceReportShare = 0.10,
  maxSourcePullShare = 0.12,
  maxDeepSourceReportShare = 0.20,
  minSourcesPerOutcome = 8,
  minDeepSourcesPerOutcome = 3,
} = {}) {
  const wide = manifest?.wide || {};
  const deep = manifest?.deep || {};
  const wideStrata = wide.strata || {};
  const deepStrata = deep.strata || {};
  const allWideOutcomes = OUTCOME_STRATA.every(key => Number(wideStrata?.[key]?.sources || 0) >= minSourcesPerOutcome);
  const allDeepOutcomes = OUTCOME_STRATA.every(key => Number(deepStrata?.[key]?.sources || 0) >= minDeepSourcesPerOutcome);
  return {
    homeGuildExcluded: Number(manifest?.homeGuildSelectedReports || 0) === 0,
    scopeIsolation: Number(manifest?.selectedWrongScopeReports || 0) === 0,
    sourceIdentityComplete: Number(manifest?.selectedMissingSourceReports || 0) === 0,
    sourceReportBalance: Number(wide.maxSourceReportShare || 0) <= maxSourceReportShare,
    sourcePullBalance: Number(wide.maxSourcePullShare || 0) <= maxSourcePullShare,
    deepSourceBalance: Number(deep.maxSourceReportShare || 0) <= maxDeepSourceReportShare,
    outcomeCoverage: allWideOutcomes,
    deepOutcomeCoverage: allDeepOutcomes,
  };
}
