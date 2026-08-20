import { createHash } from 'node:crypto';

export const INDEPENDENT_EVIDENCE_GROUPS_V1_VERSION='independent-evidence-groups-v1';
export const INDEPENDENT_EVIDENCE_GROUPS_POLICY_V1_VERSION='independent-evidence-groups-policy-v1';

export const INDEPENDENT_EVIDENCE_GROUPS_DEFAULTS=Object.freeze({
  minimumIndependentGroups:3,
  minimumPairsPerGroup:1,
});

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=(value,length=40)=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0,length);

function configFrom(input={}){
  return{
    minimumIndependentGroups:Math.max(2,Math.min(10,Number(input.minimumIndependentGroups)||INDEPENDENT_EVIDENCE_GROUPS_DEFAULTS.minimumIndependentGroups)),
    minimumPairsPerGroup:Math.max(1,Math.min(4,Number(input.minimumPairsPerGroup)||INDEPENDENT_EVIDENCE_GROUPS_DEFAULTS.minimumPairsPerGroup)),
  };
}

function relativeBucket(delta){
  const abs=Math.abs(Number(delta)||0),distance=abs<=1000?'1s':abs<=2500?'2.5s':abs<=5000?'5s':'far';
  if(abs<=250)return`simultaneous-${distance}`;
  return`${delta<0?'before':'after'}-${distance}`;
}

function controlPatternKey(event,stream,referenceTimestamp){
  const abilityId=Number(event?.abilityId??event?.ability?.id),timestamp=Number(event?.timestamp);
  if(!Number.isFinite(abilityId)||!Number.isFinite(timestamp))return null;
  return[relativeBucket(timestamp-Number(referenceTimestamp)),String(stream),abilityId,String(event?.type||'event')].join('|');
}

function controlHasPattern(control,patternKey){
  for(const [stream,events] of Object.entries(control?.streams||{})){
    for(const event of events||[]){
      if(controlPatternKey(event,stream,control.referenceTimestamp)===patternKey)return true;
    }
  }
  return false;
}

function compatibleControl(row){
  return row?.kind==='matched-null-control'&&
    row?.pagination?.complete===true&&
    row?.validNull!==false&&
    row?.evidenceContract?.targetSignalGuardValidated===true&&
    row?.evidenceContract?.innerControlEventsOnly===true&&
    row?.evidenceContract?.pairedAnchorComparison===true&&
    row?.evidenceContract?.anchorContextCoversEpisodeRadius===true&&
    row?.evidenceContract?.controlCoversEpisodeRadius===true;
}

function groupDirection({supportivePairs,contradictoryPairs}){
  if(supportivePairs>contradictoryPairs)return'supportive-direction';
  if(contradictoryPairs>supportivePairs)return'contradictory-direction';
  return'neutral-direction';
}

function groupRows(patternKey,controls,config){
  const bySource=new Map();
  for(const control of controls){
    const source=String(control?.source||'unknown');
    if(!bySource.has(source))bySource.set(source,[]);
    bySource.get(source).push(control);
  }
  return[...bySource.entries()].map(([source,rows])=>{
    const ordered=[...rows].sort((a,b)=>String(a.reportCode).localeCompare(String(b.reportCode))||Number(a.fightID)-Number(b.fightID)||Number(a.referenceTimestamp)-Number(b.referenceTimestamp));
    let anchorHits=0,nullHits=0,supportivePairs=0,contradictoryPairs=0,neutralPairs=0;
    const reportCodes=new Set();
    for(const row of ordered){
      reportCodes.add(String(row.reportCode));
      const anchorHit=Array.isArray(row.anchorObservedPatternKeys)&&row.anchorObservedPatternKeys.includes(patternKey);
      const nullHit=controlHasPattern(row,patternKey);
      if(anchorHit)anchorHits++;
      if(nullHit)nullHits++;
      if(anchorHit&&!nullHit)supportivePairs++;
      else if(!anchorHit&&nullHit)contradictoryPairs++;
      else neutralPairs++;
    }
    const eligible=ordered.length>=config.minimumPairsPerGroup;
    return{
      groupId:`source:${digest(source,16)}`,
      source,
      sourceIdentityPolicy:'reportSourceKey:guild-id-else-owner-id-else-report-code',
      independentSourceUnit:true,
      reportCodes:[...reportCodes].sort(),
      matchedPairs:ordered.length,
      anchorHits,
      nullHits,
      anchorPrevalence:ordered.length?anchorHits/ordered.length:null,
      nullPrevalence:ordered.length?nullHits/ordered.length:null,
      supportivePairs,
      contradictoryPairs,
      neutralPairs,
      direction:groupDirection({supportivePairs,contradictoryPairs}),
      eligible,
    };
  }).sort((a,b)=>a.source.localeCompare(b.source));
}

export function buildIndependentEvidenceGroupsV1({episode,matchedNullEvaluation,controlRecords=[],config:configInput={}}={}){
  if(!episode?.episodeId||!episode?.buildFingerprint)throw new Error('Mechanic Episode with buildFingerprint is required');
  if(!matchedNullEvaluation?.episodeId)throw new Error('Matched Null evaluation is required');
  if(String(matchedNullEvaluation.episodeId)!==String(episode.episodeId))throw new Error('Matched Null evaluation does not match Episode identity');
  const config=configFrom(configInput);
  const controls=(controlRecords||[]).filter(compatibleControl);
  const matchedSupported=(matchedNullEvaluation.patternAssessments||[]).filter(row=>row?.status==='matched-specificity-supported');
  const patterns=matchedSupported.map(assessment=>{
    const patternKey=String(assessment.patternKey||'');
    const groups=groupRows(patternKey,controls,config);
    const eligibleGroups=groups.filter(row=>row.eligible);
    const supportiveGroups=eligibleGroups.filter(row=>row.direction==='supportive-direction');
    const contradictoryGroups=eligibleGroups.filter(row=>row.direction==='contradictory-direction');
    const neutralGroups=eligibleGroups.filter(row=>row.direction==='neutral-direction');
    const groupCoverageSufficient=eligibleGroups.length>=config.minimumIndependentGroups;
    return{
      patternKey,
      abilityId:Number(assessment.abilityId)||null,
      displayName:assessment.displayName||null,
      matchedNullStatus:assessment.status,
      matchedNull:{
        matchedPairs:Number(assessment.matchedPairs)||0,
        anchorPrevalence:assessment.anchorPrevalence??null,
        matchedBackgroundPrevalence:assessment.matchedBackgroundPrevalence??null,
        lift:assessment.lift??null,
        prevalenceDelta:assessment.prevalenceDelta??null,
      },
      independentGroups:groups,
      summary:{
        groups:groups.length,
        eligibleGroups:eligibleGroups.length,
        supportiveGroups:supportiveGroups.length,
        contradictoryGroups:contradictoryGroups.length,
        neutralGroups:neutralGroups.length,
        groupCoverageSufficient,
      },
      status:groupCoverageSufficient?'independent-groups-evidence-available':'independent-groups-insufficient',
      stabilityClaimed:false,
      promotionEligible:false,
    };
  });

  const eligiblePatterns=patterns.filter(row=>row.status==='independent-groups-evidence-available').length;
  const empiricalEvidenceFingerprint=String(episode?.empiricalBuildFingerprint||episode?.matchedNullEvidenceFingerprint||episode?.buildFingerprint||'');
  const payload={
    version:INDEPENDENT_EVIDENCE_GROUPS_V1_VERSION,
    policyVersion:INDEPENDENT_EVIDENCE_GROUPS_POLICY_V1_VERSION,
    episodeId:episode.episodeId,
    interpretationBuildFingerprint:episode.buildFingerprint,
    empiricalEvidenceFingerprint,
    matchedNullPolicyVersion:matchedNullEvaluation.policyVersion||null,
    config,
    patterns:patterns.map(row=>({patternKey:row.patternKey,status:row.status,summary:row.summary,groups:row.independentGroups.map(group=>({source:group.source,matchedPairs:group.matchedPairs,direction:group.direction,anchorHits:group.anchorHits,nullHits:group.nullHits}))})),
  };

  return{
    version:INDEPENDENT_EVIDENCE_GROUPS_V1_VERSION,
    policyVersion:INDEPENDENT_EVIDENCE_GROUPS_POLICY_V1_VERSION,
    fingerprint:digest(payload),
    episodeId:episode.episodeId,
    interpretationBuildFingerprint:episode.buildFingerprint,
    empiricalEvidenceFingerprint,
    scope:episode.scope,
    signalId:Number(episode?.anchor?.abilityId)||null,
    config,
    matchedNullBaseline:{
      baselineSufficient:Boolean(matchedNullEvaluation.baselineSufficient),
      matchedPairs:Number(matchedNullEvaluation.matchedPairs)||0,
      matchedSources:Number(matchedNullEvaluation.matchedSources)||0,
      supportedPatterns:matchedSupported.length,
    },
    patterns,
    summary:{
      matchedSupportedPatterns:matchedSupported.length,
      patternsWithIndependentGroupCoverage:eligiblePatterns,
      compatibleMatchedControls:controls.length,
      independentSources:[...new Set(controls.map(row=>String(row.source)))].length,
    },
    promotionContribution:{
      independentEvidenceGroupsGate:matchedSupported.length===0?'not-eligible-no-matched-supported-pattern':eligiblePatterns>0?'evidence-available':'insufficient',
      automaticPromotion:false,
      reason:matchedSupported.length===0
        ?'No candidate cleared Matched Null specificity, so Independent Evidence Groups must not manufacture eligibility from earlier diagnostic neighbors.'
        :eligiblePatterns>0
          ?'Independent source-group coverage exists for at least one Matched Null-supported pattern; directional statistical stability is intentionally evaluated by a later layer.'
          :'Matched Null-supported pattern(s) exist, but independent source-group coverage is below the configured minimum.',
    },
    evidenceContract:{
      sourceUnit:'reportSourceKey:guild-id-else-owner-id-else-report-code',
      reportsFromSameGuildOrUploaderDoNotBecomeIndependentGroups:true,
      matchedNullSupportedPatternsOnly:true,
      matchedPairEvidenceOnly:true,
      homeAvoidDataUsed:false,
      sourceIndependenceClaimLimitedToGroupIdentity:true,
      statisticalStabilityNotYetClaimed:true,
      holdoutNotYetClaimed:true,
      directScoreDelta:0,
      canonicalDeepContribution:{reports:0,pulls:0},
      automaticPromotion:false,
      wclCallsExecuted:0,
      providerNetworkCallsExecuted:0,
    },
  };
}
