import { stepCorpus as baseStepCorpus } from './service.mjs';
import { corpusGet, corpusSet } from './storage.mjs';
import { corpusAliasKey, jobKey, aggregateKey, deepProfileKey } from './keys.mjs';
import { clampCorpusConfig } from './config.mjs';
import { mergeDeepProfile } from './aggregate.mjs';
import { fetchDeepProfileV373 } from './deep-profile-v373.mjs';

const num=v=>Number.isFinite(Number(v))?Number(v):0;
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const now=()=>Date.now();
const deepPulls=a=>num(a?.deepKillPulls)+num(a?.deepWipePulls);

async function resolveArgs(input={}){
  const args={encounterId:Number(input.encounterId),difficulty:Number(input.difficulty||5),partition:Number(input.partition||0)};
  if(args.partition>0)return args;
  const alias=await corpusGet(corpusAliasKey(args));
  if(!(Number(alias?.partition)>0))return null;
  return{...args,partition:Number(alias.partition)};
}
function rateInfo(rate){if(!rate)return null;const limit=num(rate.limitPerHour),spent=num(rate.pointsSpentThisHour);return{limitPerHour:limit,pointsSpentThisHour:spent,pointsRemaining:Math.max(0,limit-spent),pointsResetIn:num(rate.pointsResetIn),remainingPct:limit?Math.max(0,(limit-spent)/limit):null};}
function markRate(job,rate,config){const r=rateInfo(rate);job.rateLimit=r;if(!r?.limitPerHour)return false;const reserve=Math.max(config.minimumRateLimitReservePoints,r.limitPerHour*config.minimumRateLimitReservePct);if(r.pointsRemaining>reserve)return false;job.status='rate-limited';job.resumeAt=now()+Math.max(60,num(rate?.pointsResetIn)||60)*1000;job.message='WCL rate budget protected. Durable workflow sleeping until the hourly budget resets.';return true;}
function signature(error){return String(error?.message||error||'unknown-error').replace(/\s+/g,' ').replace(/[A-Za-z0-9]{16,}/g,'<id>').replace(/\d{5,}/g,'<n>').slice(0,180).toLowerCase();}
function recordFailure(job,code,error,config){const sig=signature(error),prev=job.consecutiveFailure;job.failedCountTotal=num(job.failedCountTotal)+1;job.failed=[...(job.failed||[]),{code,stage:'deep-v373',reason:String(error?.message||error).slice(0,500),signature:sig,at:now()}].slice(-100);job.consecutiveFailure=prev?.signature===sig?{signature:sig,count:num(prev.count)+1,lastCode:code,stage:'deep-v373'}:{signature:sig,count:1,lastCode:code,stage:'deep-v373'};if(job.consecutiveFailure.count>=config.systemicFailureThreshold){job.status='paused';job.pauseReason='systemic-error';job.message=`AUTO-PAUSED · ${job.consecutiveFailure.count} consecutive targeted Deep failures share the same WCL contract error.`;}}
function nextDeepCode(job){const done=new Set(job.processedDeep||[]),b=job.deepBuckets||{},order=['deepWipe','midWipe','kill','earlyWipe'];for(let i=0;i<order.length;i++){const idx=(num(job.deepCursor)+i)%order.length,key=order[idx],code=(b[key]||[]).find(x=>!done.has(x));if(code){job.deepCursor=(idx+1)%order.length;return code;}}return null;}
function mergeOrigin(split,profile){if(!profile?.originEvidence)return;split.originEvidence ||= {};for(const [id,row] of Object.entries(profile.originEvidence)){const dst=split.originEvidence[id]||(split.originEvidence[id]={friendlySourceEvents:0,encounterOrUnknownSourceEvents:0,unknownSourceEvents:0,reportsWithEvidence:0,events:0});dst.friendlySourceEvents+=num(row.friendlySourceEvents);dst.encounterOrUnknownSourceEvents+=num(row.encounterOrUnknownSourceEvents);dst.unknownSourceEvents+=num(row.unknownSourceEvents);dst.events+=num(row.events);if(num(row.events)>0)dst.reportsWithEvidence++;}}
function workflowState(job,aggregate,extra={}){const resumeAt=num(job?.resumeAt)||null;return{status:job?.status||'unknown',phase:job?.phase||null,pullCount:num(aggregate?.killPulls)+num(aggregate?.wipePulls),deepPullCount:deepPulls(aggregate),deepReportCount:num(aggregate?.deepReports),processedWideCount:(job?.processedWide||[]).length,processedDeepCount:(job?.processedDeep||[]).length,failedCount:num(job?.failedCountTotal||job?.failed?.length),resumeAt,executionSuperseded:false,...extra};}

export async function stepCorpusV373(input={}){
  const args=await resolveArgs(input);if(!args)return baseStepCorpus(input);
  const [job,aggregate]=await Promise.all([corpusGet(jobKey(args)),corpusGet(aggregateKey(args))]);
  if(!job||!aggregate)return baseStepCorpus(input);
  if(job.mode!=='targeted-deep'||job.phase!=='deep'||job.status!=='running')return baseStepCorpus(input);
  if(input.executionToken&&job.activeExecutionToken&&input.executionToken!==job.activeExecutionToken)return workflowState(job,aggregate,{executionSuperseded:true});
  if(job.pauseRequestedAt){job.status='paused';job.pauseReason='user';job.message='Corpus paused safely before the next targeted Deep report.';job.updatedAt=now();await corpusSet(jobKey(args),job);return workflowState(job,aggregate);}

  const pullsReady=deepPulls(aggregate)>=num(job.deepTargetPulls),reportsReady=num(aggregate.deepReports)>=num(job.deepTargetReports||0);
  if(pullsReady&&reportsReady){job.phase='compile';job.message=`TARGETED DEEP complete · ${num(aggregate.deepReports)} reports · ${deepPulls(aggregate)} pulls. Compiling model.`;job.updatedAt=now();await corpusSet(jobKey(args),job);return baseStepCorpus(input);}

  const code=nextDeepCode(job);
  if(!code){job.phase='compile';job.message=`TARGETED DEEP candidates exhausted at ${num(aggregate.deepReports)} reports / ${deepPulls(aggregate)} pulls. Compiling available evidence.`;job.updatedAt=now();await corpusSet(jobKey(args),job);return baseStepCorpus(input);}

  const config=clampCorpusConfig(input);
  try{
    const profile=await fetchDeepProfileV373({code,...args});
    if(profile){
      await corpusSet(deepProfileKey(args,code),profile);
      const splitName=mergeDeepProfile(aggregate,profile,{validationFraction:config.validationFraction});
      mergeOrigin(aggregate.splits?.[splitName]||{},profile);
    }
    job.processedDeep=uniq([...(job.processedDeep||[]),code]);job.consecutiveFailure=null;job.updatedAt=now();
    const targetReports=num(job.deepTargetReports),targetPulls=num(job.deepTargetPulls);
    job.message=`TARGETED DEEP · ${num(aggregate.deepReports)}/${targetReports} reports · ${deepPulls(aggregate)}/${targetPulls} pulls · origin evidence captured`;
    if(profile)markRate(job,profile.rateLimit,config);
  }catch(error){recordFailure(job,code,error,config);job.updatedAt=now();}
  await Promise.all([corpusSet(jobKey(args),job),corpusSet(aggregateKey(args),aggregate)]);
  return workflowState(job,aggregate);
}
