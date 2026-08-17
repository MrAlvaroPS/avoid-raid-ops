import { stepCorpusV375 } from './corpus-step-v375.mjs';
import { getCorpusStatus } from './service.mjs';
import { corpusGet, corpusSet } from './storage.mjs';
import { aggregateKey, corpusAliasKey, jobKey, modelKey } from './keys.mjs';
import { globalBossSamplingKey } from '../knowledge/keys.mjs';
import { homeGuildId, normalizeHomeOwnerIds } from '../knowledge/scopes.mjs';
import { clampCorpusConfig } from './config.mjs';
import { rebuildCanonicalBossCorpus } from './canonical-rebuild-v2.mjs';

const now = () => Date.now();
const sourceKey = source => source?.type && source?.id != null ? `${source.type}:${source.id}` : null;
const uniq = values => [...new Set((values || []).map(Number).filter(value => Number.isFinite(value) && value > 0))];

async function resolveArgs(input = {}) {
  const args = { encounterId: Number(input.encounterId), difficulty: Number(input.difficulty || 5), partition: Number(input.partition || 0) };
  if (args.partition > 0) return args;
  const alias = await corpusGet(corpusAliasKey(args));
  return Number(alias?.partition) > 0 ? { ...args, partition: Number(alias.partition) } : null;
}

function candidateSource(job, code) {
  return job?.candidateSourceByCode?.[String(code)] || `unmapped:${String(code)}`;
}

function mappedHomeSource(job, code) {
  const key = candidateSource(job, code);
  if (key === `guild:${homeGuildId()}`) return true;
  if (!key.startsWith('user:')) return false;
  const ownerId = Number(key.slice(5));
  return normalizeHomeOwnerIds(job?.homeOwnerIds || []).includes(ownerId);
}

function skipMappedHomeCandidates(job = {}) {
  const done = new Set(job.processedWide || []);
  const skipped = [];
  for (const code of job.candidates || []) {
    if (!done.has(code) && mappedHomeSource(job, code)) skipped.push(code);
  }
  if (!skipped.length) return 0;
  job.processedWide = [...new Set([...(job.processedWide || []), ...skipped])];
  job.skippedHomeSource = Number(job.skippedHomeSource || 0) + skipped.length;
  job.message = `Filtered ${skipped.length.toLocaleString()} mapped AvoiD/home-source report${skipped.length === 1 ? '' : 's'} before WCL profiling · ${job.skippedHomeSource.toLocaleString()} home candidates excluded from global boss knowledge.`;
  return skipped.length;
}

export function nextCandidateBySourceRoundRobin(job = {}) {
  const processed = new Set(job.processedWide || []);
  const failed = new Set((job.failed || []).filter(row => row.stage === 'wide').map(row => row.code));
  const remaining = (job.candidates || []).filter(code => !processed.has(code) && !failed.has(code));
  if (!remaining.length) return null;
  const counts = new Map();
  for (const code of processed) {
    const key = candidateSource(job, code);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return remaining.slice().sort((a, b) => {
    const sourceA = candidateSource(job, a), sourceB = candidateSource(job, b);
    return (counts.get(sourceA) || 0) - (counts.get(sourceB) || 0)
      || String(sourceA).localeCompare(String(sourceB))
      || String(a).localeCompare(String(b));
  })[0];
}

async function prioritizeWideCandidate(args, job) {
  if (job?.phase !== 'wide') return job;
  const filtered = skipMappedHomeCandidates(job);
  const next = nextCandidateBySourceRoundRobin(job);
  if (!next) {
    if (filtered) { job.updatedAt = now(); await corpusSet(jobKey(args), job); }
    return job;
  }
  const candidates = job.candidates || [];
  const index = candidates.indexOf(next);
  if (index > 0) job.candidates = [next, ...candidates.slice(0, index), ...candidates.slice(index + 1)];
  if (index > 0 || filtered) {
    job.samplingAcquisitionPolicy = 'source-round-robin-v1';
    job.updatedAt = now();
    await corpusSet(jobKey(args), job);
  }
  return job;
}

async function recordDiscoverySourceAndRotate(args, before, input, state) {
  if (!before || !state || state.executionSuperseded) return state;
  const current = await corpusGet(jobKey(args));
  if (!current) return state;
  if (input.executionToken && current.activeExecutionToken && String(input.executionToken) !== String(current.activeExecutionToken)) return state;
  current.candidateSourceByCode ||= {};
  current.homeOwnerIds = normalizeHomeOwnerIds(current.homeOwnerIds || []);
  let changed = false;

  if (before.phase === 'discover-identities') {
    const code = before.seedReports?.[Number(before.seedCursor || 0)];
    const previousSources = new Set((before.sourceQueue || []).map(sourceKey).filter(Boolean));
    const added = (current.sourceQueue || []).find(source => {
      const key = sourceKey(source);
      return key && !previousSources.has(key);
    });
    const key = sourceKey(added);
    if (code && key && !current.candidateSourceByCode[String(code)]) {
      current.candidateSourceByCode[String(code)] = key;
      changed = true;
    }
    // A guild-associated AvoiD report tells us the WCL uploader id as well. Keep that
    // source identity on the job so a later personal/un-guilded report by the same
    // uploader cannot leak into GLOBAL BOSS KNOWLEDGE.
    if (added?.type === 'guild' && Number(added.id) === homeGuildId() && Number(added.ownerId) > 0) {
      const nextOwners = uniq([...(current.homeOwnerIds || []), Number(added.ownerId)]);
      if (nextOwners.length !== current.homeOwnerIds.length) {
        current.homeOwnerIds = nextOwners;
        changed = true;
      }
    }
  }

  if (before.phase === 'expand-sources') {
    const source = (before.sourceQueue || []).find(row => !row.done);
    const key = sourceKey(source);
    if (key) {
      const previousCandidates = new Set(before.candidates || []);
      for (const code of current.candidates || []) {
        if (!previousCandidates.has(code) && !current.candidateSourceByCode[String(code)]) {
          current.candidateSourceByCode[String(code)] = key;
          changed = true;
        }
      }
      // The legacy expansion drained one source page-after-page. Rotate the source
      // that just produced a page to the end so future pages are fetched round-robin.
      if (current.phase === 'expand-sources') {
        const index = (current.sourceQueue || []).findIndex(row => sourceKey(row) === key);
        if (index >= 0) {
          const queue = [...current.sourceQueue];
          const [used] = queue.splice(index, 1);
          queue.push(used);
          current.sourceQueue = queue;
          current.sourceExpansionPolicy = 'source-page-round-robin-v1';
          changed = true;
        }
      }
    }
  }

  if (changed) {
    current.updatedAt = now();
    await corpusSet(jobKey(args), current);
  }
  return getCorpusStatus(args);
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
  job.engineVersion = '3.7.6-sampling-v3';
  job.schemaVersion = Math.max(2, Number(job.schemaVersion) || 0);
  job.status = 'ready';
  job.phase = 'complete';
  job.updatedAt = now();
  job.completedAt = now();
  job.message = `Canonical global-boss model rebuilt at 0 extra WCL: ${aggregate.wideReports.toLocaleString()} balanced Wide reports / ${aggregate.deepReports.toLocaleString()} balanced Deep reports · ${manifest.wide.sources.toLocaleString()} sources · hard source caps applied where feasible · AvoiD/home uploaders excluded.`;

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
  if (!args) return stepCorpusV375(input);
  let job = await corpusGet(jobKey(args));
  if (job?.status === 'running' && job?.phase === 'compile') return finalizeCanonicalCorpus(input);
  if (job?.status === 'running' && job?.phase === 'wide') job = await prioritizeWideCandidate(args, job);
  const before = job ? structuredClone(job) : null;
  const state = await stepCorpusV375(input);
  if (before?.phase === 'discover-identities' || before?.phase === 'expand-sources') {
    return recordDiscoverySourceAndRotate(args, before, input, state);
  }
  return state;
}
