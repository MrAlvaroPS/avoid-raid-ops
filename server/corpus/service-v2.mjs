import { assertCorpusStorage, corpusGet, corpusSet } from './storage.mjs';
import { aggregateKey, corpusAliasKey, jobKey, modelKey } from './keys.mjs';
import { globalBossSamplingKey } from '../knowledge/keys.mjs';
import { clampCorpusConfig } from './config.mjs';
import { rebuildCanonicalBossCorpus } from './canonical-rebuild-v2.mjs';
import { getCorpusStatus } from './service.mjs';

async function resolveArgs(input = {}) {
  const args = { encounterId: Number(input.encounterId), difficulty: Number(input.difficulty || 5), partition: Number(input.partition || 0) };
  if (args.partition > 0) return args;
  const alias = await corpusGet(corpusAliasKey(args));
  if (!(Number(alias?.partition) > 0)) return null;
  return { ...args, partition: Number(alias.partition) };
}

export async function recompileCorpusModelV2(input = {}) {
  await assertCorpusStorage();
  const args = await resolveArgs(input);
  if (!args) throw new Error('Corpus job has not been started');
  const [job, currentAggregate] = await Promise.all([corpusGet(jobKey(args)), corpusGet(aggregateKey(args))]);
  if (!job) throw new Error('Corpus job has not been started');
  const config = clampCorpusConfig(input);
  const { aggregate, model, manifest } = await rebuildCanonicalBossCorpus({ args, job, currentAggregate, config, purgeHomeGuild: true });
  job.engineVersion = '3.7.6-sampling-v2';
  job.status = 'ready';
  job.phase = 'complete';
  job.updatedAt = Date.now();
  job.completedAt = Date.now();
  job.message = `RECOMPILE · 0 WCL · canonical sampling v2 selected ${aggregate.wideReports.toLocaleString()} Wide reports / ${aggregate.deepReports.toLocaleString()} Deep reports across ${manifest.wide.sources.toLocaleString()} independent sources; home guild excluded.`;
  await Promise.all([
    corpusSet(jobKey(args), job),
    corpusSet(aggregateKey(args), aggregate),
    corpusSet(modelKey(args), model),
    corpusSet(globalBossSamplingKey(args), manifest),
  ]);
  return getCorpusStatus(args);
}

export async function getBossSamplingManifest(input = {}) {
  const args = await resolveArgs(input);
  if (!args) return null;
  return corpusGet(globalBossSamplingKey(args));
}
