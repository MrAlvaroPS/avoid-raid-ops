import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { ENCOUNTER_META_QUERY } from '../wcl/queries/telemetry.mjs';
import { ENCOUNTER_INTELLIGENCE_QUERY,MECHANIC_DAMAGE_PAGE_QUERY,FEATHER_DEBUFF_PAGE_QUERY,FEATHER_BUFF_PAGE_QUERY,MEANINGFUL_DEATH_PAGE_QUERY,idsFilter } from '../wcl/queries/intelligence.mjs';
import { selectEncounter } from '../wcl/normalization/fights.mjs';
import { paginatorEvents,eventTargetId,eventAbilityId,eventSourceId } from '../wcl/normalization/events.mjs';
import { getEncounterRulePack } from '../rule-packs/encounters/registry.mjs';
import { filtersForPack } from '../rule-packs/encounters/filters.mjs';
import { loadPublishedEncounterModelV2 } from '../corpus/service-v2.mjs';
import { homeGuildId, isHomeSourceProfile } from '../knowledge/scopes.mjs';
import { analyzeEncounterMechanics } from '../analysis/mechanics/encounter-rule-engine.mjs';
import { buildDeathChains,findCurrentBlocker } from '../analysis/root-cause/death-chains.mjs';
import { buildReliabilityEvidenceLedger } from '../analysis/reliability/evidence-ledger-v1.mjs';
import { scoreReliabilityProfiles } from '../analysis/reliability/reliability-engine-v1.mjs';
import { RELIABILITY_MODEL_VERSION } from '../analysis/reliability/reliability-policy-v1.mjs';
import { getTelemetry } from './telemetry-engine.mjs';
import { splitAnalyticalPulls } from '../analysis/pulls/pull-eligibility.mjs';

const ENGINE_VERSION='3.8.5';
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null;};

function normalizeMeaningfulDeaths(events=[],fights=[],actors=new Map()){
  const byFight={};const fightMap=new Map(fights.map(f=>[Number(f.id),f]));
  for(const e of events){
    const fightId=Number(e.fight),fight=fightMap.get(fightId);if(!fight)continue;
    const actorId=eventTargetId(e),ts=n(e.timestamp),ability=e.ability&&typeof e.ability==='object'?e.ability:null;
    const abilityId=n(e.abilityGameID ?? (typeof e.ability==='number'?e.ability:null) ?? ability?.guid ?? ability?.id);
    const row={fightId,actorId:actorId==null?null:Number(actorId),player:actors.get(Number(actorId))?.name||null,timestampReportMs:ts,fightRelativeMs:ts==null?null:Math.max(0,ts-Number(fight.startTime||0)),killingBlow:ability?.name||e.abilityName||null,killingBlowId:abilityId,overkill:n(e.overkill)};
    (byFight[fightId]??=[]).push(row);
  }
  for(const rows of Object.values(byFight))rows.sort((a,b)=>(a.timestampReportMs||0)-(b.timestampReportMs||0));
  return byFight;
}

function enrichMechanicsWithDeaths(mechanics,deathChains){
  const linked=deathChains?.linkedByMechanic||{},firstByMechanic={},byFight=new Map();
  for(const chain of deathChains?.chains||[]){if(!byFight.has(Number(chain.fightId)))byFight.set(Number(chain.fightId),[]);byFight.get(Number(chain.fightId)).push(chain);}
  for(const chains of byFight.values()){chains.sort((a,b)=>Number(a.deathAtMs||0)-Number(b.deathAtMs||0));const key=chains[0]?.probableCause?.mechanicKey;if(key)firstByMechanic[key]=(firstByMechanic[key]||0)+1;}
  return (mechanics||[]).map(m=>({...m,linkedDeaths:Number(linked[m.key]||0),firstDeaths:Number(firstByMechanic[m.key]||0)}));
}

function buildPlayerMatrix({failures=[],deathChains,actors=new Map(),recentFightIds=[]}){
  const recent=new Set(recentFightIds.map(Number)),map=new Map();
  const ensure=id=>{const key=Number(id);if(!map.has(key))map.set(key,{actorId:key,name:actors.get(key)?.name||`Actor ${key}`,failures:0,recentFailures:0,linkedDeaths:0,mechanics:{}});return map.get(key);};
  for(const f of failures){if(f.actorId==null)continue;const row=ensure(f.actorId);row.failures++;if(recent.has(Number(f.fightId)))row.recentFailures++;row.mechanics[f.mechanicKey]=(row.mechanics[f.mechanicKey]||0)+1;}
  for(const c of deathChains?.chains||[]){if(c.actorId==null||!c.probableCause)continue;ensure(c.actorId).linkedDeaths++;}
  return [...map.values()].sort((a,b)=>b.linkedDeaths-a.linkedDeaths||b.recentFailures-a.recentFailures||b.failures-a.failures);
}

function buildNextPullCalls({blocker,mechanics,playerMatrix,pullIntelligence}){
  const calls=[];
  if(blocker?.blocker){const detail=mechanics.find(m=>m.key===blocker.blocker.key);calls.push({kind:'mechanic',confidence:blocker.confidence||'medium',title:detail?.name||blocker.blocker.name,detail:detail?.expectedAction||'Fix the highest recurring mechanic failure.'});}
  const player=playerMatrix.find(p=>p.recentFailures>0&&(p.linkedDeaths>0||p.recentFailures>=2));
  if(player){const [key,count]=Object.entries(player.mechanics).sort((a,b)=>b[1]-a[1])[0]||[];const mech=mechanics.find(m=>m.key===key);calls.push({kind:'player-focus',confidence:player.linkedDeaths>0?'high':'medium',title:`${player.name} · ${mech?.name||'mechanic execution'}`,detail:`${count||player.recentFailures} player-specific exposure${(count||player.recentFailures)===1?'':'s'} in the classified evidence window${player.linkedDeaths?` · ${player.linkedDeaths} death-linked`:''}.`});}
  const gain=pullIntelligence?.currentVsPrevious?.improvements?.[0];
  if(gain)calls.push({kind:'preserve-gain',confidence:gain.confidence||'high',title:`Preserve: ${gain.label}`,detail:gain.unit==='ms'?`${Math.abs(Number(gain.delta)||0)/1000}s better than the previous analytical pull.`:gain.unit==='pp'?`${Math.abs(Number(gain.delta)||0).toFixed(1)} percentage points better than the previous analytical pull.`:'Confirmed improvement versus the previous analytical pull.'});
  const second=(blocker?.ranking||[]).find(x=>x.key!==blocker?.blocker?.key&&x.recentFailures>0);
  if(calls.length<3&&second){const detail=mechanics.find(m=>m.key===second.key);calls.push({kind:'secondary-mechanic',confidence:second.linkedDeaths>0?'medium':'low',title:detail?.name||second.name,detail:detail?.expectedAction||`${second.recentFailures} recent failed executions observed.`});}
  return calls.slice(0,3);
}

function eventIdentity(e){return [Number(e?.fight)||'',Number(e?.timestamp)||'',eventSourceId(e)??'',eventTargetId(e)??'',eventAbilityId(e)??'',String(e?.type||'')].join(':');}
function dedupeEvents(events){const map=new Map();for(const e of events||[])map.set(eventIdentity(e),e);return [...map.values()].sort((a,b)=>Number(a.timestamp||0)-Number(b.timestamp||0));}
async function paginateEvents({query,field,initial,vars,maxPages=12}){const events=[...paginatorEvents(initial)];let next=initial?.nextPageTimestamp??null,pages=initial?1:0;while(next!=null&&pages<maxPages){const page=await wclGraphql(query,{...vars,start:Number(next)});const chunk=page?.reportData?.report?.[field];events.push(...paginatorEvents(chunk));const nextPage=chunk?.nextPageTimestamp??null;if(nextPage==null||Number(nextPage)<=Number(next)){next=null;break;}next=nextPage;pages++;}return{events,next,pages,truncated:next!=null};}

function buildReliabilityShadow({telemetry,closed,mechanicsRaw,meaningfulByFight,survivalSourceComplete=false,reportCode,encounter}){
  const ledgers=buildReliabilityEvidenceLedger({players:telemetry?.players||[],fights:closed,mechanicFailures:mechanicsRaw?.failures||[],mechanicOpportunities:mechanicsRaw?.playerOpportunities||[],meaningfulDeathsByFight:meaningfulByFight,survivalSourceComplete,defensiveOpportunities:telemetry?.reliabilityEvidence?.defensiveOpportunities||[],dutyOpportunities:telemetry?.reliabilityEvidence?.dutyOpportunities||[],reportCode,encounter:{id:encounter.encounterID,difficulty:encounter.difficulty},nights:1});
  const profiles=scoreReliabilityProfiles(ledgers);
  return{modelVersion:RELIABILITY_MODEL_VERSION,status:'shadow',scope:'home-raid-report-encounter',parseIndependent:true,survivalSourceComplete:Boolean(survivalSourceComplete),profiles,summary:{players:profiles.length,published:profiles.filter(p=>p.value!=null).length,pending:profiles.filter(p=>p.value==null).length,mechanicFailuresObserved:ledgers.reduce((s,l)=>s+(l.mechanics?.unscoredFailures?.length||0),0),playerMechanicOpportunities:ledgers.reduce((s,l)=>s+(l.mechanics?.opportunities?.length||0),0),survivalOpportunities:ledgers.reduce((s,l)=>s+(l.survival?.opportunities?.length||0),0),confirmedDefensiveOpportunities:ledgers.reduce((s,l)=>s+(l.defensives?.opportunities?.length||0),0),provenDutyOpportunities:ledgers.reduce((s,l)=>s+(l.duties?.opportunities?.length||0),0)},publicationPolicy:'No player score is rendered until longitudinal identity, player-specific denominators and weight-coverage gates pass.'};
}

function externalReliabilityDisabled(){return{modelVersion:RELIABILITY_MODEL_VERSION,status:'not-applicable',scope:'external-report',parseIndependent:true,profiles:[],summary:{players:0,published:0,pending:0,mechanicFailuresObserved:0,playerMechanicOpportunities:0,survivalOpportunities:0,confirmedDefensiveOpportunities:0,provenDutyOpportunities:0},publicationPolicy:'Player/Reliability knowledge is home-raid-only. External raid players are never admitted to the AvoiD player model.'};}

export async function getEncounterIntelligence({reportCode,encounterId}){
  const meta=await wclGraphql(ENCOUNTER_META_QUERY,{code:reportCode});const report=meta?.reportData?.report;if(!report)return null;
  const reportGuildId=Number(report?.guild?.id)||null,reportOwnerId=Number(report?.owner?.id)||null,homeRaidEligible=isHomeSourceProfile({guild:report?.guild||null,owner:report?.owner||null});
  const selected=selectEncounter(report.fights,encounterId),rawClosed=selected.filter(f=>!f.inProgress),initialSplit=splitAnalyticalPulls(rawClosed),closed=initialSplit.eligible,encounter=closed.at(-1)||rawClosed.at(-1)||selected.at(-1);
  if(!encounter)return{generatedAt:Date.now(),engineVersion:ENGINE_VERSION,status:'no-encounter'};
  if(!closed.length)return{generatedAt:Date.now(),engineVersion:ENGINE_VERSION,status:'no-eligible-pulls',encounter:{id:encounter.encounterID,name:encounter.name,pulls:0,rawPulls:rawClosed.length},raidKnowledge:{scope:homeRaidEligible?'home-raid':'external-evaluation-only',homeRaidEligible,reportGuildId,reportOwnerId},analysisPopulation:{rawPulls:rawClosed.length,eligiblePulls:0,excludedPulls:initialSplit.excluded,eligibleFightIds:[],policy:'called-wipe/reset pulls remain in WCL history but are excluded from product analytics'},dataTruth:{policy:'real-derived-or-explicit-pending',pullEligibility:'first-class called-wipe/reset exclusion',reliability:homeRaidEligible?'shadow-v1':'disabled-external-source'}};

  const generatedModel=await loadPublishedEncounterModelV2({encounterId:encounter.encounterID,difficulty:encounter.difficulty||5,partition:0}).catch(()=>null);
  const pack=generatedModel?.pack||getEncounterRulePack(encounter.encounterID),packSource=generatedModel?'generated-wcl-corpus-sampling-v2':pack?'manual-fallback':null;
  if(!pack)return{generatedAt:Date.now(),engineVersion:ENGINE_VERSION,encounter:{id:encounter.encounterID,name:encounter.name,pulls:closed.length,rawPulls:rawClosed.length},raidKnowledge:{scope:homeRaidEligible?'home-raid':'external-evaluation-only',homeRaidEligible,reportGuildId,reportOwnerId},analysisPopulation:{rawPulls:rawClosed.length,eligiblePulls:closed.length,excludedPulls:initialSplit.excluded},status:'no-rule-pack',corpusModel:{status:'missing',action:'Build the encounter corpus from the Mechanics page.'},dataTruth:{policy:'real-derived-or-explicit-pending',reliability:homeRaidEligible?'shadow-v1-no-encounter-denominators':'disabled-external-source'}};

  const filters=filtersForPack(pack),fightIds=closed.map(f=>Number(f.id));
  const raw=await wclGraphql(ENCOUNTER_INTELLIGENCE_QUERY,{code:reportCode,all:fightIds,damageFilter:idsFilter(filters.damage),castFilter:idsFilter(filters.casts),enemyBuffFilter:idsFilter(filters.enemyBuffs),featherFilter:idsFilter(filters.friendlyAuras)}),r=raw?.reportData?.report||{};
  const damagePage=await paginateEvents({query:MECHANIC_DAMAGE_PAGE_QUERY,field:'mechanicDamage',initial:r.mechanicDamage,vars:{code:reportCode,all:fightIds,damageFilter:idsFilter(filters.damage)},maxPages:12});
  const debuffPage=await paginateEvents({query:FEATHER_DEBUFF_PAGE_QUERY,field:'feather',initial:r.featherDebuffs,vars:{code:reportCode,all:fightIds,featherFilter:idsFilter(filters.friendlyAuras)},maxPages:12});
  const buffPage=await paginateEvents({query:FEATHER_BUFF_PAGE_QUERY,field:'feather',initial:r.featherBuffs,vars:{code:reportCode,all:fightIds,featherFilter:idsFilter(filters.friendlyAuras)},maxPages:12});
  const deathPage=await paginateEvents({query:MEANINGFUL_DEATH_PAGE_QUERY,field:'meaningfulDeaths',initial:r.meaningfulDeaths,vars:{code:reportCode,all:fightIds},maxPages:12});
  const damageEvents=dedupeEvents(damagePage.events),castEvents=paginatorEvents(r.mechanicCasts),enemyBuffEvents=paginatorEvents(r.mechanicEnemyBuffs),friendlyAuraEvents=dedupeEvents([...debuffPage.events,...buffPage.events]),meaningfulDeathEvents=dedupeEvents(deathPage.events);

  const mechanicsRaw=analyzeEncounterMechanics({pack,fights:closed,damageEvents,castEvents,enemyBuffEvents,friendlyAuraEvents});
  const actors=new Map((report.masterData?.actors||[]).map(a=>[Number(a.id),a])),meaningfulByFight=normalizeMeaningfulDeaths(meaningfulDeathEvents,closed,actors);
  const deathChains=buildDeathChains({deathAnalysis:{meaningfulByFight},mechanicFailures:mechanicsRaw.failures,actors,windowMs:10000});
  const mechanics=enrichMechanicsWithDeaths(mechanicsRaw.mechanics,deathChains),recentFightIds=closed.slice(-5).map(f=>Number(f.id));
  const blocker=findCurrentBlocker({mechanicsAnalysis:{...mechanicsRaw,mechanics},deathChains,recentFightIds});
  const telemetry=await getTelemetry({reportCode,encounterId:encounter.encounterID});
  const reliability=homeRaidEligible?buildReliabilityShadow({telemetry,closed,mechanicsRaw,meaningfulByFight,survivalSourceComplete:!deathPage.truncated,reportCode,encounter}):externalReliabilityDisabled();
  const playerMatrix=homeRaidEligible?buildPlayerMatrix({failures:mechanicsRaw.failures,deathChains,actors,recentFightIds}):[];
  const reliabilityByActor=new Map((reliability.profiles||[]).map(p=>[Number(p.identity?.actorId),p]));for(const row of playerMatrix){const rel=reliabilityByActor.get(Number(row.actorId));if(rel)row.reliability={status:rel.status,value:rel.value,confidence:rel.confidence?.level||'unknown',explanation:rel.explanation};}
  const calls=buildNextPullCalls({blocker,mechanics,playerMatrix,pullIntelligence:telemetry?.pullIntelligence});
  const latestFightId=Number(closed.at(-1)?.id),latestPull={fightId:latestFightId,failures:mechanicsRaw.failures.filter(f=>Number(f.fightId)===latestFightId),deathChains:(deathChains.chains||[]).filter(c=>Number(c.fightId)===latestFightId)};
  const analyticalExcluded=telemetry?.pullIntelligence?.excludedPulls?.length?telemetry.pullIntelligence.excludedPulls:initialSplit.excluded;

  return{
    generatedAt:Date.now(),engineVersion:ENGINE_VERSION,status:'ready',encounter:{id:encounter.encounterID,name:encounter.name,pulls:closed.length,rawPulls:rawClosed.length},
    raidKnowledge:{scope:homeRaidEligible?'home-raid':'external-evaluation-only',homeRaidEligible,reportGuildId,reportOwnerId,homeGuildId:homeGuildId()},
    analysisPopulation:{rawPulls:rawClosed.length,eligiblePulls:closed.length,excludedPulls:analyticalExcluded,eligibleFightIds:fightIds,policy:'called-wipe/reset pulls remain in WCL history but are excluded from product analytics'},
    rulePack:{slug:pack.slug,version:pack.version,mechanics:pack.mechanics.length,source:packSource},
    corpusModel:generatedModel?{status:generatedModel.status,generatedAt:generatedModel.generatedAt,corpus:generatedModel.corpus,validation:generatedModel.validation,sampling:generatedModel.sampling,knowledgeContract:generatedModel.knowledgeContract}:{status:'manual-fallback'},
    mechanics:{...mechanicsRaw,mechanics,summary:{...mechanicsRaw.summary,linkedDeaths:(deathChains.chains||[]).filter(c=>c.probableCause).length}},deathChains,blocker,playerMatrix,nextPullCalls:calls,latestPull,reliability,
    dataCompleteness:{mechanicDamage:{events:damageEvents.length,truncated:damagePage.truncated,pages:damagePage.pages},mechanicCasts:{events:castEvents.length,truncated:Boolean(r.mechanicCasts?.nextPageTimestamp)},enemyBuffs:{events:enemyBuffEvents.length,truncated:Boolean(r.mechanicEnemyBuffs?.nextPageTimestamp)},assignmentAuras:{events:friendlyAuraEvents.length,debuffPages:debuffPage.pages,buffPages:buffPage.pages,truncated:debuffPage.truncated||buffPage.truncated,abilityIds:filters.friendlyAuras},featherAssignments:{events:friendlyAuraEvents.length,debuffPages:debuffPage.pages,buffPages:buffPage.pages,truncated:debuffPage.truncated||buffPage.truncated,abilityIds:filters.friendlyAuras},meaningfulDeaths:{events:meaningfulDeathEvents.length,truncated:deathPage.truncated,pages:deathPage.pages,sourceComplete:!deathPage.truncated},reliability:{modelVersion:RELIABILITY_MODEL_VERSION,profiles:reliability.summary.players,published:reliability.summary.published,playerMechanicOpportunities:reliability.summary.playerMechanicOpportunities,survivalOpportunities:reliability.summary.survivalOpportunities,confirmedDefensiveOpportunities:reliability.summary.confirmedDefensiveOpportunities,provenDutyOpportunities:reliability.summary.provenDutyOpportunities}},
    dataTruth:{policy:'real-derived-or-explicit-pending',mechanicFailures:packSource==='generated-wcl-corpus-sampling-v2'?'validated-generated-rule-derived-WCL-evidence':'manual-fallback-rule-derived-WCL-evidence',deathCausality:'probable-temporal-association',defensiveAvailability:'pending',reliability:homeRaidEligible?'shadow-v1-parse-independent-publication-gated':'disabled-external-source',pullEligibility:'first-class called-wipe/reset exclusion',encounterKnowledge:packSource},
    warnings:['Death cause is an evidence-ranked temporal association, not proof of causation.',packSource==='generated-wcl-corpus-sampling-v2'?'Encounter semantics are auto-generated from the balanced public multi-guild WCL corpus.':'Generated encounter model not published under the sampling-v2 contract yet; using the curated fallback pack for this encounter.',homeRaidEligible?(deathPage.truncated?'Meaningful-death pagination did not complete; Survival remains pending for affected evidence.':'Meaningful-death evidence is complete for the analysed report scope and may contribute to the Survival evidence ledger.'):'External report Survival is not admitted to AvoiD player knowledge.',homeRaidEligible?'Reliability v1 is running in shadow mode. Player mechanic failures remain unscored until clean player-opportunity denominators are proven; defensive availability and assigned-duty denominators are also publication gates.':'External raid source detected: boss execution may be evaluated, but external player identities are excluded from AvoiD player/Reliability knowledge.','DPS/HPS/parse are explicitly excluded from the Reliability formula.']
  };
}