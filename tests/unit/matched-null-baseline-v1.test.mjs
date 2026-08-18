import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchedNullBaselinePlanV1,buildMatchedNullBaselinePreviewV1,evaluateMatchedNullBaselineV1 } from '../../server/corpus/matched-null-baseline-v1.mjs';
import { buildMatchedNullControlEvidenceRecordV1 } from '../../server/corpus/matched-null-baseline-executor-v1.mjs';

const NOISE_KEY='before-2.5s|buffs|100|applybuff';
const SPECIFIC_KEY='after-2.5s|debuffs|200|removedebuff';
const WIDE_KEY='before-5s|buffs|300|applybuff';
const episode={
  episodeId:'episode:synthetic',buildFingerprint:'episode-build',scope:{encounterId:999,difficulty:5,partition:4,stateScope:'global'},
  anchor:{abilityId:900,roleInEpisode:'anchor'},edges:[{temporalWindowMs:2500}],inputEvidence:{stored:{contexts:10}},
  nodes:[
    {patternKey:'anchor|anchor|900|signal-anchor',abilityId:900,roleInEpisode:'anchor'},
    {patternKey:NOISE_KEY,abilityId:100,displayName:'Noise Aura',roleInEpisode:'precursor',disposition:'context-only',specificity:{anchorPrevalence:1},evidence:{windows:10}},
    {patternKey:SPECIFIC_KEY,abilityId:200,displayName:'Specific Aura',roleInEpisode:'aftermath',disposition:'provenance-required',specificity:{anchorPrevalence:.9},evidence:{windows:9}},
  ],
};
const context=(source,reportCode,fightID,anchorTimestamp,windowMs=2500,streams={})=>({kind:'context',signalId:900,source,reportCode,fightID,anchorTimestamp,windowMs,pagination:{complete:true},streams});
const profile=(code,fightID)=>({kind:'deep',code,fights:[{id:fightID,startTime:0,endTime:120000,kill:false,phaseTransitions:[{id:1,startTime:0},{id:2,startTime:70000}]}]});

function anchorStreams(anchorTimestamp,{wide=false}={}){
  return{
    buffs:[
      {timestamp:anchorTimestamp-1500,type:'applybuff',abilityId:100},
      ...(wide?[{timestamp:anchorTimestamp-4000,type:'applybuff',abilityId:300}]:[]),
    ],
    debuffs:[{timestamp:anchorTimestamp+1500,type:'removedebuff',abilityId:200}],
  };
}
function syntheticPlanInputs(count=6){
  const evidence=[],profiles=[],anchorTimestamp=40000;
  for(let i=1;i<=count;i++){
    const source=`guild:${i}`,code=`R${i}`;
    evidence.push(context(source,code,i,anchorTimestamp,2500,anchorStreams(anchorTimestamp)));
    evidence.push(context(source,code,i,anchorTimestamp,5000,anchorStreams(anchorTimestamp,{wide:true})));
    profiles.push(profile(code,i));
  }
  return{evidence,profiles};
}

test('matched null planner balances sources and pairs each control to sufficient anchor evidence',()=>{
  const {evidence,profiles}=syntheticPlanInputs();
  const plan=buildMatchedNullBaselinePlanV1({episode,evidenceRecords:evidence,profiles,config:{maxControls:6,maxControlsPerSource:1,minimumMatchedControls:6,minimumMatchedSources:3}});
  assert.equal(plan.anchorsKnown,6);assert.equal(plan.anchorsAvailable,6);assert.equal(plan.deficits.missingSufficientAnchorContext,0);
  assert.equal(plan.plannedControls,6);assert.equal(plan.plannedSources,6);assert.equal(plan.sufficientByPlan,true);
  assert.equal(plan.evidenceContract.pairedAnchorComparison,true);assert.equal(plan.evidenceContract.anchorContextCoversEpisodeRadius,true);assert.equal(plan.evidenceContract.localFlankControlsUsed,false);assert.equal(plan.evidenceContract.targetSignalGuardRadiusValidated,true);assert.equal(plan.evidenceContract.controlCoversEpisodeRadius,true);
  for(const control of plan.controls){
    assert.equal(control.match.sameFight,true);assert.equal(control.match.sameOutcome,true);assert.equal(control.match.phaseAvailable,true);assert.equal(control.match.phaseMatched,true);
    assert.ok(control.match.temporalDistanceMs>control.match.episodeExclusionDistanceMs);
    assert.equal(control.anchorContextWindowMs,2500);
    assert.deepEqual(control.anchorObservedPatternKeys,[SPECIFIC_KEY,NOISE_KEY].sort());
    assert.ok(control.anchorPatternFingerprint);
    assert.equal(control.contaminationGuardRadiusMs,control.match.episodeExclusionDistanceMs);
    assert.ok(control.contaminationWindowStart>=0&&control.contaminationWindowEnd<=120000);
    assert.ok(control.windowStart>=control.contaminationWindowStart&&control.windowEnd<=control.contaminationWindowEnd);
  }
});

test('matched null inner radius and paired anchor context expand to cover every Episode temporal bucket',()=>{
  const {evidence,profiles}=syntheticPlanInputs(1),wideEpisode={...episode,buildFingerprint:'episode-build-wide',edges:[{temporalWindowMs:5000}],nodes:[...episode.nodes,{patternKey:WIDE_KEY,abilityId:300,displayName:'Wide Pattern',roleInEpisode:'precursor',disposition:'context-only',specificity:{anchorPrevalence:.8},evidence:{windows:8}}]};
  const plan=buildMatchedNullBaselinePlanV1({episode:wideEpisode,evidenceRecords:evidence,profiles,config:{controlRadiusMs:2500,maxControls:1,maxControlsPerSource:1,minimumMatchedControls:4,minimumMatchedSources:2}}),control=plan.controls[0],center=control.referenceTimestamp;
  assert.equal(plan.episodeRadiusMs,5000);
  assert.equal(plan.config.requestedControlRadiusMs,2500);
  assert.equal(plan.config.controlRadiusMs,5000);
  assert.equal(control.windowMs,5000);
  assert.equal(control.anchorContextWindowMs,5000);
  assert.ok(control.anchorObservedPatternKeys.includes(WIDE_KEY));
  assert.equal(plan.evidenceContract.controlCoversEpisodeRadius,true);
  assert.equal(plan.evidenceContract.anchorContextCoversEpisodeRadius,true);
  const record=buildMatchedNullControlEvidenceRecordV1(plan,control,{streams:{buffs:[{timestamp:center-4000,type:'applybuff',abilityId:300}]},pagination:{complete:true},rateLimit:null});
  assert.equal(record.validNull,true);
  assert.equal(record.evidenceContract.pairedAnchorComparison,true);
  assert.ok(record.anchorObservedPatternKeys.includes(WIDE_KEY));
  assert.equal(record.streams.buffs.length,1,'a before-5s Episode pattern must remain observable in matched-null evidence');
  assert.equal(record.streams.buffs[0].abilityId,300);
});

test('matched null planner replaces a previously contaminated control with the next viable deterministic offset',()=>{
  const {evidence,profiles}=syntheticPlanInputs(1);
  const first=buildMatchedNullBaselinePlanV1({episode,evidenceRecords:evidence,profiles,config:{maxControls:1,maxControlsPerSource:1,minimumMatchedControls:4,minimumMatchedSources:2}});
  assert.equal(first.controls.length,1);
  const old=first.controls[0];
  const second=buildMatchedNullBaselinePlanV1({episode,evidenceRecords:evidence,profiles,rejectedControls:[{...old,validNull:false}],config:{maxControls:1,maxControlsPerSource:1,minimumMatchedControls:4,minimumMatchedSources:2}});
  assert.equal(second.controls.length,1);
  assert.notEqual(second.controls[0].referenceTimestamp,old.referenceTimestamp);
  assert.equal(second.deficits.previouslyContaminatedControls,1);
  assert.equal(second.evidenceContract.contaminatedControlsAreReplanned,true);
});

test('matched null preview is network-free, bounded, and refuses pre-paired cache',()=>{
  const {evidence,profiles}=syntheticPlanInputs();
  const plan=buildMatchedNullBaselinePlanV1({episode,evidenceRecords:evidence,profiles,config:{maxControls:6,maxControlsPerSource:1}}),legacyCache=[{controlId:plan.controls[0].controlId,pagination:{complete:true},validNull:true,evidenceContract:{targetSignalGuardValidated:true,innerControlEventsOnly:true}}],preview=buildMatchedNullBaselinePreviewV1({plan,cacheRecords:legacyCache,maxWclCalls:12,maxContinuationRounds:1});
  assert.equal(preview.executesWcl,false);assert.equal(preview.wclCallsExecuted,0);assert.equal(preview.controlsRemaining,6);assert.equal(preview.completeCacheHits,0);
  assert.equal(preview.networkUpperBound.preflightCalls,1);assert.equal(preview.networkUpperBound.initialControlCalls,6);
  assert.equal(preview.executionPolicy.exactFightIDsOnly,true);assert.equal(preview.executionPolicy.wholeReportFallback,false);assert.equal(preview.executionPolicy.pairedAnchorComparison,true);assert.equal(preview.executionPolicy.targetSignalGuardFetch,true);assert.equal(preview.executionPolicy.innerControlEventsOnly,true);assert.equal(preview.executionPolicy.controlCoversEpisodeRadius,true);assert.equal(preview.executionPolicy.localFlankBaselineIsPromotionBaseline,false);
});

test('guarded evidence rejects a target anchor outside the inner control window without polluting stored pattern events',()=>{
  const {evidence,profiles}=syntheticPlanInputs(1);
  const plan=buildMatchedNullBaselinePlanV1({episode,evidenceRecords:evidence,profiles,config:{maxControls:1,maxControlsPerSource:1,minimumMatchedControls:4,minimumMatchedSources:2}}),control=plan.controls[0],center=control.referenceTimestamp;
  const bundle={
    streams:{
      buffs:[{timestamp:center-1500,type:'applybuff',abilityId:100},{timestamp:center+5000,type:'applybuff',abilityId:777}],
      enemyCasts:[{timestamp:center+5000,type:'cast',abilityId:900}],
    },
    pagination:{complete:true},rateLimit:null,
  };
  const record=buildMatchedNullControlEvidenceRecordV1(plan,control,bundle);
  assert.equal(record.validNull,false);
  assert.equal(record.invalidReason,'target-signal-observed-inside-episode-guard');
  assert.equal(record.contamination.targetSignalObserved,true);
  assert.equal(record.evidenceContract.targetSignalGuardValidated,true);
  assert.equal(record.evidenceContract.innerControlEventsOnly,true);
  assert.equal(record.evidenceContract.pairedAnchorComparison,true);
  assert.deepEqual(record.anchorObservedPatternKeys,control.anchorObservedPatternKeys);
  assert.equal(record.streams.buffs.length,1);
  assert.equal(record.streams.buffs[0].abilityId,100);
  assert.equal(record.streams.enemyCasts.length,0,'guard-only anchor evidence must not become baseline pattern evidence');
});

function controlRecord(index,{invalid=false,anchorPatternKeys=[NOISE_KEY,SPECIFIC_KEY]}={}){
  const referenceTimestamp=50000,streams={buffs:[{timestamp:referenceTimestamp-1500,type:'applybuff',abilityId:100}],debuffs:invalid?[{timestamp:referenceTimestamp+1500,type:'removedebuff',abilityId:200}]:[]};
  return{kind:'matched-null-control',controlId:`C${index}`,source:`guild:${index}`,reportCode:`R${index}`,fightID:index,referenceTimestamp,anchorObservedPatternKeys:[...anchorPatternKeys],pagination:{complete:true},validNull:!invalid,evidenceContract:{pairedAnchorComparison:true,anchorContextCoversEpisodeRadius:true,controlCoversEpisodeRadius:true,targetSignalGuardValidated:true,innerControlEventsOnly:true},streams};
}

test('matched baseline compares anchor and null prevalence over the same valid pairs',()=>{
  const controls=[];for(let i=1;i<=6;i++)controls.push(controlRecord(i));controls.push(controlRecord(7,{invalid:true}));
  const result=evaluateMatchedNullBaselineV1({episode,controlRecords:controls,config:{minimumMatchedControls:6,minimumMatchedSources:3}});
  assert.equal(result.baselineSufficient,true);assert.equal(result.matchedPairs,6);assert.equal(result.completeControls,6);assert.equal(result.invalidControls,1);
  const noise=result.patternAssessments.find(row=>row.abilityId===100),specific=result.patternAssessments.find(row=>row.abilityId===200);
  assert.equal(noise.matchedPairs,6);assert.equal(noise.anchorPrevalence,1);assert.equal(noise.matchedBackgroundPrevalence,1);assert.equal(noise.status,'matched-background-noise');
  assert.equal(specific.anchorPrevalence,1);assert.equal(specific.discoveryAnchorPrevalence,.9);assert.equal(specific.matchedBackgroundPrevalence,0);assert.equal(specific.status,'matched-specificity-supported');
  assert.equal(result.promotionContribution.automaticPromotion,false);assert.equal(result.evidenceContract.pairedAnchorComparison,true);assert.equal(result.evidenceContract.sourceIndependenceNotYetClaimed,true);
});

test('matched gate uses paired anchor prevalence even when discovery prevalence disagrees',()=>{
  const pairedEpisode={...episode,nodes:episode.nodes.map(row=>row.abilityId===200?{...row,specificity:{...row.specificity,anchorPrevalence:.2}}:row)};
  const controls=[];for(let i=1;i<=6;i++)controls.push(controlRecord(i));
  const result=evaluateMatchedNullBaselineV1({episode:pairedEpisode,controlRecords:controls,config:{minimumMatchedControls:6,minimumMatchedSources:3}}),specific=result.patternAssessments.find(row=>row.abilityId===200);
  assert.equal(specific.discoveryAnchorPrevalence,.2);
  assert.equal(specific.anchorPrevalence,1,'the matched gate must use the anchors paired to the valid null controls');
  assert.equal(specific.matchedBackgroundPrevalence,0);
  assert.equal(specific.status,'matched-specificity-supported');
});
