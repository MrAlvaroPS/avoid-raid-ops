import { corpusDelete, corpusGet, corpusList, corpusSet } from './storage.mjs';
import { aggregateKey, corpusId, modelKey, profileKey, deepProfileKey } from './keys.mjs';
import { createAggregate, mergeWideProfile, mergeDeepProfile } from './aggregate.mjs';
import { compileEncounterModel } from './compiler.mjs';
import { bossKnowledgeScope, homeGuildId, isHomeSourceProfile, normalizeHomeOwnerIds, sanitizeGlobalBossProfile } from '../knowledge/scopes.mjs';
import { globalBossSamplingKey } from '../knowledge/keys.mjs';
import { buildBalancedBossSample, buildBossSamplingManifest } from './sampling-v2.mjs';

const readJsonKeys = async (keys, { concurrency = 24 } = {}) => {
  const out = [];
  for (let i = 0; i < keys.length; i += concurrency) {
    const batch = keys.slice(i, i + concurrency);
    const rows = await Promise.all(batch.map(key => corpusGet(key).then(value => ({ key, value }))));
    out.push(...rows);
  }
  return out;
};

export function compilerOptionsFromCorpusConfig(config = {}) {
  return {
    minWideReports: config.minWideReportsToCompile,
    minWideReportsToPublish: config.minWideReportsToPublish,
    minDeepReportsToPublish: config.minDeepReportsToPublish,
    minValidationReportsToPublish: config.minValidationReportsToPublish,
    minWidePullsToPublish: config.minWidePullsToPublish,
    minDeepPullsToPublish: config.minDeepPullsToPublish,
    minIndependentSourcesToPublish: config.minIndependentSourcesToPublish,
    minValidationSourcesToPublish: config.minValidationSourcesToPublish,
    minValidationMeanToPublish: config.minValidationMeanToPublish,
    minLearnedPctToPublish: config.minLearnedPctToPublish,
    minSemanticCoverageToPublish: config.minSemanticCoverageToPublish,
    minSignalCoverageToPublish: config.minSignalCoverageToPublish,
    maxCriticalUnresolvedToPublish: config.maxCriticalUnresolvedToPublish,
  };
}

async function migrateLegacyRowsToPartition(rows = [], args = {}) {
  let migrated = 0;
  for (const row of rows) {
    if (!row?.value) continue;
    let value = row.value;
    let changed = false;
    // The key prefix is already partition-scoped. Old profile schemas predated a
    // partition field inside the JSON, so inherit pN only from this exact storage path.
    if (!(Number(value.partition) > 0)) {
      value = { ...value, partition:Number(args.partition), partitionProvenance:'partition-scoped-storage-key-v1' };
      changed = true;
      migrated++;
    }
    const sanitized = sanitizeGlobalBossProfile(value);
    if ((value.fights || []).some(fight => Object.hasOwn(fight || {}, 'friendlyPlayers')) || value.knowledgeScope !== 'global-boss') changed = true;
    row.value = sanitized;
    if (changed) await corpusSet(row.key, sanitized);
  }
  return migrated;
}

function deriveHomeOwnerIds(rows = [], existing = []) {
  const discovered = [...(existing || [])];
  for (const row of rows) {
    const profile = row?.value;
    if (Number(profile?.guild?.id) !== homeGuildId()) continue;
    const ownerId = Number(profile?.owner?.id);
    if (Number.isFinite(ownerId) && ownerId > 0) discovered.push(ownerId);
  }
  return normalizeHomeOwnerIds(discovered);
}

async function purgeHomeSourceRows(rows = [], homeOwnerIds = []) {
  const home = rows.filter(row => row?.value && isHomeSourceProfile(row.value, homeOwnerIds));
  for (const row of home) await corpusDelete(row.key);
  return home.length;
}

export async function rebuildCanonicalBossCorpus({ args, job, currentAggregate = null, config, purgeHomeGuild = true } = {}) {
  const scope = bossKnowledgeScope(args);
  const prefix = corpusId(args);
  const [wideKeys, deepKeys] = await Promise.all([
    corpusList(`profiles/${prefix}/`),
    corpusList(`deep/${prefix}/`),
  ]);
  if (!wideKeys.length) throw new Error('No persisted wide profiles are available to build the canonical boss corpus');

  const [wideRows, deepRows] = await Promise.all([readJsonKeys(wideKeys), readJsonKeys(deepKeys)]);
  const [migratedWide, migratedDeep] = await Promise.all([
    migrateLegacyRowsToPartition(wideRows, args),
    migrateLegacyRowsToPartition(deepRows, args),
  ]);
  // This is what makes the already-running pre-v2 Belo'ren cache safely reusable:
  // any persisted AvoiD guild profile teaches the recompiler its uploader owner id,
  // then personal/un-guilded profiles by that same owner are excluded too. No WCL call.
  const homeOwnerIds = deriveHomeOwnerIds([...wideRows, ...deepRows], job?.homeOwnerIds || []);
  if (job) job.homeOwnerIds = homeOwnerIds;
  const wideProfiles = wideRows.map(row => row.value).filter(Boolean);
  const deepProfiles = deepRows.map(row => row.value).filter(Boolean);

  const wideSample = buildBalancedBossSample(wideProfiles, {
    scope,
    targetPulls: Number(job?.targetPulls) || Number.POSITIVE_INFINITY,
    mode: 'wide',
    homeOwnerIds,
  });
  const selectedWideCodes = new Set(wideSample.selectedCodes);
  const deepEligible = deepProfiles.filter(profile => selectedWideCodes.has(String(profile?.code || '')));
  const deepSample = buildBalancedBossSample(deepEligible, {
    scope,
    targetPulls: Number(job?.deepTargetPulls) || Number.POSITIVE_INFINITY,
    mode: 'deep',
    homeOwnerIds,
  });

  const manifest = buildBossSamplingManifest({ scope, wideSample, deepSample });
  manifest.selectedWideCodes = wideSample.selectedCodes;
  manifest.selectedDeepCodes = deepSample.selectedCodes;
  manifest.cachedWideReports = wideProfiles.length;
  manifest.cachedDeepReports = deepProfiles.length;
  manifest.migratedLegacyPartitionProfiles = migratedWide + migratedDeep;
  manifest.homeOwnerIdsRecoveredFromCache = homeOwnerIds.length;

  const aggregate = createAggregate({
    ...args,
    encounter: currentAggregate?.encounter || job?.encounter || null,
    validationFraction: config.validationFraction,
  });
  aggregate.resolvedPartition = Number(args.partition);
  aggregate.discoveredSourcePool = Number(currentAggregate?.discoveredSourcePool || job?.sourceQueue?.length || 0);
  aggregate.sampling = manifest;

  for (const profile of wideSample.selected) mergeWideProfile(aggregate, profile, { validationFraction: config.validationFraction });
  for (const profile of deepSample.selected) mergeDeepProfile(aggregate, profile, { validationFraction: config.validationFraction });

  const model = compileEncounterModel(aggregate, compilerOptionsFromCorpusConfig(config));
  model.knowledgeContract = {
    version: manifest.contractVersion,
    scope: manifest.scope,
    homeGuildId: manifest.homeGuildId,
    homeOwnerIds: manifest.homeOwnerIds,
    homeGuildParticipatesInBossModel: false,
    knownHomeUploadersParticipateInBossModel: false,
    playerKnowledgeScope: 'home-raid-only',
  };
  model.sampling = manifest;

  let purgedHomeGuildProfiles = 0;
  if (purgeHomeGuild) {
    purgedHomeGuildProfiles += await purgeHomeSourceRows(wideRows, homeOwnerIds);
    purgedHomeGuildProfiles += await purgeHomeSourceRows(deepRows, homeOwnerIds);
  }
  manifest.purgedHomeGuildProfiles = purgedHomeGuildProfiles;
  manifest.purgedHomeSourceProfiles = purgedHomeGuildProfiles;

  return {
    aggregate,
    model,
    manifest,
    storageWrites: {
      aggregateKey: aggregateKey(args),
      modelKey: modelKey(args),
      samplingKey: globalBossSamplingKey(args),
    },
  };
}

export async function persistedProfileExists(args, code, { deep = false } = {}) {
  return Boolean(await corpusGet(deep ? deepProfileKey(args, code) : profileKey(args, code)));
}
