export const IRIS_KNOWLEDGE_CONTRACT_VERSION = 'iris-knowledge-contract-v1';
export const GLOBAL_BOSS_SOURCE_ISOLATION_VERSION = 'global-boss-source-isolation-v1';
export const DEFAULT_HOME_GUILD_ID = 788166;

const finitePositive = value => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const parsePositiveIdList = value => [...new Set(String(value || '')
  .split(/[\s,;]+/)
  .map(finitePositive)
  .filter(Boolean))];

export function homeGuildId() {
  // AVOID_HOME_GUILD_ID is the explicit knowledge-boundary override. WCL_GUILD_ID is
  // the established runtime guild setting, so use it as the compatibility fallback
  // instead of allowing report analysis and knowledge isolation to drift apart.
  return finitePositive(process.env.AVOID_HOME_GUILD_ID)
    || finitePositive(process.env.WCL_GUILD_ID)
    || DEFAULT_HOME_GUILD_ID;
}

export function configuredHomeOwnerIds() {
  return parsePositiveIdList(process.env.AVOID_HOME_WCL_OWNER_IDS);
}

export function normalizeHomeOwnerIds(additional = []) {
  return [...new Set([...configuredHomeOwnerIds(), ...(additional || []).map(finitePositive).filter(Boolean)])];
}

export function bossKnowledgeScope({ encounterId, difficulty = 5, partition = 0 } = {}) {
  const encounter = finitePositive(encounterId);
  const diff = finitePositive(difficulty);
  const part = finitePositive(partition);
  if (!encounter) throw new Error('Global boss knowledge requires encounterId');
  if (!diff) throw new Error('Global boss knowledge requires difficulty');
  if (!part) throw new Error('Global boss knowledge requires a resolved partition');
  return Object.freeze({
    kind: 'global-boss',
    encounterId: encounter,
    difficulty: diff,
    partition: part,
    contractVersion: IRIS_KNOWLEDGE_CONTRACT_VERSION,
  });
}

export function raidKnowledgeScope({ guildId = homeGuildId(), encounterId = null, difficulty = null, partition = null } = {}) {
  const guild = finitePositive(guildId);
  if (guild !== homeGuildId()) throw new Error(`Raid/player knowledge is home-guild only (expected guild ${homeGuildId()})`);
  return Object.freeze({
    kind: 'home-raid',
    guildId: guild,
    encounterId: finitePositive(encounterId),
    difficulty: finitePositive(difficulty),
    partition: finitePositive(partition),
    contractVersion: IRIS_KNOWLEDGE_CONTRACT_VERSION,
  });
}

export function isHomeGuildId(value) {
  return finitePositive(value) === homeGuildId();
}

export function isHomeOwnerId(value, additional = []) {
  const owner = finitePositive(value);
  return owner != null && normalizeHomeOwnerIds(additional).includes(owner);
}

export function sourceGuildId(profile = {}) {
  return finitePositive(profile?.guild?.id);
}

export function sourceOwnerId(profile = {}) {
  return finitePositive(profile?.owner?.id);
}

export function isHomeGuildProfile(profile = {}) {
  return isHomeGuildId(sourceGuildId(profile));
}

export function isHomeSourceProfile(profile = {}, additionalOwnerIds = []) {
  return isHomeGuildProfile(profile) || isHomeOwnerId(sourceOwnerId(profile), additionalOwnerIds);
}

/**
 * GLOBAL BOSS evidence is fail-closed. A report is eligible only when WCL gives
 * us a concrete guild identity and that guild is provably not HOME. Owner-only
 * or anonymous reports may still be useful elsewhere, but they cannot enter the
 * GLOBAL train/validation corpus because "not known to be HOME" is not proof of
 * independence from HOME.
 */
export function classifyGlobalBossSourceProfile(profile = {}, additionalOwnerIds = []) {
  const guildId = sourceGuildId(profile);
  const ownerId = sourceOwnerId(profile);
  const homeGuild = guildId != null && isHomeGuildId(guildId);
  const homeOwner = ownerId != null && isHomeOwnerId(ownerId, additionalOwnerIds);
  if (homeGuild || homeOwner) {
    return Object.freeze({
      version: GLOBAL_BOSS_SOURCE_ISOLATION_VERSION,
      eligible: false,
      status: 'home-source',
      guildId,
      ownerId,
      homeGuild,
      homeOwner,
      independenceProven: false,
    });
  }
  if (guildId != null) {
    return Object.freeze({
      version: GLOBAL_BOSS_SOURCE_ISOLATION_VERSION,
      eligible: true,
      status: 'verified-external-guild',
      guildId,
      ownerId,
      homeGuild: false,
      homeOwner: false,
      independenceProven: true,
    });
  }
  return Object.freeze({
    version: GLOBAL_BOSS_SOURCE_ISOLATION_VERSION,
    eligible: false,
    status: 'external-origin-unverified',
    guildId: null,
    ownerId,
    homeGuild: false,
    homeOwner: false,
    independenceProven: false,
  });
}

export function isVerifiedExternalGlobalBossSourceProfile(profile = {}, additionalOwnerIds = []) {
  return classifyGlobalBossSourceProfile(profile, additionalOwnerIds).eligible === true;
}

export function profileMatchesBossScope(profile = {}, scope = {}) {
  return Number(profile?.encounterId) === Number(scope?.encounterId)
    && Number(profile?.difficulty) === Number(scope?.difficulty)
    && Number(profile?.partition) === Number(scope?.partition);
}

export function assertProfileAllowedInGlobalBossKnowledge(profile = {}, scope = {}, { additionalHomeOwnerIds = [] } = {}) {
  if (!profileMatchesBossScope(profile, scope)) {
    throw new Error(`Boss corpus scope mismatch for report ${profile?.code || 'unknown'}: expected encounter ${scope?.encounterId} d${scope?.difficulty} p${scope?.partition}`);
  }
  const source = classifyGlobalBossSourceProfile(profile, additionalHomeOwnerIds);
  if (source.status === 'home-source') {
    throw new Error('Home source is excluded from global boss training/holdout');
  }
  if (source.eligible !== true) {
    throw new Error('GLOBAL BOSS source independence is unverified; fail-closed source policy rejected the report');
  }
  return true;
}

export function sanitizeGlobalBossProfile(profile = {}) {
  const cleanFight = fight => {
    if (!fight || typeof fight !== 'object') return fight;
    const { friendlyPlayers, ...rest } = fight;
    return rest;
  };
  return {
    ...profile,
    knowledgeScope: 'global-boss',
    knowledgeContractVersion: IRIS_KNOWLEDGE_CONTRACT_VERSION,
    sourceIsolationVersion: GLOBAL_BOSS_SOURCE_ISOLATION_VERSION,
    fights: Array.isArray(profile.fights) ? profile.fights.map(cleanFight) : profile.fights,
  };
}
