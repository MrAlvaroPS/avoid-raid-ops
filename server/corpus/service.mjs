import { corpusGet,corpusSet,corpusDelete,corpusList,corpusStorageStatus,assertCorpusStorage } from './storage.mjs';
import { jobKey,aggregateKey,modelKey,profileKey,deepProfileKey,corpusId,corpusAliasKey } from './keys.mjs';
import { clampCorpusConfig } from './config.mjs';
import { fetchRankingPage } from './ranking-source.mjs';
import { fetchReportIdentity,sourceFromIdentity,sourceKey,fetchSourceReports } from './source-expansion.mjs';
import { fetchWideProfile } from './wide-profile.mjs';
import { fetchDeepProfile } from './deep-profile.mjs';
import { createAggregate,mergeWideProfile,mergeDeepProfile,aggregateSummary,hashString } from './aggregate.mjs';
import { compileEncounterModel,modelDiagnostics } from './compiler.mjs';

const ENGINE_VERSION='3.7.0';
const SCHEMA_VERSION=2;
const now=()=>Date.now();
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const DAY=86400000;

function normalizeArgs(input={}){return{encounterId:Number(input.encounterId),difficulty:Number(input.difficulty||5),partition:Number(input.partition||0)};}
function withPartition(args,partition){return{...args,partition:Number(partition)};}
function widePullCount(aggregate){return Number(aggregate?.killPulls||0)+Number(aggregate?.wipePulls||0);}
function deepPullCount(aggregate){return Number(aggregate?.deepKillPulls||0)+Number(aggregate?.deepWipePulls||0);}
function rateInfo(rate){if(!rate)return null;const limit=Number(rate.limitPerHour)||0,spent=Number(rate.pointsSpentThisHour)||0;return{limitPerHour:limit,pointsSpentThisHour:spent,pointsRemaining:Math.max(0,limit-spent),pointsResetIn:Number(rate.pointsResetIn)||0,remainingPct:limit?Math.max(0,(limit-spent)/limit):null};}
function shouldPauseForRate(rate,config){const r=rateInfo(rate);if(!r||!r.limitPerHour)return false;return r.pointsRemaining<=Math.max(config.minimumRateLimitReservePoints,r.limitPerHour*config.minimumRateLimitReservePct);}
function markRate(job,rate,config){job.rateLimit=rateInfo(rate);if(shouldPauseForRate(rate,config)){job.status='rate-limited';job.resumeAt=now()+Math.max(60,Number(rate?.pointsResetIn)||60)*1000;job.message='WCL rate budget protected. Durable workflow sleeping until the hourly budget resets.';return true;}return false;}

function normalizeErrorSignature(error){
  let s=String(error?.message||error||'unknown-error').replace(/\s+/g,' ').trim();
  const jsonMsg=s.match(/"message"\s*:\s*"([^"]+)/i)?.[1];if(jsonMsg)s=jsonMsg;
  s=s.replace(/[A-Za-z0-9]{16,}/g,'<id>').replace(/\d{5,}/g,'<n>');
  return s.slice(0,180).toLowerCase();
}
function recordFailure(job,{code,stage,error,config}){
  const reason=String(error?.message||error).slice(0,500),signature=normalizeErrorSignature(error);
  job.failedCountTotal=Number(job.failedCountTotal||0)+1;
  job.failed=[...(job.failed||[]),{code,stage,reason,signature,at:now()}].slice(-100);
  const prev=job.consecutiveFailure;
  job.consecutiveFailure=prev?.signature===signature?{signature,count:Number(prev.count||0)+1,lastCode:code,stage}:{signature,count:1,lastCode:code,stage};
  if(job.consecutiveFailure.count>=config.systemicFailureThreshold){
    job.status='paused';job.pauseReason='systemic-error';job.message=`AUTO-PAUSED · ${job.consecutiveFailure.count} consecutive ${stage} failures share the same WCL contract error. No more API points will be spent until resumed after a fix.`;
    return true;
  }
  return false;
}
function clearFailureStreak(job){job.consecutiveFailure=null;}

async function saveAlias(args){
  if(!(Number(args.partition)>0))throw new Error('Refusing to persist a corpus alias without a resolved partition');
  await corpusSet(corpusAliasKey(args),{schemaVersion:1,engineVersion:ENGINE_VERSION,encounterId:Number(args.encounterId),difficulty:Number(args.difficulty),partition:Number(args.partition),updatedAt:now()});
}
async function resolveExistingArgs(input={}){
  const args=normalizeArgs(input);if(args.partition>0)return args;
  const alias=await corpusGet(corpusAliasKey(args));
  return Number(alias?.partition)>0?withPartition(args,alias.partition):null;
}
async function loadState(args){const [job,aggregate,model]=await Promise.all([corpusGet(jobKey(args)),corpusGet(aggregateKey(args)),corpusGet(modelKey(args))]);return{job,aggregate,model};}

function sourceStats(job){
  const all=job.sourceQueue||[],done=all.filter(s=>s.done).length;
  return{total:all.length,done,guilds:all.filter(s=>s.type==='guild').length,personalUploaders:all.filter(s=>s.type==='user').length,pagesScanned:Number(job.sourcePagesScanned||0),reportsDiscovered:Number(job.expandedReportsSeen||0)};
}
async function publicJob(args,job,aggregate,model){
  if(!job)return null;const storage=await corpusStorageStatus();const pulls=widePullCount(aggregate),deepPulls=deepPullCount(aggregate);const sources=sourceStats(job);
  const identityTotal=(job.seedReports||[]).length,identityDone=Math.min(identityTotal,Number(job.seedCursor||0));
  const discoveryProgress=job.phase==='discover-ranking'?Math.min(.25,Math.max(0,(Number(job.rankingPage||1)-1)/Math.max(4,Number(job.maxRankingPages||500)))):job.phase==='discover-identities'?(.25+.25*(identityTotal?identityDone/identityTotal:1)):job.phase==='expand-sources'?(.5+.5*(sources.total?sources.done/sources.total:1)):1;
  const lastFailure=(job.failed||[]).at?.(-1)||null;
  return{
    corpusId:corpusId(args),schemaVersion:job.schemaVersion,engineVersion:job.engineVersion,encounterId:job.encounterId,difficulty:job.difficulty,partition:job.partition,requestedPartition:job.requestedPartition,resolvedPartition:job.resolvedPartition,
    mode:job.mode,status:job.status,phase:job.phase,createdAt:job.createdAt,startedAt:job.startedAt,updatedAt:job.updatedAt,completedAt:job.completedAt||null,
    targetPulls:job.targetPulls,deepTargetPulls:job.deepTargetPulls,targetReports:job.targetPulls,deepTargetReports:job.deepTargetPulls,
    rankingPage:job.rankingPage,rankingExhausted:Boolean(job.rankingExhausted),seedReportCount:identityTotal,identityResolvedCount:identityDone,candidateCount:job.candidates?.length||0,
    processedWideCount:job.processedWide?.length||0,processedDeepCount:job.processedDeep?.length||0,failedCount:Number(job.failedCountTotal||job.failed?.length||0),skippedNoEncounter:Number(job.skippedNoEncounter||0),
    pullCount:pulls,deepPullCount:deepPulls,sourceStats:sources,rateLimit:job.rateLimit||null,resumeAt:job.resumeAt||null,pauseReason:job.pauseReason||null,message:job.message||null,
    executionMode:job.executionMode||null,workflowRunId:job.workflowRunId||null,workflowStartedAt:job.workflowStartedAt||null,
    systemicFailure:job.consecutiveFailure?{signature:job.consecutiveFailure.signature,count:Number(job.consecutiveFailure.count||0),stage:job.consecutiveFailure.stage||null}:null,
    lastFailure:lastFailure?{code:lastFailure.code,stage:lastFailure.stage,reason:lastFailure.reason,at:lastFailure.at}:null,
    progress:{discovery:Math.min(1,discoveryProgress),wide:Math.min(1,pulls/Math.max(1,job.targetPulls)),deep:Math.min(1,deepPulls/Math.max(1,job.deepTargetPulls))},
    aggregate:aggregate?aggregateSummary(aggregate):null,model:model?modelDiagnostics(model):null,storage
  };
}


export async function getCorpusHealth(){return{engineVersion:ENGINE_VERSION,schemaVersion:SCHEMA_VERSION,storage:await corpusStorageStatus()};}

export async function getCorpusStatus(input){
  const args=await resolveExistingArgs(input);if(!args)return null;const state=await loadState(args);return publicJob(args,state.job,state.aggregate,state.model);
}

function rankingSeedWindow(rows,existingStart=null){
  const times=(rows||[]).map(r=>Number(r.startTime)).filter(Number.isFinite);const min=times.length?Math.min(...times):null;
  const anchor=Number.isFinite(Number(existingStart))?Math.min(Number(existingStart),min??Number(existingStart)):min;
  return anchor==null?null:Math.max(0,anchor-2*DAY);
}

async function bootstrapContext(input,config,mode){
  const requested=normalizeArgs(input);const page=await fetchRankingPage({...requested,page:1});const resolvedPartition=requested.partition>0?requested.partition:Number(page.resolvedPartition||0);
  if(!(resolvedPartition>0))throw new Error('WCL did not expose a resolvable partition for this encounter');
  const args=withPartition(requested,resolvedPartition);
  const existingAlias=requested.partition===0?await corpusGet(corpusAliasKey(requested)):null;
  if(mode==='enrich'&&Number(existingAlias?.partition)>0&&Number(existingAlias.partition)!==resolvedPartition)throw new Error(`WCL default partition changed from p${existingAlias.partition} to p${resolvedPartition}. Start a fresh corpus; partitions are never mixed.`);
  return{args,page};
}

export async function startCorpus(input={}){
  await assertCorpusStorage();const requested=normalizeArgs(input);if(!requested.encounterId)throw new Error('encounterId is required');const config=clampCorpusConfig(input);const mode=input.mode==='enrich'?'enrich':'initial';
  const {args,page}=await bootstrapContext(input,config,mode);await saveAlias(args);const existing=await loadState(args);
  let aggregate=existing.aggregate;
  if(!aggregate||mode==='initial'&&input.reset===true){aggregate=createAggregate({...args,encounter:page.encounter,validationFraction:config.validationFraction});aggregate.resolvedPartition=args.partition;}
  aggregate.partition=args.partition;aggregate.resolvedPartition=args.partition;if(page.encounter)aggregate.encounter=page.encounter;
  const processedWide=mode==='enrich'?uniq(existing.job?.processedWide||[]):[];const processedDeep=mode==='enrich'?uniq(existing.job?.processedDeep||[]):[];
  const currentPulls=mode==='enrich'?widePullCount(aggregate):0,currentDeepPulls=mode==='enrich'?deepPullCount(aggregate):0;
  const targetPulls=mode==='enrich'?Math.min(config.maxTargetPulls,Math.max(currentPulls+Math.max(100,Number(input.addPulls??input.addReports)||500),Number(input.targetPulls??input.targetReports)||0)):config.targetPulls;
  const deepTargetPulls=mode==='enrich'?Math.min(targetPulls,Math.max(currentDeepPulls+Math.max(20,Number(input.addDeepPulls??input.addDeepReports)||100),Number(input.deepTargetPulls??input.deepTargetReports)||0)):config.deepTargetPulls;
  const seedCodes=uniq(page.rows.map(x=>x.reportCode));const oldCandidates=mode==='enrich'?uniq(existing.job?.candidates||[]):[];const candidates=uniq([...oldCandidates,...seedCodes]);
  const oldSources=mode==='enrich'?(existing.job?.sourceQueue||[]):[];const oldSourceKeys=new Set(oldSources.map(sourceKey).filter(Boolean));
  const job={schemaVersion:SCHEMA_VERSION,engineVersion:ENGINE_VERSION,...args,requestedPartition:requested.partition,mode,status:'running',phase:page.hasMore?'discover-ranking':'discover-identities',createdAt:existing.job?.createdAt||now(),startedAt:now(),updatedAt:now(),targetPulls,deepTargetPulls,maxRankingPages:config.maxRankingPages,maxSourcePages:config.maxSourcePages,maxCandidateReports:config.maxCandidateReports,rankingPage:2,rankingExhausted:!page.hasMore,seedReports:mode==='enrich'?uniq([...(existing.job?.seedReports||[]),...seedCodes]):seedCodes,seedCursor:mode==='enrich'?0:0,candidates,processedWide,processedDeep,sourceQueue:oldSources,sourceSeen:[...oldSourceKeys],sourcePagesScanned:Number(mode==='enrich'?existing.job?.sourcePagesScanned||0:0),expandedReportsSeen:Number(mode==='enrich'?existing.job?.expandedReportsSeen||0:0),partitionWindowStart:rankingSeedWindow(page.rows,mode==='enrich'?existing.job?.partitionWindowStart:null),failed:mode==='enrich'?(existing.job?.failed||[]):[],failedCountTotal:mode==='enrich'?Number(existing.job?.failedCountTotal||0):0,skippedNoEncounter:mode==='enrich'?Number(existing.job?.skippedNoEncounter||0):0,deepBuckets:mode==='enrich'?(existing.job?.deepBuckets||{kill:[],deepWipe:[],midWipe:[],earlyWipe:[]}):{kill:[],deepWipe:[],midWipe:[],earlyWipe:[]},deepCursor:0,encounter:page.encounter||aggregate.encounter||null,resolvedPartition:args.partition,rateLimit:rateInfo(page.rateLimit),resumeAt:null,pauseReason:null,pauseRequestedAt:null,consecutiveFailure:null,activeExecutionToken:null,executionMode:null,workflowRunId:null,workflowStartedAt:null,message:mode==='enrich'?'Refreshing ranking seeds before expanding the existing persistent corpus.':`Partition p${args.partition} resolved before persistence. Discovering ranked seeds.`};
  markRate(job,page.rateLimit,config);await Promise.all([corpusSet(jobKey(args),job),corpusSet(aggregateKey(args),aggregate)]);return publicJob(args,job,aggregate,existing.model);
}

async function discoverRankingStep(job,aggregate,config,args){
  if(job.rankingExhausted||job.rankingPage>job.maxRankingPages){job.rankingExhausted=true;job.phase='discover-identities';job.seedCursor=0;job.message=`Ranking discovery complete with ${(job.seedReports||[]).length.toLocaleString()} seed reports. Resolving guild/personal-log sources.`;return;}
  const page=await fetchRankingPage({...args,page:job.rankingPage});
  if(Number(page.resolvedPartition)>0&&Number(page.resolvedPartition)!==Number(args.partition)){job.status='paused';job.pauseReason='partition-changed';job.message=`AUTO-PAUSED · WCL returned partition p${page.resolvedPartition} while corpus is locked to p${args.partition}.`;return;}
  if(page.encounter){job.encounter=page.encounter;aggregate.encounter=page.encounter;}
  const codes=page.rows.map(x=>x.reportCode);job.seedReports=uniq([...(job.seedReports||[]),...codes]);job.candidates=uniq([...(job.candidates||[]),...codes]);job.partitionWindowStart=rankingSeedWindow(page.rows,job.partitionWindowStart);job.rankingPage++;
  if(!page.hasMore)job.rankingExhausted=true;job.message=`Ranked seeds ${(job.seedReports||[]).length.toLocaleString()} · page ${job.rankingPage-1}. Current-partition history window starts ${job.partitionWindowStart?new Date(job.partitionWindowStart).toISOString().slice(0,10):'when source reports are available'}.`;markRate(job,page.rateLimit,config);
}

async function discoverIdentityStep(job,aggregate,config,args){
  const seeds=job.seedReports||[];if(Number(job.seedCursor||0)>=seeds.length){job.phase='expand-sources';job.message=`Resolved ${job.sourceQueue?.length||0} independent guild/personal sources. Expanding their public raid history.`;return;}
  const code=seeds[Number(job.seedCursor||0)];job.seedCursor=Number(job.seedCursor||0)+1;
  try{
    const {identity,rateLimit}=await fetchReportIdentity(code);if(identity){const source=sourceFromIdentity(identity),key=sourceKey(source);if(source&&key&&!new Set(job.sourceSeen||[]).has(key)){job.sourceQueue=[...(job.sourceQueue||[]),source];job.sourceSeen=uniq([...(job.sourceSeen||[]),key]);}if(Number(identity.startTime)>0)job.partitionWindowStart=rankingSeedWindow([{startTime:identity.startTime}],job.partitionWindowStart);}clearFailureStreak(job);job.message=`Seed identities ${job.seedCursor.toLocaleString()} / ${seeds.length.toLocaleString()} · ${job.sourceQueue.length.toLocaleString()} unique report sources.`;markRate(job,rateLimit,config);
  }catch(error){recordFailure(job,{code,stage:'seed-identity',error,config});}
}

async function expandSourcesStep(job,aggregate,config,args){
  const queue=job.sourceQueue||[];const source=queue.find(x=>!x.done);
  if(!source||job.candidates.length>=job.maxCandidateReports){job.phase='wide';job.message=`History expansion complete: ${job.candidates.length.toLocaleString()} candidate reports from ${sourceStats(job).total.toLocaleString()} independent sources. Profiling exact encounter fightIDs.`;return;}
  const zoneId=Number(job.encounter?.zone?.id||aggregate.encounter?.zone?.id);if(!(zoneId>0)){job.status='paused';job.pauseReason='missing-zone';job.message='AUTO-PAUSED · encounter zone id unavailable; source expansion cannot be safely scoped.';return;}
  try{
    const page=await fetchSourceReports({source,zoneId,page:source.page||1,limit:config.sourcePageLimit,startTime:job.partitionWindowStart||0,endTime:now()});
    const before=job.candidates.length;job.candidates=uniq([...job.candidates,...page.rows.map(r=>r.code)]).slice(0,job.maxCandidateReports);job.expandedReportsSeen=Number(job.expandedReportsSeen||0)+page.rows.length;job.sourcePagesScanned=Number(job.sourcePagesScanned||0)+1;
    if(page.hasMore&&Number(source.page||1)<job.maxSourcePages&&job.candidates.length<job.maxCandidateReports)source.page=Number(source.page||1)+1;else source.done=true;
    clearFailureStreak(job);const stats=sourceStats(job);job.message=`Expanded ${stats.done}/${stats.total} sources · ${stats.pagesScanned} pages · ${job.candidates.length.toLocaleString()} unique candidate reports (+${job.candidates.length-before}).`;markRate(job,page.rateLimit,config);
  }catch(error){source.done=true;recordFailure(job,{code:sourceKey(source),stage:'source-expansion',error,config});}
}

function nextWideCode(job){const done=new Set(job.processedWide||[]),failed=new Set((job.failed||[]).filter(x=>x.stage==='wide').map(x=>x.code));return (job.candidates||[]).find(code=>!done.has(code)&&!failed.has(code))||null;}
function classifyDeepProfile(profile){if(profile.kills>0)return'kill';const fps=(profile.fights||[]).map(f=>Number(f.fightPercentage)).filter(Number.isFinite);const best=fps.length?Math.min(...fps):100;if(best<50)return'deepWipe';if(best<90)return'midWipe';return'earlyWipe';}
function addDeepCandidate(job,profile){const key=classifyDeepProfile(profile);job.deepBuckets ||= {kill:[],deepWipe:[],midWipe:[],earlyWipe:[]};job.deepBuckets[key]=uniq([...(job.deepBuckets[key]||[]),profile.code]);}
function nextDeepCode(job){const done=new Set(job.processedDeep||[]),b=job.deepBuckets||{};const order=['deepWipe','midWipe','kill','earlyWipe'];for(let i=0;i<order.length;i++){const idx=(Number(job.deepCursor||0)+i)%order.length,key=order[idx],code=(b[key]||[]).find(x=>!done.has(x));if(code){job.deepCursor=(idx+1)%order.length;return code;}}return (job.processedWide||[]).filter(x=>!done.has(x)).sort((a,b)=>hashString(a)-hashString(b))[0]||null;}

async function wideStep(job,aggregate,config,args){
  const pulls=widePullCount(aggregate);if(pulls>=job.targetPulls){job.phase='deep';job.message=`Wide target reached: ${pulls.toLocaleString()} pulls across ${aggregate.wideReports.toLocaleString()} reports. Building stratified deep sample.`;return;}
  const code=nextWideCode(job);if(!code){job.phase='deep';job.message=`Candidate reports exhausted at ${pulls.toLocaleString()} retained pulls (${aggregate.wideReports.toLocaleString()} reports). Continuing with the best available deep sample.`;return;}
  try{
    const profile=await fetchWideProfile({code,...args});if(!profile||!(profile.kills+profile.wipes)){job.skippedNoEncounter=Number(job.skippedNoEncounter||0)+1;job.processedWide=uniq([...(job.processedWide||[]),code]);clearFailureStreak(job);job.message=`Filtered ${code}: no matching encounter/difficulty fights. ${job.skippedNoEncounter.toLocaleString()} candidates filtered without treating them as errors.`;return;}
    await corpusSet(profileKey(args,code),profile);mergeWideProfile(aggregate,profile,{validationFraction:config.validationFraction});job.processedWide=uniq([...(job.processedWide||[]),code]);addDeepCandidate(job,profile);clearFailureStreak(job);job.message=`Wide corpus ${widePullCount(aggregate).toLocaleString()} / ${job.targetPulls.toLocaleString()} pulls · ${aggregate.wideReports.toLocaleString()} reports · ${sourceStats(job).total.toLocaleString()} independent sources discovered.`;markRate(job,profile.rateLimit,config);
  }catch(error){recordFailure(job,{code,stage:'wide',error,config});if(job.status!=='paused')job.message=`Skipped ${code}: ${String(error?.message||error).slice(0,160)}`;}
}

async function deepStep(job,aggregate,config,args){
  const pulls=deepPullCount(aggregate);if(pulls>=job.deepTargetPulls||job.processedWide.length===0){job.phase='compile';job.message=`Deep sample ${pulls.toLocaleString()} pulls. Compiling train/holdout encounter model.`;return;}
  const code=nextDeepCode(job);if(!code){job.phase='compile';job.message=`Deep candidates exhausted at ${pulls.toLocaleString()} pulls; compiling with available complete streams.`;return;}
  try{
    const profile=await fetchDeepProfile({code,...args});if(!profile){job.processedDeep=uniq([...(job.processedDeep||[]),code]);clearFailureStreak(job);return;}
    await corpusSet(deepProfileKey(args,code),profile);mergeDeepProfile(aggregate,profile,{validationFraction:config.validationFraction});job.processedDeep=uniq([...(job.processedDeep||[]),code]);clearFailureStreak(job);const complete=Object.values(profile.completeness||{}).filter(Boolean).length,total=Object.keys(profile.completeness||{}).length;job.message=`Deep sample ${deepPullCount(aggregate).toLocaleString()} / ${job.deepTargetPulls.toLocaleString()} pulls · ${job.processedDeep.length.toLocaleString()} reports · latest streams ${complete}/${total} complete.`;markRate(job,profile.rateLimit,config);
  }catch(error){job.processedDeep=uniq([...(job.processedDeep||[]),code]);recordFailure(job,{code,stage:'deep',error,config});if(job.status!=='paused')job.message=`Deep sample skipped ${code}: ${String(error?.message||error).slice(0,160)}`;}
}

async function compileStep(job,aggregate,config,args){
  aggregate.discoveredSourcePool=sourceStats(job).total;
  const model=compileEncounterModel(aggregate,{minWideReports:config.minWideReportsToCompile,minWideReportsToPublish:config.minWideReportsToPublish,minDeepReportsToPublish:config.minDeepReportsToPublish,minValidationReportsToPublish:config.minValidationReportsToPublish,minWidePullsToPublish:config.minWidePullsToPublish,minDeepPullsToPublish:config.minDeepPullsToPublish,minIndependentSourcesToPublish:config.minIndependentSourcesToPublish,minValidationSourcesToPublish:config.minValidationSourcesToPublish,minValidationMeanToPublish:config.minValidationMeanToPublish,minLearnedPctToPublish:config.minLearnedPctToPublish,minSemanticCoverageToPublish:config.minSemanticCoverageToPublish,minSignalCoverageToPublish:config.minSignalCoverageToPublish,maxCriticalUnresolvedToPublish:config.maxCriticalUnresolvedToPublish});await corpusSet(modelKey(args),model);job.phase='complete';job.status='ready';job.completedAt=now();job.message=model.status==='published'?`Generated model published at ${model.learning?.scorePct??'—'}% learned from ${aggregate.wideReports.toLocaleString()} reports / ${widePullCount(aggregate).toLocaleString()} pulls.`:`Candidate compiled at ${model.learning?.scorePct??'—'}% learned. Use the learning breakdown to decide whether more WCL evidence or semantic depth is the next bottleneck.`;return model;
}

export async function stepCorpus(input={}){
  const args=await resolveExistingArgs(input);if(!args)throw new Error('Corpus job has not been started for the resolved partition');const config=clampCorpusConfig(input);let {job,aggregate,model}=await loadState(args);if(!job)throw new Error('Corpus job has not been started');if(!aggregate)aggregate=createAggregate({...args,validationFraction:config.validationFraction});
  const executionToken=input.executionToken?String(input.executionToken):null;
  if(executionToken&&job.activeExecutionToken!==executionToken){const state=await publicJob(args,job,aggregate,model);return{...state,executionSuperseded:true};}
  if(job.status==='paused'||job.status==='ready')return publicJob(args,job,aggregate,model);
  if(job.status==='rate-limited'&&job.resumeAt&&now()<job.resumeAt)return publicJob(args,job,aggregate,model);
  if(job.status==='rate-limited'){job.status='running';job.resumeAt=null;}
  job.updatedAt=now();
  if(job.phase==='discover-ranking')await discoverRankingStep(job,aggregate,config,args);
  else if(job.phase==='discover-identities')await discoverIdentityStep(job,aggregate,config,args);
  else if(job.phase==='expand-sources')await expandSourcesStep(job,aggregate,config,args);
  else if(job.phase==='wide')await wideStep(job,aggregate,config,args);
  else if(job.phase==='deep')await deepStep(job,aggregate,config,args);
  else if(job.phase==='compile')model=await compileStep(job,aggregate,config,args);
  else if(job.phase==='complete')job.status='ready';
  job.updatedAt=now();
  if(executionToken){
    const currentJob=await corpusGet(jobKey(args));
    if(currentJob&&currentJob.activeExecutionToken!==executionToken){
      await corpusSet(aggregateKey(args),aggregate);
      const state=await publicJob(args,currentJob,aggregate,model);
      return{...state,executionSuperseded:true};
    }
  }
  await Promise.all([corpusSet(jobKey(args),job),corpusSet(aggregateKey(args),aggregate)]);return publicJob(args,job,aggregate,model);
}

export async function pauseCorpus(input={}){const args=await resolveExistingArgs(input);if(!args)throw new Error('Corpus job has not been started');const {job,aggregate,model}=await loadState(args);if(!job)throw new Error('Corpus job has not been started');job.status='paused';job.pauseRequestedAt=now();job.activeExecutionToken=null;job.updatedAt=now();job.message='Corpus build paused. Persistent checkpoints and processed profiles are retained.';await corpusSet(jobKey(args),job);return publicJob(args,job,aggregate,model);}
export async function resumeCorpus(input={}){const args=await resolveExistingArgs(input);if(!args)throw new Error('Corpus job has not been started');const {job,aggregate,model}=await loadState(args);if(!job)throw new Error('Corpus job has not been started');job.status='running';job.pauseReason=null;job.pauseRequestedAt=null;job.resumeAt=null;job.consecutiveFailure=null;job.activeExecutionToken=null;job.updatedAt=now();job.message=`Resuming ${job.phase} from persistent checkpoint.`;await corpusSet(jobKey(args),job);return publicJob(args,job,aggregate,model);}

export async function activateCorpusExecution(input={},executionToken){
  if(!executionToken)throw new Error('executionToken is required');const args=await resolveExistingArgs(input);if(!args)throw new Error('Corpus job has not been started');const {job,aggregate,model}=await loadState(args);if(!job)throw new Error('Corpus job has not been started');
  job.activeExecutionToken=String(executionToken);job.executionMode=String(input.executionMode||'vercel-workflow');job.workflowRunId=null;job.workflowStartedAt=now();job.updatedAt=now();
  await corpusSet(jobKey(args),job);return publicJob(args,job,aggregate,model);
}

export async function attachWorkflowRun(input={},executionToken,runId){
  const args=await resolveExistingArgs(input);if(!args)throw new Error('Corpus job has not been started');const {job,aggregate,model}=await loadState(args);if(!job)throw new Error('Corpus job has not been started');
  if(executionToken&&job.activeExecutionToken!==String(executionToken))return publicJob(args,job,aggregate,model);
  job.workflowRunId=runId?String(runId):null;job.workflowStartedAt=job.workflowStartedAt||now();job.updatedAt=now();await corpusSet(jobKey(args),job);return publicJob(args,job,aggregate,model);
}


async function readJsonKeys(keys,{concurrency=24}={}){
  const out=[];for(let i=0;i<keys.length;i+=concurrency){const batch=keys.slice(i,i+concurrency);const rows=await Promise.all(batch.map(key=>corpusGet(key).then(value=>({key,value}))));out.push(...rows);}return out;
}

export async function recompileCorpusModel(input={}){
  await assertCorpusStorage();const args=await resolveExistingArgs(input);if(!args)throw new Error('Corpus job has not been started');const config=clampCorpusConfig(input);const current=await loadState(args);if(!current.job)throw new Error('Corpus job has not been started');
  const [wideKeys,deepKeys]=await Promise.all([corpusList(`profiles/${corpusId(args)}/`),corpusList(`deep/${corpusId(args)}/`)]);
  if(!wideKeys.length)throw new Error('No persisted wide profiles are available to recompile');
  const aggregate=createAggregate({...args,encounter:current.aggregate?.encounter||current.job?.encounter||null,validationFraction:config.validationFraction});aggregate.resolvedPartition=args.partition;aggregate.discoveredSourcePool=sourceStats(current.job).total;
  const wideRows=await readJsonKeys(wideKeys);for(const {value} of wideRows)if(value)mergeWideProfile(aggregate,value,{validationFraction:config.validationFraction});
  const deepRows=await readJsonKeys(deepKeys);for(const {value} of deepRows)if(value)mergeDeepProfile(aggregate,value,{validationFraction:config.validationFraction});
  const model=compileEncounterModel(aggregate,{minWideReports:config.minWideReportsToCompile,minWideReportsToPublish:config.minWideReportsToPublish,minDeepReportsToPublish:config.minDeepReportsToPublish,minValidationReportsToPublish:config.minValidationReportsToPublish,minWidePullsToPublish:config.minWidePullsToPublish,minDeepPullsToPublish:config.minDeepPullsToPublish,minIndependentSourcesToPublish:config.minIndependentSourcesToPublish,minValidationSourcesToPublish:config.minValidationSourcesToPublish,minValidationMeanToPublish:config.minValidationMeanToPublish,minLearnedPctToPublish:config.minLearnedPctToPublish,minSemanticCoverageToPublish:config.minSemanticCoverageToPublish,minSignalCoverageToPublish:config.minSignalCoverageToPublish,maxCriticalUnresolvedToPublish:config.maxCriticalUnresolvedToPublish});
  const job=current.job;job.engineVersion=ENGINE_VERSION;job.schemaVersion=SCHEMA_VERSION;job.status='ready';job.phase='complete';job.updatedAt=now();job.completedAt=now();job.message=`Recompiled from ${aggregate.wideReports.toLocaleString()} persisted wide reports and ${aggregate.deepReports.toLocaleString()} persisted deep reports with zero WCL API requests · ${model.learning?.scorePct??'—'}% learned.`;
  await Promise.all([corpusSet(aggregateKey(args),aggregate),corpusSet(modelKey(args),model),corpusSet(jobKey(args),job)]);return publicJob(args,job,aggregate,model);
}

export async function resetCorpus(input={}){
  const requested=normalizeArgs(input),args=await resolveExistingArgs(input);if(!args)return{reset:true,corpusId:null};const prefixes=[`profiles/${corpusId(args)}/`,`deep/${corpusId(args)}/`];for(const prefix of prefixes)for(const key of await corpusList(prefix))await corpusDelete(key);await Promise.all([corpusDelete(jobKey(args)),corpusDelete(aggregateKey(args)),corpusDelete(modelKey(args)),requested.partition===0?corpusDelete(corpusAliasKey(requested)):Promise.resolve()]);return{reset:true,corpusId:corpusId(args)};
}

export async function loadPublishedEncounterModel(input={}){const args=await resolveExistingArgs(input);if(!args)return null;const model=await corpusGet(modelKey(args));return model?.status==='published'?model:null;}
export async function loadAnyEncounterModel(input={}){const args=await resolveExistingArgs(input);if(!args)return null;return corpusGet(modelKey(args));}
