import { corpusGet,corpusList,corpusSet } from '../server/corpus/storage.mjs';
import { corpusId } from '../server/corpus/keys.mjs';
import { evaluateMatchedNullBaselineV1 } from '../server/corpus/matched-null-baseline-v1.mjs';
import { buildIndependentEvidenceGroupsV1 } from '../server/corpus/independent-evidence-groups-v1.mjs';
import { buildStatisticalStabilityV1 } from '../server/corpus/statistical-stability-v1.mjs';

function parseArgs(argv){
  const out={difficulty:5,partition:4,persist:false};
  for(let i=0;i<argv.length;i++){
    const token=argv[i],next=()=>argv[++i];
    if(token==='--wcl')out.encounterId=Number(next());
    else if(token==='--difficulty')out.difficulty=Number(next());
    else if(token==='--partition')out.partition=Number(next());
    else if(token==='--signal')out.signalId=Number(next());
    else if(token==='--episode')out.episodeBuildFingerprint=String(next()||'').trim();
    else if(token==='--persist')out.persist=true;
    else if(token==='--help'||token==='-h')out.help=true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return out;
}

function usage(){
  console.log('Usage:\n  npm run validate:evidence-groups -- --wcl 3182 --difficulty 5 --partition 4 --signal 1243866 --episode <episodeBuildFingerprint> [--persist]\n\nReads only persisted Episode + Matched Null evidence and evaluates Independent Evidence Groups + Statistical Stability. Makes zero WCL, Blizzard or Wago calls.');
}

const args=parseArgs(process.argv.slice(2));
if(args.help){usage();process.exit(0);}
for(const [key,value] of Object.entries({encounterId:args.encounterId,difficulty:args.difficulty,partition:args.partition,signalId:args.signalId}))if(!Number.isInteger(value)||value<=0)throw new Error(`--${key==='encounterId'?'wcl':key} must be a positive integer`);
if(!/^[a-f0-9]{40}$/i.test(args.episodeBuildFingerprint||''))throw new Error('--episode must be a 40-character Episode build fingerprint');

const scope={encounterId:args.encounterId,difficulty:args.difficulty,partition:args.partition};
const episodeKey=`mechanic-episodes/${corpusId(scope)}/${args.signalId}/${args.episodeBuildFingerprint}.json`;
console.log('\n[1/5] Load persisted Episode (0 network)');
const episode=await corpusGet(episodeKey);
if(!episode)throw new Error(`Episode not found: ${episodeKey}`);
const empiricalEvidenceFingerprint=String(episode.empiricalBuildFingerprint||episode.matchedNullEvidenceFingerprint||episode.buildFingerprint||'');
console.log(JSON.stringify({episodeId:episode.episodeId,interpretationBuildFingerprint:episode.buildFingerprint,empiricalEvidenceFingerprint,officialReconciliation:episode.officialReconciliation?.status||'not-present',structuralReconciliation:episode.structuralReconciliation?.status||'not-present'},null,2));

console.log('\n[2/5] Load compatible Matched Null controls (0 network)');
const prefix=`matched-null-baselines/${corpusId(scope)}/${args.signalId}/${empiricalEvidenceFingerprint}/evidence/`;
const keys=await corpusList(prefix),controls=[];
for(const key of keys){const value=await corpusGet(key).catch(()=>null);if(value)controls.push(value);}
console.log(JSON.stringify({evidencePrefix:prefix,storedControlRecords:controls.length,networkCalls:0},null,2));

console.log('\n[3/5] Re-evaluate Matched Null from stored evidence');
const matchedNull=evaluateMatchedNullBaselineV1({episode,controlRecords:controls});
console.log(JSON.stringify({baselineSufficient:matchedNull.baselineSufficient,matchedPairs:matchedNull.matchedPairs,matchedSources:matchedNull.matchedSources,summary:matchedNull.summary,supportedPatterns:(matchedNull.patternAssessments||[]).filter(row=>row.status==='matched-specificity-supported').map(row=>({patternKey:row.patternKey,abilityId:row.abilityId,status:row.status,anchorPrevalence:row.anchorPrevalence,backgroundPrevalence:row.matchedBackgroundPrevalence,lift:row.lift,prevalenceDelta:row.prevalenceDelta}))},null,2));

console.log('\n[4/5] Build Independent Evidence Groups');
const groups=buildIndependentEvidenceGroupsV1({episode,matchedNullEvaluation:matchedNull,controlRecords:controls});
let groupsStored=groups;
if(args.persist){
  const base=`independent-evidence-groups/${corpusId(scope)}/${args.signalId}/${episode.buildFingerprint}`;
  const revisionKey=`${base}/revisions/${groups.fingerprint}.json`,latestKey=`${base}/latest.json`;
  groupsStored={...groups,storage:{kind:'independent-evidence-groups-revision',revisionKey,latestKey}};
  await corpusSet(revisionKey,groupsStored);await corpusSet(latestKey,groupsStored);
}
console.log(JSON.stringify({fingerprint:groups.fingerprint,summary:groups.summary,promotionContribution:groups.promotionContribution,patterns:groups.patterns.map(row=>({patternKey:row.patternKey,abilityId:row.abilityId,status:row.status,summary:row.summary,groups:row.independentGroups.map(group=>({source:group.source,matchedPairs:group.matchedPairs,direction:group.direction,anchorHits:group.anchorHits,nullHits:group.nullHits}))})),persisted:args.persist,wclCalls:0,blizzardCalls:0,wagoCalls:0},null,2));

console.log('\n[5/5] Evaluate source-stratified Statistical Stability');
const stability=buildStatisticalStabilityV1({evidenceGroups:groupsStored});
if(args.persist){
  const base=`statistical-stability/${corpusId(scope)}/${args.signalId}/${episode.buildFingerprint}`;
  const revisionKey=`${base}/revisions/${stability.fingerprint}.json`,latestKey=`${base}/latest.json`;
  const stored={...stability,storage:{kind:'statistical-stability-revision',evidenceGroupsFingerprint:groups.fingerprint,revisionKey,latestKey}};
  await corpusSet(revisionKey,stored);await corpusSet(latestKey,stored);
}
console.log(JSON.stringify({fingerprint:stability.fingerprint,summary:stability.summary,holdoutContribution:stability.holdoutContribution,patterns:stability.patterns.map(row=>({patternKey:row.patternKey,abilityId:row.abilityId,status:row.status,metrics:row.metrics,failedGates:row.failedGates,holdoutEligible:row.holdoutEligible})),persisted:args.persist,wclCalls:0,blizzardCalls:0,wagoCalls:0},null,2));

console.log('\nOK: Evidence Groups + Statistical Stability validation completed entirely from persisted evidence.');
