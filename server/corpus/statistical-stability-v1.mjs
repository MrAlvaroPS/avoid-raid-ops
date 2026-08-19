import { createHash } from 'node:crypto';

export const STATISTICAL_STABILITY_V1_VERSION='source-stratified-statistical-stability-v1';
export const STATISTICAL_STABILITY_POLICY_V1_VERSION='source-stratified-statistical-stability-policy-v1';

export const STATISTICAL_STABILITY_DEFAULTS=Object.freeze({
  minimumEligibleGroups:3,
  minimumSupportiveGroupShare:2/3,
  maximumContradictoryGroupShare:0.25,
  minimumMedianPrevalenceDelta:0.25,
  maximumDeltaMad:0.50,
});

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=(value,length=40)=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0,length);
const finite=value=>Number.isFinite(Number(value))?Number(value):null;

function configFrom(input={}){
  const clamp=(value,fallback,min,max)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
  return{
    minimumEligibleGroups:Math.max(3,Math.min(10,Number(input.minimumEligibleGroups)||STATISTICAL_STABILITY_DEFAULTS.minimumEligibleGroups)),
    minimumSupportiveGroupShare:clamp(input.minimumSupportiveGroupShare,STATISTICAL_STABILITY_DEFAULTS.minimumSupportiveGroupShare,0.5,1),
    maximumContradictoryGroupShare:clamp(input.maximumContradictoryGroupShare,STATISTICAL_STABILITY_DEFAULTS.maximumContradictoryGroupShare,0,0.5),
    minimumMedianPrevalenceDelta:clamp(input.minimumMedianPrevalenceDelta,STATISTICAL_STABILITY_DEFAULTS.minimumMedianPrevalenceDelta,0,1),
    maximumDeltaMad:clamp(input.maximumDeltaMad,STATISTICAL_STABILITY_DEFAULTS.maximumDeltaMad,0,1),
  };
}

function median(values=[]){
  const rows=values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!rows.length)return null;
  const mid=Math.floor(rows.length/2);
  return rows.length%2?rows[mid]:(rows[mid-1]+rows[mid])/2;
}

function mad(values=[],center=median(values)){
  if(center==null)return null;
  return median(values.map(value=>Math.abs(Number(value)-center)).filter(Number.isFinite));
}

function sourceEffect(group){
  const anchor=finite(group?.anchorPrevalence),background=finite(group?.nullPrevalence);
  const delta=anchor==null||background==null?null:anchor-background;
  return{
    groupId:group?.groupId||null,
    source:String(group?.source||'unknown'),
    matchedPairs:Number(group?.matchedPairs)||0,
    anchorPrevalence:anchor,
    nullPrevalence:background,
    prevalenceDelta:delta,
    supportivePairs:Number(group?.supportivePairs)||0,
    contradictoryPairs:Number(group?.contradictoryPairs)||0,
    neutralPairs:Number(group?.neutralPairs)||0,
    direction:group?.direction||'neutral-direction',
  };
}

function assessPattern(pattern,config){
  const groups=(pattern?.independentGroups||[]).filter(row=>row?.eligible===true).map(sourceEffect);
  const n=groups.length;
  const supportive=groups.filter(row=>row.direction==='supportive-direction').length;
  const contradictory=groups.filter(row=>row.direction==='contradictory-direction').length;
  const neutral=groups.filter(row=>row.direction==='neutral-direction').length;
  const supportiveShare=n?supportive/n:0,contradictoryShare=n?contradictory/n:0,neutralShare=n?neutral/n:0;
  const deltas=groups.map(row=>row.prevalenceDelta).filter(Number.isFinite);
  const medianPrevalenceDelta=median(deltas),deltaMad=mad(deltas,medianPrevalenceDelta);
  const gates={
    minimumGroups:n>=config.minimumEligibleGroups,
    supportiveShare:supportiveShare>=config.minimumSupportiveGroupShare,
    contradictoryShare:contradictoryShare<=config.maximumContradictoryGroupShare,
    medianPrevalenceDelta:medianPrevalenceDelta!=null&&medianPrevalenceDelta>=config.minimumMedianPrevalenceDelta,
    dispersion:deltaMad!=null&&deltaMad<=config.maximumDeltaMad,
  };
  const failed=Object.entries(gates).filter(([,value])=>value!==true).map(([key])=>key);
  const status=failed.length?'source-stratified-stability-insufficient':'source-stratified-stability-supported';
  return{
    patternKey:pattern.patternKey,
    abilityId:Number(pattern.abilityId)||null,
    displayName:pattern.displayName||null,
    evidenceGroupsStatus:pattern.status,
    sourceEffects:groups,
    metrics:{
      eligibleGroups:n,
      supportiveGroups:supportive,
      contradictoryGroups:contradictory,
      neutralGroups:neutral,
      supportiveGroupShare:supportiveShare,
      contradictoryGroupShare:contradictoryShare,
      neutralGroupShare:neutralShare,
      medianPrevalenceDelta,
      deltaMad,
      minPrevalenceDelta:deltas.length?Math.min(...deltas):null,
      maxPrevalenceDelta:deltas.length?Math.max(...deltas):null,
    },
    gates,
    failedGates:failed,
    status,
    significanceClaimed:false,
    causalClaimed:false,
    holdoutEligible:status==='source-stratified-stability-supported',
    promotionEligible:false,
  };
}

export function buildStatisticalStabilityV1({evidenceGroups,config:configInput={}}={}){
  if(!evidenceGroups?.fingerprint||!evidenceGroups?.episodeId)throw new Error('Independent Evidence Groups product is required');
  const config=configFrom(configInput);
  const candidates=(evidenceGroups.patterns||[]).filter(row=>row?.status==='independent-groups-evidence-available');
  const patterns=candidates.map(row=>assessPattern(row,config));
  const supported=patterns.filter(row=>row.status==='source-stratified-stability-supported').length;
  const contradictory=patterns.filter(row=>Number(row.metrics?.contradictoryGroups)>0).length;
  const payload={
    version:STATISTICAL_STABILITY_V1_VERSION,
    policyVersion:STATISTICAL_STABILITY_POLICY_V1_VERSION,
    evidenceGroupsFingerprint:evidenceGroups.fingerprint,
    episodeId:evidenceGroups.episodeId,
    empiricalEvidenceFingerprint:evidenceGroups.empiricalEvidenceFingerprint||null,
    config,
    patterns:patterns.map(row=>({patternKey:row.patternKey,status:row.status,metrics:row.metrics,gates:row.gates})),
  };
  return{
    version:STATISTICAL_STABILITY_V1_VERSION,
    policyVersion:STATISTICAL_STABILITY_POLICY_V1_VERSION,
    fingerprint:digest(payload),
    episodeId:evidenceGroups.episodeId,
    interpretationBuildFingerprint:evidenceGroups.interpretationBuildFingerprint||null,
    empiricalEvidenceFingerprint:evidenceGroups.empiricalEvidenceFingerprint||null,
    evidenceGroupsFingerprint:evidenceGroups.fingerprint,
    scope:evidenceGroups.scope,
    signalId:evidenceGroups.signalId,
    config,
    patterns,
    summary:{
      eligibleEvidenceGroupPatterns:candidates.length,
      evaluatedPatterns:patterns.length,
      stabilitySupportedPatterns:supported,
      stabilityInsufficientPatterns:patterns.length-supported,
      patternsWithAnyContradictoryGroup:contradictory,
    },
    holdoutContribution:{
      statisticalStabilityGate:candidates.length===0?'not-eligible-no-independent-evidence-pattern':supported>0?'evidence-available':'insufficient',
      holdoutReadyPatterns:patterns.filter(row=>row.holdoutEligible).map(row=>row.patternKey),
      reason:candidates.length===0
        ?'No pattern has sufficient Independent Evidence Groups coverage, so Statistical Stability must not manufacture a candidate.'
        :supported>0
          ?'At least one pattern is directionally stable under the source-balanced v1 contract and may advance to an untouched holdout plan.'
          :'Independent group coverage exists, but no candidate satisfied the source-balanced stability contract.',
    },
    evidenceContract:{
      inputRequiresIndependentEvidenceGroups:true,
      equalSourceWeighting:true,
      reportPullVolumeCannotIncreaseSourceWeight:true,
      sourceLevelDirectionEvaluated:true,
      formalNullHypothesisSignificanceClaimed:false,
      confidenceIntervalClaimed:false,
      causalCombatEvidenceAdded:false,
      homeAvoidDataUsed:false,
      holdoutNotYetExecuted:true,
      directScoreDelta:0,
      canonicalDeepContribution:{reports:0,pulls:0},
      automaticPromotion:false,
      wclCallsExecuted:0,
      providerNetworkCallsExecuted:0,
    },
  };
}
