import { paginatorEvents,eventAbilityId,eventTargetId,eventSourceId } from '../wcl/normalization/events.mjs';
import { masterAbilityMaps, fetchReportHeader } from './wide-profile.mjs';
import { fetchCompleteDeepEventData } from './deep-events-pagination.mjs';

const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const lower=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[’']/g,"'");
const eventType=e=>lower(e?.type);
const ts=e=>num(e?.timestamp);
const isApply=t=>t==='applybuff'||t==='applydebuff'||t==='applybuffstack'||t==='applydebuffstack'||t==='refreshbuff'||t==='refreshdebuff';
const isRemove=t=>t==='removebuff'||t==='removedebuff'||t==='removebuffstack'||t==='removedebuffstack';

export function eventExtraAbilityId(e){
  const vals=[e?.extraAbilityGameID,e?.extraAbility?.guid,e?.extraAbility?.gameID,e?.extraAbility?.id,e?.interruptedAbilityGameID,e?.interruptedAbility?.guid];
  for(const v of vals){const n=num(v);if(n!=null)return n;}return null;
}
function fightOf(e,fights){const fid=num(e?.fight);if(fid!=null){const f=fights.find(x=>x.id===fid);if(f)return f;}const t=ts(e);return fights.find(f=>t!=null&&t>=f.startTime&&t<=f.endTime)||null;}
function cohortOfFight(f){return f?.kill?'kill':'wipe';}
function compactFight(f){return{id:num(f.id),startTime:num(f.startTime),endTime:num(f.endTime),kill:Boolean(f.kill),fightPercentage:num(f.fightPercentage),bossPercentage:num(f.bossPercentage),friendlyPlayers:(f.friendlyPlayers||[]).map(Number).filter(Number.isFinite),phaseTransitions:(f.phaseTransitions||[]).map(p=>({id:num(p.id),startTime:num(p.startTime)}))};}

export const STATE_TOKEN_PAIRS=[['light','void'],['holy','shadow'],['radiant','dark'],['fire','frost'],['flame','frost'],['red','blue'],['solar','lunar'],['sun','moon'],['positive','negative']];
const STOP_WORDS=new Set(['the','of','a','an','s','and','or']);
function nameTokens(name){return lower(name).replace(/'s\b/g,' ').replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(Boolean);}
function normalizeBase(name,token){return nameTokens(name).filter(t=>t!==token&&!STOP_WORDS.has(t)).join(' ');}
function similarity(a,b){const A=new Set(String(a||'').split(/\s+/).filter(Boolean)),B=new Set(String(b||'').split(/\s+/).filter(Boolean));if(!A.size||!B.size)return 0;let i=0;for(const x of A)if(B.has(x))i++;return i/Math.max(A.size,B.size);}

export function detectLexicalStatePairs(abilities={}){
  const rows=Object.values(abilities);const out=[];const seen=new Set();
  for(const [a,b] of STATE_TOKEN_PAIRS){
    const aa=rows.filter(x=>nameTokens(x.name).includes(a)),bb=rows.filter(x=>nameTokens(x.name).includes(b));
    for(const x of aa)for(const y of bb){
      const bx=normalizeBase(x.name,a),by=normalizeBase(y.name,b);const sim=similarity(bx,by);
      if(!bx||!by||!(bx===by||sim>=.67))continue;
      const key=[x.id,y.id].sort((m,n)=>m-n).join(':');if(seen.has(key))continue;seen.add(key);
      const dimension=bx===by?bx:(bx.length<=by.length?bx:by);
      out.push({key:`${a}-${b}:${dimension}`,dimension:dimension||`${a}-${b}`,values:{[a.toUpperCase()]:x.id,[b.toUpperCase()]:y.id},tokens:[a,b],lexicalSimilarity:sim});
    }
  }
  return out;
}

function detectObservedAuraPairs(abilities={},auraEvents=[]){
  const observed=new Set(auraEvents.map(eventAbilityId).map(Number).filter(Number.isFinite));
  const rows=Object.values(abilities).filter(x=>observed.has(Number(x.id)));const out=[];const seen=new Set();
  for(const [a,b] of STATE_TOKEN_PAIRS){
    const aa=rows.filter(x=>nameTokens(x.name).includes(a)),bb=rows.filter(x=>nameTokens(x.name).includes(b));
    for(const x of aa)for(const y of bb){
      const bx=normalizeBase(x.name,a),by=normalizeBase(y.name,b),sim=similarity(bx,by);
      // Broad enough to catch possessive/translated-ish naming, still guarded by event exclusivity below.
      if(!bx||!by||sim<.34)continue;
      const idKey=[Number(x.id),Number(y.id)].sort((m,n)=>m-n).join(':');if(seen.has(idKey))continue;seen.add(idKey);
      out.push({key:`${a}-${b}:${bx===by?bx:(bx.length<=by.length?bx:by)}`,dimension:bx===by?bx:(bx.length<=by.length?bx:by),values:{[a.toUpperCase()]:Number(x.id),[b.toUpperCase()]:Number(y.id)},tokens:[a,b],lexicalSimilarity:sim});
    }
  }
  return out;
}

function analyzeStatePair(auraEvents,pair,fights){
  const idToValue=new Map(Object.entries(pair.values).map(([v,id])=>[Number(id),v]));
  const events=[...auraEvents].filter(e=>idToValue.has(Number(eventAbilityId(e)))).sort((a,b)=>(ts(a)||0)-(ts(b)||0));
  const byFight=new Map(),activeByPlayer=new Map(),valueCounts={};let applications=0,conflicts=0;const players=new Set(),fightSet=new Set();
  for(const e of events){
    const id=eventAbilityId(e),value=idToValue.get(Number(id)),target=eventTargetId(e),fight=fightOf(e,fights),time=ts(e),type=eventType(e);if(!value||target==null||!fight||time==null)continue;
    const fk=Number(fight.id),pk=`${fk}:${target}`;fightSet.add(fk);players.add(pk);
    if(!byFight.has(fk))byFight.set(fk,new Map());const fp=byFight.get(fk);if(!fp.has(target))fp.set(target,[]);
    const active=activeByPlayer.get(pk)||new Set();
    if(isApply(type)){
      const other=[...active].find(v=>v!==value);if(other)conflicts++;
      active.add(value);applications++;valueCounts[value]=(Number(valueCounts[value])||0)+1;fp.get(target).push({ts:time,value});
    } else if(isRemove(type)) {
      active.delete(value);const next=active.size===1?[...active][0]:null;fp.get(target).push({ts:time,value:next});
    }
    activeByPlayer.set(pk,active);
  }
  return{timelines:byFight,applications,conflicts,players:players.size,fights:fightSet.size,valueCounts,exclusivity:applications?Math.max(0,1-conflicts/applications):null};
}
function stateAt(timelines,fightId,playerId,time){const rows=timelines.get(Number(fightId))?.get(Number(playerId))||[];let state=null;for(const r of rows){if(r.ts>time)break;state=r.value;}return state;}
function tokenOfName(name,pair){const toks=nameTokens(name);for(const t of pair.tokens)if(toks.includes(t))return t.toUpperCase();return null;}

function ensureAbility(map,id,abilities){if(id==null)return null;if(!map[id]){const m=abilities[String(id)]||{id,name:`Ability ${id}`};map[id]={id:Number(id),name:m.name,type:m.type||null,kill:{begins:0,casts:0,interrupts:0,damageHits:0,damageOccurrences:0,damageTargets:0,deathLinks:0,phaseBoundaryCasts:0,enemyBuffApplications:0,enemyDebuffApplications:0},wipe:{begins:0,casts:0,interrupts:0,damageHits:0,damageOccurrences:0,damageTargets:0,deathLinks:0,phaseBoundaryCasts:0,enemyBuffApplications:0,enemyDebuffApplications:0},stateAlignment:{}};}return map[id];}
function phaseNear(f,time,window=2500){return (f?.phaseTransitions||[]).some(p=>num(p.startTime)!=null&&Math.abs(Number(p.startTime)-Number(time))<=window);}
function groupDamage(events,fights){
  const groups=[];const keyed=new Map();
  for(const e of [...events].filter(x=>ts(x)!=null).sort((a,b)=>ts(a)-ts(b))){const f=fightOf(e,fights),id=eventAbilityId(e);if(!f||id==null)continue;const key=`${f.id}:${id}`;let g=keyed.get(key),time=ts(e);if(!g||time-g.last>350){g={fight:f,abilityId:id,start:time,last:time,targets:new Set(),events:[]};groups.push(g);keyed.set(key,g);}g.last=time;const target=eventTargetId(e);if(target!=null)g.targets.add(target);g.events.push(e);}
  return groups;
}

function relationBucket(map,sourceId,targetId,targetKind=null){
  const key=`${sourceId}>${targetId}`;if(!map[key])map[key]={sourceId:Number(sourceId),targetId:Number(targetId),...(targetKind?{targetKind}:{}),kill:{sourceOccurrences:0,linkedOccurrences:0,deltaTotalMs:0},wipe:{sourceOccurrences:0,linkedOccurrences:0,deltaTotalMs:0}};return map[key];
}
function buildRelations(castEvents,damageGroups,enemyAuraEvents,fights){
  const relations={castToEnemyAura:{},castToDamage:{}};
  const casts=[...castEvents].filter(e=>eventType(e)==='cast'&&eventAbilityId(e)!=null&&ts(e)!=null).map(e=>({fight:fightOf(e,fights),sourceId:eventAbilityId(e),time:ts(e)})).filter(x=>x.fight);
  const enemyAuras=[...enemyAuraEvents].filter(e=>isApply(eventType(e))&&eventAbilityId(e)!=null&&ts(e)!=null).map(e=>({fight:fightOf(e,fights),targetId:eventAbilityId(e),time:ts(e),kind:eventType(e).includes('debuff')?'debuff':'buff'})).filter(x=>x.fight);
  for(const c of casts){
    const cohort=cohortOfFight(c.fight);
    const nearbyAuras=enemyAuras.filter(a=>a.fight.id===c.fight.id&&a.time>=c.time&&a.time-c.time<=5000);
    const seenAura=new Set();for(const a of nearbyAuras){const k=`${a.targetId}:${a.kind}`;if(seenAura.has(k))continue;seenAura.add(k);const row=relationBucket(relations.castToEnemyAura,c.sourceId,a.targetId,a.kind);row[cohort].linkedOccurrences++;row[cohort].deltaTotalMs+=a.time-c.time;}
    const nearbyDamage=damageGroups.filter(g=>g.fight.id===c.fight.id&&g.start>=c.time&&g.start-c.time<=5000);
    const seenDamage=new Set();for(const d of nearbyDamage){if(seenDamage.has(d.abilityId))continue;seenDamage.add(d.abilityId);const row=relationBucket(relations.castToDamage,c.sourceId,d.abilityId);row[cohort].linkedOccurrences++;row[cohort].deltaTotalMs+=d.start-c.time;}
  }
  const castCounts={kill:{},wipe:{}};for(const c of casts){const cohort=cohortOfFight(c.fight);castCounts[cohort][c.sourceId]=(Number(castCounts[cohort][c.sourceId])||0)+1;}
  for(const map of [relations.castToEnemyAura,relations.castToDamage])for(const row of Object.values(map))for(const cohort of ['kill','wipe'])row[cohort].sourceOccurrences=Number(castCounts[cohort][row.sourceId])||0;
  return relations;
}

export function normalizeDeepProfile(header,data,{encounterId,difficulty}){
  if(!header)return null;const report=data?.reportData?.report||{};const fights=(header.fights||[]).map(compactFight);const maps=masterAbilityMaps(header.masterData);const abilities=Object.fromEntries([...maps.byId].map(([id,v])=>[String(id),v]));
  const castEvents=paginatorEvents(report.enemyCasts),damageEvents=paginatorEvents(report.friendDamage),interruptEvents=paginatorEvents(report.interrupts),debuffEvents=paginatorEvents(report.debuffs),buffEvents=paginatorEvents(report.buffs),enemyBuffEvents=paginatorEvents(report.enemyBuffs),enemyDebuffEvents=paginatorEvents(report.enemyDebuffs),deathEvents=paginatorEvents(report.deaths);const auraEvents=[...debuffEvents,...buffEvents],enemyAuraEvents=[...enemyBuffEvents,...enemyDebuffEvents];
  const stats={};
  for(const e of castEvents){const f=fightOf(e,fights),id=eventAbilityId(e);if(!f||id==null)continue;const row=ensureAbility(stats,id,abilities),c=row[cohortOfFight(f)],t=eventType(e);if(t==='begincast')c.begins++;if(t==='cast')c.casts++;if(t==='cast'&&phaseNear(f,ts(e)))c.phaseBoundaryCasts++;}
  for(const e of interruptEvents){const f=fightOf(e,fights),id=eventExtraAbilityId(e);if(!f||id==null)continue;ensureAbility(stats,id,abilities)[cohortOfFight(f)].interrupts++;}
  for(const e of enemyBuffEvents){const f=fightOf(e,fights),id=eventAbilityId(e);if(!f||id==null||!isApply(eventType(e)))continue;ensureAbility(stats,id,abilities)[cohortOfFight(f)].enemyBuffApplications++;}
  for(const e of enemyDebuffEvents){const f=fightOf(e,fights),id=eventAbilityId(e);if(!f||id==null||!isApply(eventType(e)))continue;ensureAbility(stats,id,abilities)[cohortOfFight(f)].enemyDebuffApplications++;}
  const groups=groupDamage(damageEvents,fights);for(const g of groups){const row=ensureAbility(stats,g.abilityId,abilities),c=row[cohortOfFight(g.fight)];c.damageOccurrences++;c.damageHits+=g.events.length;c.damageTargets+=g.targets.size;}
  const damageByTarget=new Map();for(const e of damageEvents){const f=fightOf(e,fights),target=eventTargetId(e),time=ts(e),id=eventAbilityId(e);if(!f||target==null||time==null||id==null)continue;const key=`${f.id}:${target}`;if(!damageByTarget.has(key))damageByTarget.set(key,[]);damageByTarget.get(key).push({time,id});}
  for(const d of deathEvents){const f=fightOf(d,fights),target=eventTargetId(d)??eventSourceId(d),time=ts(d);if(!f||target==null||time==null)continue;const rows=(damageByTarget.get(`${f.id}:${target}`)||[]).filter(x=>x.time<=time&&time-x.time<=3000);const ids=new Set(rows.map(x=>x.id));for(const id of ids)ensureAbility(stats,id,abilities)[cohortOfFight(f)].deathLinks++;}

  const candidates=[...detectLexicalStatePairs(abilities),...detectObservedAuraPairs(abilities,auraEvents)];const pairMap=new Map();for(const pair of candidates){const idKey=Object.values(pair.values).map(Number).sort((a,b)=>a-b).join(':');const prev=pairMap.get(idKey);if(!prev||Number(pair.lexicalSimilarity||0)>Number(prev.lexicalSimilarity||0))pairMap.set(idKey,pair);}
  const statePairs=[];
  for(const pair of pairMap.values()){
    const analysis=analyzeStatePair(auraEvents,pair,fights);if(analysis.applications<8)continue;
    pair.applications=analysis.applications;pair.conflicts=analysis.conflicts;pair.players=analysis.players;pair.fights=analysis.fights;pair.valueCounts=analysis.valueCounts;pair.exclusivity=analysis.exclusivity;statePairs.push(pair);
    for(const e of damageEvents){const f=fightOf(e,fights),id=eventAbilityId(e),target=eventTargetId(e),time=ts(e);if(!f||id==null||target==null||time==null)continue;const required=tokenOfName(abilities[String(id)]?.name,pair);if(!required)continue;const current=stateAt(analysis.timelines,f.id,target,time);const row=ensureAbility(stats,id,abilities);const key=pair.key;if(!row.stateAlignment[key])row.stateAlignment[key]={pairKey:key,required,tokens:pair.tokens,kill:{match:0,mismatch:0,unknown:0},wipe:{match:0,mismatch:0,unknown:0}};const bucket=row.stateAlignment[key][cohortOfFight(f)];if(!current)bucket.unknown++;else if(current===required)bucket.match++;else bucket.mismatch++;
    }
  }

  const relations=buildRelations(castEvents,groups,enemyAuraEvents,fights);
  const completeness={enemyCasts:report.enemyCasts?.nextPageTimestamp==null,friendDamage:report.friendDamage?.nextPageTimestamp==null,interrupts:report.interrupts?.nextPageTimestamp==null,debuffs:report.debuffs?.nextPageTimestamp==null,buffs:report.buffs?.nextPageTimestamp==null,enemyBuffs:report.enemyBuffs?.nextPageTimestamp==null,enemyDebuffs:report.enemyDebuffs?.nextPageTimestamp==null,deaths:report.deaths?.nextPageTimestamp==null};
  return{schemaVersion:3,kind:'deep',code:header.code,title:header.title||null,zone:header.zone||null,guild:header.guild||null,owner:header.owner||null,encounterId:Number(encounterId),difficulty:Number(difficulty),fights,abilities,abilityStats:stats,statePairs,relations,completeness,eventCounts:{casts:castEvents.length,damage:damageEvents.length,interrupts:interruptEvents.length,debuffs:debuffEvents.length,buffs:buffEvents.length,enemyBuffs:enemyBuffEvents.length,enemyDebuffs:enemyDebuffEvents.length,deaths:deathEvents.length},rateLimit:data?.rateLimitData||header.rateLimit||null,generatedAt:Date.now()};
}

export async function fetchDeepProfile({code,encounterId,difficulty=5}){
  const header=await fetchReportHeader({code,encounterId,difficulty});
  if(!header||!header.fights?.length)return null;
  const fightIDs=header.fights.map(f=>f.id).filter(Number.isFinite);if(!fightIDs.length)return null;
  const fetched=await fetchCompleteDeepEventData({code:String(code),fightIDs});
  const profile=normalizeDeepProfile(header,fetched.data,{encounterId,difficulty});
  if(profile)profile.deepStreamPagination=fetched.pagination;
  return profile;
}
