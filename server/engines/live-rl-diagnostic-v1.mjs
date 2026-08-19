import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { LIVE_RL_DIAGNOSTIC_QUERY } from '../wcl/queries/live-rl-diagnostic.mjs';
import { paginatorEvents,eventAbilityId,eventAbilityName,eventSourceId } from '../wcl/normalization/events.mjs';
import { abilityBreakdown,tableEntries } from '../wcl/normalization/tables.mjs';
import { loadMechanicKnowledgeViewV1 } from '../services/mechanic-knowledge-view-service.mjs';

export const LIVE_RL_DIAGNOSTIC_VERSION='live-rl-diagnostic-v1';
const finite=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v));
const cleanName=v=>String(v||'').trim()||null;
const eventType=e=>String(e?.type||'').toLowerCase();
const pct=(part,total)=>total>0?100*part/total:null;

function uniqueCasts(events=[]){
  const rows=[...events].filter(e=>eventType(e)==='begincast'||eventType(e)==='cast').sort((a,b)=>Number(a.timestamp||0)-Number(b.timestamp||0));
  const preferred=rows.some(e=>eventType(e)==='begincast')?rows.filter(e=>eventType(e)==='begincast'):rows.filter(e=>eventType(e)==='cast');
  const last=new Map(),out=[];
  for(const e of preferred){const key=`${eventSourceId(e)??'s'}:${eventAbilityId(e)??eventAbilityName(e)??'a'}`,ts=Number(e.timestamp||0),prev=last.get(key);if(prev==null||ts-prev>750){out.push(e);last.set(key,ts);}}
  return out;
}
function groupAbilities(events=[]){
  const map=new Map();
  for(const e of events){const id=eventAbilityId(e),name=cleanName(eventAbilityName(e))||(id!=null?`Ability ${id}`:'Unknown'),key=String(id??name),row=map.get(key)||{abilityId:id,name,count:0,firstTimestamp:null};row.count++;const ts=finite(e?.timestamp)?Number(e.timestamp):null;if(ts!=null&&(row.firstTimestamp==null||ts<row.firstTimestamp))row.firstTimestamp=ts;map.set(key,row);}
  return [...map.values()].sort((a,b)=>b.count-a.count||String(a.name).localeCompare(String(b.name)));
}
function officialAbilityMap(view){
  const map=new Map();
  for(const mechanic of view?.bossKnowledge?.officialMechanics||[])for(const ability of mechanic.abilities||[]){const id=Number(ability.abilityId);if(!Number.isInteger(id)||id<=0)continue;const rows=map.get(id)||[];rows.push({mechanicKey:mechanic.key||null,mechanicName:mechanic.name||null,stage:mechanic.stage?.name||null,abilityName:ability.name||null});map.set(id,rows);}
  return map;
}
function annotate(row,official){const matches=official.get(Number(row.abilityId))||[],fallback=/^Ability \d+$/.test(String(row?.name||''))?matches.find(x=>x.abilityName)?.abilityName:null;return{...row,name:fallback||row.name,officialMechanics:matches};}
function playerRoleMap(telemetry){const map=new Map();for(const p of telemetry?.players||[]){if(p?.name)map.set(String(p.name).toLowerCase(),p.role||null);}return map;}
function topPlayerPressure(table,telemetry){
  const roles=playerRoleMap(telemetry);return tableEntries(table).map(row=>({actorId:finite(row?.id)?Number(row.id):null,name:row?.name||null,totalDamage:Number(row?.total||0),role:roles.get(String(row?.name||'').toLowerCase())||null})).filter(row=>row.totalDamage>0).sort((a,b)=>b.totalDamage-a.totalDamage).slice(0,6);
}
function deathStory(latest){
  const rows=(latest?.meaningfulDeathTimeline?.length?latest.meaningfulDeathTimeline:latest?.rawDeathTimeline)||[],first=rows[0]||latest?.firstDeath||null,firstMs=finite(latest?.firstDeathMs)?Number(latest.firstDeathMs):finite(first?.fightRelativeMs)?Number(first.fightRelativeMs):null,duration=finite(latest?.durationMs)?Number(latest.durationMs):null;
  const cascade=firstMs==null?0:rows.filter(d=>finite(d?.fightRelativeMs)&&Number(d.fightRelativeMs)>=firstMs&&Number(d.fightRelativeMs)<=firstMs+10000).length;
  return{firstDeath:first?{player:first.player||null,actorId:first.actorId??null,atMs:firstMs,killingBlow:first.killingBlow||null,abilityId:first.abilityId??first.killingBlowId??null,overkill:first.overkill??null}:null,deathCascade10s:cascade,continuedAfterFirstDeathMs:firstMs!=null&&duration!=null?Math.max(0,duration-firstMs):null,meaningfulDeaths:Number(latest?.meaningfulDeaths||0),rawDeaths:Number(latest?.rawDeaths||0),timeline:rows.slice(0,10)};
}
function priorities({latest,wipeStory,incoming,casts,debuffs,interrupts,dispels}){
  const out=[];
  if(wipeStory.firstDeath)out.push({kind:'death-chain',certainty:'observed',title:'First break in the pull',detail:`${wipeStory.firstDeath.player||'A player'} died first${wipeStory.firstDeath.atMs!=null?` at ${Math.round(wipeStory.firstDeath.atMs/1000)}s`:''}${wipeStory.firstDeath.killingBlow?` to ${wipeStory.firstDeath.killingBlow}`:''}. Review this event before assigning mechanic blame.`});
  if(wipeStory.deathCascade10s>=2)out.push({kind:'death-cascade',certainty:'observed',title:'Death cascade after the first loss',detail:`${wipeStory.deathCascade10s} recorded deaths occurred within 10s of the first death.`});
  const top=incoming[0];if(top)out.push({kind:'incoming-pressure',certainty:'observed',title:`Highest incoming pressure: ${top.name}`,detail:`${top.sharePct!=null?top.sharePct.toFixed(1)+'% of mapped incoming damage':''}${top.officialMechanics?.[0]?.mechanicName?` · official mechanic: ${top.officialMechanics[0].mechanicName}`:''}. Presence/damage does not by itself prove a player failure.`});
  const topCast=casts[0];if(topCast)out.push({kind:'cast-pressure',certainty:'observed',title:`Cast pressure: ${topCast.name}`,detail:`${topCast.count} observed cast${topCast.count===1?'':'s'} in the latest pull · ${interrupts} friendly interrupt event${interrupts===1?'':'s'} recorded overall for the pull. Verify assignments only where this cast is actually interruptible.`});
  const topDebuff=debuffs[0];if(topDebuff)out.push({kind:'debuff-pressure',certainty:'observed',title:`Debuff pressure: ${topDebuff.name}`,detail:`${topDebuff.count} apply/refresh event${topDebuff.count===1?'':'s'} · ${dispels} friendly dispel event${dispels===1?'':'s'} recorded in the pull. Counts are descriptive, not a missed-dispel verdict.`});
  if(latest&&finite(latest.fightPercentage))out.push({kind:'progress',certainty:'observed',title:'Progress checkpoint',detail:`Pull ended at ${Number(latest.fightPercentage).toFixed(1)}% remaining · stage ${latest.stageCount||'—'}.`});
  return out.slice(0,5);
}

export async function getLiveRlDiagnosticV1({reportCode,encounterId,difficulty,telemetry}={}){
  const latest=telemetry?.pullIntelligence?.latest;if(!latest?.fightId)return null;
  const fightId=Number(latest.fightId),[raw,knowledge]=await Promise.all([
    wclGraphql(LIVE_RL_DIAGNOSTIC_QUERY,{code:reportCode,fight:[fightId]}),
    loadMechanicKnowledgeViewV1({encounterId:Number(encounterId),difficulty:Number(difficulty),partition:0}).catch(()=>null),
  ]);
  const report=raw?.reportData?.report||{},official=officialAbilityMap(knowledge),damageTable=report.currentDamageTaken;
  const abilities=abilityBreakdown(damageTable).filter(a=>Number(a.total)>0&&Number(a.id)!==1&&String(a.name||'').toLowerCase()!=='melee').sort((a,b)=>Number(b.total)-Number(a.total));
  const totalIncoming=abilities.reduce((sum,row)=>sum+Number(row.total||0),0);
  const incoming=abilities.slice(0,8).map(row=>annotate({abilityId:row.id,name:row.name,totalDamage:Number(row.total||0),sharePct:pct(Number(row.total||0),totalIncoming),rawCount:Number(row.count||0)},official));
  const uniqueCastEvents=uniqueCasts(paginatorEvents(report.currentEnemyCasts)),allCasts=groupAbilities(uniqueCastEvents),casts=allCasts.slice(0,8).map(row=>annotate(row,official));
  const debuffEvents=paginatorEvents(report.currentDebuffs).filter(e=>['applydebuff','applydebuffstack','refreshdebuff'].includes(eventType(e))),allDebuffs=groupAbilities(debuffEvents),debuffs=allDebuffs.slice(0,8).map(row=>annotate(row,official));
  const interrupts=paginatorEvents(report.currentInterrupts),dispels=paginatorEvents(report.currentDispels),wipeStory=deathStory(latest),playerPressure=topPlayerPressure(damageTable,telemetry);
  const result={version:LIVE_RL_DIAGNOSTIC_VERSION,generatedAt:Date.now(),scope:{reportCode,encounterId:Number(encounterId),difficulty:Number(difficulty),fightId},pull:{pullNumber:latest.pullNumber,kill:Boolean(latest.kill),fightPercentage:latest.fightPercentage??null,durationMs:latest.durationMs??null,stageCount:latest.stageCount??null},wipeStory,incomingPressure:{totalMappedDamage:totalIncoming,topAbilities:incoming},castPressure:{enemyCasts:casts,totalUniqueCasts:uniqueCastEvents.length,uniqueCastAbilities:allCasts.length},debuffPressure:{topDebuffs:debuffs,totalDebuffEvents:debuffEvents.length,uniqueDebuffs:allDebuffs.length},control:{interrupts:interrupts.length,dispels:dispels.length},playerPressure,reviewPriorities:priorities({latest,wipeStory,incoming,casts,debuffs,interrupts:interrupts.length,dispels:dispels.length}),officialKnowledge:{available:Boolean(knowledge?.bossKnowledge?.officialMechanics?.length),mechanics:Number(knowledge?.bossKnowledge?.officialMechanics?.length||0),networkExecuted:false},pagesIncomplete:{enemyCasts:Boolean(report.currentEnemyCasts?.nextPageTimestamp),interrupts:Boolean(report.currentInterrupts?.nextPageTimestamp),dispels:Boolean(report.currentDispels?.nextPageTimestamp),debuffs:Boolean(report.currentDebuffs?.nextPageTimestamp)},evidenceContract:{selectedPullExact:true,sameDifficultyOnly:true,objectiveObservedFactsOnly:true,noMechanicBlameWithoutClassifier:true,noMissedInterruptInference:true,noMissedDispelInference:true,officialMappingIsSemanticContextNotCausality:true,topListsDoNotDefineTotals:true}};
  return result;
}
