import { stepCorpusV375 } from './corpus-step-v375.mjs';
import { getCorpusStatus } from './service.mjs';
import { corpusGet, corpusSet } from './storage.mjs';
import { aggregateKey, corpusAliasKey, jobKey, modelKey } from './keys.mjs';
import { globalBossSamplingKey } from '../knowledge/keys.mjs';
import { clampCorpusConfig } from './config.mjs';
import { rebuildCanonicalBossCorpus } from './canonical-rebuild-v2.mjs';

const now = () => Date.now();

async function resolveArgs(input = {}) {
  const args = { encounterId: Number(input.encounterId), difficulty: Number(input.difficulty || 5), partition: Number(input.partition || 0) };
  if (args.partition > 0) return args;
  const alias = await corpusGet(corpusAliasKey(args));
  return Number(alias?.partition) > 0 ? { ...args, partition: Number(alias.partition) } : null;
}

async function finalizeCanonicalCorpus(input = {}) {
  const args = await resolveArgs(input);
  if (!args) return stepCorpusV375(input);
  const [job, currentAggregate] = await Promise.all([corpusGet(jobKey(args)), corpusGet(aggregateKey(args))]);
  if (!job || job.status !== 'running' || job.phase !== 'compile') return stepCorpusV375(input);
  const executionToken = input.executionToken ? String(input.executionToken) : null;
  if (executionToken && job.activeExecutionToken && String(job.activeExecutionToken) !== executionToken) {
    const state = await getCorpusStatus(args);
    return { ...state, executionSuperseded: true };
  }

  const config = clampCorpusConfig(input);
  const rebuilt = await rebuildCanonicalBossCorpus({ args, job, currentAggregate, config, purgeHomeGuild: true });
  const { aggregate, model, manifest } = rebuilt;
  job.engineVersion = '3.7.6-sampling-v2';
  job.schemaVersion = Math.max(2, Number(job.schemaVersion) || 0);
  job.status = 'ready';
  job.phase = 'complete';
  job.updatedAt = now();
  job.completedAt = now();
  job.message = `Canonical global-boss model rebuilt at 0 extra WCL: ${aggregate.wideReports.toLocaleString()} balanced Wide reports / ${aggregate.deepReports.toLocaleString()} balanced Deep reports · ${manifest.wide.sources.toLocaleString()} sources · home guild excluded.`;

  await Promise.all([
    corpusSet(jobKey(args), job),
    corpusSet(aggregateKey(args), aggregate),
    corpusSet(modelKey(args), model),
    corpusSet(globalBossSamplingKey(args), manifest),
  ]);
  return getCorpusStatus(args);
}

export async function stepCorpusV376(input = {}) {
  const args = await resolveArgs(input);
  if (args) {
    const job = await corpusGet(jobKey(args));
    if (job?.status === 'running' && job?.phase === 'compile') return finalizeCanonicalCorpus(input);
  }
  return stepCorpusV375(input);
}
