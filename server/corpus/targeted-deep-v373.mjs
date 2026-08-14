import { assertCorpusStorage, corpusGet, corpusSet, corpusList } from './storage.mjs';
import { corpusAliasKey, corpusId, jobKey, aggregateKey } from './keys.mjs';

const now=()=>Date.now();
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const sourceKey=p=>p?.guild?.id?`guild:${p.guild.id}`:p?.owner?.id?`user:${p.owner.id}`:`report:${p?.code||'unknown'}`;
const deepPullCount=a=>num(a?.deepKillPulls)+num(a?.deepWipePulls);
const widePullCount=a=>num(a?.killPulls)+num(a?.wipePulls);

function normalizeArgs(input={}){return{encounterId:Number(input.encounterId),difficulty:Number(input.difficulty||5),partition:Number(input.partition||0)};}
async function resolveArgs(input={}){const args=normalizeArgs(input);if(args.partition>0)return args;const alias=await corpusGet(corpusAliasKey(args));if(!(Number(alias?.partition)>0))throw new Error('Corpus job has not been started');return{...args,partition:Number(alias.partition)};}
function classify(profile){if(num(profile?.kills)>0)return'kill';const fps=(profile?.fights||[]).map(f=>Number(f.fightPercentage)).filter(Number.isFinite);const best=fps.length?Math.min(...fps):100;if(best<50)return'deepWipe';if(best<90)return'midWipe';return'earlyWipe';}
function hasAbility(profile,id){const key=String(id);for(const table of Object.values(profile?.tables||{})){const row=table?.[key];if(row&&(num(row.count)>0||num(row.total)>0||num(row.rows)>0))return true;}return false;}
function focusHits(profile,ids){let hits=0;for(const id of ids)if(hasAbility(profile,id))hits++;return hits;}

export function prioritizeWideProfilesForDeepV373(profiles=[],processedDeep=[],focusAbilityIds=[]){
  const done=new Set(processedDeep||[]),focus=uniq((focusAbilityIds||[]).map(Number).filter(Number.isFinite));
  const rows=profiles.filter(p=>p?.code&&!done.has(p.code)).map(p=>({...p,__bucket:classify(p),__source:sourceKey(p),__focus:focusHits(p,focus),__pulls:num(p.kills)+num(p.wipes)}));
  rows.sort((a,b)=>b.__focus-a.__focus||({deepWipe:0,kill:1,midWipe:2,earlyWipe:3}[a.__bucket]-({deepWipe:0,kill:1,midWipe:2,earlyWipe:3}[b.__bucket]))||b.__pulls-a.__pulls||String(a.code).localeCompare(String(b.code)));
  const first=[],repeat=[],seen=new Set();for(const row of rows){if(seen.has(row.__source))repeat.push(row);else{seen.add(row.__source);first.push(row);}}
  return[...first,...repeat];
}

export async function startTargetedDeepV373(input={}){
  await assertCorpusStorage();const args=await resolveArgs(input);const [job,aggregate]=await Promise.all([corpusGet(jobKey(args)),corpusGet(aggregateKey(args))]);
  if(!job||!aggregate)throw new Error('Corpus job has not been started');
  if(['running','rate-limited'].includes(job.status))throw new Error('Corpus is already running');
  const keys=await corpusList(`profiles/${corpusId(args)}/`),profiles=[];for(const key of keys){const p=await corpusGet(key);if(p)profiles.push(p);}
  const ordered=prioritizeWideProfilesForDeepV373(profiles,job.processedDeep||[],input.focusAbilityIds||[]);if(!ordered.length)throw new Error('No persisted Wide reports remain available for targeted Deep profiling');
  const buckets={kill:[],deepWipe:[],midWipe:[],earlyWipe:[]};for(const p of ordered)buckets[p.__bucket].push(p.code);
  const currentPulls=deepPullCount(aggregate),currentReports=num(aggregate.deepReports),avg=currentReports>0?currentPulls/currentReports:8;
  const requestedReports=Math.max(1,Math.min(100,Number(input.addDeepReports)||12));
  const availableReports=Math.min(requestedReports,ordered.length);
  const requestedPulls=Math.max(20,Number(input.addDeepPulls)||0,Math.ceil(avg*availableReports));
  const deepTargetPulls=Math.min(widePullCount(aggregate),currentPulls+requestedPulls);
  const deepTargetReports=Math.min(num(aggregate.wideReports),currentReports+availableReports);
  const updated={...job,engineVersion:'3.7.3',schemaVersion:Math.max(4,num(job.schemaVersion)),mode:'targeted-deep',status:'running',phase:'deep',startedAt:now(),updatedAt:now(),completedAt:null,targetPulls:widePullCount(aggregate),deepTargetPulls,deepTargetReports,deepBuckets:buckets,deepCursor:0,resumeAt:null,pauseReason:null,pauseRequestedAt:null,consecutiveFailure:null,activeExecutionToken:null,executionMode:null,workflowRunId:null,workflowStartedAt:null,targetedDeepPlan:{requestedReports:availableReports,requestedPulls,deepTargetPulls,deepTargetReports,availableWideReports:ordered.length,focusAbilityIds:uniq((input.focusAbilityIds||[]).map(Number).filter(Number.isFinite)),selectedPreview:ordered.slice(0,12).map(p=>({code:p.code,bucket:p.__bucket,source:p.__source,focusHits:p.__focus,pulls:p.__pulls}))},message:`TARGETED DEEP · existing Wide only · stop after both ${deepTargetReports} Deep reports and ${deepTargetPulls} Deep pulls are reached · ${ordered.length} candidates available.`};
  await corpusSet(jobKey(args),updated);return{args,job:updated,plan:updated.targetedDeepPlan};
}
