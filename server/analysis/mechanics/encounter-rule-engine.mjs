import { eventAbilityId,eventTargetId,eventSourceId,eventsForFight } from '../../wcl/normalization/events.mjs';

const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null;};
const lower=v=>String(v||'').toLowerCase();
const eventType=e=>lower(e?.type);
const timestamp=e=>n(e?.timestamp);
const abilityMatches=(event,ids=[])=>{const id=eventAbilityId(event);return id!=null&&ids.includes(Number(id));};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function buildColorTimeline(auraEvents,pack){
  const light=new Set(pack?.auras?.lightFeather?.ids||[]),voids=new Set(pack?.auras?.voidFeather?.ids||[]);
  const byPlayer=new Map();
  const events=[...(auraEvents||[])].sort((a,b)=>(timestamp(a)||0)-(timestamp(b)||0));
  for(const e of events){
    const target=eventTargetId(e);if(target==null)continue;
    const id=eventAbilityId(e);const color=light.has(id)?'LIGHT':voids.has(id)?'VOID':null;if(!color)continue;
    const type=eventType(e),ts=timestamp(e);if(ts==null)continue;
    if(!byPlayer.has(target))byPlayer.set(target,[]);
    const arr=byPlayer.get(target);
    if(type.includes('remove'))arr.push({ts,color:null,event:e});
    else if(type.includes('apply')||type.includes('refresh')||!type)arr.push({ts,color,event:e});
  }
  return byPlayer;
}

export function colorAt(timeline,playerId,ts){
  const rows=timeline.get(Number(playerId))||[];let current=null;
  for(const row of rows){if(row.ts>ts)break;current=row.color;}
  return current;
}

export function buildStateTimelines(auraEvents,pack){
  const dimensions=[...(pack?.stateDimensions||[])];
  if(pack?.auras?.lightFeather||pack?.auras?.voidFeather){
    dimensions.push({key:'alignment',values:{LIGHT:{ids:pack?.auras?.lightFeather?.ids||[]},VOID:{ids:pack?.auras?.voidFeather?.ids||[]}}});
  }
  const out=new Map();
  for(const dim of dimensions){
    const idToValue=new Map();
    for(const [value,def] of Object.entries(dim.values||{}))for(const id of def?.ids||[])idToValue.set(Number(id),value);
    const byPlayer=new Map();
    for(const e of [...(auraEvents||[])].sort((a,b)=>(timestamp(a)||0)-(timestamp(b)||0))){
      const target=eventTargetId(e),id=eventAbilityId(e),value=idToValue.get(Number(id)),ts=timestamp(e);if(target==null||!value||ts==null)continue;
      if(!byPlayer.has(target))byPlayer.set(target,[]);const arr=byPlayer.get(target),type=eventType(e);
      if(type.includes('remove'))arr.push({ts,value:null,event:e});else if(type.includes('apply')||type.includes('refresh')||!type)arr.push({ts,value,event:e});
    }
    out.set(dim.key,byPlayer);
  }
  return out;
}
export function stateAt(stateTimelines,dimension,playerId,ts){
  const rows=stateTimelines.get(String(dimension))?.get(Number(playerId))||[];let current=null;
  for(const row of rows){if(row.ts>ts)break;current=row.value;}return current;
}

function pushFailure(out,{mechanic,event,fight,actorId,reason,confidence='high',weight=1,scope='player',meta=null,occurrenceKey=null}){
  const ts=timestamp(event);
  out.push({
    mechanicKey:mechanic.key,mechanicName:mechanic.name,category:mechanic.category,severity:mechanic.severity,
    fightId:Number(fight.id),timestampReportMs:ts,fightRelativeMs:ts==null?null:Math.max(0,ts-Number(fight.startTime||0)),
    actorId:actorId==null?null:Number(actorId),scope,reason,confidence,weight,occurrenceKey,
    evidence:{abilityId:eventAbilityId(event),eventType:event?.type||null,...(meta||{})}
  });
}

function uniqueByTime(events,{windowMs=600,keyFn=e=>`${eventSourceId(e)??'s'}:${eventAbilityId(e)??'a'}`}={}){
  const sorted=[...(events||[])].filter(e=>timestamp(e)!=null).sort((a,b)=>timestamp(a)-timestamp(b));
  const out=[];const lastByKey=new Map();
  for(const e of sorted){
    const key=keyFn(e),ts=timestamp(e),last=lastByKey.get(key);
    if(last==null||ts-last>windowMs){out.push(e);lastByKey.set(key,ts);}
  }
  return out;
}

function castOpportunities(events){
  const begins=(events||[]).filter(e=>eventType(e)==='begincast');
  const source=begins.length?begins:(events||[]).filter(e=>eventType(e)==='cast');
  return uniqueByTime(source,{windowMs:750,keyFn:e=>`${eventSourceId(e)??'s'}:${eventAbilityId(e)??'a'}`});
}

function clusterPlayerDamage(events,{gapMs=2500,maxDurationMs=12000}={}){
  const groups=[];const byKey=new Map();
  for(const e of [...(events||[])].filter(e=>timestamp(e)!=null).sort((a,b)=>timestamp(a)-timestamp(b))){
    const actor=eventTargetId(e);if(actor==null)continue;
    const key=`${actor}:${eventAbilityId(e)??'a'}`;const prev=byKey.get(key),ts=timestamp(e);
    if(!prev||ts-prev.lastTs>gapMs||ts-prev.startTs>maxDurationMs){
      const g={actorId:Number(actor),first:e,startTs:ts,lastTs:ts,hits:1,amount:Number(e.amount)||0,events:[e]};
      groups.push(g);byKey.set(key,g);
    }else{
      prev.lastTs=ts;prev.hits++;prev.amount+=(Number(e.amount)||0);prev.events.push(e);
    }
  }
  return groups;
}

function clusterRaidDamage(events,{gapMs=250}={}){
  const groups=[];let current=null;
  for(const e of [...(events||[])].filter(e=>timestamp(e)!=null).sort((a,b)=>timestamp(a)-timestamp(b))){
    const ts=timestamp(e),ability=eventAbilityId(e);
    if(!current||current.abilityId!==ability||ts-current.lastTs>gapMs){
      current={abilityId:ability,first:e,startTs:ts,lastTs:ts,hits:1,actors:new Set(eventTargetId(e)==null?[]:[Number(eventTargetId(e))]),events:[e]};
      groups.push(current);
    }else{
      current.lastTs=ts;current.hits++;const actor=eventTargetId(e);if(actor!=null)current.actors.add(Number(actor));current.events.push(e);
    }
  }
  return groups;
}

function occurrenceRef(fight,mechanic,opportunities,ts,{maxDelayMs=12000,fallbackBucketMs=1000}={}){
  const eligible=(opportunities||[]).map((e,i)=>({e,i,ts:timestamp(e)})).filter(x=>x.ts!=null&&x.ts<=ts&&ts-x.ts<=maxDelayMs);
  const match=eligible.at(-1);
  if(match)return{key:`${fight.id}:${mechanic.key}:cast:${match.i}:${match.ts}`,source:'cast',event:match.e,index:match.i};
  return{key:`${fight.id}:${mechanic.key}:event:${Math.round(ts/fallbackBucketMs)}`,source:'event',event:null,index:null};
}

function periodicEvidence(group){
  if(!group)return false;
  if(group.hits>=2)return true;
  return group.events.some(e=>Boolean(e.tick)||eventType(e).includes('tick')||Boolean(e.periodic));
}

function ensureAgg(perMechanic,m){
  if(!perMechanic.has(m.key))perMechanic.set(m.key,{
    key:m.key,name:m.name,category:m.category,severity:m.severity,scoreable:m.scoreable,
    expectedAction:m.expectedAction,wowhead:m.wowhead,opportunityUnit:'mechanic-occurrence',opportunities:0,
    failedOccurrences:0,failures:0,playerExposures:0,observedIncidents:0,unresolvedAssignments:0,
    cleanOccurrences:null,successes:null,executionSuccessPct:null,denominatorStatus:m.scoreable?'pending':'observed-only',
    linkedDeaths:0,firstDeaths:0,confidence:'unknown',evidenceCount:0,
    _failedOccurrenceKeys:new Set(),_opportunityKeys:new Set(),_playerExposureKeys:new Set()
  });
  return perMechanic.get(m.key);
}

function addOpportunity(agg,fight,mechanic,e,index){
  const ts=timestamp(e);const key=`${fight.id}:${mechanic.key}:cast:${index}:${ts??'na'}`;
  agg._opportunityKeys.add(key);
}
function addFailureRecord({failures,agg,mechanic,event,fight,actorId,reason,confidence='high',weight=1,scope='player',meta=null,occurrenceKey}){
  agg._failedOccurrenceKeys.add(occurrenceKey);
  if(actorId!=null)agg._playerExposureKeys.add(`${occurrenceKey}:actor:${Number(actorId)}`);
  pushFailure(failures,{mechanic,event,fight,actorId,reason,confidence,weight,scope,meta,occurrenceKey});
}

const normalizedInference=new Set([
  'wrong-color-impact','wrong-state-impact','failure-damage-by-occurrence','completed-damage-is-failure',
  'completed-cast-is-failure','failure-aura-is-failure','opposite-color-periodic'
]);

export function analyzeEncounterMechanics({pack,fights=[],damageEvents=[],castEvents=[],enemyBuffEvents=[],friendlyAuraEvents=[]}){
  if(!pack)return{status:'no-rule-pack',mechanics:[],failures:[],playerFailures:{},summary:null};
  const failures=[],perMechanic=new Map();
  for(const m of pack.mechanics)ensureAgg(perMechanic,m);

  for(const fight of fights){
    const fd=eventsForFight(damageEvents,fight),fc=eventsForFight(castEvents,fight),fb=eventsForFight(enemyBuffEvents,fight);
    const fa=eventsForFight(friendlyAuraEvents,fight);
    const colorTimeline=buildColorTimeline(fa,pack);
    const stateTimelines=buildStateTimelines(fa,pack);

    for(const m of pack.mechanics){
      const agg=ensureAgg(perMechanic,m);
      const allRelevantCasts=fc.filter(e=>abilityMatches(e,m.castIds||[]));
      const opportunityIds=m.opportunityCastIds||m.castIds||[];
      const relevantOpportunityCasts=fc.filter(e=>abilityMatches(e,opportunityIds));
      const opportunities=castOpportunities(relevantOpportunityCasts);
      opportunities.forEach((e,i)=>addOpportunity(agg,fight,m,e,i));

      if(m.inference==='wrong-color-impact'||m.inference==='wrong-state-impact'){
        const hits=fd.filter(e=>abilityMatches(e,m.damageIds||[]));
        const impacts=clusterRaidDamage(hits,{gapMs:300});
        if(!opportunities.length){
          impacts.forEach((g,i)=>agg._opportunityKeys.add(`${fight.id}:${m.key}:impact:${i}:${g.startTs}`));
        }
        for(const impact of impacts){
          agg.observedIncidents++;
          const ref=occurrenceRef(fight,m,opportunities,impact.startTs,{maxDelayMs:m.occurrenceWindowMs||12000,fallbackBucketMs:500});
          for(const actor of impact.actors){
            const required=m.requiredState?.value||m.requiredColor||null;
            const dimension=m.requiredState?.dimension||'alignment';
            const current=m.requiredState?stateAt(stateTimelines,dimension,actor,impact.startTs):colorAt(colorTimeline,actor,impact.startTs);
            if(!current){agg.unresolvedAssignments++;continue;}
            if(required&&current!==required){
              addFailureRecord({failures,agg,mechanic:m,event:impact.first,fight,actorId:actor,
                reason:`${current} player received ${required} mechanic`,confidence:'high',scope:'player',occurrenceKey:ref.key,
                meta:{hitCount:impact.events.filter(e=>Number(eventTargetId(e))===Number(actor)).length,assignment:current,requiredState:{dimension,value:required}}});
            }
          }
        }
      }else if(m.inference==='opposite-color-periodic'){
        const hits=fd.filter(e=>abilityMatches(e,m.damageIds||[]));
        const groups=clusterPlayerDamage(hits,{gapMs:2200,maxDurationMs:12000});
        for(const group of groups){
          agg.observedIncidents++;
          if(!periodicEvidence(group))continue; // direct hit alone is normal; periodic aura is the wrong-colour signal.
          const ref=occurrenceRef(fight,m,opportunities,group.startTs,{maxDelayMs:m.occurrenceWindowMs||12000,fallbackBucketMs:1500});
          const c=colorAt(colorTimeline,group.actorId,group.startTs);
          addFailureRecord({failures,agg,mechanic:m,event:group.first,fight,actorId:group.actorId,
            reason:'Opposing-colour periodic Flames aura observed',confidence:c&&m.requiredColor&&c!==m.requiredColor?'confirmed':'high',scope:'player',occurrenceKey:ref.key,
            meta:{hitCount:group.hits,totalAmount:group.amount,assignment:c,requiredColor:m.requiredColor,signal:'periodic-aura'}});
        }
      }else if(m.inference==='failure-damage-by-occurrence'){
        const hits=fd.filter(e=>abilityMatches(e,m.failureDamageIds||[]));
        for(const incident of clusterPlayerDamage(hits,{gapMs:2200,maxDurationMs:12000})){
          agg.observedIncidents++;
          const ref=occurrenceRef(fight,m,opportunities,incident.startTs,{maxDelayMs:m.occurrenceWindowMs||52000,fallbackBucketMs:5000});
          addFailureRecord({failures,agg,mechanic:m,event:incident.first,fight,actorId:incident.actorId,
            reason:'Failure-damage episode observed',confidence:'high',scope:'player',occurrenceKey:ref.key,
            meta:{hitCount:incident.hits,totalAmount:incident.amount}});
        }
      }else if(m.inference==='completed-damage-is-failure'){
        const hits=fd.filter(e=>abilityMatches(e,m.damageIds||[]));
        for(const incident of clusterRaidDamage(hits,{gapMs:900})){
          agg.observedIncidents++;
          const ref=occurrenceRef(fight,m,opportunities,incident.startTs,{maxDelayMs:m.occurrenceWindowMs||10000,fallbackBucketMs:1000});
          addFailureRecord({failures,agg,mechanic:m,event:incident.first,fight,actorId:null,
            reason:'Raid-wide damage indicates the interruptible cast completed',confidence:'confirmed',weight:1.5,scope:'raid',occurrenceKey:ref.key,
            meta:{affectedPlayers:incident.actors.size,hitCount:incident.hits}});
        }
      }else if(m.inference==='completed-cast-is-failure'){
        const completed=uniqueByTime(allRelevantCasts.filter(e=>eventType(e)==='cast'),{windowMs:600,keyFn:e=>`${eventSourceId(e)??'s'}:${eventAbilityId(e)??'a'}`});
        for(const e of completed){
          const ref=occurrenceRef(fight,m,opportunities,timestamp(e),{maxDelayMs:m.occurrenceWindowMs||35000,fallbackBucketMs:1000});
          addFailureRecord({failures,agg,mechanic:m,event:e,fight,actorId:null,reason:'Failure cast completed',confidence:'confirmed',weight:1.5,scope:'raid',occurrenceKey:ref.key});
        }
      }else if(m.inference==='failure-aura-is-failure'){
        const buffs=uniqueByTime(fb.filter(e=>abilityMatches(e,m.failureAuraIds||[])),{windowMs:250,keyFn:e=>`${eventSourceId(e)??'s'}:${eventAbilityId(e)??'a'}`});
        for(const e of buffs){
          const ref=occurrenceRef(fight,m,opportunities,timestamp(e),{maxDelayMs:m.occurrenceWindowMs||6000,fallbackBucketMs:500});
          addFailureRecord({failures,agg,mechanic:m,event:e,fight,actorId:null,
            reason:`${m.name} failure aura applied`,confidence:'confirmed',weight:1.5,scope:'raid',occurrenceKey:ref.key,
            meta:{signal:'boss-empowerment',failureAuraId:eventAbilityId(e)}});
        }
      }else if(m.inference==='quill-splash-observed'){
        const hits=fd.filter(e=>abilityMatches(e,m.damageIds||[]));
        const impacts=clusterRaidDamage(hits,{gapMs:180});
        agg.observedIncidents+=impacts.length;
        agg.maxAffectedPlayers=Math.max(Number(agg.maxAffectedPlayers)||0,...impacts.map(x=>x.actors.size),0);
        // Mythic Quill damage splashes around the interceptor. Damage recipients
        // are therefore evidence of impact, not proof that each recipient failed.
      }else if(m.inference==='phase-transition-observed'||m.inference==='phase-boundary-observed'||m.inference==='pressure-window'||m.inference==='damage-distribution-only'||m.inference==='stateful-impact-observed'||m.inference==='stateful-cast-observed'||m.inference==='wipe-associated-cast'||m.inference==='duration-analysis'||m.inference==='stack-count'){
        // Observational mechanics intentionally produce no failure records here.
      }
    }
  }

  for(const m of pack.mechanics){
    const agg=ensureAgg(perMechanic,m);
    agg.opportunities=agg._opportunityKeys.size;
    agg.failedOccurrences=agg._failedOccurrenceKeys.size;
    agg.failures=agg.failedOccurrences; // backwards-compatible UI field; now occurrence-normalized.
    agg.playerExposures=agg._playerExposureKeys.size;
    agg.evidenceCount=failures.filter(f=>f.mechanicKey===m.key).length;
    const mechFailures=failures.filter(f=>f.mechanicKey===m.key);
    agg.confidence=mechFailures.some(f=>f.confidence==='confirmed')?'confirmed':mechFailures.some(f=>f.confidence==='high')?'high':mechFailures.some(f=>f.confidence==='medium')?'medium':'unknown';
    const canNormalize=m.scoreable&&normalizedInference.has(m.inference)&&agg.opportunities>0&&agg.failedOccurrences<=agg.opportunities;
    agg.denominatorStatus=m.scoreable?(canNormalize?'normalized':'pending'):'observed-only';
    if(canNormalize){
      agg.cleanOccurrences=Math.max(0,agg.opportunities-agg.failedOccurrences);
      agg.successes=agg.cleanOccurrences;
      agg.executionSuccessPct=100*agg.cleanOccurrences/agg.opportunities;
    }
    delete agg._failedOccurrenceKeys;delete agg._opportunityKeys;delete agg._playerExposureKeys;
  }

  const mechanics=[...perMechanic.values()];
  const playerMap=new Map();
  for(const f of failures){
    if(f.actorId==null)continue;
    if(!playerMap.has(f.actorId))playerMap.set(f.actorId,[]);
    playerMap.get(f.actorId).push(f);
  }

  const activeScoreable=mechanics.filter(m=>m.scoreable&&(m.opportunities>0||m.failedOccurrences>0));
  const normalized=activeScoreable.filter(m=>m.denominatorStatus==='normalized');
  const incomplete=activeScoreable.filter(m=>m.denominatorStatus!=='normalized');
  const weightedOpportunities=normalized.reduce((s,m)=>s+m.opportunities*Math.max(1,Number(m.severity)||1),0);
  const weightedFailures=normalized.reduce((s,m)=>s+m.failedOccurrences*Math.max(1,Number(m.severity)||1),0);
  const mechanicalAccuracy=weightedOpportunities>0&&!incomplete.length?clamp(100*(1-weightedFailures/weightedOpportunities),0,100):null;

  return {
    status:'rule-pack',rulePackVersion:pack.version,mechanics,failures,
    playerFailures:Object.fromEntries([...playerMap].map(([id,rows])=>[id,rows])),
    summary:{
      scoreableMechanics:activeScoreable.length,
      normalizedMechanics:normalized.length,
      pendingDenominators:incomplete.map(m=>m.key),
      opportunities:normalized.reduce((s,m)=>s+m.opportunities,0),
      failedOccurrences:normalized.reduce((s,m)=>s+m.failedOccurrences,0),
      playerExposures:normalized.reduce((s,m)=>s+m.playerExposures,0),
      failures:normalized.reduce((s,m)=>s+m.failedOccurrences,0),
      weightedOpportunities:weightedOpportunities||null,
      weightedFailures:weightedOpportunities?weightedFailures:null,
      mechanicalAccuracy,
      accuracyStatus:mechanicalAccuracy==null?(incomplete.length?'pending-normalized-denominators':'insufficient-data'):'normalized-occurrence-weighted'
    }
  };
}
