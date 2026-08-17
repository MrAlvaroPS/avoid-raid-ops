import { homeGuildId } from './scopes.mjs';

const positive = (value, name) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} is required`);
  return n;
};

export function globalBossKnowledgeId({ encounterId, difficulty = 5, partition } = {}) {
  return `${positive(encounterId, 'encounterId')}/d${positive(difficulty, 'difficulty')}/p${positive(partition, 'partition')}`;
}

export function globalBossSamplingKey(args) {
  return `sampling/${globalBossKnowledgeId(args)}.json`;
}

export function homeRaidKnowledgeId({ guildId = homeGuildId(), encounterId, difficulty = 5, partition } = {}) {
  const guild = positive(guildId, 'guildId');
  if (guild !== homeGuildId()) throw new Error(`Home raid ledger may only use guild ${homeGuildId()}`);
  return `${guild}/${positive(encounterId, 'encounterId')}/d${positive(difficulty, 'difficulty')}/p${positive(partition, 'partition')}`;
}

export function homeRaidLedgerKey(args) {
  return `raid-ledger/${homeRaidKnowledgeId(args)}.json`;
}
