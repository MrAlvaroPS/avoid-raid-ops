import { corpusGet,corpusList } from '../server/corpus/storage.mjs';
import { corpusId,aggregateKey,jobKey } from '../server/corpus/keys.mjs';
import { evaluateMatchedNullBaselineV1 } from '../server/corpus/matched-null-baseline-v1.mjs';
import { buildIndependentEvidenceGroupsV1 } from '../server/corpus/independent-evidence-groups-v1.mjs';
import { buildStatisticalStabilityV1 } from '../server/corpus/statistical-stability-v1.mjs';
import { buildUntouchedHoldoutReservationV1 } from '../server/corpus/untouched-holdout-v1.mjs';
import { buildGlobalBossLearningSourceLineageV1 } from '../server/corpus/untouched-holdout-source-pool-v1.mjs';
import { buildUntouchedHoldoutSourceDiscoveryPreviewV1 } from '../server/corpus/untouched-holdout-source-discovery-v1.mjs';
import { buildUntouchedHoldoutAcquisitionPreviewV1 } from '../server/corpus/untouched-holdout-acquisition-v1.mjs';

function parseArgs(argv){
  const out={difficulty:5,partition:4};
  for(let i=0;i<argv.length;i++){
    const token=argv[i],next=()=>argv[++i];
    if(token==='--wcl')out.encounterId=Number(next());
    else if(token==='--difficulty')out.difficulty=Number(next());
    else if(token==='--partition')out.partition=Number(next());
    else if(token==='--signal')out.signalId=Number(next());
    else if(token==='--episode')out.episodeBuildFingerprint=String(next()||'').trim();
    else if(token==='--help'||token==='-h')out.help=true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return out;
}

function usage(){
  console.log('Usage:\n  npm run validate:untouched-holdout -- --wcl <encounterId> --difficulty <difficulty> --partition <partition> --signal <signalId> --episode <episodeBuildFingerprint>\n\nReplays the generic stored-evidence chain through Statistical Stability, builds the GLOBAL BOSS source lineage, previews automatic unseen-source discovery, Holdout reservation and combat-evidence acquisition. The smoke itself executes zero WCL, Blizzard or Wago calls.');
}

const args=parseArgs(process.argv.slice(2));
if(args.help){usage();process.exit(0);}
for(const [key,value] of Object.entries({encounterId:args.encounterId,difficulty:args.difficulty,partition:args.partition,signalId:args.signalId}))if(!Number.isInteger(value)||value<=0)throw new Error(`--${key==='encounterId'?'wcl':key} must be a positive integer`);
if(!/^[a-f0-9]{40}$/i.test(args.episodeBuildFingerprint||''))throw new Error('--episode must be a 40-character Episode build fingerprint');

const scope={encounterId:args.encounterId,difficulty:args.difficulty,partition:args.partition};
const episodeKey=`mechanic-episodes/${corpusId(scope)}/${args.signalId}/${args.episodeBuildFingerprint}.json`;
console.log('\n[1/8] Load persisted Episode (0 network)');
const episode=await corpusGet(episodeKey);
if(!episode)throw new Error(`Episode not found: ${episodeKey}`);
const empiricalEvidenceFingerprint=String(episode.empiricalBuildFingerprint||episode.matchedNullEvidenceFingerprint||episode.buildFingerprint||'');
console.log(JSON.stringify({episodeId:episode.episodeId,interpretationBuildFingerprint:episode.buildFingerprint,empiricalEvidenceFingerprint},null,2));

console.log('\n[2/8] Load compatible Matched Null controls (0 network)');
const prefix=`matched-null-baselines/${corpusId(scope)}/${args.signalId}/${empiricalEvidenceFingerprint}/evidence/`;
const keys=await corpusList(prefix),controls=[];
for(const key of keys){const value=await corpusGet(key).catch(()=>null);if(value)controls.push(value);}
console.log(JSON.stringify({storedControlRecords:controls.length,networkCalls:0},null,2));

console.log('\n[3/8] Re-evaluate Matched Null from stored evidence');
const matchedNull=evaluateMatchedNullBaselineV1({episode,controlRecords:controls});
console.log(JSON.stringify({baselineSufficient:matchedNull.baselineSufficient,matchedPairs:matchedNull.matchedPairs,matchedSources:matchedNull.matchedSources,summary:matchedNull.summary},null,2));

console.log('\n[4/8] Build Independent Evidence Groups');
const groups=buildIndependentEvidenceGroupsV1({episode,matchedNullEvaluation:matchedNull,controlRecords:controls});
console.log(JSON.stringify({summary:groups.summary,gate:groups.promotionContribution?.independentEvidenceGroupsGate,networkCalls:0},null,2));

console.log('\n[5/8] Evaluate Statistical Stability');
const stability=buildStatisticalStabilityV1({evidenceGroups:groups});
console.log(JSON.stringify({summary:stability.summary,gate:stability.holdoutContribution?.statisticalStabilityGate,holdoutReadyPatterns:stability.holdoutContribution?.holdoutReadyPatterns||[],networkCalls:0},null,2));

console.log('\n[6/8] Build source lineage + preview automatic unseen-source discovery (0 network)');
const [aggregate,job]=await Promise.all([corpusGet(aggregateKey(scope)).catch(()=>null),corpusGet(jobKey(scope)).catch(()=>null)]);
const lineage=buildGlobalBossLearningSourceLineageV1({aggregate,job,matchedNullControls:controls,evidenceGroups:groups,stability,lineageComplete:Boolean(aggregate&&job)});
const discoveryPreview=buildUntouchedHoldoutSourceDiscoveryPreviewV1({scope,stability,lineage,config:{startRankingPage:Number(job?.rankingPage)||1}});
console.log(JSON.stringify({lineage:{fingerprint:lineage.fingerprint,complete:lineage.complete,observedCombatSources:lineage.observedCombatSourceKeys.length,priorLearningSources:lineage.priorLearningSourceKeys.length,metadataPreviouslyDiscoveredSources:lineage.metadataPreviouslyDiscoveredSourceKeys.length},sourceDiscovery:{status:discoveryPreview.status,executable:discoveryPreview.executable,networkUpperBound:discoveryPreview.networkUpperBound,evidenceContract:discoveryPreview.evidenceContract}},null,2));

console.log('\n[7/8] Preview Untouched Holdout reservation');
const reservation=buildUntouchedHoldoutReservationV1({stability,sourceCandidates:[]});
console.log(JSON.stringify({status:reservation.status,frozenCandidatePatterns:reservation.frozenCandidatePatterns,reservedSources:reservation.reservedSources,acquisitionRequired:reservation.acquisitionRequired,evidenceContract:reservation.evidenceContract,wclCalls:0,blizzardCalls:0,wagoCalls:0},null,2));

console.log('\n[8/8] Preview automatic Holdout combat acquisition (0 network)');
const acquisitionPreview=buildUntouchedHoldoutAcquisitionPreviewV1({reservation,episode,cacheRecords:[]});
console.log(JSON.stringify({status:acquisitionPreview.status,executable:acquisitionPreview.executable,frozenCandidatePatterns:acquisitionPreview.frozenCandidatePatterns,reservedSources:acquisitionPreview.reservedSources,callBudget:acquisitionPreview.callBudget,evidenceContract:acquisitionPreview.evidenceContract,wclCalls:0,blizzardCalls:0,wagoCalls:0},null,2));

if(stability.summary.stabilitySupportedPatterns===0){
  if(discoveryPreview.status!=='not-eligible-no-stability-supported-pattern')throw new Error('Automatic source discovery manufactured eligibility despite zero Stability-supported patterns');
  if(discoveryPreview.networkUpperBound.wclCalls!==0||discoveryPreview.networkUpperBound.wclCombatEventCalls!==0)throw new Error('Blocked candidate must collapse automatic source discovery to zero WCL calls');
  if(reservation.status!=='not-eligible-no-stability-supported-pattern')throw new Error('Holdout reservation manufactured eligibility despite zero Stability-supported patterns');
  if(acquisitionPreview.status!=='reservation-not-ready'||acquisitionPreview.executable!==false)throw new Error('Holdout combat acquisition must remain non-executable when reservation is not ready');
  if(acquisitionPreview.callBudget.theoreticalWclCallUpperBound!==0||acquisitionPreview.wclCallsExecuted!==0)throw new Error('Blocked candidate must collapse Holdout combat acquisition to zero WCL calls');
}
if(reservation.evidenceContract.legacyValidationIsUntouchedHoldout!==false)throw new Error('Legacy validation must never be represented as untouched holdout');
console.log('\nOK: generic Untouched Holdout validation completed through automatic source discovery, reservation and combat-acquisition planning entirely from persisted evidence.');
