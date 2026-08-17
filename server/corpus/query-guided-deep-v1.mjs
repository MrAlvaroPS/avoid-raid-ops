import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { CORPUS_DEEP_EVENTS_QUERY } from '../wcl/queries/corpus.mjs';
import { fetchReportHeader } from './wide-profile.mjs';
import { normalizeDeepProfile } from './deep-profile.mjs';
import { corpusSplit, hashString } from './aggregate.mjs';

export const QUERY_GUIDED_DEEP_POLICY_VERSION = 'query-guided-deep-v1';
export const QUERY_GUIDED_OUTCOME_WEIGHTS = Object.freeze({ kill:0.20, deepWipe:0.30, midWipe:0.30, earlyWipe:0.20 });

const num=value=>Number.isFinite(Number(value))?Number(value):0;
const uniq=values=>[...new Set((values||[]).filter(Boolean))];

export function deepSourceKey(profile={}){
  const guildId=Number(profile?.guild?.id);
  if(Number.isFinite(guildId)&&guildId>0)return `guild:${guildId}`;
  const ownerId=Number(profile?.owner?.id);
  if(Number.isFinite(ownerId)&&ownerId>0)return `user:${ownerId}`;
  return null;
}

export function classifyDeepFight(fight={}){
  if(fight?.kill)return 'kill';
  const progress=Number(fight?.fightPercentage);
  if(Number.isFinite(progress)&&progress<50)return 'deepWipe';
  if(Number.isFinite(progress)&&progress<90)return 'midWipe';
  return 'earlyWipe';
}

function hasAbility(profile,id){
  const key=String(id);
  for(const table of Object.values(profile?.tables||{})){
    const row=table?.[key];
    if(row&&(num(row.count)>0||num(row.total)>0||num(row.rows)>0))return true;
  }
  return false;
}

function focusHits(profile,focusAbilityIds=[]){
  let hits=0;
  for(const id of focusAbilityIds)if(hasAbility(profile,id))hits++;
  return hits;
}

function emptyOutcomes(){return {kill:0,deepWipe:0,midWipe:0,earlyWipe:0};}
function desiredOutcomeCounts(targetPulls){
  return Object.fromEntries(Object.entries(QUERY_GUIDED_OUTCOME_WEIGHTS).map(([key,weight])=>[key,Math.max(1,Number(targetPulls||0)*weight)]));
}

function fightPriority(fight,current,desired){
  const outcome=classifyDeepFight(fight);
  const target=Math.max(1,Number(desired[outcome]||1));
  const deficit=Math.max(0,target-Number(current[outcome]||0));
  return {outcome,deficitRatio:deficit/target};
}

function selectFights(profile,{count,currentOutcomes,desiredOutcomes}={}){
  const fights=(profile?.fights||[]).filter(f=>Number.isFinite(Number(f?.id)));
  const ranked=fights.map(fight=>({fight,...fightPriority(fight,currentOutcomes,desiredOutcomes)})).sort((a,b)=>
    b.deficitRatio-a.deficitRatio
    || Number(a.fight.kill)-Number(b.fight.kill)
    || Number(a.fight.fightPercentage??100)-Number(b.fight.fightPercentage??100)
    || Number(a.fight.id)-Number(b.fight.id)
  );
  return ranked.slice(0,Math.max(1,Math.min(ranked.length,Number(count)||1)));
}

function buildAbilityProbeExpressions(focusAbilityIds=[]){
  const ids=uniq((focusAbilityIds||[]).map(Number).filter(id=>Number.isFinite(id)&&id>0));
  const groups=[];
  for(let i=0;i<ids.length;i+=8){
    const chunk=ids.slice(i,i+8);
    groups.push({
      abilityIds:chunk,
      filterExpression:`ability.id IN (${chunk.join(',')})`,
      purpose:'surgical-origin-or-relation-probe',
    });
  }
  return groups;
}

export function buildQueryGuidedDeepPlan(profiles=[],{
  processedDeep=[],
  focusAbilityIds=[],
  requestedReports=12,
  requestedPulls=100,
  validationFraction=.2,
  existingDeepSourceReports={},
  maxFightsPerReport=6,
}={}){
  const done=new Set(processedDeep||[]);
  const focus=uniq((focusAbilityIds||[]).map(Number).filter(Number.isFinite));
  const reportGoal=Math.max(1,Number(requestedReports)||1);
  const pullGoal=Math.max(reportGoal,Number(requestedPulls)||reportGoal);
  const desired=desiredOutcomeCounts(pullGoal);
  const currentOutcomes=emptyOutcomes();
  const sourceCounts=new Map(Object.entries(existingDeepSourceReports||{}).map(([key,value])=>[key,num(value)]));
  const candidates=profiles.filter(profile=>profile?.code&&!done.has(profile.code)&&deepSourceKey(profile)).map(profile=>({
    profile,
    source:deepSourceKey(profile),
    focusHits:focusHits(profile,focus),
    split:corpusSplit(profile,validationFraction),
    pulls:(profile.fights||[]).length,
  }));
  const selected=[];
  let selectedPulls=0;
  const selectedSources=new Map();

  while(selected.length<reportGoal&&candidates.length){
    const remainingReports=Math.max(1,reportGoal-selected.length);
    const remainingPulls=Math.max(0,pullGoal-selectedPulls);
    const perReport=Math.max(1,Math.min(maxFightsPerReport,Math.ceil(remainingPulls/remainingReports)||1));
    candidates.sort((a,b)=>
      (sourceCounts.get(a.source)||0)+(selectedSources.get(a.source)||0)-(sourceCounts.get(b.source)||0)-(selectedSources.get(b.source)||0)
      || Number(b.split==='validation')-Number(a.split==='validation')
      || b.focusHits-a.focusHits
      || b.pulls-a.pulls
      || hashString(a.profile.code)-hashString(b.profile.code)
    );
    const row=candidates.shift();
    const chosen=selectFights(row.profile,{count:perReport,currentOutcomes,desiredOutcomes:desired});
    if(!chosen.length)continue;
    const outcomeCounts=emptyOutcomes();
    for(const item of chosen){
      outcomeCounts[item.outcome]++;
      currentOutcomes[item.outcome]++;
    }
    const fightIDs=chosen.map(item=>Number(item.fight.id));
    selected.push({
      code:String(row.profile.code),
      source:row.source,
      split:row.split,
      focusHits:row.focusHits,
      fightIDs,
      pulls:fightIDs.length,
      outcomeCounts,
    });
    selectedPulls+=fightIDs.length;
    selectedSources.set(row.source,(selectedSources.get(row.source)||0)+1);
  }

  return {
    policyVersion:QUERY_GUIDED_DEEP_POLICY_VERSION,
    requestedReports:reportGoal,
    requestedPulls:pullGoal,
    selectedReports:selected.length,
    selectedPulls,
    selectedSources:new Set(selected.map(row=>row.source)).size,
    selected,
    fightIDsByCode:Object.fromEntries(selected.map(row=>[row.code,row.fightIDs])),
    outcomeCounts:currentOutcomes,
    focusAbilityIds:focus,
    surgicalProbeExpressions:buildAbilityProbeExpressions(focus),
    queryPolicy:{
      canonicalDeepUsesExactFightIDs:true,
      maxFightsPerReport,
      canonicalDeepUsesCompleteStreamsForSelectedFights:true,
      surgicalAbilityProbesCountAsDeepReports:false,
      surgicalAbilityProbesCountAsDeepPulls:false,
      rationale:'Use WCL fightIDs to spend full Deep bandwidth only on fights that close report/outcome/source deficits. Ability-filter probes are diagnostic evidence only and must never inflate canonical Deep coverage.',
    },
  };
}

export async function fetchQueryGuidedDeepProfile({code,encounterId,difficulty=5,partition=0,fightIDs=[]}={}){
  const header=await fetchReportHeader({code,encounterId,difficulty,partition});
  if(!header||!header.fights?.length)return null;
  const requested=new Set((fightIDs||[]).map(Number).filter(Number.isFinite));
  const selected=requested.size?header.fights.filter(fight=>requested.has(Number(fight.id))):header.fights;
  if(!selected.length)return null;
  const exactFightIDs=selected.map(fight=>Number(fight.id));
  const data=await wclGraphql(CORPUS_DEEP_EVENTS_QUERY,{code:String(code),fightIDs:exactFightIDs});
  const profile=normalizeDeepProfile({...header,fights:selected},data,{encounterId,difficulty});
  if(profile){
    profile.partition=Number(partition||0);
    profile.queryGuided={policyVersion:QUERY_GUIDED_DEEP_POLICY_VERSION,fightIDs:exactFightIDs,fullStreamsForSelectedFights:true};
  }
  return profile;
}
