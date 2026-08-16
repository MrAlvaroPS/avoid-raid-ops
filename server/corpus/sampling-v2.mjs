import {
  IRIS_KNOWLEDGE_CONTRACT_VERSION,
  homeGuildId,
  isHomeGuildProfile,
  profileMatchesBossScope,
  sanitizeGlobalBossProfile,
} from '../knowledge/scopes.mjs';

export const BOSS_SAMPLING_POLICY_VERSION = 'boss-corpus-sampling-v2';
export const OUTCOME_STRATA = Object.freeze(['kill', 'deepWipe', 'midWipe', 'earlyWipe']);
// Progression-heavy on purpose: two passes for deep/mid wipes, one for kill/early.
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
  return profile?.code ? `report:${String(profile.code)}` : null;
}

export function bossProfilePullCount(profile = {}) {
  return Array.isArray(profile?.fights) ? profile.fights.length : Math.max(0, Number(profile?.kills || 0) + Number(profile?.wipes || 0));
}

export function classifyBossOutcome(profile = {}) {
  const fights = Array.isArray(profile?.fights) ? profile.fights : [];
  if (fights.some(fight => Boolean(fight?.kill)) || Number(profile?.kills || 0) > 0) return 'kill';
  const percentages = fights.map(fight => num(fight?.fightPercentage)).filter(Number.isFinite);
  const best = percentages.length ? Math.min(...percentages) : 100;
  if (best < 50) return 'deepWipe';
  if (best < 90) return 'midWipe';
  return 'earlyWipe';
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
    const source = bossProfileSourceKey(profile) || `report:${profile?.code || 'unknown'}`;
    const stratum = classifyBossOutcome(profile);
    const count = bossProfilePullCount(profile);
    pulls += count;
    sourceReports.set(source, (sourceReports.get(source) || 0) + 1);
    sourcePulls.set(source, (sourcePulls.get(source) || 0) + count);
    strata[stratum].reports++;
    strata[stratum].pulls += count;
    stratumSources[stratum].add(source);
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
    if (!bossProfileSourceKey(clean)) excluded.missingSource++;
    accepted.push(clean);
  }
  return { accepted, excluded };
}

function buildQueues(profiles = []) {
  const queues = new Map(OUTCOME_STRATA.map(key => [key, new Map()]));
  for (const profile of profiles) {
    const stratum = classifyBossOutcome(profile);
    const source = bossProfileSourceKey(profile) || `report:${profile.code}`;
    const bySource = queues.get(stratum);
    if (!bySource.has(source)) bySource.set(source, []);
    bySource.get(source).push(profile);
  }
  for (const bySource of queues.values()) {
    for (const queue of bySource.values()) {
      queue.sort((a, b) => (num(a?.startTime) || 0) - (num(b?.startTime) || 0) || String(a.code).localeCompare(String(b.code)));
    }
  }
  return queues;
}

function nextSource(bySource, sourceReportCount, sourcePullCount) {
  const candidates = [...bySource.entries()].filter(([, queue]) => queue.length > 0).map(([source]) => source);
  candidates.sort((a, b) =>
    (sourceReportCount.get(a) || 0) - (sourceReportCount.get(b) || 0)
    || (sourcePullCount.get(a) || 0) - (sourcePullCount.get(b) || 0)
    || stableHash(a) - stableHash(b)
    || a.localeCompare(b)
  );
  return candidates[0] || null;
}

export function buildBalancedBossSample(profiles = [], {
  scope,
  targetPulls = Number.POSITIVE_INFINITY,
  targetReports = Number.POSITIVE_INFINITY,
  mode = 'wide',
} = {}) {
  const normalized = normalizeProfiles(profiles, scope);
  const queues = buildQueues(normalized.accepted);
  const selected = [];
  const sourceReportCount = new Map();
  const sourcePullCount = new Map();
  const pullGoal = Number.isFinite(Number(targetPulls)) ? Math.max(0, Number(targetPulls)) : Number.POSITIVE_INFINITY;
  const reportGoal = Number.isFinite(Number(targetReports)) ? Math.max(0, Number(targetReports)) : Number.POSITIVE_INFINITY;
  let selectedPulls = 0;
  let madeProgress = true;

  while (madeProgress && selected.length < reportGoal && selectedPulls < pullGoal) {
    madeProgress = false;
    for (const stratum of OUTCOME_ROUND_ROBIN) {
      if (selected.length >= reportGoal || selectedPulls >= pullGoal) break;
      const bySource = queues.get(stratum);
      const source = nextSource(bySource, sourceReportCount, sourcePullCount);
      if (!source) continue;
      const profile = bySource.get(source).shift();
      if (!profile) continue;
      const pulls = bossProfilePullCount(profile);
      selected.push(profile);
      selectedPulls += pulls;
      sourceReportCount.set(source, (sourceReportCount.get(source) || 0) + 1);
      sourcePullCount.set(source, (sourcePullCount.get(source) || 0) + pulls);
      madeProgress = true;
    }
  }

  const available = selectionStats(normalized.accepted);
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
  };
}

export function buildBossSamplingManifest({ scope, wideSample, deepSample, createdAt = Date.now() } = {}) {
  const wide = wideSample || { stats: selectionStats([]), available: selectionStats([]), excluded: {} };
  const deep = deepSample || { stats: selectionStats([]), available: selectionStats([]), excluded: {} };
  return {
    schemaVersion: 1,
    policyVersion: BOSS_SAMPLING_POLICY_VERSION,
    contractVersion: IRIS_KNOWLEDGE_CONTRACT_VERSION,
    scope: { kind: 'global-boss', encounterId: Number(scope?.encounterId), difficulty: Number(scope?.difficulty), partition: Number(scope?.partition) },
    homeGuildId: homeGuildId(),
    homeGuildExcluded: Number(wide?.excluded?.homeGuild || 0) + Number(deep?.excluded?.homeGuild || 0),
    wrongScopeExcluded: Number(wide?.excluded?.wrongScope || 0) + Number(deep?.excluded?.wrongScope || 0),
    wide: { ...wide.stats, available: wide.available, excluded: wide.excluded },
    deep: { ...deep.stats, available: deep.available, excluded: deep.excluded },
    outcomePolicy: {
      strata: [...OUTCOME_STRATA],
      roundRobin: [...OUTCOME_ROUND_ROBIN],
      meaning: 'Canonical training/holdout is selected by outcome stratum and then by least-represented independent source. Cached reports may be broader than the canonical sample.',
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
    homeGuildExcluded: Number(manifest?.homeGuildId || 0) > 0 && Number(manifest?.homeGuildExcluded || 0) >= 0,
    scopeIsolation: Number(manifest?.wrongScopeExcluded || 0) >= 0,
    sourceReportBalance: Number(wide.maxSourceReportShare || 0) <= maxSourceReportShare,
    sourcePullBalance: Number(wide.maxSourcePullShare || 0) <= maxSourcePullShare,
    deepSourceBalance: Number(deep.maxSourceReportShare || 0) <= maxDeepSourceReportShare,
    outcomeCoverage: allWideOutcomes,
    deepOutcomeCoverage: allDeepOutcomes,
  };
}
