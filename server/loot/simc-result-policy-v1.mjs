export const SIMC_RESULT_POLICY_VERSION='simc-result-policy-v1.1';

const unsupportedMatch=reason=>String(reason||'').match(/(?:Trivial:\s*)?([^\r\n]+?)\s+for Player ['"][^'"]+['"] is not currently supported\./i);
const upstreamModelFailure=result=>Number(result?.exitCode)===40||/SimulationCraft exited 40/i.test(String(result?.reason||''));

export function classifyLootSimResultV1(result={}){
  if(result?.status!=='sim-failed')return result;
  const match=unsupportedMatch(result?.reason);
  if(match)return{
    ...result,
    status:'role-model-pending',
    gainPct:null,
    simSupport:'unsupported-by-current-simc-nightly',
    unsupportedModel:String(match[1]||'current specialization').trim(),
    reason:`${String(match[1]||'This specialization').trim()} is not currently supported by the verified SimulationCraft nightly. Loot eligibility remains valid; raid-value simulation is pending.`,
    resultPolicyVersion:SIMC_RESULT_POLICY_VERSION,
  };
  if(upstreamModelFailure(result))return{
    ...result,
    status:'simc-upstream-model-error',
    gainPct:null,
    simSupport:'upstream-nightly-model-error',
    retryableAfterEngineUpdate:true,
    reason:`The verified SimulationCraft nightly aborted while modeling this specialization/profile. No loot value is inferred. Upstream detail: ${String(result?.reason||'unknown model failure').slice(0,600)}`,
    resultPolicyVersion:SIMC_RESULT_POLICY_VERSION,
  };
  return result;
}

export function classifyLootSimulationV1(simulation={}){
  return{...simulation,results:(simulation?.results||[]).map(classifyLootSimResultV1),resultPolicyVersion:SIMC_RESULT_POLICY_VERSION};
}
