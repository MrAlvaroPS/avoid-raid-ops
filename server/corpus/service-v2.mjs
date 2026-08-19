import { assertCorpusStorage, corpusGet, corpusSet } from './storage.mjs';
import { aggregateKey, corpusAliasKey, jobKey, modelKey, deepProfileKey } from './keys.mjs';
import { globalBossSamplingKey } from '../knowledge/keys.mjs';
import { clampCorpusConfig } from './config.mjs';
import { rebuildCanonicalBossCorpus } from './canonical-rebuild-v2.mjs';
import { getCorpusStatus } from './service.mjs';
import { BOSS_SAMPLING_POLICY_VERSION } from './sampling-v2.mjs';
import { IRIS_KNOWLEDGE_CONTRACT_VERSION } from '../knowledge/scopes.mjs';

export const OPERATIONAL_REFERENCE_VERSION='global-boss-operational-reference-v1';
export const OPERATIONAL_REFERENCE_THRESHOLDS=Object.freeze({minWidePulls:100,minDeepPulls:20,minWideSources:8,minDeepSources:3});

async function resolveArgs(input = {}) {
  const encounterId=Number(input.encounterId),difficulty=Number(input.difficulty),partition=Number(input.partition||0);
  if(!Number.isInteger(encounterId)||encounterId<=0)throw new Error('encounterId is required');
  if(!Number.isInteger(difficulty)||difficulty<=0)throw new Error('difficulty is required');
  const args = { encounterId, difficulty, partition };
  if (args.partition > 0) return args;
  const alias = await corpusGet(corpusAliasKey(args));
  if (!(Number(alias?.partition) > 0)) return null;
  return { ...args, partition: Number(alias.partition) };
}

function canonicalSourceSafety(model,sampling,args){
  if(!model||!sampling)return false;
  if(sampling.policyVersion!==BOSS_SAMPLING_POLICY_VERSION)return false;
  if(sampling.contractVersion!==IRIS_KNOWLEDGE_CONTRACT_VERSION)return false;
  if(Number(sampling?.scope?.encounterId)!==Number(args.encounterId)
      ||Number(sampling?.scope?.difficulty)!==Number(args.difficulty)
      ||Number(sampling?.scope?.partition)!==Number(args.partition))return false;
  if(Number(sampling.homeSourceSelectedReports||0)!==0)return false;
  if(Number(sampling.homeGuildSelectedReports||0)!==0)return false;
  if(Number(sampling.homeOwnerSelectedReports||0)!==0)return false;
  if(Number(sampling.selectedWrongScopeReports||0)!==0)return false;
  if(Number(sampling.selectedMissingSourceReports||0)!==0)return false;
  if(model?.knowledgeContract?.version!==IRIS_KNOWLEDGE_CONTRACT_VERSION)return false;
  if(model?.knowledgeContract?.homeGuildParticipatesInBossModel!==false)return false;
  if(model?.knowledgeContract?.knownHomeUploadersParticipateInBossModel!==false)return false;
  return true;
}

const uniq=values=>[...new Set((values||[]).map(Number).filter(Number.isFinite))];
const finite=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v));
function abilityDeep(aggregate,id,cohort,key){
  return ['train','validation'].reduce((sum,split)=>sum+Number(aggregate?.splits?.[split]?.abilities?.[String(id)]?.deep?.[cohort]?.[key]||0),0);
}
function mechanicMetric(mechanic){
  const inference=String(mechanic?.inference||'');
  if(inference==='failure-aura-is-failure')return{kind:'enemy-aura-applications',ids:uniq(mechanic.failureAuraIds),keys:['enemyBuffApplications','enemyDebuffApplications']};
  if(['phase-transition-observed','phase-boundary-observed','stateful-cast-observed','wipe-associated-cast','completed-cast-is-failure'].includes(inference))return{kind:'cast-occurrences',ids:uniq([...(mechanic.opportunityCastIds||[]),...(mechanic.castIds||[])]),keys:['begins','casts'],preferFirst:true};
  const damageIds=uniq([...(mechanic.damageIds||[]),...(mechanic.failureDamageIds||[])]);
  if(damageIds.length)return{kind:'damage-occurrences',ids:damageIds,keys:['damageOccurrences']};
  const castIds=uniq([...(mechanic.opportunityCastIds||[]),...(mechanic.castIds||[])]);
  if(castIds.length)return{kind:'cast-occurrences',ids:castIds,keys:['begins','casts'],preferFirst:true};
  return null;
}
function cohortMetric(aggregate,metric,cohort){
  if(!metric?.ids?.length)return 0;
  if(metric.preferFirst){
    const first=metric.ids.reduce((sum,id)=>sum+abilityDeep(aggregate,id,cohort,metric.keys[0]),0);
    if(first>0)return first;
    return metric.ids.reduce((sum,id)=>sum+abilityDeep(aggregate,id,cohort,metric.keys[1]),0);
  }
  return metric.ids.reduce((sum,id)=>sum+metric.keys.reduce((sub,key)=>sub+abilityDeep(aggregate,id,cohort,key),0),0);
}

function quantile(values,p){
  const rows=(values||[]).filter(finite).map(Number).sort((a,b)=>a-b);if(!rows.length)return null;if(rows.length===1)return rows[0];
  const pos=(rows.length-1)*Number(p),lo=Math.floor(pos),hi=Math.ceil(pos),w=pos-lo;return rows[lo]*(1-w)+rows[hi]*w;
}
function distribution(values){
  const rows=(values||[]).filter(finite).map(Number);if(!rows.length)return null;
  return{n:rows.length,min:Math.min(...rows),p25:quantile(rows,.25),p50:quantile(rows,.5),p75:quantile(rows,.75),p90:quantile(rows,.9),p95:quantile(rows,.95),max:Math.max(...rows),mean:rows.reduce((a,b)=>a+b,0)/rows.length};
}
function cohortFights(profile,cohort){return(profile?.fights||[]).filter(f=>Boolean(f?.kill)===(cohort==='kill'));}
function cohortMinutes(profile,cohort){return cohortFights(profile,cohort).reduce((sum,f)=>{const d=Number(f?.endTime)-Number(f?.startTime);return sum+(Number.isFinite(d)&&d>0?d/60000:0);},0);}
function profileAbilityMetric(profile,id,cohort,metric){
  const side=profile?.abilityStats?.[String(id)]?.[cohort]||{};
  if(metric==='casts')return Number(side.begins)>0?Number(side.begins):Number(side.casts||0);
  return Number(side?.[metric]||0);
}
function metricDistribution(deepProfiles,id,cohort,metric){
  const rows=[];let total=0,pulls=0,minutes=0;
  for(const profile of deepProfiles||[]){
    const fs=cohortFights(profile,cohort);if(!fs.length)continue;const count=profileAbilityMetric(profile,id,cohort,metric),mins=cohortMinutes(profile,cohort);
    pulls+=fs.length;minutes+=mins;total+=count;rows.push({perPull:count/fs.length,perMinute:mins>0?count/mins:null});
  }
  if(!rows.length)return null;
  return{reports:rows.length,pulls,meanPerPull:pulls?total/pulls:null,meanPerMinute:minutes?total/minutes:null,reportNormalized:{perPull:distribution(rows.map(x=>x.perPull)),perMinute:distribution(rows.map(x=>x.perMinute))}};
}
function aggregateAbilityName(aggregate,id,deepProfiles){
  for(const split of ['train','validation']){const name=aggregate?.splits?.[split]?.abilities?.[String(id)]?.name;if(name&&!String(name).startsWith('Ability '))return name;}
  for(const profile of deepProfiles||[]){const name=profile?.abilityStats?.[String(id)]?.name||profile?.abilities?.[String(id)]?.name;if(name&&!String(name).startsWith('Ability '))return name;}
  return`Ability ${id}`;
}
function abilityBenchmarks(aggregate,deepProfiles){
  const ids=new Set();for(const profile of deepProfiles||[])for(const id of Object.keys(profile?.abilityStats||{})){const n=Number(id);if(Number.isInteger(n)&&n>0)ids.add(n);}
  return[...ids].sort((a,b)=>a-b).map(id=>({abilityId:id,name:aggregateAbilityName(aggregate,id,deepProfiles),metrics:{damageHits:{kill:metricDistribution(deepProfiles,id,'kill','damageHits'),wipe:metricDistribution(deepProfiles,id,'wipe','damageHits')},damageOccurrences:{kill:metricDistribution(deepProfiles,id,'kill','damageOccurrences'),wipe:metricDistribution(deepProfiles,id,'wipe','damageOccurrences')},casts:{kill:metricDistribution(deepProfiles,id,'kill','casts'),wipe:metricDistribution(deepProfiles,id,'wipe','casts')},deathLinks:{kill:metricDistribution(deepProfiles,id,'kill','deathLinks'),wipe:metricDistribution(deepProfiles,id,'wipe','deathLinks')}}}));
}
function operationalBenchmark(pack,aggregate,deepProfiles=[]){
  if(!pack||!aggregate)return null;
  const killPulls=Number(aggregate.deepKillPulls||0),wipePulls=Number(aggregate.deepWipePulls||0),allPulls=killPulls+wipePulls;
  const mechanics=(pack.mechanics||[]).map(mechanic=>{
    const metric=mechanicMetric(mechanic);if(!metric)return null;
    const kill=cohortMetric(aggregate,metric,'kill'),wipe=cohortMetric(aggregate,metric,'wipe'),all=kill+wipe;
    return{key:mechanic.key,name:mechanic.name||mechanic.key,metric:metric.kind,deepPulls:allPulls,killPulls,wipePulls,meanPerPull:allPulls?all/allPulls:null,killMeanPerPull:killPulls?kill/killPulls:null,wipeMeanPerPull:wipePulls?wipe/wipePulls:null};
  }).filter(Boolean);
  return{version:'global-observational-benchmark-v2',source:'canonical-deep-corpus',semantics:'same-difficulty descriptive GLOBAL reference. Pull-weighted means plus report-normalized distributions; wipe comparisons should prefer per-minute rates to reduce depth bias. Not a failure threshold, blame signal or promotion gate.',deepPulls:allPulls,killPulls,wipePulls,mechanics,abilities:abilityBenchmarks(aggregate,deepProfiles),distributionContract:{sameDifficultyOnly:true,homeExcludedByCanonicalSampling:true,killPrimaryUnit:'per-pull',wipePrimaryUnit:'per-minute',percentiles:'report-normalized rates from canonical Deep reports',rawDamageAmountDistributionUnavailable:true,automaticFailureInference:false}};
}

export async function recompileCorpusModelV2(input = {}) {
  await assertCorpusStorage();
  const args = await resolveArgs(input);
  if (!args) throw new Error('Corpus job has not been started');
  const [job, currentAggregate] = await Promise.all([corpusGet(jobKey(args)), corpusGet(aggregateKey(args))]);
  if (!job) throw new Error('Corpus job has not been started');
  const config = clampCorpusConfig(input);
  const { aggregate, model, manifest } = await rebuildCanonicalBossCorpus({ args, job, currentAggregate, config, purgeHomeGuild: true });
  job.engineVersion = '3.9.12-sampling-v3';
  job.status = 'ready';
  job.phase = 'complete';
  job.updatedAt = Date.now();
  job.completedAt = Date.now();
  job.message = `RECOMPILE · 0 WCL · canonical sampling v3 selected ${aggregate.wideReports.toLocaleString()} Wide reports / ${aggregate.deepReports.toLocaleString()} Deep reports across ${manifest.wide.sources.toLocaleString()} independent sources; hard source caps applied where mathematically feasible; AvoiD/home uploaders excluded.`;
  await Promise.all([
    corpusSet(jobKey(args), job),
    corpusSet(aggregateKey(args), aggregate),
    corpusSet(modelKey(args), model),
    corpusSet(globalBossSamplingKey(args), manifest),
  ]);
  return getCorpusStatus(args);
}

export async function getBossSamplingManifest(input = {}) {
  const args = await resolveArgs(input);
  if (!args) return null;
  return corpusGet(globalBossSamplingKey(args));
}

export async function loadOperationalEncounterModelV2(input={}){
  const args=await resolveArgs(input);if(!args)return null;
  const [model,sampling,aggregate]=await Promise.all([corpusGet(modelKey(args)),corpusGet(globalBossSamplingKey(args)),corpusGet(aggregateKey(args))]);
  if(!canonicalSourceSafety(model,sampling,args)||!model?.pack)return null;
  const t={...OPERATIONAL_REFERENCE_THRESHOLDS,...(input.thresholds||{})};
  const evidence={
    widePulls:Number(sampling?.wide?.pulls||0),deepPulls:Number(sampling?.deep?.pulls||0),
    wideSources:Number(sampling?.wide?.sources||0),deepSources:Number(sampling?.deep?.sources||0),
    wideReports:Number(sampling?.wide?.reports||0),deepReports:Number(sampling?.deep?.reports||0),
  };
  const checks={
    widePulls:evidence.widePulls>=Number(t.minWidePulls),deepPulls:evidence.deepPulls>=Number(t.minDeepPulls),
    wideSources:evidence.wideSources>=Number(t.minWideSources),deepSources:evidence.deepSources>=Number(t.minDeepSources),
  };
  if(!Object.values(checks).every(Boolean))return null;
  const selectedDeepCodes=[...(sampling?.selectedDeepCodes||[])].map(String).filter(Boolean);
  const deepProfiles=(await Promise.all(selectedDeepCodes.map(code=>corpusGet(deepProfileKey(args,code)).catch(()=>null)))).filter(Boolean);
  return{
    ...model,
    operationalReference:{
      version:OPERATIONAL_REFERENCE_VERSION,status:model.status==='published'?'published-compatible':'operational-unpublished',
      scope:{encounterId:args.encounterId,difficulty:args.difficulty,partition:args.partition},evidence,thresholds:t,checks,
      sourceIsolation:'canonical-sampling-fail-closed',acceptedKnowledge:model.status==='published',automaticPromotion:false,
      benchmark:operationalBenchmark(model.pack,aggregate,deepProfiles),
      meaning:model.status==='published'?'Published model also satisfies the operational floor.':'Bounded same-difficulty public reference safe for operational classification only; it is not accepted/promoted boss knowledge.'
    }
  };
}

// Application/runtime consumers that require accepted knowledge must use this loader.
// It rejects any pre-contract or merely operational model even if a candidate pack exists.
export async function loadPublishedEncounterModelV2(input = {}) {
  const args=await resolveArgs(input);
  if(!args)return null;
  const [model,sampling]=await Promise.all([corpusGet(modelKey(args)),corpusGet(globalBossSamplingKey(args))]);
  if(!model||model.status!=='published'||!sampling)return null;
  if(!canonicalSourceSafety(model,sampling,args))return null;
  return model;
}
