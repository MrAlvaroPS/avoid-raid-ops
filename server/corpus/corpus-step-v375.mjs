import { stepCorpusV373 } from './corpus-step-v373.mjs';
import { corpusGet, corpusSet } from './storage.mjs';
import { corpusAliasKey, jobKey, aggregateKey, deepProfileKey } from './keys.mjs';
import { clampCorpusConfig } from './config.mjs';
import { mergeDeepProfile, hashString } from './aggregate.mjs';
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
function nextDeepCode(job){
  const done=new Set(job.processedDeep||[]),b=job.deepBuckets||{},order=['deepWipe','midWipe','kill','earlyWipe'];
  for(let i=0;i<order.length;i++){
    const idx=(num(job.deepCursor)+i)%order.length,key=order[idx],code=(b[key]||[]).find(x=>!done.has(x));
    if(code){job.deepCursor=(idx+1)%order.length;return code;}
  }
  return (job.processedWide||[]).filter(x=>!done.has(x)).sort((a,b)=>hashString(a)-hashString(b))[0]||null;
}
function rateInfo(rate){if(!rate)return null;const limit=num(rate.limitPerHour),spent=num(rate.pointsSpentThisHour);return{limitPerHour:limit,pointsSpentThisHour:spent,pointsRemaining:Math.max(0,limit-spent),pointsResetIn:num(rate.pointsResetIn),remainingPct:limit?Math.max(0,(limit-spent)/limit):null};}
function markRate(job,rate,config){
  const r=rateInfo(rate);job.rateLimit=r;if(!r?.limitPerHour)return false;
  const reserve=Math.max(config.minimumRateLimitReservePoints,r.limitPerHour*config.minimumRateLimitReservePct);
  if(r.pointsRemaining>reserve)return false;
  job.status='rate-limited';job.resumeAt=now()+Math.max(60,num(rate?.pointsResetIn)||60)*1000;job.message='WCL rate budget protected. Durable workflow sleeping until the hourly budget resets.';return true;
}
function failureSignature(error){return String(error?.message||error||'unknown-error').replace(/\s+/g,' ').replace(/[A-Za-z0-9]{16,}/g,'<id>').replace(/\d{5,}/g,'<n>').slice(0,180).toLowerCase();}
function recordFailure(job,code,error,config){
  const signature=failureSignature(error),prev=job.consecutiveFailure;
  job.failedCountTotal=num(job.failedCountTotal)+1;
  job.failed=[...(job.failed||[]),{code,stage:'deep-v375',reason:String(error?.message||error).slice(0,500),signature,at:now()}].slice(-100);
  job.consecutiveFailure=prev?.signature===signature?{signature,count:num(prev.count)+1,lastCode:code,stage:'deep-v375'}:{signature,count:1,lastCode:code,stage:'deep-v375'};
  if(job.consecutiveFailure.count>=config.systemicFailureThreshold){job.status='paused';job.pauseReason='systemic-error';job.message=`AUTO-PAUSED · ${job.consecutiveFailure.count} consecutive Deep failures share the same WCL contract error.`;}
}
function workflowState(job,aggregate,extra={}){
  const resumeAt=num(job?.resumeAt)||null;
  return{status:job?.status||'unknown',phase:job?.phase||null,pullCount:num(aggregate?.killPulls)+num(aggregate?.wipePulls),deepPullCount:deepPulls(aggregate),deepReportCount:num(aggregate?.deepReports),processedWideCount:(job?.processedWide||[]).length,processedDeepCount:(job?.processedDeep||[]).length,failedCount:num(job?.failedCountTotal||job?.failed?.length),resumeAt,executionSuperseded:false,...extra};
}

// Normal enrich used the legacy Deep fetcher, so provenance collected by v3.7.3 was
// absent as soon as the workflow left targeted-deep mode. Intercept only the normal
// Deep phase; every other phase keeps the established v3.7.3/base workflow behaviour.
export async function stepCorpusV375(input={}){
  const args=await resolveArgs(input);if(!args)return stepCorpusV373(input);
  const [job,aggregate]=await Promise.all([corpusGet(jobKey(args)),corpusGet(aggregateKey(args))]);
  if(!job||!aggregate)return stepCorpusV373(input);
  if(job.mode==='targeted-deep'||job.phase!=='deep'||job.status!=='running')return stepCorpusV373(input);
  if(input.executionToken&&job.activeExecutionToken&&String(input.executionToken)!==String(job.activeExecutionToken))return workflowState(job,aggregate,{executionSuperseded:true});
  if(job.pauseRequestedAt){job.status='paused';job.pauseReason='user';job.message='Corpus paused safely before the next Deep report.';job.updatedAt=now();await corpusSet(jobKey(args),job);return workflowState(job,aggregate);}

  if(deepPulls(aggregate)>=num(job.deepTargetPulls)||!(job.processedWide||[]).length){
    job.phase='compile';job.message=`Deep sample ${deepPulls(aggregate).toLocaleString()} pulls. Compiling train/holdout encounter model.`;job.updatedAt=now();await corpusSet(jobKey(args),job);return stepCorpusV373(input);
  }
  const code=nextDeepCode(job);
  if(!code){job.phase='compile';job.message=`Deep candidates exhausted at ${deepPulls(aggregate).toLocaleString()} pulls; compiling with available complete streams.`;job.updatedAt=now();await corpusSet(jobKey(args),job);return stepCorpusV373(input);}

  const config=clampCorpusConfig(input);
  try{
    const profile=await fetchDeepProfileV373({code,...args});
    if(profile){await corpusSet(deepProfileKey(args,code),profile);mergeDeepProfile(aggregate,profile,{validationFraction:config.validationFraction});}
    job.processedDeep=uniq([...(job.processedDeep||[]),code]);job.consecutiveFailure=null;job.updatedAt=now();
    const complete=Object.values(profile?.completeness||{}).filter(Boolean).length,total=Object.keys(profile?.completeness||{}).length;
    job.message=`Deep sample ${deepPulls(aggregate).toLocaleString()} / ${num(job.deepTargetPulls).toLocaleString()} pulls · ${num(aggregate.deepReports).toLocaleString()} reports · origin provenance retained · latest streams ${complete}/${total} complete.`;
    if(profile)markRate(job,profile.rateLimit,config);
  }catch(error){job.processedDeep=uniq([...(job.processedDeep||[]),code]);recordFailure(job,code,error,config);job.updatedAt=now();if(job.status!=='paused')job.message=`Deep sample skipped ${code}: ${String(error?.message||error).slice(0,160)}`;}
  await Promise.all([corpusSet(jobKey(args),job),corpusSet(aggregateKey(args),aggregate)]);
  return workflowState(job,aggregate);
}
