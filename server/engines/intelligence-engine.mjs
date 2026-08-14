import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { ENCOUNTER_META_QUERY } from '../wcl/queries/telemetry.mjs';
import { ENCOUNTER_INTELLIGENCE_QUERY,MECHANIC_DAMAGE_PAGE_QUERY,FEATHER_DEBUFF_PAGE_QUERY,FEATHER_BUFF_PAGE_QUERY,idsFilter } from '../wcl/queries/intelligence.mjs';
import { selectEncounter } from '../wcl/normalization/fights.mjs';
import { paginatorEvents,eventTargetId,eventAbilityId,eventSourceId } from '../wcl/normalization/events.mjs';
import { getEncounterRulePack } from '../rule-packs/encounters/registry.mjs';
import { filtersForPack } from '../rule-packs/encounters/filters.mjs';
import { loadPublishedEncounterModel } from '../corpus/service.mjs';
import { analyzeEncounterMechanics } from '../analysis/mechanics/encounter-rule-engine.mjs';
import { buildDeathChains,findCurrentBlocker } from '../analysis/root-cause/death-chains.mjs';
import { getTelemetry } from './telemetry-engine.mjs';
import { splitAnalyticalPulls } from '../analysis/pulls/pull-eligibility.mjs';

const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null;};

function normalizeMeaningfulDeaths(events=[],fights=[],actors=new Map()){
  const byFight={};
  const fightMap=new Map(fights.map(f=>[Number(f.id),f]));
  for(const e of events){
    const fightId=Number(e.fight);const fight=fightMap.get(fightId);if(!fight)continue;
    const actorId=eventTargetId(e),ts=n(e.timestamp);
    const ability=e.ability&&typeof e.ability==='object'?e.ability:null;
    const abilityId=n(e.abilityGameID ?? (typeof e.ability==='number'?e.ability:null) ?? ability?.guid ?? ability?.id);
    const row={
      fightId,actorId:actorId==null?null:Number(actorId),player:actors.get(Number(actorId))?.name||null,
      timestampReportMs:ts,fightRelativeMs:ts==null?null:Math.max(0,ts-Number(fight.startTime||0)),
      killingBlow:ability?.name||e.abilityName||null,killingBlowId:abilityId,overkill:n(e.overkill)
    };
    (byFight[fightId]??=[]).push(row);
  }
  for(const rows of Object.values(byFight))rows.sort((a,b)=>(a.timestampReportMs||0)-(b.timestampReportMs||0));
  return byFight;
}

function enrichMechanicsWithDeaths(mechanics,deathChains){
  const linked=deathChains?.linkedByMechanic||{};
  const firstByMechanic={};
  const byFight=new Map();
  for(const chain of deathChains?.chains||[]){
    if(!byFight.has(Number(chain.fightId)))byFight.set(Number(chain.fightId),[]);
    byFight.get(Number(chain.fightId)).push(chain);
  }
  for(const chains of byFight.values()){
    chains.sort((a,b)=>Number(a.deathAtMs||0)-Number(b.deathAtMs||0));
    const key=chains[0]?.probableCause?.mechanicKey;if(key)firstByMechanic[key]=(firstByMechanic[key]||0)+1;
  }
  return (mechanics||[]).map(m=>({...m,linkedDeaths:Number(linked[m.key]||0),firstDeaths:Number(firstByMechanic[m.key]||0)}));
}

function buildPlayerMatrix({failures=[],deathChains,actors=new Map(),recentFightIds=[]}){
  const recent=new Set(recentFightIds.map(Number));const map=new Map();
  const ensure=id=>{const key=Number(id);if(!map.has(key))map.set(key,{actorId:key,name:actors.get(key)?.name||`Actor ${key}`,failures:0,recentFailures:0,linkedDeaths:0,mechanics:{}});return map.get(key);};
  for(const f of failures){if(f.actorId==null)continue;const row=ensure(f.actorId);row.failures++;if(recent.has(Number(f.fightId)))row.recentFailures++;row.mechanics[f.mechanicKey]=(row.mechanics[f.mechanicKey]||0)+1;}
  for(const c of deathChains?.chains||[]){if(c.actorId==null||!c.probableCause)continue;ensure(c.actorId).linkedDeaths++;}
  return [...map.values()].sort((a,b)=>b.linkedDeaths-a.linkedDeaths||b.recentFailures-a.recentFailures||b.failures-a.failures);
}

function buildNextPullCalls({blocker,mechanics,playerMatrix,pullIntelligence}){
  const calls=[];
  if(blocker?.blocker){
    const detail=mechanics.find(m=>m.key===blocker.blocker.key);
    calls.push({kind:'mechanic',confidence:blocker.confidence||'medium',title:detail?.name||blocker.blocker.name,detail:detail?.expectedAction||'Fix the highest recurring mechanic failure.'});
  }
  const player=playerMatrix.find(p=>p.recentFailures>0&&(p.linkedDeaths>0||p.recentFailures>=2));
  if(player){
    const [key,count]=Object.entries(player.mechanics).sort((a,b)=>b[1]-a[1])[0]||[];const mech=mechanics.find(m=>m.key===key);
    calls.push({kind:'player-focus',confidence:player.linkedDeaths>0?'high':'medium',title:`${player.name} · ${mech?.name||'mechanic execution'}`,detail:`${count||player.recentFailures} player-specific exposure${(count||player.recentFailures)===1?'':'s'} in the classified evidence window${player.linkedDeaths?` · ${player.linkedDeaths} death-linked`:''}.`});
  }
  const gain=pullIntelligence?.currentVsPrevious?.improvements?.[0];
  if(gain){
    calls.push({kind:'preserve-gain',confidence:gain.confidence||'high',title:`Preserve: ${gain.label}`,detail:gain.unit==='ms'?`${Math.abs(Number(gain.delta)||0)/1000}s better than the previous analytical pull.`:gain.unit==='pp'?`${Math.abs(Number(gain.delta)||0).toFixed(1)} percentage points better than the previous analytical pull.`:'Confirmed improvement versus the previous analytical pull.'});
  }
  const second=(blocker?.ranking||[]).find(x=>x.key!==blocker?.blocker?.key&&x.recentFailures>0);
  if(calls.length<3&&second){const detail=mechanics.find(m=>m.key===second.key);calls.push({kind:'secondary-mechanic',confidence:second.linkedDeaths>0?'medium':'low',title:detail?.name||second.name,detail:detail?.expectedAction||`${second.recentFailures} recent failed executions observed.`});}
  return calls.slice(0,3);
}

function eventIdentity(e){
  return [Number(e?.fight)||'',Number(e?.timestamp)||'',eventSourceId(e)??'',eventTargetId(e)??'',eventAbilityId(e)??'',String(e?.type||'')].join(':');
}
function dedupeEvents(events){const map=new Map();for(const e of events||[])map.set(eventIdentity(e),e);return [...map.values()].sort((a,b)=>Number(a.timestamp||0)-Number(b.timestamp||0));}

async function paginateEvents({query,field,initial,vars,maxPages=12}){
  const events=[...paginatorEvents(initial)];let next=initial?.nextPageTimestamp??null,pages=initial?1:0;
  while(next!=null&&pages<maxPages){
    const page=await wclGraphql(query,{...vars,start:Number(next)});const chunk=page?.reportData?.report?.[field];events.push(...paginatorEvents(chunk));const nextPage=chunk?.nextPageTimestamp??null;
    if(nextPage==null||Number(nextPage)<=Number(next)) {next=null;break;} next=nextPage;pages++;
  }
  return{events,next,pages,truncated:next!=null};
}

export async function getEncounterIntelligence({reportCode,encounterId}){
  const meta=await wclGraphql(ENCOUNTER_META_QUERY,{code:reportCode});const report=meta?.reportData?.report;if(!report)return null;
  const selected=selectEncounter(report.fights,encounterId);const rawClosed=selected.filter(f=>!f.inProgress);const initialSplit=splitAnalyticalPulls(rawClosed);const closed=initialSplit.eligible;const encounter=closed.at(-1)||rawClosed.at(-1)||selected.at(-1);
  if(!encounter)return{generatedAt:Date.now(),engineVersion:'3.7.0',status:'no-encounter'};
  if(!closed.length)return{generatedAt:Date.now(),engineVersion:'3.7.0',status:'no-eligible-pulls',encounter:{id:encounter.encounterID,name:encounter.name,pulls:0,rawPulls:rawClosed.length},analysisPopulation:{rawPulls:rawClosed.length,eligiblePulls:0,excludedPulls:initialSplit.excluded,eligibleFightIds:[],policy:'called-wipe/reset pulls remain in WCL history but are excluded from product analytics'},dataTruth:{policy:'real-derived-or-explicit-pending',pullEligibility:'first-class called-wipe/reset exclusion'}};

  const generatedModel=await loadPublishedEncounterModel({encounterId:encounter.encounterID,difficulty:encounter.difficulty||5,partition:0}).catch(()=>null);
  const pack=generatedModel?.pack||getEncounterRulePack(encounter.encounterID);
  const packSource=generatedModel?'generated-wcl-corpus':pack?'manual-fallback':null;
  if(!pack)return{generatedAt:Date.now(),engineVersion:'3.7.0',encounter:{id:encounter.encounterID,name:encounter.name,pulls:closed.length,rawPulls:rawClosed.length},analysisPopulation:{rawPulls:rawClosed.length,eligiblePulls:closed.length,excludedPulls:initialSplit.excluded},status:'no-rule-pack',corpusModel:{status:'missing',action:'Build the encounter corpus from the Mechanics page.'},dataTruth:{policy:'real-derived-or-explicit-pending'}};

  const filters=filtersForPack(pack);const fightIds=closed.map(f=>Number(f.id));
  const raw=await wclGraphql(ENCOUNTER_INTELLIGENCE_QUERY,{code:reportCode,all:fightIds,damageFilter:idsFilter(filters.damage),castFilter:idsFilter(filters.casts),enemyBuffFilter:idsFilter(filters.enemyBuffs),featherFilter:idsFilter(filters.friendlyAuras)});
  const r=raw?.reportData?.report||{};

  const damagePage=await paginateEvents({query:MECHANIC_DAMAGE_PAGE_QUERY,field:'mechanicDamage',initial:r.mechanicDamage,vars:{code:reportCode,all:fightIds,damageFilter:idsFilter(filters.damage)},maxPages:12});
  const debuffPage=await paginateEvents({query:FEATHER_DEBUFF_PAGE_QUERY,field:'feather',initial:r.featherDebuffs,vars:{code:reportCode,all:fightIds,featherFilter:idsFilter(filters.friendlyAuras)},maxPages:12});
  const buffPage=await paginateEvents({query:FEATHER_BUFF_PAGE_QUERY,field:'feather',initial:r.featherBuffs,vars:{code:reportCode,all:fightIds,featherFilter:idsFilter(filters.friendlyAuras)},maxPages:12});
  const damageEvents=dedupeEvents(damagePage.events);const castEvents=paginatorEvents(r.mechanicCasts);const enemyBuffEvents=paginatorEvents(r.mechanicEnemyBuffs);const friendlyAuraEvents=dedupeEvents([...debuffPage.events,...buffPage.events]);const meaningfulDeathEvents=paginatorEvents(r.meaningfulDeaths);

  const mechanicsRaw=analyzeEncounterMechanics({pack,fights:closed,damageEvents,castEvents,enemyBuffEvents,friendlyAuraEvents});
  const actors=new Map((report.masterData?.actors||[]).map(a=>[Number(a.id),a]));const meaningfulByFight=normalizeMeaningfulDeaths(meaningfulDeathEvents,closed,actors);
  const deathChains=buildDeathChains({deathAnalysis:{meaningfulByFight},mechanicFailures:mechanicsRaw.failures,actors,windowMs:10000});
  const mechanics=enrichMechanicsWithDeaths(mechanicsRaw.mechanics,deathChains);const recentFightIds=closed.slice(-5).map(f=>Number(f.id));
  const blocker=findCurrentBlocker({mechanicsAnalysis:{...mechanicsRaw,mechanics},deathChains,recentFightIds});

  const telemetry=await getTelemetry({reportCode,encounterId:encounter.encounterID});
  const playerMatrix=buildPlayerMatrix({failures:mechanicsRaw.failures,deathChains,actors,recentFightIds});
  const calls=buildNextPullCalls({blocker,mechanics,playerMatrix,pullIntelligence:telemetry?.pullIntelligence});
  const latestFightId=Number(closed.at(-1)?.id);const latestPull={fightId:latestFightId,failures:mechanicsRaw.failures.filter(f=>Number(f.fightId)===latestFightId),deathChains:(deathChains.chains||[]).filter(c=>Number(c.fightId)===latestFightId)};
  const analyticalExcluded=telemetry?.pullIntelligence?.excludedPulls?.length?telemetry.pullIntelligence.excludedPulls:initialSplit.excluded;

  return{
    generatedAt:Date.now(),engineVersion:'3.7.0',status:'ready',
    encounter:{id:encounter.encounterID,name:encounter.name,pulls:closed.length,rawPulls:rawClosed.length},
    analysisPopulation:{rawPulls:rawClosed.length,eligiblePulls:closed.length,excludedPulls:analyticalExcluded,eligibleFightIds:fightIds,policy:'called-wipe/reset pulls remain in WCL history but are excluded from product analytics'},
    rulePack:{slug:pack.slug,version:pack.version,mechanics:pack.mechanics.length,source:packSource},
    corpusModel:generatedModel?{status:generatedModel.status,generatedAt:generatedModel.generatedAt,corpus:generatedModel.corpus,validation:generatedModel.validation}:{status:'manual-fallback'},
    mechanics:{...mechanicsRaw,mechanics,summary:{...mechanicsRaw.summary,linkedDeaths:(deathChains.chains||[]).filter(c=>c.probableCause).length}},
    deathChains,blocker,playerMatrix,nextPullCalls:calls,latestPull,
    dataCompleteness:{
      mechanicDamage:{events:damageEvents.length,truncated:damagePage.truncated,pages:damagePage.pages},
      mechanicCasts:{events:castEvents.length,truncated:Boolean(r.mechanicCasts?.nextPageTimestamp)},
      enemyBuffs:{events:enemyBuffEvents.length,truncated:Boolean(r.mechanicEnemyBuffs?.nextPageTimestamp)},
      assignmentAuras:{events:friendlyAuraEvents.length,debuffPages:debuffPage.pages,buffPages:buffPage.pages,truncated:debuffPage.truncated||buffPage.truncated,abilityIds:filters.friendlyAuras},
      featherAssignments:{events:friendlyAuraEvents.length,debuffPages:debuffPage.pages,buffPages:buffPage.pages,truncated:debuffPage.truncated||buffPage.truncated,abilityIds:filters.friendlyAuras},
      meaningfulDeaths:{events:meaningfulDeathEvents.length,truncated:Boolean(r.meaningfulDeaths?.nextPageTimestamp)}
    },
    dataTruth:{policy:'real-derived-or-explicit-pending',mechanicFailures:packSource==='generated-wcl-corpus'?'validated-generated-rule-derived-WCL-evidence':'manual-fallback-rule-derived-WCL-evidence',deathCausality:'probable-temporal-association',defensiveAvailability:'pending',reliability:'pending',pullEligibility:'first-class called-wipe/reset exclusion',encounterKnowledge:packSource},
    warnings:[
      'Death cause is an evidence-ranked temporal association, not proof of causation.',
      packSource==='generated-wcl-corpus'?'Encounter semantics are auto-generated from a persisted WCL training/holdout corpus.':'Generated encounter model not published yet; using the curated fallback pack for this encounter.',
      'Defensive availability and Reliability remain intentionally pending in v3.5.'
    ]
  };
}
