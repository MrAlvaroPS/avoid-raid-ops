import { defineHandler } from 'nitro/h3';
import {
  getCorpusHealth,
  getCorpusStatus,
  startCorpus,
  pauseCorpus,
  resumeCorpus,
  resetCorpus,
  loadAnyEncounterModel,
} from '../../../server/corpus/service.mjs';
import { recompileCorpusModelV2, getBossSamplingManifest } from '../../../server/corpus/service-v2.mjs';
import { assertCorpusStorage, corpusGet, corpusStorageErrorInfo } from '../../../server/corpus/storage.mjs';
import { launchCorpusExecution, corpusExecutionDescriptor } from '../../../server/corpus/execution.mjs';
import { aggregateKey, jobKey } from '../../../server/corpus/keys.mjs';
import { aggregateSummary } from '../../../server/corpus/aggregate.mjs';
import { applyBossSamplingPolicyV377, modelDiagnosticsV377 } from '../../../server/corpus/model-policy-v377.mjs';
import { startTargetedDeepV373 } from '../../../server/corpus/targeted-deep-v373.mjs';
import { IRIS_KNOWLEDGE_CONTRACT_VERSION, homeGuildId } from '../../../server/knowledge/scopes.mjs';
import { BOSS_SAMPLING_POLICY_VERSION } from '../../../server/corpus/sampling-v2.mjs';

const ENGINE_VERSION = '3.7.7';
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function requestInput(request, body = {}) {
  const url = new URL(request.url);
  return {
    encounterId: Number(body.encounterId || url.searchParams.get('encounter') || 0),
    difficulty: Number(body.difficulty || url.searchParams.get('difficulty') || 5) || 5,
    partition: Number(body.partition ?? url.searchParams.get('partition') ?? 0) || 0,
    ...body,
  };
}

async function policyContext(input) {
  const raw = await loadAnyEncounterModel(input);
  if (!raw) return { raw:null, aggregate:null, args:null, job:null };
  const partition = Number(raw.resolvedPartition ?? raw.partition ?? input.partition ?? 0);
  const args = { encounterId:Number(raw.encounterId || input.encounterId), difficulty:Number(raw.difficulty || input.difficulty || 5), partition };
  const [aggregate,job] = partition > 0 ? await Promise.all([
    corpusGet(aggregateKey(args)).catch(() => null),
    corpusGet(jobKey(args)).catch(() => null),
  ]) : [null,null];
  return { raw, aggregate, args, job };
}

async function decorateStatus(input, status) {
  if (!status) return status;
  const {raw,aggregate,job} = await policyContext(input);
  return {
    ...status,
    engineVersion: ENGINE_VERSION,
    knowledgeContractVersion: IRIS_KNOWLEDGE_CONTRACT_VERSION,
    samplingPolicyVersion: BOSS_SAMPLING_POLICY_VERSION,
    homeGuildId: homeGuildId(),
    deepTargetReports: Number(job?.deepTargetReports || 0) || null,
    targetReports: Number(job?.targetReports || 0) || null,
    aggregate: aggregate ? aggregateSummary(aggregate) : status.aggregate,
    model: raw ? modelDiagnosticsV377(raw, aggregate) : (status.model || null),
  };
}

async function policyModel(input) {
  const {raw,aggregate} = await policyContext(input);
  const model=applyBossSamplingPolicyV377(raw, aggregate);
  if(model){
    model.engineVersion=ENGINE_VERSION;
    if(model.validation) model.validation.publicationMode='manual-review-hold-v3.7.7-query-guided';
  }
  return model;
}

async function improveModel(input) {
  const execution = corpusExecutionDescriptor();
  const active = await getCorpusStatus(input);
  if (execution.runtime === 'local' && active && (active.status === 'running' || active.status === 'rate-limited')) {
    return {
      status: active,
      workflowRunId: null,
      executionMode: 'local-worker',
      reusedExistingJob: true,
    };
  }

  const model = await policyModel(input);
  if (!model) throw new Error('No encounter model is available to improve');
  const rec = model.learning?.enrichmentRecommendation || {};
  if (rec.mode === 'targeted-deep') {
    await startTargetedDeepV373({
      ...input,
      addDeepPulls: Number(rec.suggestedAdditionalDeepPulls) || 0,
      addDeepReports: Number(rec.suggestedAdditionalDeepReports) || 0,
      focusAbilityIds: model.learning?.enrichmentFocusAbilityIds || [],
    });
    return launchCorpusExecution({ ...input, mode:'targeted-deep' });
  }
  await startCorpus({
    ...input,
    mode:'enrich',
    addPulls:Number(rec.suggestedAdditionalWidePulls) || 500,
    addDeepPulls:Number(rec.suggestedAdditionalDeepPulls) || 100,
  });
  return launchCorpusExecution({ ...input, mode:'enrich' });
}

export default defineHandler(async (event) => {
  const request = event.req;
  const url = new URL(request.url);
  const actionFromQuery = url.searchParams.get('action') || 'status';

  try {
    if (request.method === 'GET') {
      const input = requestInput(request);
      if (actionFromQuery === 'health') {
        const storage = await assertCorpusStorage();
        const health = await getCorpusHealth();
        return json({
          ok: true,
          ...corpusExecutionDescriptor(),
          ...health,
          engineVersion: ENGINE_VERSION,
          policyVersion: 'relation-provenance-v2+boss-sampling-v3+query-guided-rec-v2',
          knowledgeContractVersion: IRIS_KNOWLEDGE_CONTRACT_VERSION,
          samplingPolicyVersion: BOSS_SAMPLING_POLICY_VERSION,
          homeGuildId: homeGuildId(),
          intelligenceName:'Iris',
          storage,
        });
      }
      if (!input.encounterId) return json({ ok:false, error:'encounter is required' }, 400);
      if (actionFromQuery === 'model') {
        const model = await policyModel(input);
        return json({ ok:Boolean(model), model }, model ? 200 : 404);
      }
      if (actionFromQuery === 'sampling') {
        const sampling = await getBossSamplingManifest(input);
        return json({ ok:Boolean(sampling), sampling }, sampling ? 200 : 404);
      }
      return json({ ok:true, status:await decorateStatus(input, await getCorpusStatus(input)) });
    }

    if (request.method !== 'POST') return json({ ok:false, error:'Method not allowed' }, 405);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || actionFromQuery || 'status');
    const input = requestInput(request, body);
    if (!input.encounterId) return json({ ok:false, error:'encounterId is required' }, 400);

    if (action === 'start' || action === 'enrich') {
      const mode = action === 'enrich' ? 'enrich' : 'initial';
      await startCorpus({ ...input, mode });
      const launched = await launchCorpusExecution({ ...input, mode });
      return json({ ok:true, status:await decorateStatus(input, launched.status), workflowRunId:launched.workflowRunId, executionMode:launched.executionMode }, 202);
    }
    if (action === 'improve') {
      const launched = await improveModel(input);
      return json({ ok:true, status:await decorateStatus(input, launched.status), workflowRunId:launched.workflowRunId, executionMode:launched.executionMode, reusedExistingJob:Boolean(launched.reusedExistingJob), plan:(await policyModel(input))?.learning?.enrichmentRecommendation || null }, 202);
    }
    if (action === 'targeted-deep') {
      await startTargetedDeepV373(input);
      const launched = await launchCorpusExecution({ ...input, mode:'targeted-deep' });
      return json({ ok:true, status:await decorateStatus(input, launched.status), workflowRunId:launched.workflowRunId, executionMode:launched.executionMode }, 202);
    }
    if (action === 'pause') return json({ ok:true, status:await decorateStatus(input, await pauseCorpus(input)) });
    if (action === 'resume') {
      await resumeCorpus(input);
      const launched = await launchCorpusExecution(input);
      return json({ ok:true, status:await decorateStatus(input, launched.status), workflowRunId:launched.workflowRunId, executionMode:launched.executionMode }, 202);
    }
    if (action === 'recompile') {
      const status = await recompileCorpusModelV2(input);
      return json({ ok:true, status:await decorateStatus(input, status), model:await policyModel(input), sampling:await getBossSamplingManifest(input) });
    }
    if (action === 'reset') return json({ ok:true, ...(await resetCorpus(input)) });
    if (action === 'model') return json({ ok:true, model:await policyModel(input) });
    if (action === 'sampling') return json({ ok:true, sampling:await getBossSamplingManifest(input) });
    if (action === 'status') return json({ ok:true, status:await decorateStatus(input, await getCorpusStatus(input)) });

    return json({ ok:false, error:`Unsupported corpus action: ${action}` }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const storage = corpusStorageErrorInfo(error);
    const storageError = Boolean(storage) || /blob|storage|OIDC|BLOB_READ_WRITE_TOKEN/i.test(message);
    return json({
      ok:false,
      error:message,
      ...(storage?{
        code:'CORPUS_BLOB_READ_BLOCKED',
        storage:{...storage,actionRequired:'Check Vercel Storage → Blob → Usage/limits before retrying corpus actions.'},
      }:{}),
    }, Number(error?.httpStatus) || (storageError ? 503 : 500));
  }
});
