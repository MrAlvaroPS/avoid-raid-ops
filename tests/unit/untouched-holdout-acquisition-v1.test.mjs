import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUntouchedHoldoutReservationV1,evaluateUntouchedHoldoutV1 } from '../../server/corpus/untouched-holdout-v1.mjs';
import { buildUntouchedHoldoutAcquisitionPreviewV1,executeUntouchedHoldoutAcquisitionV1 } from '../../server/corpus/untouched-holdout-acquisition-v1.mjs';

function memoryStorage(){const values=new Map();return{values,storageGet:async key=>values.get(String(key))??null,storageSet:async(key,value)=>{values.set(String(key),value);}};}
const rate={limitPerHour:10000,pointsSpentThisHour:100,pointsResetIn:1000};
const emptyPage=()=>({data:[],nextPageTimestamp:null});
const eventPage=events=>({data:events,nextPageTimestamp:null});

function semanticReport({signalId,candidateId,fightID,abilityID,windowStart}){
  const report={enemyCasts:emptyPage(),friendDamage:emptyPage(),interrupts:emptyPage(),debuffs:emptyPage(),buffs:emptyPage(),enemyBuffs:emptyPage(),enemyDebuffs:emptyPage(),deaths:emptyPage()};
  if(Number(abilityID)===Number(signalId)){
    report.debuffs=eventPage([{timestamp:40000,fight:fightID,type:'applydebuff',abilityGameID:signalId}]);
  }else if(abilityID==null&&Number(windowStart)<40000){
    report.debuffs=eventPage([{timestamp:41000,fight:fightID,type:'applydebuff',abilityGameID:candidateId}]);
  }
  return report;
}

test('reservation-ready generic Holdout acquires only frozen seed reports and produces evaluable paired evidence',async()=>{
  const signalId=900001,candidateId=900002,patternKey=`after-1s|debuffs|${candidateId}|applydebuff`;
  const scope={encounterId:9876,difficulty:5,partition:7};
  const episode={
    episodeId:'episode:9876:5:7:synthetic',buildFingerprint:'1'.repeat(40),scope,
    anchor:{abilityId:signalId},
    nodes:[{roleInEpisode:'anchor',abilityId:signalId},{roleInEpisode:'supporting',abilityId:candidateId,patternKey}],
    edges:[{source:'anchor',target:'candidate',temporalWindowMs:2500}],
  };
  const stability={
    fingerprint:'2'.repeat(40),episodeId:episode.episodeId,empiricalEvidenceFingerprint:'3'.repeat(40),
    patterns:[{patternKey,abilityId:candidateId,displayName:'Synthetic Candidate',status:'source-stratified-stability-supported',holdoutEligible:true}],
  };
  const sourceCandidates=[2001,2002,2003].map((id,index)=>({source:`guild:${id}`,seedReportCode:`SYNTH000000${index+1}`,metadataOnlyDiscovery:true,homeSource:false,preexistingCorpusMember:false,priorLearningUse:false,combatEvidenceObservedBeforeReservation:false}));
  const reservation=buildUntouchedHoldoutReservationV1({stability,sourceCandidates,config:{targetReservedSources:3,minimumEvaluableSources:3},reservedAt:1000});
  assert.equal(reservation.status,'reservation-ready');
  assert.equal(reservation.reservedSources.length,3);
  assert.ok(reservation.reservedSources.every(row=>row.seedReportCode));

  const guildByCode=new Map(sourceCandidates.map(row=>[row.seedReportCode,Number(row.source.split(':')[1])]));
  const storage=memoryStorage();let calls=0;
  const fetcher=async(query,variables)=>{
    calls++;
    const text=String(query);
    if(text.includes('AvoidCorpusRateLimit'))return{rateLimitData:rate};
    if(text.includes('AvoidCorpusReportHeader')){
      const guildId=guildByCode.get(String(variables.code));
      return{rateLimitData:rate,reportData:{report:{code:variables.code,guild:{id:guildId,name:`Guild ${guildId}`},owner:{id:guildId+5000},fights:[{id:guildId,startTime:0,endTime:120000,phaseTransitions:[]}]}}};
    }
    if(text.includes('AvoidSemanticProbeEventsContinuation'))throw new Error('synthetic fixture must not paginate');
    if(text.includes('AvoidSemanticProbeEvents')){
      const fightID=Number(variables.fightIDs?.[0]);
      return{rateLimitData:rate,reportData:{report:semanticReport({signalId,candidateId,fightID,abilityID:variables.abilityID,windowStart:variables.windowStart})}};
    }
    throw new Error(`Unexpected query: ${text.slice(0,80)}`);
  };

  const preview=buildUntouchedHoldoutAcquisitionPreviewV1({reservation,episode,cacheRecords:[],config:{maxPairsPerSource:1,maxAnchorContinuationRounds:0,maxContextContinuationRounds:0,maxWclCalls:30}});
  assert.equal(preview.status,'acquisition-ready');
  assert.equal(preview.executable,true);
  assert.equal(preview.evidenceContract.sourceExpansionForbidden,true);
  assert.equal(preview.evidenceContract.fightSelectionUsesOutcomeMetrics,false);

  const result=await executeUntouchedHoldoutAcquisitionV1({reservation,episode,scope,previewFingerprint:preview.fingerprint,confirmExecution:true,config:preview.config,fetcher,storageGet:storage.storageGet,storageSet:storage.storageSet,clock:()=>2000});
  assert.equal(result.status,'complete');
  assert.equal(result.completeSources,3);
  assert.equal(result.holdoutEvidence.sources.length,3);
  assert.equal(result.evidenceContract.onlyFrozenSeedReportsQueried,true);
  assert.equal(result.evidenceContract.sourceExpansionForbidden,true);
  assert.ok(calls<=30);
  for(const source of result.holdoutEvidence.sources){
    assert.deepEqual(source.patterns,[{patternKey,abilityId:candidateId,matchedPairs:1,anchorHits:1,nullHits:0}]);
  }

  const evaluation=evaluateUntouchedHoldoutV1({reservation,holdoutEvidence:result.holdoutEvidence});
  assert.equal(evaluation.summary.supportedPatterns,1);
  assert.equal(evaluation.promotionContribution.untouchedHoldoutGate,'evidence-available');
  assert.equal(evaluation.promotionContribution.automaticPromotion,false);
});

test('acquisition preview executes zero WCL when reservation is not ready',()=>{
  const episode={episodeId:'episode:any',buildFingerprint:'4'.repeat(40),scope:{encounterId:5555,difficulty:4,partition:2},anchor:{abilityId:600001},nodes:[],edges:[]};
  const reservation={status:'not-eligible-no-stability-supported-pattern',fingerprint:null,episodeId:episode.episodeId,reservedSources:[],frozenCandidatePatterns:[],config:{minimumEvaluableSources:3}};
  const preview=buildUntouchedHoldoutAcquisitionPreviewV1({reservation,episode});
  assert.equal(preview.executable,false);
  assert.equal(preview.status,'reservation-not-ready');
  assert.equal(preview.callBudget.theoreticalWclCallUpperBound,0);
  assert.equal(preview.wclCallsExecuted,0);
});

test('frozen seed report source mismatch settles source without querying combat events',async()=>{
  const patternKey='after-1s|debuffs|700002|applydebuff';
  const scope={encounterId:6666,difficulty:5,partition:3};
  const episode={episodeId:'episode:mismatch',buildFingerprint:'5'.repeat(40),scope,anchor:{abilityId:700001},nodes:[{roleInEpisode:'supporting',patternKey,abilityId:700002}],edges:[]};
  const stability={fingerprint:'6'.repeat(40),episodeId:episode.episodeId,patterns:[{patternKey,abilityId:700002,status:'source-stratified-stability-supported',holdoutEligible:true}]};
  const reservation=buildUntouchedHoldoutReservationV1({stability,sourceCandidates:[1,2,3].map((n)=>({source:`guild:${8000+n}`,seedReportCode:`MISMATCH0000${n}`,homeSource:false,preexistingCorpusMember:false,priorLearningUse:false,combatEvidenceObservedBeforeReservation:false})),config:{targetReservedSources:3,minimumEvaluableSources:3},reservedAt:1000});
  const storage=memoryStorage();let semanticCalls=0;
  const fetcher=async(query,variables)=>{
    const text=String(query);
    if(text.includes('AvoidCorpusRateLimit'))return{rateLimitData:rate};
    if(text.includes('AvoidCorpusReportHeader'))return{rateLimitData:rate,reportData:{report:{code:variables.code,guild:{id:999999},owner:{id:1},fights:[{id:1,startTime:0,endTime:100000,phaseTransitions:[]}]}}};
    if(text.includes('AvoidSemanticProbeEvents')){semanticCalls++;return{rateLimitData:rate,reportData:{report:semanticReport({signalId:700001,candidateId:700002,fightID:1,abilityID:variables.abilityID,windowStart:variables.windowStart})}};}
    throw new Error('Unexpected query');
  };
  const preview=buildUntouchedHoldoutAcquisitionPreviewV1({reservation,episode,config:{maxWclCalls:20}});
  const result=await executeUntouchedHoldoutAcquisitionV1({reservation,episode,scope,previewFingerprint:preview.fingerprint,confirmExecution:true,config:preview.config,fetcher,storageGet:storage.storageGet,storageSet:storage.storageSet,clock:()=>2000});
  assert.equal(semanticCalls,0);
  assert.equal(result.status,'evidence-incomplete');
  assert.equal(result.completeSources,0);
  assert.equal(result.settledSources,3);
});
