import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchedNullBaselinePlanV1,buildMatchedNullBaselinePreviewV1,evaluateMatchedNullBaselineV1 } from '../../server/corpus/matched-null-baseline-v1.mjs';
import { buildMatchedNullControlEvidenceRecordV1 } from '../../server/corpus/matched-null-baseline-executor-v1.mjs';

const episode={
  episodeId:'episode:synthetic',buildFingerprint:'episode-build',scope:{encounterId:999,difficulty:5,partition:4,stateScope:'global'},
  anchor:{abilityId:900,roleInEpisode:'anchor'},edges:[{temporalWindowMs:2500}],inputEvidence:{stored:{contexts:10}},
  nodes:[
    {patternKey:'anchor|anchor|900|signal-anchor',abilityId:900,roleInEpisode:'anchor'},
    {patternKey:'before-2.5s|buffs|100|applybuff',abilityId:100,displayName:'Noise Aura',roleInEpisode:'precursor',disposition:'context-only',specificity:{anchorPrevalence:1},evidence:{windows:10}},
    {patternKey:'after-2.5s|debuffs|200|removedebuff',abilityId:200,displayName:'Specific Aura',roleInEpisode:'aftermath',disposition:'provenance-required',specificity:{anchorPrevalence:.9},evidence:{windows:9}},
  ],
};
const context=(source,reportCode,fightID,anchorTimestamp)=>({kind:'context',signalId:900,source,reportCode,fightID,anchorTimestamp,windowMs:2500,pagination:{complete:true},streams:{}});
const profile=(code,fightID)=>({kind:'deep',code,fights:[{id:fightID,startTime:0,endTime:120000,kill:false,phaseTransitions:[{id:1,startTime:0},{id:2,startTime:70000}]}]});

function syntheticPlanInputs(count=6){
  const evidence=[],profiles=[];for(let i=1;i<=count;i++){evidence.push(context(`guild:${i}`,`R${i}`,i,40000));profiles.push(profile(`R${i}`,i));}return{evidence,profiles};
}

test('matched null planner balances sources and keeps the full contamination guard inside the same fight',()=>{
  const {evidence,profiles}=syntheticPlanInputs();
  const plan=buildMatchedNullBaselinePlanV1({episode,evidenceRecords:evidence,profiles,config:{maxControls:6,maxControlsPerSource:1,minimumMatchedControls:6,minimumMatchedSources:3}});
  assert.equal(plan.plannedControls,6);assert.equal(plan.plannedSources,6);assert.equal(plan.sufficientByPlan,true);assert.equal(plan.evidenceContract.localFlankControlsUsed,false);assert.equal(plan.evidenceContract.targetSignalGuardRadiusValidated,true);
  for(const control of plan.controls){
    assert.equal(control.match.sameFight,true);assert.equal(control.match.sameOutcome,true);assert.equal(control.match.phaseAvailable,true);assert.equal(control.match.phaseMatched,true);
    assert.ok(control.match.temporalDistanceMs>control.match.episodeExclusionDistanceMs);
    assert.equal(control.contaminationGuardRadiusMs,control.match.episodeExclusionDistanceMs);
    assert.ok(control.contaminationWindowStart>=0&&control.contaminationWindowEnd<=120000);
    assert.ok(control.windowStart>=control.contaminationWindowStart&&control.windowEnd<=control.contaminationWindowEnd);
  }
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

test('matched null preview is network-free, bounded, and refuses legacy unguarded cache',()=>{
  const {evidence,profiles}=syntheticPlanInputs();
  const plan=buildMatchedNullBaselinePlanV1({episode,evidenceRecords:evidence,profiles,config:{maxControls:6,maxControlsPerSource:1}}),legacyCache=[{controlId:plan.controls[0].controlId,pagination:{complete:true},validNull:true,evidenceContract:{}}],preview=buildMatchedNullBaselinePreviewV1({plan,cacheRecords:legacyCache,maxWclCalls:12,maxContinuationRounds:1});
  assert.equal(preview.executesWcl,false);assert.equal(preview.wclCallsExecuted,0);assert.equal(preview.controlsRemaining,6);assert.equal(preview.completeCacheHits,0);assert.equal(preview.networkUpperBound.preflightCalls,1);assert.equal(preview.networkUpperBound.initialControlCalls,6);assert.equal(preview.executionPolicy.exactFightIDsOnly,true);assert.equal(preview.executionPolicy.wholeReportFallback,false);assert.equal(preview.executionPolicy.targetSignalGuardFetch,true);assert.equal(preview.executionPolicy.innerControlEventsOnly,true);assert.equal(preview.executionPolicy.localFlankBaselineIsPromotionBaseline,false);
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
  assert.equal(record.streams.buffs.length,1);
  assert.equal(record.streams.buffs[0].abilityId,100);
  assert.equal(record.streams.enemyCasts.length,0,'guard-only anchor evidence must not become baseline pattern evidence');
});

function controlRecord(index,{invalid=false}={}){
  const referenceTimestamp=50000,streams={buffs:[{timestamp:referenceTimestamp-1500,type:'applybuff',abilityId:100}],debuffs:invalid?[{timestamp:referenceTimestamp+1500,type:'removedebuff',abilityId:200}]:[]};
  return{kind:'matched-null-control',controlId:`C${index}`,source:`guild:${index}`,reportCode:`R${index}`,fightID:index,referenceTimestamp,pagination:{complete:true},validNull:!invalid,evidenceContract:{targetSignalGuardValidated:true,innerControlEventsOnly:true},streams};
}

test('matched baseline separates recurring background noise from a specific pattern and rejects contaminated controls',()=>{
  const controls=[];for(let i=1;i<=6;i++)controls.push(controlRecord(i));controls.push(controlRecord(7,{invalid:true}));
  const result=evaluateMatchedNullBaselineV1({episode,controlRecords:controls,config:{minimumMatchedControls:6,minimumMatchedSources:3}});
  assert.equal(result.baselineSufficient,true);assert.equal(result.completeControls,6);assert.equal(result.invalidControls,1);
  const noise=result.patternAssessments.find(row=>row.abilityId===100),specific=result.patternAssessments.find(row=>row.abilityId===200);
  assert.equal(noise.matchedBackgroundPrevalence,1);assert.equal(noise.status,'matched-background-noise');assert.equal(specific.matchedBackgroundPrevalence,0);assert.equal(specific.status,'matched-specificity-supported');assert.equal(result.promotionContribution.automaticPromotion,false);assert.equal(result.evidenceContract.sourceIndependenceNotYetClaimed,true);
});
