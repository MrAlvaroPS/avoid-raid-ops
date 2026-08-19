import { createHash } from 'node:crypto';
import { getCorpusStatus,startCorpus } from './service.mjs';

export const RAID_CORPUS_BOOTSTRAP_VERSION='raid-corpus-bootstrap-v1';
export const RAID_CORPUS_FOUNDATION_PROFILE=Object.freeze({corpusProfile:'foundation',targetPulls:300,deepTargetPulls:60,maxRankingPages:8,maxSourcePages:4,maxCandidateReports:1200});
const DEFAULT_DIFFICULTIES=Object.freeze(['normal','heroic','mythic']);
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const digest=value=>createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');
const canonical=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
const scopeKey=row=>`${positive(row.wclEncounterId)}:d${positive(row.difficulty?.id)}`;

export async function buildRaidCorpusBootstrapPreviewV1({catalog,learningPlan,difficultyNames=DEFAULT_DIFFICULTIES,profile=RAID_CORPUS_FOUNDATION_PROFILE,getStatus=getCorpusStatus}={}){
  if(!catalog?.currentRaid?.encounters?.length)throw new Error('current raid catalog is required');
  if(!learningPlan?.fingerprint)throw new Error('persisted raid learning availability is required before corpus bootstrap');
  if(String(learningPlan.catalogFingerprint)!==String(catalog.fingerprint))throw new Error('raid learning availability does not belong to the current raid catalog');
  const allowed=new Set((difficultyNames||DEFAULT_DIFFICULTIES).map(canonical)),scopes=[];
  for(const row of learningPlan.scopes||[]){
    const difficultyName=canonical(row.difficulty?.name);if(!allowed.has(difficultyName))continue;
    const encounterId=positive(row.wclEncounterId),difficulty=positive(row.difficulty?.id),partition=positive(row.partition||catalog.currentRaid.defaultPartition?.id);
    if(!encounterId||!difficulty){scopes.push({...row,scopeKey:scopeKey(row),bootstrapStatus:'not-startable-missing-operational-scope',corpus:null});continue;}
    const args={encounterId,difficulty,partition:partition||0},corpus=await getStatus(args).catch(()=>null),available=row.status==='public-evidence-available';
    const active=Boolean(corpus&&['running','rate-limited','paused'].includes(String(corpus.status))),complete=Boolean(corpus&&['ready','completed'].includes(String(corpus.status)));
    const bootstrapStatus=complete?'reference-ready':active?'reference-building':!available?'waiting-for-public-evidence':'startable-foundation';
    scopes.push({zoneId:row.zoneId,raidName:row.raidName,journalEncounterId:row.journalEncounterId,wclEncounterId:encounterId,bossName:row.bossName,difficulty:row.difficulty,partition:partition||null,availabilityStatus:row.status,publicSources:Number(row.publicSources||0),scopeKey:scopeKey(row),bootstrapStatus,corpus:corpus?{corpusId:corpus.corpusId,status:corpus.status,phase:corpus.phase,pullCount:Number(corpus.pullCount||0),deepPullCount:Number(corpus.deepPullCount||0),sourceStats:corpus.sourceStats||null,progress:corpus.progress||null}:null});
  }
  const startable=scopes.filter(row=>row.bootstrapStatus==='startable-foundation');
  const request={version:RAID_CORPUS_BOOTSTRAP_VERSION,catalogFingerprint:catalog.fingerprint,learningPlanFingerprint:learningPlan.fingerprint,difficultyNames:[...allowed].sort(),profile,scopes:scopes.map(row=>({scopeKey:row.scopeKey,availabilityStatus:row.availabilityStatus,bootstrapStatus:row.bootstrapStatus,partition:row.partition}))};
  return{version:RAID_CORPUS_BOOTSTRAP_VERSION,fingerprint:digest(request),catalogFingerprint:catalog.fingerprint,learningPlanFingerprint:learningPlan.fingerprint,raid:{zoneId:catalog.currentRaid.zoneId,name:catalog.currentRaid.name,partition:catalog.currentRaid.defaultPartition||null},profile,scopes,summary:{eligibleScopes:scopes.length,startableScopes:startable.length,buildingScopes:scopes.filter(row=>row.bootstrapStatus==='reference-building').length,readyScopes:scopes.filter(row=>row.bootstrapStatus==='reference-ready').length,waitingScopes:scopes.filter(row=>row.bootstrapStatus==='waiting-for-public-evidence').length},networkUpperBound:{previewWclCalls:0,previewCombatEventCalls:0,startInitializationMetadataCalls:startable.length},workerHardLimits:{perScope:{maxRankingPages:Number(profile.maxRankingPages),maxSourcePages:Number(profile.maxSourcePages),maxCandidateReports:Number(profile.maxCandidateReports),targetPulls:Number(profile.targetPulls),deepTargetPulls:Number(profile.deepTargetPulls)}},evidenceContract:{globalPublicReference:true,homeAvoidExcludedByCorpusSourcePolicy:true,difficultyScoped:true,crossDifficultyComparisonForbidden:true,foundationIsAcceptedKnowledge:false,foundationCanAutoPromote:false,availabilityMustBePublicBeforeStart:true,previewNetworkCalls:0}};
}

export async function startRaidCorpusFoundationV1({preview,confirmExecution=false,previewFingerprint,maxNewScopes=4,start=startCorpus}={}){
  if(!preview?.fingerprint)throw new Error('raid corpus bootstrap preview is required');
  if(confirmExecution!==true)throw new Error('confirmExecution:true is required to start GLOBAL public foundation corpora');
  if(String(previewFingerprint)!==String(preview.fingerprint))throw new Error('raid corpus bootstrap preview fingerprint mismatch');
  const limit=Math.max(1,Math.min(32,Number(maxNewScopes)||4)),selected=(preview.scopes||[]).filter(row=>row.bootstrapStatus==='startable-foundation').slice(0,limit),started=[];
  for(const row of selected){const status=await start({encounterId:row.wclEncounterId,difficulty:row.difficulty.id,partition:row.partition||0,...preview.profile,mode:'initial'});started.push({scopeKey:row.scopeKey,bossName:row.bossName,difficulty:row.difficulty,corpusId:status?.corpusId||null,status:status?.status||null,phase:status?.phase||null});}
  return{version:'raid-corpus-bootstrap-start-v1',previewFingerprint:preview.fingerprint,started,summary:{requested:selected.length,started:started.length,remainingStartable:Math.max(0,(preview.summary?.startableScopes||0)-started.length)},usage:{wclInitializationCalls:started.length,wclCombatEventCalls:0},evidenceContract:{onlyPreviewedPublicScopesStarted:true,difficultyScoped:true,crossDifficultyComparisonForbidden:true,foundationIsAcceptedKnowledge:false,automaticPromotion:false}};
}
