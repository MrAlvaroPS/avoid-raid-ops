import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { LIVE_RL_DIAGNOSTIC_QUERY } from '../wcl/queries/live-rl-diagnostic.mjs';
import { paginatorEvents,eventAbilityId,eventAbilityName,eventSourceId,eventTargetId } from '../wcl/normalization/events.mjs';
import { abilityBreakdown,tableEntries } from '../wcl/normalization/tables.mjs';
import { loadMechanicKnowledgeViewV1 } from '../services/mechanic-knowledge-view-service.mjs';

export const LIVE_RL_DIAGNOSTIC_VERSION='live-rl-diagnostic-v2';
const finite=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v));
const cleanName=v=>String(v||'').trim()||null;
const eventType=e=>String(e?.type||'').toLowerCase();
const pct=(part,total)=>total>0?100*part/total:null;
const opaqueName=v=>/^Ability\s+\d+$/i.test(String(v||''))||String(v||'').toLowerCase()==='unknown';
const mapped=row=>Boolean(row?.officialMechanics?.length);

function uniqueCasts(events=[]){
  const rows=[...events].filter(e=>eventType(e)==='begincast'||eventType(e)==='cast').sort((a,b)=>Number(a.timestamp||0)-Number(b.timestamp||0));
  const preferred=rows.some(e=>eventType(e)==='begincast')?rows.filter(e=>eventType(e)==='begincast'):rows.filter(e=>eventType(e)==='cast');
  const last=new Map(),out=[];
  for(const e of preferred){const key=`${eventSourceId(e)??'s'}:${eventAbilityId(e)??eventAbilityName(e)??'a'}`,ts=Number(e.timestamp||0),prev=last.get(key);if(prev==null||ts-prev>750){out.push(e);last.set(key,ts);}}
  return out;
}
function groupAbilities(events=[]){
  const map=new Map();
  for(const e of events){const id=eventAbilityId(e),name=cleanName(eventAbilityName(e))||(id!=null?`Ability ${id}`:'Unknown'),key=String(id??name),row=map.get(key)||{abilityId:id,name,count:0,firstTimestamp:null,targets:new Set(),sources:new Set()};row.count++;const ts=finite(e?.timestamp)?Number(e.timestamp):null;if(ts!=null&&(row.firstTimestamp==null||ts<row.firstTimestamp))row.firstTimestamp=ts;const target=eventTargetId(e),source=eventSourceId(e);if(target!=null)row.targets.add(Number(target));if(source!=null)row.sources.add(Number(source));map.set(key,row);}
  return [...map.values()].map(row=>({...row,uniqueTargets:row.targets.size,uniqueSources:row.sources.size,targets:undefined,sources:undefined})).sort((a,b)=>b.count-a.count||String(a.name).localeCompare(String(b.name)));
}
function officialAbilityMap(view){
  const map=new Map();
  for(const mechanic of view?.bossKnowledge?.officialMechanics||[])for(const ability of mechanic.abilities||[]){const id=Number(ability.abilityId);if(!Number.isInteger(id)||id<=0)continue;const rows=map.get(id)||[];rows.push({mechanicKey:mechanic.key||null,mechanicName:mechanic.name||null,stage:mechanic.stage?.name||null,abilityName:ability.name||null});map.set(id,rows);}
  return map;
}
function annotate(row,official){const matches=official.get(Number(row.abilityId))||[],fallback=opaqueName(row?.name)?matches.find(x=>x.abilityName)?.abilityName:null;return{...row,name:fallback||row.name,officialMechanics:matches};}
function playerRoleMap(telemetry){const map=new Map();for(const p of telemetry?.players||[]){if(p?.name)map.set(String(p.name).toLowerCase(),p.role||null);}return map;}
function playerPressure(table,telemetry){
  const roles=playerRoleMap(telemetry),rows=tableEntries(table).map(row=>({actorId:finite(row?.id)?Number(row.id):null,name:row?.name||null,totalDamage:Number(row?.total||0),role:roles.get(String(row?.name||'').toLowerCase())||null})).filter(row=>row.totalDamage>0).sort((a,b)=>b.totalDamage-a.totalDamage);
  return{nonTanks:rows.filter(row=>String(row.role||'').toUpperCase()!=='TANK').slice(0,6),tanks:rows.filter(row=>String(row.role||'').toUpperCase()==='TANK').slice(0,3),all:rows.slice(0,8)};
}
function deathStory(latest){
  const rows=(latest?.meaningfulDeathTimeline?.length?latest.meaningfulDeathTimeline:latest?.rawDeathTimeline)||[],first=rows[0]||latest?.firstDeath||null,firstMs=finite(latest?.firstDeathMs)?Number(latest.firstDeathMs):finite(first?.fightRelativeMs)?Number(first.fightRelativeMs):null,duration=finite(latest?.durationMs)?Number(latest.durationMs):null;
  const cascade=firstMs==null?0:rows.filter(d=>finite(d?.fightRelativeMs)&&Number(d.fightRelativeMs)>=firstMs&&Number(d.fightRelativeMs)<=firstMs+10000).length;
  return{firstDeath:first?{player:first.player||null,actorId:first.actorId??null,atMs:firstMs,killingBlow:first.killingBlow||null,abilityId:first.abilityId??first.killingBlowId??null,overkill:first.overkill??null}:null,deathCascade10s:cascade,continuedAfterFirstDeathMs:firstMs!=null&&duration!=null?Math.max(0,duration-firstMs):null,meaningfulDeaths:Number(latest?.meaningfulDeaths||0),rawDeaths:Number(latest?.rawDeaths||0),timeline:rows.slice(0,10)};
}
function relevantIncoming(rows=[]){return rows.filter(row=>mapped(row)||(!opaqueName(row.name)&&Number(row.sharePct||0)>=8)).sort((a,b)=>(mapped(b)?1:0)-(mapped(a)?1:0)||Number(b.sharePct||0)-Number(a.sharePct||0));}
function relevantCasts(rows=[]){return rows.filter(row=>mapped(row)||(!opaqueName(row.name)&&Number(row.count||0)>=2)).sort((a,b)=>(mapped(b)?1:0)-(mapped(a)?1:0)||Number(b.count||0)-Number(a.count||0));}
function relevantDebuffs(rows=[]){return rows.filter(row=>mapped(row)||(!opaqueName(row.name)&&Number(row.uniqueTargets||0)>=2)).sort((a,b)=>(mapped(b)?1:0)-(mapped(a)?1:0)||Number(b.uniqueTargets||0)-Number(a.uniqueTargets||0)||Number(b.count||0)-Number(a.count||0));}
function mechanicContext(row){return row?.officialMechanics?.[0]?.mechanicName||null;}
function rlSummary({latest,wipeStory,incoming,casts,debuffs,interrupts,dispels}){
  const kill=Boolean(latest?.kill),priorities=[],facts=[];
  facts.push(kill?{label:'RESULT',value:'BOSS KILLED'}:{label:'PROGRESS',value:finite(latest?.fightPercentage)?`${Number(latest.fightPercentage).toFixed(1)}% remaining`:'Wipe'});
  if(wipeStory.firstDeath)facts.push({label:'FIRST BREAK',value:`${wipeStory.firstDeath.player||'Player'} · ${Math.round(Number(wipeStory.firstDeath.atMs||0)/1000)}s${wipeStory.firstDeath.killingBlow?` · ${wipeStory.firstDeath.killingBlow}`:''}`});
  if(wipeStory.deathCascade10s>=2)facts.push({label:'CASCADE',value:`${wipeStory.deathCascade10s} deaths within 10s`});
  const topIncoming=incoming[0]||null,topCast=casts[0]||null,topDebuff=debuffs[0]||null;
  if(!kill&&wipeStory.firstDeath)priorities.push({kind:'death-chain',certainty:'observed',title:'Start with the first death',detail:`Review ${wipeStory.firstDeath.player||'the first player'} at ${Math.round(Number(wipeStory.firstDeath.atMs||0)/1000)}s${wipeStory.firstDeath.killingBlow?` (${wipeStory.firstDeath.killingBlow})`:''}. ${wipeStory.deathCascade10s>=2?`${wipeStory.deathCascade10s} deaths followed inside 10s, so this is the first place to inspect.`:'Do not assign mechanic blame until the event is mapped.'}`});
  if(!kill&&topIncoming)priorities.push({kind:'mechanic-pressure',certainty:mapped(topIncoming)?'official-context':'observed',title:`Review ${mechanicContext(topIncoming)||topIncoming.name}`,detail:`${Number(topIncoming.sharePct||0).toFixed(1)}% of mapped incoming damage in this pull${mechanicContext(topIncoming)?` · official mechanic: ${mechanicContext(topIncoming)}`:''}. This is a pressure signal, not automatic blame.`});
  if(!kill&&topCast&&priorities.length<3)priorities.push({kind:'cast-plan',certainty:mapped(topCast)?'official-context':'observed',title:`Check the cast plan for ${mechanicContext(topCast)||topCast.name}`,detail:`${topCast.count} observed casts${mechanicContext(topCast)?` · official mechanic: ${mechanicContext(topCast)}`:''}. ${interrupts} friendly interrupt events were recorded overall; Iris does not infer missed interrupts without cast-specific proof.`});
  if(!kill&&topDebuff&&priorities.length<3)priorities.push({kind:'debuff-plan',certainty:mapped(topDebuff)?'official-context':'observed',title:`Check debuff handling for ${mechanicContext(topDebuff)||topDebuff.name}`,detail:`${topDebuff.uniqueTargets||0} players affected · ${topDebuff.count} apply/refresh events${mechanicContext(topDebuff)?` · official mechanic: ${mechanicContext(topDebuff)}`:''}. ${dispels} friendly dispel events were recorded overall.`});
  if(kill)priorities.push({kind:'cleared',certainty:'observed',title:'Encounter cleared',detail:'No next-pull instruction is generated. Use the evidence below only for learning and future difficulty preparation.'});
  return{status:kill?'cleared':priorities.length?'review':'insufficient-signal',headline:kill?'Boss killed':priorities[0]?.title||'No high-value RL signal yet',facts,priorities:priorities.slice(0,3),suppressed:{incomingRows:Math.max(0,Number(incoming._rawCount||0)-incoming.length),castRows:Math.max(0,Number(casts._rawCount||0)-casts.length),debuffRows:Math.max(0,Number(debuffs._rawCount||0)-debuffs.length)},contract:{maxPriorities:3,rawTelemetryIsEvidenceNotBrief:true,opaqueAbilityIdsSuppressedUnlessOfficiallyMapped:true,tankDamageNotUsedAsPrimaryPlayerHotspot:true}};
}

export async function getLiveRlDiagnosticV1({reportCode,encounterId,difficulty,telemetry}={}){
  const latest=telemetry?.pullIntelligence?.latest;if(!latest?.fightId)return null;
  const fightId=Number(latest.fightId),[raw,knowledge]=await Promise.all([
    wclGraphql(LIVE_RL_DIAGNOSTIC_QUERY,{code:reportCode,fight:[fightId]}),
    loadMechanicKnowledgeViewV1({encounterId:Number(encounterId),difficulty:Number(difficulty),partition:0}).catch(()=>null),
  ]);
  const report=raw?.reportData?.report||{},official=officialAbilityMap(knowledge),damageTable=report.currentDamageTaken;
  const abilities=abilityBreakdown(damageTable).filter(a=>Number(a.total)>0&&Number(a.id)!==1&&String(a.name||'').toLowerCase()!=='melee').sort((a,b)=>Number(b.total)-Number(a.total));
  const totalIncoming=abilities.reduce((sum,row)=>sum+Number(row.total||0),0),allIncoming=abilities.map(row=>annotate({abilityId:row.id,name:row.name,totalDamage:Number(row.total||0),sharePct:pct(Number(row.total||0),totalIncoming),rawCount:Number(row.count||0)},official));
  const incoming=relevantIncoming(allIncoming);incoming._rawCount=allIncoming.length;
  const uniqueCastEvents=uniqueCasts(paginatorEvents(report.currentEnemyCasts)),allCastRows=groupAbilities(uniqueCastEvents).map(row=>annotate(row,official)),casts=relevantCasts(allCastRows);casts._rawCount=allCastRows.length;
  const debuffEvents=paginatorEvents(report.currentDebuffs).filter(e=>['applydebuff','applydebuffstack','refreshdebuff'].includes(eventType(e))),allDebuffRows=groupAbilities(debuffEvents).map(row=>annotate(row,official)),debuffs=relevantDebuffs(allDebuffRows);debuffs._rawCount=allDebuffRows.length;
  const interrupts=paginatorEvents(report.currentInterrupts),dispels=paginatorEvents(report.currentDispels),wipeStory=deathStory(latest),pressure=playerPressure(damageTable,telemetry),summary=rlSummary({latest,wipeStory,incoming,casts,debuffs,interrupts:interrupts.length,dispels:dispels.length});
  return{version:LIVE_RL_DIAGNOSTIC_VERSION,generatedAt:Date.now(),scope:{reportCode,encounterId:Number(encounterId),difficulty:Number(difficulty),fightId},pull:{pullNumber:latest.pullNumber,kill:Boolean(latest.kill),fightPercentage:latest.fightPercentage??null,durationMs:latest.durationMs??null,stageCount:latest.stageCount??null},rlSummary:summary,wipeStory,incomingPressure:{totalMappedDamage:totalIncoming,topAbilities:incoming.slice(0,6),rawAbilityRows:allIncoming.length,suppressedRows:Math.max(0,allIncoming.length-incoming.length)},castPressure:{enemyCasts:casts.slice(0,6),totalUniqueCasts:uniqueCastEvents.length,uniqueCastAbilities:allCastRows.length,suppressedAbilities:Math.max(0,allCastRows.length-casts.length)},debuffPressure:{topDebuffs:debuffs.slice(0,6),totalDebuffEvents:debuffEvents.length,uniqueDebuffs:allDebuffRows.length,suppressedDebuffs:Math.max(0,allDebuffRows.length-debuffs.length)},control:{interrupts:interrupts.length,dispels:dispels.length},playerPressure:pressure.nonTanks,playerPressureContext:{nonTanks:pressure.nonTanks,tanks:pressure.tanks},reviewPriorities:summary.priorities,officialKnowledge:{available:Boolean(knowledge?.bossKnowledge?.officialMechanics?.length),mechanics:Number(knowledge?.bossKnowledge?.officialMechanics?.length||0),networkExecuted:false},pagesIncomplete:{enemyCasts:Boolean(report.currentEnemyCasts?.nextPageTimestamp),interrupts:Boolean(report.currentInterrupts?.nextPageTimestamp),dispels:Boolean(report.currentDispels?.nextPageTimestamp),debuffs:Boolean(report.currentDebuffs?.nextPageTimestamp)},evidenceContract:{selectedPullExact:true,sameDifficultyOnly:true,objectiveObservedFactsOnly:true,noMechanicBlameWithoutClassifier:true,noMissedInterruptInference:true,noMissedDispelInference:true,officialMappingIsSemanticContextNotCausality:true,topListsDoNotDefineTotals:true,rawTelemetryIsNotTheRlBrief:true,opaqueUnmappedAbilityIdsSuppressedFromPriority:true,tankPressureSeparatedFromRaidHotspots:true}};
}