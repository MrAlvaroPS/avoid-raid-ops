import { sleep } from 'workflow';

export async function corpusBuildWorkflow(input) {
  "use workflow";

  while (true) {
    const state = await runCorpusBatch(input);
    if (!state || state.executionSuperseded || state.status === 'ready' || state.status === 'paused') return state;

    if (state.status === 'rate-limited') {
      await sleep(`${Math.max(5, Math.min(3600, Number(state.waitSeconds) || 60))}s`);
    } else {
      // Deliberately gentle: WCL is the scarce resource, not Vercel CPU.
      await sleep('2s');
    }
  }
}

async function runCorpusBatch(input) {
  "use step";

  const { stepCorpus } = await import('../server/corpus/service.mjs');
  let state = null;

  // A small batch amortizes workflow overhead while still checkpointing frequently.
  for (let i = 0; i < 4; i++) {
    try {
      state = await stepCorpus(input);
    } catch (error) {
      if (/has not been started|resolved partition/i.test(String(error?.message || error))) {
        return { status:'reset', phase:null, pullCount:0, deepPullCount:0, processedWideCount:0, processedDeepCount:0, failedCount:0, resumeAt:null, waitSeconds:0, executionSuperseded:true };
      }
      throw error;
    }
    if (!state || state.executionSuperseded || state.status !== 'running') break;
  }

  const resumeAt = Number(state?.resumeAt) || null;
  return {
    status: state?.status || 'unknown',
    phase: state?.phase || null,
    pullCount: Number(state?.pullCount || 0),
    deepPullCount: Number(state?.deepPullCount || 0),
    processedWideCount: Number(state?.processedWideCount || 0),
    processedDeepCount: Number(state?.processedDeepCount || 0),
    failedCount: Number(state?.failedCount || 0),
    resumeAt,
    waitSeconds: resumeAt ? Math.max(5, Math.ceil((resumeAt - Date.now()) / 1000)) : 0,
    executionSuperseded: Boolean(state?.executionSuperseded),
  };
}
