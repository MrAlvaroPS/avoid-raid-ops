import { assertCorpusStorage, corpusGet, corpusSet, corpusList } from './storage.mjs';
import { corpusAliasKey, corpusId, jobKey, aggregateKey } from './keys.mjs';
import { buildQueryGuidedDeepPlan, deepSourceKey, classifyDeepFight } from './query-guided-deep-v1.mjs';

const now=()=>Date.now();
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const sourceKey=p=>deepSourceKey(p);
const deepPullCount=a=>num(a?.deepKillPulls)+num(a?.deepWipePulls);
const widePullCount=a=>num(a?.killPulls)+num(a?.wipePulls);

function normalizeArgs(input={}){return{encounterId:Number(input.encounterId),difficulty:Number(input.difficulty||5),partition:Number(input.partition||0)};}
async function resolveArgs(input={}){const args=normalizeArgs(input);if(args.partition>0)return args;const alias=await corpusGet(corpusAliasKey(args));if(!(Number(alias?.partition)>0))throw new Error('Corpus job has not been started');return{...args,partition:Number(alias.partition)};}
function classify(profile){if(num(profile?.kills)>0)return'kill';const fps=(profile?.fights||[]).map(f=>Number(f.fightPercentage)).filter(Number.isFinite);const best=fps.length?Math.min(...fps):100;if(best<50)return'deepWipe';if(best<90)return'midWipe';return'earlyWipe';}
function hasAbility(profile,id){const key=String(id);for(const table of Object.values(profile?.tables||{})){const row=table?.[key];if(row&&(num(row.count)>0||num(row.total)>0||num(row.rows)>0))return true;}return false;}
function focusHits(profile,ids){let hits=0;for(const id of ids)if(hasAbility(profile,id))hits++;return hits;}

// Compatibility export retained for existing tests/callers. The execution planner below
// is stricter: it selects exact fights per report rather than always deep-profiling every
// fight contained in a chosen report.
export function prioritizeWideProfilesForDeepV373(profiles=[],processedDeep=[],focusAbilityIds=[]){
  const done=new Set(processedDeep||[]),focus=uniq((focusAbilityIds||[]).map(Number).filter(Number.isFinite));
  const rows=profiles.filter(p=>p?.code&&!done.has(p.code)&&sourceKey(p)).map(p=>({...p,__bucket:classify(p),__source:sourceKey(p),__focus:focusHits(p,focus),__pulls:num(p.kills)+num(p.wipes)}));
  rows.sort((a,b)=>b.__focus-a.__focus||({deepWipe:0,kill:1,midWipe:2,earlyWipe:3}[a.__bucket]-({deepWipe:0,kill:1,midWipe:2,earlyWipe:3}[b.__bucket]))||b.__pulls-a.__pulls||String(a.code).localeCompare(String(b.code)));
  const first=[],repeat=[],seen=new Set();for(const row of rows){if(seen.has(row.__source))repeat.push(row);else{seen.add(row.__source);first.push(row);}}
  return[...first,...repeat];
}

function dominantOutcome(row={}){
  const entries=Object.entries(row.outcomeCounts||{}).sort((a,b)=>Number(b[1])-Number(a[1])||['deepWipe','midWipe','kill','earlyWipe'].indexOf(a[0])-['deepWipe','midWipe','kill','earlyWipe'].indexOf(b[0]));
  return entries[0]?.[0]||'earlyWipe';
}

export async function startTargetedDeepV373(input={}){
  await assertCorpusStorage();const args=await resolveArgs(input);const [job,aggregate]=await Promise.all([corpusGet(jobKey(args)),corpusGet(aggregateKey(args))]);
  if(!job||!aggregate)throw new Error('Corpus job has not been started');
  if(['running','rate-limited'].includes(job.status))throw new Error('Corpus is already running');
  const keys=await corpusList(`profiles/${corpusId(args)}/`),profiles=[];for(const key of keys){const p=await corpusGet(key);if(p)profiles.push(p);}
  const existingCandidates=prioritizeWideProfilesForDeepV373(profiles,job.processedDeep||[],input.focusAbilityIds||[]);if(!existingCandidates.length)throw new Error('No persisted Wide reports remain available for targeted Deep profiling');
  const currentPulls=deepPullCount(aggregate),currentReports=num(aggregate.deepReports),avg=currentReports>0?currentPulls/currentReports:8;
  const requestedReports=Math.max(1,Math.min(100,Number(input.addDeepReports)||12));
  const requestedPulls=Math.max(requestedReports,Number(input.addDeepPulls)||0,Math.ceil(avg*requestedReports));
  const queryPlan=buildQueryGuidedDeepPlan(profiles,{
    processedDeep:job.processedDeep||[],
    focusAbilityIds:input.focusAbilityIds||[],
    requestedReports,
    requestedPulls,
    validationFraction:aggregate.validationFraction??.2,
    existingDeepSourceReports:aggregate.deepSourceReports||{},
  });
  if(!queryPlan.selectedReports)throw new Error('No trustworthy source-scoped Wide reports remain available for query-guided Deep profiling');
  const buckets={kill:[],deepWipe:[],midWipe:[],earlyWipe:[]};for(const row of queryPlan.selected)buckets[dominantOutcome(row)].push(row.code);
  const deepTargetPulls=Math.min(widePullCount(aggregate),currentPulls+queryPlan.selectedPulls);
  const deepTargetReports=Math.min(num(aggregate.wideReports),currentReports+queryPlan.selectedReports);
  const updated={...job,engineVersion:'3.7.6-query-guided-deep-v1',schemaVersion:Math.max(5,num(job.schemaVersion)),mode:'targeted-deep',status:'running',phase:'deep',startedAt:now(),updatedAt:now(),completedAt:null,targetPulls:widePullCount(aggregate),deepTargetPulls,deepTargetReports,deepBuckets:buckets,deepCursor:0,resumeAt:null,pauseReason:null,pauseRequestedAt:null,consecutiveFailure:null,activeExecutionToken:null,executionMode:null,workflowRunId:null,workflowStartedAt:null,queryGuidedDeepPlan:queryPlan,deepFightIDsByCode:queryPlan.fightIDsByCode,targetedDeepPlan:{requestedReports:queryPlan.selectedReports,requestedPulls:queryPlan.selectedPulls,deepTargetPulls,deepTargetReports,availableWideReports:existingCandidates.length,focusAbilityIds:queryPlan.focusAbilityIds,queryPolicy:queryPlan.queryPolicy,surgicalProbeExpressions:queryPlan.surgicalProbeExpressions,selectedPreview:queryPlan.selected.slice(0,12)},message:`QUERY-GUIDED DEEP · existing Wide only · ${queryPlan.selectedReports} reports / ${queryPlan.selectedPulls} exact fights planned across ${queryPlan.selectedSources} sources · full streams only for selected fightIDs; surgical ability probes remain non-counting diagnostics.`};
  await corpusSet(jobKey(args),updated);return{args,job:updated,plan:updated.targetedDeepPlan};
}
