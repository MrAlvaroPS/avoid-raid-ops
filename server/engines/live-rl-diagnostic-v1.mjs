import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { LIVE_RL_DIAGNOSTIC_QUERY } from '../wcl/queries/live-rl-diagnostic.mjs';
import { paginatorEvents,eventAbilityId,eventAbilityName,eventSourceId,eventTargetId } from '../wcl/normalization/events.mjs';
import { abilityBreakdown,tableEntries } from '../wcl/normalization/tables.mjs';
import { loadMechanicKnowledgeViewV1 } from '../services/mechanic-knowledge-view-service.mjs';
import { loadOperationalEncounterModelV2 } from '../corpus/service-v2.mjs';

export const LIVE_RL_DIAGNOSTIC_VERSION='live-rl-diagnostic-v4';
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
function telemetryPull(telemetry,fightId){
  const pulls=telemetry?.pullIntelligence?.pulls||[];if(finite(fightId)){const exact=pulls.find(p=>Number(p.fightId)===Number(fightId));if(exact)return exact;}return telemetry?.pullIntelligence?.latest||pulls.at(-1)||null;
}
function reportPull(report,{fightId,encounterId,difficulty}){
  const scope=(report?.fights||[]).filter(f=>Number(f.encounterID)===Number(encounterId)&&Number(f.difficulty)===Number(difficulty)&&!f.inProgress).sort((a,b)=>Number(a.startTime||0)-Number(b.startTime||0)||Number(a.id||0)-Number(b.id||0));
  const fight=scope.find(f=>Number(f.id)===Number(fightId));if(!fight)return null;
  return{fightId:Number(fight.id),pullNumber:scope.findIndex(f=>Number(f.id)===Number(fight.id))+1,kill:Boolean(fight.kill),fightPercentage:finite(fight.fightPercentage)?Number(fight.fightPercentage):null,bossPercentage:finite(fight.bossPercentage)?Number(fight.bossPercentage):null,durationMs:Math.max(0,Number(fight.endTime||0)-Number(fight.startTime||0)),stageCount:null,startTime:Number(fight.startTime||0),endTime:Number(fight.endTime||0)};
}
function reportDeaths(report,pull){
  const actors=new Map((report?.masterData?.actors||[]).map(a=>[Number(a.id),a]));const start=Number(pull?.startTime||0);
  return paginatorEvents(report?.currentDeaths).map(e=>{const actorId=eventTargetId(e)??eventSourceId(e),actor=actors.get(Number(actorId)),timestamp=finite(e?.timestamp)?Number(e.timestamp):null;return{actorId:actorId??null,player:actor?.name||null,fightRelativeMs:timestamp!=null?Math.max(0,timestamp-start):null,killingBlow:null,abilityId:eventAbilityId(e)??null,overkill:finite(e?.overkill)?Number(e.overkill):null};}).filter(row=>row.actorId!=null||row.player).sort((a,b)=>Number(a.fightRelativeMs||0)-Number(b.fightRelativeMs||0));
}
function deathStory(pull,report){
  let rows=(pull?.meaningfulDeathTimeline?.length?pull.meaningfulDeathTimeline:pull?.rawDeathTimeline)||[];if(!rows.length)rows=reportDeaths(report,pull);
  const first=rows[0]||pull?.firstDeath||null,firstMs=finite(pull?.firstDeathMs)?Number(pull.firstDeathMs):finite(first?.fightRelativeMs)?Number(first.fightRelativeMs):null,duration=finite(pull?.durationMs)?Number(pull.durationMs):null;
  const cascade=firstMs==null?0:rows.filter(d=>finite(d?.fightRelativeMs)&&Number(d.fightRelativeMs)>=firstMs&&Number(d.fightRelativeMs)<=firstMs+10000).length;
  return{firstDeath:first?{player:first.player||null,actorId:first.actorId??null,atMs:firstMs,killingBlow:first.killingBlow||null,abilityId:first.abilityId??first.killingBlowId??null,overkill:first.overkill??null}:null,deathCascade10s:cascade,continuedAfterFirstDeathMs:firstMs!=null&&duration!=null?Math.max(0,duration-firstMs):null,meaningfulDeaths:Number(pull?.meaningfulDeaths??rows.length??0),rawDeaths:Number(pull?.rawDeaths??rows.length??0),timeline:rows.slice(0,10)};
}
function benchmarkMap(reference){return new Map((reference?.operationalReference?.benchmark?.abilities||[]).map(row=>[Number(row.abilityId),row]));}
function band(current,dist){if(!finite(current)||!dist)return null;const x=Number(current);if(finite(dist.p95)&&x>Number(dist.p95))return'above-p95';if(finite(dist.p90)&&x>Number(dist.p90))return'above-p90';if(finite(dist.p75)&&x>Number(dist.p75))return'above-p75';if(finite(dist.p25)&&x<Number(dist.p25))return'below-p25';return'typical';}
function globalComparison(bench,metric,pull,currentCount){
  const cohort=pull?.kill?'kill':'wipe',row=bench?.metrics?.[metric]?.[cohort];if(!row||!finite(currentCount))return null;
  const durationMinutes=finite(pull?.durationMs)&&Number(pull.durationMs)>0?Number(pull.durationMs)/60000:null,unit=pull?.kill?'perPull':'perMinute',current=unit==='perPull'?Number(currentCount):(durationMinutes?Number(currentCount)/durationMinutes:null),dist=row?.reportNormalized?.[unit],b=band(current,dist),mean=unit==='perPull'?row.meanPerPull:row.meanPerMinute;
  if(!finite(current)||!dist)return null;
  return{cohort,unit:unit==='perPull'?'per-pull':'per-minute',current,mean:finite(mean)?Number(mean):null,band:b,reports:Number(row.reports||dist.n||0),pulls:Number(row.pulls||0),p25:dist.p25??null,p50:dist.p50??null,p75:dist.p75??null,p90:dist.p90??null,p95:dist.p95??null,semantics:pull?.kill?'Compared with canonical same-difficulty GLOBAL kill report rates.':'Compared by rate/minute with canonical same-difficulty GLOBAL wipes to reduce wipe-depth bias.'};
}
function withGlobal(row,benchmarks,metric,pull,currentCount){const bench=benchmarks.get(Number(row.abilityId));return{...row,global:globalComparison(bench,metric,pull,currentCount)};}
const anomalyRank=row=>row?.global?.band==='above-p95'?4:row?.global?.band==='above-p90'?3:row?.global?.band==='above-p75'?2:row?.global?.band==='below-p25'?1:0;
function relevantIncoming(rows=[]){return rows.filter(row=>mapped(row)||anomalyRank(row)>=2||(!opaqueName(row.name)&&Number(row.sharePct||0)>=8)).sort((a,b)=>anomalyRank(b)-anomalyRank(a)||(mapped(b)?1:0)-(mapped(a)?1:0)||Number(b.sharePct||0)-Number(a.sharePct||0));}
function relevantCasts(rows=[]){return rows.filter(row=>mapped(row)||anomalyRank(row)>=2||(!opaqueName(row.name)&&Number(row.count||0)>=2)).sort((a,b)=>anomalyRank(b)-anomalyRank(a)||(mapped(b)?1:0)-(mapped(a)?1:0)||Number(b.count||0)-Number(a.count||0));}
function relevantDebuffs(rows=[]){return rows.filter(row=>mapped(row)||(!opaqueName(row.name)&&Number(row.uniqueTargets||0)>=2)).sort((a,b)=>(mapped(b)?1:0)-(mapped(a)?1:0)||Number(b.uniqueTargets||0)-Number(a.uniqueTargets||0)||Number(b.count||0)-Number(a.count||0));}
function mechanicContext(row){return row?.officialMechanics?.[0]?.mechanicName||null;}
function globalPhrase(row){const g=row?.global;if(!g)return null;const label=g.band==='above-p95'?'above GLOBAL P95':g.band==='above-p90'?'above GLOBAL P90':g.band==='above-p75'?'above GLOBAL P75':g.band==='below-p25'?'below GLOBAL P25':'within the GLOBAL middle range';const mean=finite(g.mean)?` · GLOBAL mean ${Number(g.mean).toFixed(1)} ${g.unit}`:'';return`${label}${mean} · ${g.reports} canonical Deep reports`;}
function anomalyRows(rows=[]){return rows.filter(row=>anomalyRank(row)>=3).sort((a,b)=>anomalyRank(b)-anomalyRank(a));}
function rlSummary({pull,wipeStory,incoming,casts,debuffs,interrupts,dispels,globalReference}){
  const kill=Boolean(pull?.kill),priorities=[],facts=[];
  facts.push(kill?{label:'RESULT',value:'BOSS KILLED'}:{label:'PROGRESS',value:finite(pull?.fightPercentage)?`${Number(pull.fightPercentage).toFixed(1)}% remaining`:'Wipe'});
  if(wipeStory.firstDeath)facts.push({label:'FIRST BREAK',value:`${wipeStory.firstDeath.player||'Player'} · ${Math.round(Number(wipeStory.firstDeath.atMs||0)/1000)}s${wipeStory.firstDeath.killingBlow?` · ${wipeStory.firstDeath.killingBlow}`:''}`});
  if(wipeStory.deathCascade10s>=2)facts.push({label:'CASCADE',value:`${wipeStory.deathCascade10s} deaths within 10s`});
  const incomingAnomaly=anomalyRows(incoming)[0]||null,castAnomaly=anomalyRows(casts)[0]||null,topIncoming=incoming[0]||null,topCast=casts[0]||null,topDebuff=debuffs[0]||null;
  if(!kill&&wipeStory.firstDeath)priorities.push({kind:'death-chain',certainty:'observed',title:'Start with the first death',detail:`Review ${wipeStory.firstDeath.player||'the first player'} at ${Math.round(Number(wipeStory.firstDeath.atMs||0)/1000)}s${wipeStory.firstDeath.killingBlow?` (${wipeStory.firstDeath.killingBlow})`:''}. ${wipeStory.deathCascade10s>=2?`${wipeStory.deathCascade10s} deaths followed inside 10s, so this is the first place to inspect.`:'Do not assign mechanic blame until the event is mapped.'}`});
  const pressurePick=incomingAnomaly||topIncoming;if(pressurePick&&priorities.length<3)priorities.push({kind:'global-pressure',certainty:mapped(pressurePick)?'official-context':'observed',title:`${incomingAnomaly?'GLOBAL outlier':'Review'}: ${mechanicContext(pressurePick)||pressurePick.name}`,detail:`${Number(pressurePick.sharePct||0).toFixed(1)}% of mapped incoming damage${globalPhrase(pressurePick)?` · ${globalPhrase(pressurePick)}`:''}${mechanicContext(pressurePick)?` · official mechanic: ${mechanicContext(pressurePick)}`:''}. This is an exposure signal, not automatic blame.`});
  const castPick=castAnomaly||topCast;if(castPick&&priorities.length<3)priorities.push({kind:'global-cast-plan',certainty:mapped(castPick)?'official-context':'observed',title:`${castAnomaly?'GLOBAL cast outlier':'Check cast plan'}: ${mechanicContext(castPick)||castPick.name}`,detail:`${castPick.count} observed casts${globalPhrase(castPick)?` · ${globalPhrase(castPick)}`:''}${mechanicContext(castPick)?` · official mechanic: ${mechanicContext(castPick)}`:''}. ${interrupts} friendly interrupt events were recorded overall; no missed-interrupt verdict is inferred.`});
  if(!kill&&topDebuff&&priorities.length<3)priorities.push({kind:'debuff-plan',certainty:mapped(topDebuff)?'official-context':'observed',title:`Check debuff handling: ${mechanicContext(topDebuff)||topDebuff.name}`,detail:`${topDebuff.uniqueTargets||0} players affected · ${topDebuff.count} apply/refresh events${mechanicContext(topDebuff)?` · official mechanic: ${mechanicContext(topDebuff)}`:''}. ${dispels} friendly dispel events were recorded overall.`});
  if(kill&&!priorities.length)priorities.push({kind:'cleared',certainty:'observed',title:'Encounter cleared cleanly against the available GLOBAL signals',detail:'No same-difficulty GLOBAL P90+ exposure signal was found in the mapped damage/cast evidence. This is not proof of perfect execution.'});
  return{status:kill?'cleared':priorities.length?'review':'insufficient-signal',headline:kill?'Boss killed · GLOBAL review':priorities[0]?.title||'No high-value RL signal yet',facts,priorities:priorities.slice(0,3),globalReference:{available:Boolean(globalReference?.operationalReference?.benchmark),deepPulls:Number(globalReference?.operationalReference?.benchmark?.deepPulls||0),killPulls:Number(globalReference?.operationalReference?.benchmark?.killPulls||0),wipePulls:Number(globalReference?.operationalReference?.benchmark?.wipePulls||0),sameDifficultyOnly:true},suppressed:{incomingRows:Math.max(0,Number(incoming._rawCount||0)-incoming.length),castRows:Math.max(0,Number(casts._rawCount||0)-casts.length),debuffRows:Math.max(0,Number(debuffs._rawCount||0)-debuffs.length)},contract:{maxPriorities:3,globalOutlierIsNotFailure:true,rawTelemetryIsEvidenceNotBrief:true,opaqueAbilityIdsSuppressedUnlessOfficiallyMapped:true,tankDamageNotUsedAsPrimaryPlayerHotspot:true}};
}

export async function getLiveRlDiagnosticV1({reportCode,encounterId,difficulty,telemetry=null,fightId=null}={}){
  const fromTelemetry=telemetryPull(telemetry,fightId),selectedFightId=Number(fightId??fromTelemetry?.fightId);if(!Number.isInteger(selectedFightId)||selectedFightId<=0)return null;
  const [raw,knowledge,globalReference]=await Promise.all([
    wclGraphql(LIVE_RL_DIAGNOSTIC_QUERY,{code:reportCode,fight:[selectedFightId]}),
    loadMechanicKnowledgeViewV1({encounterId:Number(encounterId),difficulty:Number(difficulty),partition:0}).catch(()=>null),
    loadOperationalEncounterModelV2({encounterId:Number(encounterId),difficulty:Number(difficulty),partition:0}).catch(()=>null),
  ]);
  const report=raw?.reportData?.report||{},pull=fromTelemetry||reportPull(report,{fightId:selectedFightId,encounterId,difficulty});if(!pull)throw new Error('Selected fight is not a completed pull in the requested boss+difficulty scope');
  const official=officialAbilityMap(knowledge),benchmarks=benchmarkMap(globalReference),damageTable=report.currentDamageTaken;
  const abilities=abilityBreakdown(damageTable).filter(a=>Number(a.total)>0&&Number(a.id)!==1&&String(a.name||'').toLowerCase()!=='melee').sort((a,b)=>Number(b.total)-Number(a.total));
  const totalIncoming=abilities.reduce((sum,row)=>sum+Number(row.total||0),0),allIncoming=abilities.map(row=>withGlobal(annotate({abilityId:row.id,name:row.name,totalDamage:Number(row.total||0),sharePct:pct(Number(row.total||0),totalIncoming),rawCount:Number(row.count||0)},official),benchmarks,'damageHits',pull,Number(row.count||0)));
  const incoming=relevantIncoming(allIncoming);incoming._rawCount=allIncoming.length;
  const uniqueCastEvents=uniqueCasts(paginatorEvents(report.currentEnemyCasts)),allCastRows=groupAbilities(uniqueCastEvents).map(row=>withGlobal(annotate(row,official),benchmarks,'casts',pull,row.count)),casts=relevantCasts(allCastRows);casts._rawCount=allCastRows.length;
  const debuffEvents=paginatorEvents(report.currentDebuffs).filter(e=>['applydebuff','applydebuffstack','refreshdebuff'].includes(eventType(e))),allDebuffRows=groupAbilities(debuffEvents).map(row=>annotate(row,official)),debuffs=relevantDebuffs(allDebuffRows);debuffs._rawCount=allDebuffRows.length;
  const interrupts=paginatorEvents(report.currentInterrupts),dispels=paginatorEvents(report.currentDispels),wipeStory=deathStory(pull,report),pressure=playerPressure(damageTable,telemetry),summary=rlSummary({pull,wipeStory,incoming,casts,debuffs,interrupts:interrupts.length,dispels:dispels.length,globalReference});
  return{version:LIVE_RL_DIAGNOSTIC_VERSION,generatedAt:Date.now(),scope:{reportCode,encounterId:Number(encounterId),difficulty:Number(difficulty),fightId:selectedFightId},pull:{pullNumber:pull.pullNumber,kill:Boolean(pull.kill),fightPercentage:pull.fightPercentage??null,durationMs:pull.durationMs??null,stageCount:pull.stageCount??null},rlSummary:summary,wipeStory,incomingPressure:{totalMappedDamage:totalIncoming,topAbilities:incoming.slice(0,6),rawAbilityRows:allIncoming.length,suppressedRows:Math.max(0,allIncoming.length-incoming.length)},castPressure:{enemyCasts:casts.slice(0,6),totalUniqueCasts:uniqueCastEvents.length,uniqueCastAbilities:allCastRows.length,suppressedAbilities:Math.max(0,allCastRows.length-casts.length)},debuffPressure:{topDebuffs:debuffs.slice(0,6),totalDebuffEvents:debuffEvents.length,uniqueDebuffs:allDebuffRows.length,suppressedDebuffs:Math.max(0,allDebuffRows.length-debuffs.length)},control:{interrupts:interrupts.length,dispels:dispels.length},playerPressure:pressure.nonTanks,playerPressureContext:{nonTanks:pressure.nonTanks,tanks:pressure.tanks},reviewPriorities:summary.priorities,globalReference:{available:Boolean(globalReference?.operationalReference?.benchmark),version:globalReference?.operationalReference?.benchmark?.version||null,deepPulls:Number(globalReference?.operationalReference?.benchmark?.deepPulls||0),killPulls:Number(globalReference?.operationalReference?.benchmark?.killPulls||0),wipePulls:Number(globalReference?.operationalReference?.benchmark?.wipePulls||0),sameDifficultyOnly:true,networkExecuted:false},officialKnowledge:{available:Boolean(knowledge?.bossKnowledge?.officialMechanics?.length),mechanics:Number(knowledge?.bossKnowledge?.officialMechanics?.length||0),networkExecuted:false},pagesIncomplete:{enemyCasts:Boolean(report.currentEnemyCasts?.nextPageTimestamp),interrupts:Boolean(report.currentInterrupts?.nextPageTimestamp),dispels:Boolean(report.currentDispels?.nextPageTimestamp),debuffs:Boolean(report.currentDebuffs?.nextPageTimestamp),deaths:Boolean(report.currentDeaths?.nextPageTimestamp)},evidenceContract:{selectedPullExact:true,selectedFightId:selectedFightId,sameDifficultyOnly:true,objectiveObservedFactsOnly:true,noMechanicBlameWithoutClassifier:true,noMissedInterruptInference:true,noMissedDispelInference:true,officialMappingIsSemanticContextNotCausality:true,globalBenchmarkIsDescriptiveNotCausal:true,killBenchmarkUsesPerPull:true,wipeBenchmarkUsesPerMinute:true,selectedPullDiagnosticDoesNotRequireFullTelemetry:true,topListsDoNotDefineTotals:true,rawTelemetryIsNotTheRlBrief:true,opaqueUnmappedAbilityIdsSuppressedFromPriority:true,tankPressureSeparatedFromRaidHotspots:true}};
}