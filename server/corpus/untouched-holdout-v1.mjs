import { createHash } from 'node:crypto';

export const UNTOUCHED_HOLDOUT_VERSION='untouched-holdout-v1';
export const UNTOUCHED_HOLDOUT_POLICY_VERSION='untouched-holdout-policy-v1';
export const UNTOUCHED_HOLDOUT_DEFAULTS=Object.freeze({
  targetReservedSources:5,
  minimumEvaluableSources:3,
  minimumSupportiveSourceShare:2/3,
  maximumContradictorySourceShare:0.25,
  minimumSourcePrevalenceDelta:0.15,
  minimumMedianPrevalenceDelta:0.20,
});

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=(value,length=40)=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0,length);
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const sourceKey=value=>String(value||'').trim();

function median(values=[]){
  const rows=values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!rows.length)return null;
  const middle=Math.floor(rows.length/2);
  return rows.length%2?rows[middle]:(rows[middle-1]+rows[middle])/2;
}

function policy(input={}){
  const clamp=(value,fallback,min,max)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
  return{
    targetReservedSources:Math.max(3,Math.min(12,Number(input.targetReservedSources)||UNTOUCHED_HOLDOUT_DEFAULTS.targetReservedSources)),
    minimumEvaluableSources:Math.max(3,Math.min(10,Number(input.minimumEvaluableSources)||UNTOUCHED_HOLDOUT_DEFAULTS.minimumEvaluableSources)),
    minimumSupportiveSourceShare:clamp(input.minimumSupportiveSourceShare,UNTOUCHED_HOLDOUT_DEFAULTS.minimumSupportiveSourceShare,0.5,1),
    maximumContradictorySourceShare:clamp(input.maximumContradictorySourceShare,UNTOUCHED_HOLDOUT_DEFAULTS.maximumContradictORYSourceShare,0,0.5),
    minimumSourcePrevalenceDelta:clamp(input.minimumSourcePrevalenceDelta,UNTOUCHED_HOLDOUT_DEFAULTS.minimumSourcePrevalenceDelta,0,1),
    minimumMedianPrevalenceDelta:clamp(input.minimumMedianPrevalenceDelta,UNTOUCHED_HOLDOUT_DEFAULTS.minimumMedianPrevalenceDelta,0,1),
  };
}

function supportedPatterns(stability){
  return (stability?.patterns||[])
    .filter(row=>row?.status==='source-stratified-stability-supported'&&row?.holdoutEligible===true)
    .map(row=>({patternKey:String(row.patternKey||''),abilityId:Number(row.abilityId)||null,displayName:row.displayName||null}))
    .filter(row=>row.patternKey)
    .sort((a,b)=>a.patternKey.localeCompare(b.patternKey));
}

function normalizeSourceCandidate(row){
  const value=typeof row==='string'?{source:row}:row||{};
  const source=sourceKey(value.source||value.sourceKey);
  const seedReportCode=String(value.seedReportCode||value.reportCode||'').trim()||null;
  const reasons=[];
  if(!source)reasons.push('missing-source-identity');
  if(value.homeSource!==false)reasons.push('home-source-status-not-explicitly-false');
  if(value.preexistingCorpusMember!==false)reasons.push('preexisting-corpus-status-not-explicitly-false');
  if(value.priorLearningUse!==false)reasons.push('prior-learning-use-status-not-explicitly-false');
  if(value.combatEvidenceObservedBeforeReservation!==false)reasons.push('prior-combat-evidence-status-not-explicitly-false');
  return{
    source,seedReportCode,
    metadataOnlyDiscovery:value.metadataOnlyDiscovery===true,
    homeSource:value.homeSource===true,
    preexistingCorpusMember:value.preexistingCorpusMember===true,
    priorLearningUse:value.priorLearningUse===true,
    combatEvidenceObservedBeforeReservation:value.combatEvidenceObservedBeforeReservation===true,
    eligible:reasons.length===0,
    rejectionReasons:reasons,
  };
}

export function buildUntouchedHoldoutReservationV1({stability,sourceCandidates=[],config={},reservedAt=Date.now()}={}){
  if(!stability?.fingerprint||!stability?.episodeId)throw new Error('Statistical Stability product is required before holdout reservation');
  const frozenPatterns=supportedPatterns(stability),settings=policy(config),timestamp=Number(reservedAt)||Date.now();
  if(!frozenPatterns.length){
    return{
      version:UNTOUCHED_HOLDOUT_VERSION,policyVersion:UNTOUCHED_HOLDOUT_POLICY_VERSION,
      status:'not-eligible-no-stability-supported-pattern',stabilityFingerprint:stability.fingerprint,episodeId:stability.episodeId,
      empiricalEvidenceFingerprint:stability.empiricalEvidenceFingerprint||null,reservedAt:timestamp,config:settings,
      frozenCandidatePatterns:[],reservedSources:[],rejectedSources:[],
      acquisitionRequired:false,
      evidenceContract:{candidateSetFrozen:true,sourceSelectionUsesCombatOutcomes:false,legacyValidationIsUntouchedHoldout:false,homeAvoidDataUsed:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,automaticPromotion:false},
    };
  }
  const normalized=sourceCandidates.map(normalizeSourceCandidate);
  const eligible=normalized.filter(row=>row.eligible);
  const rejected=normalized.filter(row=>!row.eligible);
  const ranked=eligible
    .map(row=>({...row,selectionRank:digest(`${UNTOUCHED_HOLDOUT_POLICY_VERSION}|${stability.fingerprint}|${row.source}`,16)}))
    .sort((a,b)=>a.selectionRank.localeCompare(b.selectionRank)||a.source.localeCompare(b.source));
  const reservedSources=ranked.slice(0,settings.targetReservedSources);
  const status=reservedSources.length>=settings.minimumEvaluableSources?'reservation-ready':'holdout-unavailable-insufficient-unseen-sources';
  const payload={
    version:UNTOUCHED_HOLDOUT_VERSION,policyVersion:UNTOUCHED_HOLDOUT_POLICY_VERSION,stabilityFingerprint:stability.fingerprint,
    episodeId:stability.episodeId,empiricalEvidenceFingerprint:stability.empiricalEvidenceFingerprint||null,reservedAt:timestamp,
    frozenCandidatePatterns:frozenPatterns.map(row=>row.patternKey),reservedSources:reservedSources.map(row=>({source:row.source,seedReportCode:row.seedReportCode||null})),config:settings,
  };
  return{
    ...payload,fingerprint:digest(payload),status,config:settings,frozenCandidatePatterns:frozenPatterns,reservedSources,
    rejectedSources:rejected,acquisitionRequired:status==='reservation-ready',
    evidenceContract:{
      candidateSetFrozen:true,sourceSetFrozen:true,sourceSelectionUsesCombatOutcomes:false,
      sourceSeedMetadataFrozenBeforeCombatEvidence:true,reservationRequiresExplicitlyUnseenSources:true,preexistingCorpusSourcesForbidden:true,legacyValidationIsUntouchedHoldout:false,
      holdoutMayNotDiscoverNewCandidates:true,holdoutMayNotRetuneThresholds:true,failedHoldoutRequiresNewCandidateAndNewReservation:true,
      homeAvoidDataUsed:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0,automaticPromotion:false,
    },
  };
}

function sourcePatternEvidence(sourceRow,patternKey,settings){
  const row=(sourceRow?.patterns||[]).find(item=>String(item?.patternKey||'')===patternKey);
  if(!row)return null;
  const matchedPairs=Math.max(0,Number(row.matchedPairs)||0),anchorHits=Math.max(0,Number(row.anchorHits)||0),nullHits=Math.max(0,Number(row.nullHits)||0);
  if(!matchedPairs||anchorHits>matchedPairs||nullHits>matchedPairs)return null;
  const anchorPrevalence=anchorHits/matchedPairs,nullPrevalence=nullHits/matchedPairs,prevalenceDelta=anchorPrevalence-nullPrevalence;
  const direction=prevalenceDelta>=settings.minimumSourcePrevalenceDelta?'supportive-direction':prevalenceDelta<=0?'contradictory-direction':'neutral-direction';
  return{matchedPairs,anchorHits,nullHits,anchorPrevalence,nullPrevalence,prevalenceDelta,direction};
}

function evaluatePattern(pattern,sourceRows,settings){
  const observations=[];
  for(const sourceRow of sourceRows){
    const evidence=sourcePatternEvidence(sourceRow,pattern.patternKey,settings);
    if(evidence)observations.push({source:sourceKey(sourceRow.source),...evidence});
  }
  const n=observations.length,supportive=observations.filter(row=>row.direction==='supportive-direction').length,contradictory=observations.filter(row=>row.direction==='contradictory-direction').length,neutral=n-supportive-contradictory;
  const supportiveShare=n?supportive/n:0,contradictoryShare=n?contradictory/n:0,medianPrevalenceDelta=median(observations.map(row=>row.prevalenceDelta));
  const sufficient=n>=settings.minimumEvaluableSources;
  const gates={
    minimumSources:sufficient,
    supportiveShare:sufficient&&supportiveShare>=settings.minimumSupportiveSourceShare,
    contradictoryShare:sufficient&&contradictoryShare<=settings.maximumContradictorySourceShare,
    medianPrevalenceDelta:sufficient&&medianPrevalenceDelta!=null&&medianPrevalenceDelta>=settings.minimumMedianPrevalenceDelta,
  };
  let status='untouched-holdout-inconclusive';
  if(sufficient)status=Object.values(gates).every(Boolean)?'untouched-holdout-supported':'untouched-holdout-rejected';
  return{
    patternKey:pattern.patternKey,abilityId:pattern.abilityId,displayName:pattern.displayName,
    status,sourceObservations:observations,
    metrics:{evaluableSources:n,supportiveSources:supportive,contradictorySources:contradictory,neutralSources:neutral,supportiveSourceShare:supportiveShare,contradictorySourceShare:contradictoryShare,medianPrevalenceDelta},
    gates,failedGates:Object.entries(gates).filter(([,value])=>value!==true).map(([key])=>key),
    promotionEligible:false,
  };
}

export function evaluateUntouchedHoldoutV1({reservation,holdoutEvidence}={}){
  if(!reservation?.fingerprint||reservation?.status!=='reservation-ready')throw new Error('A reservation-ready Untouched Holdout plan is required');
  if(!holdoutEvidence||typeof holdoutEvidence!=='object')throw new Error('Holdout evidence is required');
  if(String(holdoutEvidence.reservationFingerprint||'')!==String(reservation.fingerprint))throw new Error('Holdout evidence reservation fingerprint mismatch');
  const collectedAt=finite(holdoutEvidence.collectedAt);
  if(collectedAt==null||collectedAt<Number(reservation.reservedAt||0))throw new Error('Holdout evidence must be collected after reservation');
  const reservedSet=new Set((reservation.reservedSources||[]).map(row=>sourceKey(row.source)));
  const rows=Array.isArray(holdoutEvidence.sources)?holdoutEvidence.sources:[];
  const unknownSources=rows.map(row=>sourceKey(row.source)).filter(source=>source&&!reservedSet.has(source));
  if(unknownSources.length)throw new Error(`Holdout evidence contains unreserved sources: ${[...new Set(unknownSources)].join(', ')}`);
  const frozenKeys=new Set((reservation.frozenCandidatePatterns||[]).map(row=>String(row.patternKey||'')));
  const observedPatternKeys=new Set(rows.flatMap(row=>(row.patterns||[]).map(item=>String(item?.patternKey||'')).filter(Boolean)));
  const unexpected=[...observedPatternKeys].filter(key=>!frozenKeys.has(key));
  if(unexpected.length)throw new Error(`Holdout cannot discover or add candidate patterns: ${unexpected.join(', ')}`);
  const patterns=(reservation.frozenCandidatePatterns||[]).map(pattern=>evaluatePattern(pattern,rows,reservation.config||policy()));
  const supported=patterns.filter(row=>row.status==='untouched-holdout-supported');
  const rejected=patterns.filter(row=>row.status==='untouched-holdout-rejected');
  const inconclusive=patterns.filter(row=>row.status==='untouched-holdout-inconclusive');
  const payload={version:UNTOUCHED_HOLDOUT_VERSION,policyVersion:UNTOUCHED_HOLDOUT_POLICY_VERSION,reservationFingerprint:reservation.fingerprint,stabilityFingerprint:reservation.stabilityFingerprint,patterns:patterns.map(row=>({patternKey:row.patternKey,status:row.status,metrics:row.metrics,gates:row.gates}))};
  return{
    version:UNTOUCHED_HOLDOUT_VERSION,policyVersion:UNTOUCHED_HOLDOUT_POLICY_VERSION,fingerprint:digest(payload),
    reservationFingerprint:reservation.fingerprint,stabilityFingerprint:reservation.stabilityFingerprint,episodeId:reservation.episodeId,
    empiricalEvidenceFingerprint:reservation.empiricalEvidenceFingerprint||null,scope:holdoutEvidence.scope||null,patterns,
    summary:{frozenPatterns:patterns.length,supportedPatterns:supported.length,rejectedPatterns:rejected.length,inconclusivePatterns:inconclusive.length,reservedSources:reservedSet.size,evidenceSources:new Set(rows.map(row=>sourceKey(row.source)).filter(Boolean)).size},
    promotionContribution:{
      untouchedHoldoutGate:patterns.length===0?'not-eligible-no-frozen-pattern':supported.length>0?'evidence-available':rejected.length>0?'rejected':'inconclusive',
      holdoutSupportedPatterns:supported.map(row=>row.patternKey),holdoutRejectedPatterns:rejected.map(row=>row.patternKey),
      automaticPromotion:false,
      reason:supported.length>0?'At least one pre-frozen candidate replicated in reserved unseen sources. Promotion remains a separate contract.':rejected.length>0?'At least one pre-frozen candidate failed the untouched holdout. Retuning against this holdout is forbidden; a revised candidate requires a new reservation.':'Holdout evidence is incomplete for the frozen candidate set.',
    },
    evidenceContract:{
      candidateSetFrozenBeforeEvidence:true,sourceSetFrozenBeforeEvidence:true,onlyReservedSourcesAccepted:true,
      newCandidateDiscoveryForbidden:true,thresholdRetuningFromHoldoutForbidden:true,holdoutReuseAfterRetuningForbidden:true,
      causalCombatEvidenceAdded:false,homeAvoidDataUsed:false,directScoreDelta:0,canonicalDeepContribution:{reports:0,pulls:0},automaticPromotion:false,
      wclCallsExecuted:0,providerNetworkCallsExecuted:0,
    },
  };
}
