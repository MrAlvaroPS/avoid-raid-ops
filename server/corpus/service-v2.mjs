import { assertCorpusStorage, corpusGet, corpusSet } from './storage.mjs';
import { aggregateKey, corpusAliasKey, jobKey, modelKey } from './keys.mjs';
import { globalBossSamplingKey } from '../knowledge/keys.mjs';
import { clampCorpusConfig } from './config.mjs';
import { rebuildCanonicalBossCorpus } from './canonical-rebuild-v2.mjs';
import { getCorpusStatus } from './service.mjs';
import { BOSS_SAMPLING_POLICY_VERSION } from './sampling-v2.mjs';
import { IRIS_KNOWLEDGE_CONTRACT_VERSION } from '../knowledge/scopes.mjs';

export const OPERATIONAL_REFERENCE_VERSION='global-boss-operational-reference-v1';
export const OPERATIONAL_REFERENCE_THRESHOLDS=Object.freeze({minWidePulls:100,minDeepPulls:20,minWideSources:8,minDeepSources:3});

async function resolveArgs(input = {}) {
  const encounterId=Number(input.encounterId),difficulty=Number(input.difficulty),partition=Number(input.partition||0);
  if(!Number.isInteger(encounterId)||encounterId<=0)throw new Error('encounterId is required');
  if(!Number.isInteger(difficulty)||difficulty<=0)throw new Error('difficulty is required');
  const args = { encounterId, difficulty, partition };
  if (args.partition > 0) return args;
  const alias = await corpusGet(corpusAliasKey(args));
  if (!(Number(alias?.partition) > 0)) return null;
  return { ...args, partition: Number(alias.partition) };
}

function canonicalSourceSafety(model,sampling,args){
  if(!model||!sampling)return false;
  if(sampling.policyVersion!==BOSS_SAMPLING_POLICY_VERSION)return false;
  if(sampling.contractVersion!==IRIS_KNOWLEDGE_CONTRACT_VERSION)return false;
  if(Number(sampling?.scope?.encounterId)!==Number(args.encounterId)
      ||Number(sampling?.scope?.difficulty)!==Number(args.difficulty)
      ||Number(sampling?.scope?.partition)!==Number(args.partition))return false;
  if(Number(sampling.homeSourceSelectedReports||0)!==0)return false;
  if(Number(sampling.homeGuildSelectedReports||0)!==0)return false;
  if(Number(sampling.homeOwnerSelectedReports||0)!==0)return false;
  if(Number(sampling.selectedWrongScopeReports||0)!==0)return false;
  if(Number(sampling.selectedMissingSourceReports||0)!==0)return false;
  if(model?.knowledgeContract?.version!==IRIS_KNOWLEDGE_CONTRACT_VERSION)return false;
  if(model?.knowledgeContract?.homeGuildParticipatesInBossModel!==false)return false;
  if(model?.knowledgeContract?.knownHomeUploadersParticipateInBossModel!==false)return false;
  return true;
}

export async function recompileCorpusModelV2(input = {}) {
  await assertCorpusStorage();
  const args = await resolveArgs(input);
  if (!args) throw new Error('Corpus job has not been started');
  const [job, currentAggregate] = await Promise.all([corpusGet(jobKey(args)), corpusGet(aggregateKey(args))]);
  if (!job) throw new Error('Corpus job has not been started');
  const config = clampCorpusConfig(input);
  const { aggregate, model, manifest } = await rebuildCanonicalBossCorpus({ args, job, currentAggregate, config, purgeHomeGuild: true });
  job.engineVersion = '3.9.12-sampling-v3';
  job.status = 'ready';
  job.phase = 'complete';
  job.updatedAt = Date.now();
  job.completedAt = Date.now();
  job.message = `RECOMPILE · 0 WCL · canonical sampling v3 selected ${aggregate.wideReports.toLocaleString()} Wide reports / ${aggregate.deepReports.toLocaleString()} Deep reports across ${manifest.wide.sources.toLocaleString()} independent sources; hard source caps applied where mathematically feasible; AvoiD/home uploaders excluded.`;
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

export async function loadOperationalEncounterModelV2(input={}){
  const args=await resolveArgs(input);if(!args)return null;
  const [model,sampling]=await Promise.all([corpusGet(modelKey(args)),corpusGet(globalBossSamplingKey(args))]);
  if(!canonicalSourceSafety(model,sampling,args)||!model?.pack)return null;
  const t={...OPERATIONAL_REFERENCE_THRESHOLDS,...(input.thresholds||{})};
  const evidence={
    widePulls:Number(sampling?.wide?.pulls||0),deepPulls:Number(sampling?.deep?.pulls||0),
    wideSources:Number(sampling?.wide?.sources||0),deepSources:Number(sampling?.deep?.sources||0),
    wideReports:Number(sampling?.wide?.reports||0),deepReports:Number(sampling?.deep?.reports||0),
  };
  const checks={
    widePulls:evidence.widePulls>=Number(t.minWidePulls),deepPulls:evidence.deepPulls>=Number(t.minDeepPulls),
    wideSources:evidence.wideSources>=Number(t.minWideSources),deepSources:evidence.deepSources>=Number(t.minDeepSources),
  };
  if(!Object.values(checks).every(Boolean))return null;
  return{
    ...model,
    operationalReference:{
      version:OPERATIONAL_REFERENCE_VERSION,status:model.status==='published'?'published-compatible':'operational-unpublished',
      scope:{encounterId:args.encounterId,difficulty:args.difficulty,partition:args.partition},evidence,thresholds:t,checks,
      sourceIsolation:'canonical-sampling-fail-closed',acceptedKnowledge:model.status==='published',automaticPromotion:false,
      meaning:model.status==='published'?'Published model also satisfies the operational floor.':'Bounded same-difficulty public reference safe for operational classification only; it is not accepted/promoted boss knowledge.'
    }
  };
}

// Application/runtime consumers that require accepted knowledge must use this loader.
// It rejects any pre-contract or merely operational model even if a candidate pack exists.
export async function loadPublishedEncounterModelV2(input = {}) {
  const args = await resolveArgs(input);
  if (!args) return null;
  const [model, sampling] = await Promise.all([
    corpusGet(modelKey(args)),
    corpusGet(globalBossSamplingKey(args)),
  ]);
  if (!model || model.status !== 'published' || !sampling) return null;
  if(!canonicalSourceSafety(model,sampling,args))return null;
  return model;
}
