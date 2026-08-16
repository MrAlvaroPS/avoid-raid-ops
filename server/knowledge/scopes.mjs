export const IRIS_KNOWLEDGE_CONTRACT_VERSION = 'iris-knowledge-contract-v1';
export const DEFAULT_HOME_GUILD_ID = 788166;

const finitePositive = value => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function homeGuildId() {
  return finitePositive(process.env.AVOID_HOME_GUILD_ID) || DEFAULT_HOME_GUILD_ID;
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

export function sourceGuildId(profile = {}) {
  return finitePositive(profile?.guild?.id);
}

export function isHomeGuildProfile(profile = {}) {
  return isHomeGuildId(sourceGuildId(profile));
}

export function profileMatchesBossScope(profile = {}, scope = {}) {
  return Number(profile?.encounterId) === Number(scope?.encounterId)
    && Number(profile?.difficulty) === Number(scope?.difficulty)
    && Number(profile?.partition) === Number(scope?.partition);
}

export function assertProfileAllowedInGlobalBossKnowledge(profile = {}, scope = {}) {
  if (!profileMatchesBossScope(profile, scope)) {
    throw new Error(`Boss corpus scope mismatch for report ${profile?.code || 'unknown'}: expected encounter ${scope?.encounterId} d${scope?.difficulty} p${scope?.partition}`);
  }
  if (isHomeGuildProfile(profile)) {
    throw new Error(`Home guild ${homeGuildId()} is excluded from global boss training/holdout`);
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
    fights: Array.isArray(profile.fights) ? profile.fights.map(cleanFight) : profile.fights,
  };
}
