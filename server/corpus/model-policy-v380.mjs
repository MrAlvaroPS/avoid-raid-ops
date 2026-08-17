import { applyBossSamplingPolicyV379, modelDiagnosticsV379 } from './model-policy-v379.mjs';
import { buildLocalMechanicSynthesisV1 } from './local-mechanic-synthesis-v1.mjs';

export const LOCAL_SYNTHESIS_POLICY_VERSION='local-mechanic-synthesis-policy-v1';

const num=value=>Number.isFinite(Number(value))?Number(value):0;

function nextLearningAction(model,synthesis){
  const previous=model?.learning?.recommendations?.learningNext||model?.learning?.learningRecommendation||{};
  if(!synthesis?.counts?.total)return previous;
  const partialOrSufficient=synthesis.counts.localEvidenceSufficient+synthesis.counts.localEvidencePartial;
  if(partialOrSufficient>0){
    return{
      purpose:'learning',
      priority:'high',
      mode:'local-mechanic-synthesis-review',
      execution:'local-only',
      wclCallsExecuted:0,
      targetAbilityIds:synthesis.locallyReviewableAbilityIds,
      externalEvidenceTargetAbilityIds:synthesis.externalEvidenceTargetAbilityIds,
      reason:`${partialOrSufficient} critical encounter signal${partialOrSufficient===1?' has':'s have'} useful persisted structural evidence. Review those local hypotheses before buying any WCL evidence.${synthesis.counts.externalEvidenceNeeded?` ${synthesis.counts.externalEvidenceNeeded} signal${synthesis.counts.externalEvidenceNeeded===1?'':'s'} still need a concrete external semantic question.`:''}`,
    };
  }
  if(synthesis.counts.externalEvidenceNeeded>0){
    return{
      purpose:'learning',
      priority:'high',
      mode:'surgical-semantic-probe-plan',
      execution:'dry-run-only',
      wclCallsExecuted:0,
      targetAbilityIds:synthesis.externalEvidenceTargetAbilityIds,
      reason:`Persisted canonical evidence cannot settle ${synthesis.counts.externalEvidenceNeeded} critical encounter signal${synthesis.counts.externalEvidenceNeeded===1?'':'s'}. Build exact-fight semantic probe plans for the explicit missing evidence only; do not launch broad enrichment.`,
    };
  }
  return previous;
}

export function applyLocalMechanicSynthesisOverlayV380(model,aggregate=null){
  if(!model)return null;
  const synthesis=buildLocalMechanicSynthesisV1({model,aggregate:aggregate||{}});
  const learningNext=nextLearningAction(model,synthesis);
  const recommendations={...(model?.learning?.recommendations||{}),learningNext};
  const criticalCount=num(model?.learning?.signalTriage?.criticalUnresolved?.length);
  const numericLowest=model?.learning?.lowestDimension||model?.learning?.bottleneck||null;
  const actionBottleneck=criticalCount>0?'signalDiscoveryPct':model?.learning?.actionBottleneck||numericLowest;

  model.engineVersion='3.7.10';
  model.policyVersion='signal-triage-v1+local-mechanic-synthesis-v1+semantic-contract-v1+decision-separation-v1';
  model.learning={
    ...(model.learning||{}),
    localMechanicSynthesis:synthesis,
    recommendations,
    learningRecommendation:learningNext,
    actionBottleneck,
    numericBottleneck:numericLowest,
    blockingGate:criticalCount>0?'critical-unresolved-signals':null,
    decisionSemantics:{
      numericBottleneck:'Lowest numeric learning component. It does not automatically decide the next action when a hard evidence gate is active.',
      actionBottleneck:'Dimension targeted by the current learning action after hard evidence gates are considered.',
      blockingGate:'Hard gate that currently caps or prevents maturity independent of the lowest numeric component.',
    },
  };
  model.validation={
    ...(model.validation||{}),
    publicationMode:'manual-review-hold-v3.7.10-local-synthesis',
  };
  model.evaluatedAt=Date.now();
  return model;
}

export function applyBossSamplingPolicyV380(input,aggregate=null){
  return applyLocalMechanicSynthesisOverlayV380(applyBossSamplingPolicyV379(input,aggregate),aggregate);
}

export function modelDiagnosticsV380(input,aggregate=null){
  const base=modelDiagnosticsV379(input,aggregate)||{};
  const model=applyBossSamplingPolicyV380(input,aggregate);
  if(!model)return null;
  return{
    ...base,
    engineVersion:model.engineVersion,
    learningBottleneck:model.learning?.bottleneck,
    numericBottleneck:model.learning?.numericBottleneck,
    actionBottleneck:model.learning?.actionBottleneck,
    blockingGate:model.learning?.blockingGate,
    localMechanicSynthesis:model.learning?.localMechanicSynthesis,
    recommendations:model.learning?.recommendations,
    policyVersion:model.policyVersion,
    publicationMode:model.validation?.publicationMode,
    evaluatedAt:model.evaluatedAt,
  };
}
