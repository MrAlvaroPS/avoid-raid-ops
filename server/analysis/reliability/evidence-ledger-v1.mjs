import { RELIABILITY_POLICY,roleKey } from './reliability-policy-v1.mjs';

const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const arr=v=>Array.isArray(v)?v:[];

const dedupeBy=(rows,keyFn)=>{
  const map=new Map();
  for(const row of rows||[]){const key=keyFn(row);if(key!=null&&!map.has(key))map.set(key,row);}
  return [...map.values()];
};

const duplicateKeys=(rows,keyFn)=>{
  const seen=new Set(),dupes=[];
  for(const row of rows||[]){const key=keyFn(row);if(key==null)continue;if(seen.has(key))dupes.push(key);else seen.add(key);}
  return [...new Set(dupes)];
};

const playerServerKey=player=>{
  const server=player?.server||player?.realm||null;
  const region=server&&typeof server==='object'?(server?.region?.slug||server?.region?.compactName||player?.region||null):(player?.region||null);
  const realm=server&&typeof server==='object'?(server?.slug||server?.name||player?.serverName||null):(typeof server==='string'?server:player?.serverName||null);
  if(region&&realm)return`${String(region).toLowerCase()}:${String(realm).toLowerCase()}`;
  if(realm)return`unknown-region:${String(realm).toLowerCase()}`;
  return null;
};

export function reliabilityIdentity(player,{reportCode=null}={}){
  const canonical=player?.canonicalID??player?.canonicalId??null;
  if(canonical!=null)return{key:`wcl:${canonical}`,canonicalId:Number(canonical),status:'canonical'};
  const serverKey=playerServerKey(player),name=String(player?.name||'').trim().toLowerCase();
  if(serverKey&&name)return{key:`character:${serverKey}:${name}`,canonicalId:null,status:'provisional-name-realm'};
  return{key:`report:${reportCode||'unknown'}:actor:${Number(player?.actorId)||0}`,canonicalId:null,status:'report-scoped'};
}

function attendedFightIds(player,fights){
  const id=Number(player?.actorId);
  return arr(fights).filter(f=>arr(f?.friendlyPlayers).map(Number).includes(id)).map(f=>Number(f.id));
}

function meaningfulRowsByFight(input){
  if(input instanceof Map)return input;
  return new Map(Object.entries(input||{}).map(([k,v])=>[Number(k),arr(v)]));
}

function survivalLedger(player,fightIds,meaningfulByFight,{sourceComplete=true}={}){
  const actorId=Number(player.actorId);
  if(!sourceComplete){
    return{
      sourceComplete:false,
      opportunities:[],
      unscored:fightIds.map(fightId=>({actorId,fightId,kind:'survival',reason:'meaningful-death-stream-incomplete'}))
    };
  }
  const rows=[];
  for(const fightId of fightIds){
    const deaths=arr(meaningfulByFight.get(Number(fightId))).slice().sort((a,b)=>Number(a.timestampReportMs||a.timestamp||0)-Number(b.timestampReportMs||b.timestamp||0));
    const playerDeath=deaths.find(d=>Number(d.actorId??d.targetID)===actorId)||null;
    const first=deaths[0]||null;
    const isFirst=Boolean(playerDeath&&Number(first?.actorId??first?.targetID)===actorId);
    const incidentPenalty=playerDeath?(isFirst?RELIABILITY_POLICY.survivalIncidentPenalty.firstMeaningfulDeath:RELIABILITY_POLICY.survivalIncidentPenalty.meaningfulDeath):0;
    rows.push({
      key:`${fightId}:survival:${actorId}`,
      actorId,fightId,kind:'survival',observable:true,sourceComplete:true,confidence:'confirmed',
      success:!playerDeath,incidentPenalty,
      firstMeaningfulDeath:isFirst,meaningfulDeath:Boolean(playerDeath),
      timestampReportMs:finite(playerDeath?.timestampReportMs??playerDeath?.timestamp),
      evidenceSource:'WCL Deaths events with wipeCutoff=5'
    });
  }
  return{sourceComplete:true,opportunities:rows,unscored:[]};
}

function mechanicLedger(player,opportunities,failures){
  const actorId=Number(player.actorId);
  const incoming=dedupeBy(arr(opportunities).filter(o=>Number(o.actorId)===actorId&&o.eligible!==false),o=>`${actorId}:${o.occurrenceKey||`${o.fightId}:${o.mechanicKey}:${o.timestampReportMs||''}`}`);
  const scoredOpps=incoming.filter(o=>o.assigned===true&&o.observable===true&&o.sourceComplete===true);
  const unscoredOpportunities=incoming.filter(o=>!scoredOpps.includes(o)).map(o=>({
    ...o,actorId,kind:'mechanic-opportunity-unscored',
    reason:o.sourceComplete!==true?'mechanic-source-not-proven-complete':o.assigned!==true?'mechanic-player-assignment-not-proven':'mechanic-outcome-not-observable'
  }));
  const actorFailures=dedupeBy(arr(failures).filter(f=>Number(f.actorId)===actorId),f=>`${actorId}:${f.occurrenceKey||`${f.fightId}:${f.mechanicKey}:${f.timestampReportMs||''}`}`);
  const failureMap=new Map(actorFailures.map(f=>[f.occurrenceKey||`${f.fightId}:${f.mechanicKey}:${f.timestampReportMs||''}`,f]));
  const scored=scoredOpps.map(o=>{
    const key=o.occurrenceKey||`${o.fightId}:${o.mechanicKey}:${o.timestampReportMs||''}`;
    const failure=failureMap.get(key)||null;
    return{
      key:`mechanic:${actorId}:${key}`,actorId,kind:'mechanic',fightId:Number(o.fightId),mechanicKey:o.mechanicKey||null,
      occurrenceKey:key,severity:Math.max(1,Math.min(5,Number(o.severity)||3)),confidence:o.confidence||'high',
      observable:true,assigned:true,sourceComplete:true,success:!failure,failure:failure||null,
      evidenceSource:o.evidenceSource||o.source||'encounter-rule-engine'
    };
  });
  const matched=new Set(scored.filter(x=>x.failure).map(x=>x.occurrenceKey));
  const unscoredFailures=actorFailures.filter(f=>!matched.has(f.occurrenceKey||`${f.fightId}:${f.mechanicKey}:${f.timestampReportMs||''}`)).map(f=>({
    actorId,kind:'mechanic-failure-without-player-denominator',fightId:Number(f.fightId),mechanicKey:f.mechanicKey||null,
    occurrenceKey:f.occurrenceKey||null,severity:Number(f.severity)||null,confidence:f.confidence||'unknown',reason:f.reason||null,
    evidenceSource:'classified-mechanic-failure'
  }));
  return{scored,unscoredFailures,unscoredOpportunities};
}

function defensiveLedger(player,opportunities){
  const actorId=Number(player.actorId),scored=[],unscored=[];
  for(const o of dedupeBy(arr(opportunities).filter(x=>Number(x.actorId)===actorId),x=>`${actorId}:${x.opportunityKey||`${x.fightId}:${x.abilityId||''}:${x.timestampReportMs||''}`}`)){
    const availability=String(o.availability||o.available||'unknown').toLowerCase();
    const outcomeKnown=typeof o.usedOnTime==='boolean'||(typeof o.used==='boolean'&&typeof o.late==='boolean');
    const row={...o,actorId,kind:'defensive',availability};
    if(o.sourceComplete!==true){unscored.push({...row,observable:false,reason:'defensive-source-not-proven-complete'});continue;}
    if(availability!=='confirmed'){unscored.push({...row,observable:false,reason:'defensive-availability-not-confirmed'});continue;}
    if(!outcomeKnown){unscored.push({...row,observable:false,reason:'defensive-outcome-not-observable'});continue;}
    scored.push({
      ...row,observable:true,sourceComplete:true,success:Boolean(o.usedOnTime??(o.used&&!o.late)),dangerWeight:clamp(Number(o.dangerWeight)||1,0.25,1),
      preventableDeath:o.preventableDeath===true,confidence:o.confidence||'high'
    });
  }
  return{scored,unscored};
}

function dutyLedger(player,opportunities){
  const actorId=Number(player.actorId),scored=[],unscored=[];
  for(const o of dedupeBy(arr(opportunities).filter(x=>Number(x.actorId)===actorId),x=>`${actorId}:${x.opportunityKey||`${x.fightId}:${x.dutyKey||''}:${x.timestampReportMs||''}`}`)){
    const reason=o.sourceComplete!==true?'duty-source-not-proven-complete':o.assigned!==true?'duty-not-proven-assigned':o.observable!==true?'duty-outcome-not-observable':null;
    if(reason){unscored.push({...o,actorId,kind:'duty',reason});continue;}
    scored.push({...o,actorId,kind:'duty',sourceComplete:true,success:Boolean(o.success),importance:clamp(Number(o.importance)||1,0.25,1),confidence:o.confidence||'high'});
  }
  return{scored,unscored};
}

function adaptationSignal(mechanicRows){
  const byMechanic=new Map();
  for(const row of mechanicRows){if(!byMechanic.has(row.mechanicKey))byMechanic.set(row.mechanicKey,[]);byMechanic.get(row.mechanicKey).push(row);}
  let repeatOpportunities=0,repeatedFailures=0;
  const details=[];
  for(const [mechanicKey,rows] of byMechanic){
    const ordered=rows.slice().sort((a,b)=>Number(a.fightId)-Number(b.fightId)||String(a.occurrenceKey).localeCompare(String(b.occurrenceKey)));
    let seenFailure=false,exposures=0,repeatForMechanic=0,failForMechanic=0;
    for(const row of ordered){
      exposures++;
      if(seenFailure&&exposures>RELIABILITY_POLICY.adaptation.minimumPriorExposures){repeatOpportunities++;repeatForMechanic++;if(!row.success){repeatedFailures++;failForMechanic++;}}
      if(!row.success)seenFailure=true;
    }
    if(repeatForMechanic)details.push({mechanicKey,repeatOpportunities:repeatForMechanic,repeatedFailures:failForMechanic,rate:failForMechanic/repeatForMechanic});
  }
  return{
    status:repeatOpportunities?'observed':'pending',
    repeatOpportunities,repeatedFailures,
    repeatedFailureRate:repeatOpportunities?repeatedFailures/repeatOpportunities:null,
    details
  };
}

export function validateReliabilityLedger(ledger){
  const errors=[],warnings=[];
  const attended=arr(ledger?.participation?.fightIds),survival=arr(ledger?.survival?.opportunities),mechanics=arr(ledger?.mechanics?.opportunities),defensives=arr(ledger?.defensives?.opportunities),duties=arr(ledger?.duties?.opportunities);
  const uniqueAttendance=new Set(attended.map(Number));
  if(uniqueAttendance.size!==attended.length)errors.push('duplicate attended fight IDs');
  if(Number(ledger?.participation?.pullsAttended)!==uniqueAttendance.size)errors.push('pullsAttended does not equal unique attended fight count');
  if(ledger?.survival?.sourceComplete===true&&survival.length!==uniqueAttendance.size)errors.push('survival opportunity count does not equal attended pull count');
  if(ledger?.survival?.sourceComplete===false&&survival.length)errors.push('incomplete survival source produced scored opportunities');
  const survivalFightIds=new Set(survival.map(x=>Number(x.fightId)));
  if(survivalFightIds.size!==survival.length)errors.push('duplicate survival opportunity for a pull');
  for(const row of survival)if(!uniqueAttendance.has(Number(row.fightId)))errors.push(`survival opportunity references unattended fight ${row.fightId}`);

  const dupMechanics=duplicateKeys(mechanics,x=>x.key||`${x.actorId}:${x.occurrenceKey}`);
  if(dupMechanics.length)errors.push(`duplicate mechanic opportunity keys: ${dupMechanics.slice(0,3).join(', ')}`);
  const dupDefensives=duplicateKeys(defensives,x=>x.key||`${x.actorId}:${x.opportunityKey}`);
  if(dupDefensives.length)errors.push(`duplicate defensive opportunity keys: ${dupDefensives.slice(0,3).join(', ')}`);
  const dupDuties=duplicateKeys(duties,x=>x.key||`${x.actorId}:${x.opportunityKey}`);
  if(dupDuties.length)errors.push(`duplicate duty opportunity keys: ${dupDuties.slice(0,3).join(', ')}`);

  for(const row of defensives)if(String(row.availability)!=='confirmed'||row.sourceComplete!==true||row.observable!==true)errors.push('scored defensive opportunity without confirmed availability/completeness/outcome');
  for(const row of duties)if(row.assigned!==true||row.observable!==true||row.sourceComplete!==true)errors.push('scored duty opportunity without proven assignment/completeness/outcome');
  for(const row of mechanics)if(row.assigned!==true||row.observable!==true||row.sourceComplete!==true)errors.push('scored mechanic opportunity without proven player assignment/completeness/outcome');

  if(ledger?.survival?.sourceComplete===false)warnings.push('meaningful-death source is incomplete; Survival is unscored');
  if(arr(ledger?.mechanics?.unscoredFailures).length)warnings.push('classified mechanic failures exist without player-level clean denominators');
  if(arr(ledger?.mechanics?.unscoredOpportunities).length)warnings.push('mechanic opportunity candidates exist without complete assignment/outcome evidence');
  if(arr(ledger?.defensives?.unscored).length)warnings.push('defensive observations exist with unknown/unscoreable availability or outcome');
  if(arr(ledger?.duties?.unscored).length)warnings.push('duty observations exist without proven assignment/outcome');
  if(ledger?.identity?.status==='report-scoped')warnings.push('player identity is report-scoped and cannot publish longitudinal Reliability');

  return{ok:errors.length===0,status:errors.length?'data-error':'valid',errors,warnings};
}

export function buildReliabilityEvidenceLedger({
  players=[],fights=[],mechanicFailures=[],mechanicOpportunities=[],meaningfulDeathsByFight={},
  defensiveOpportunities=[],dutyOpportunities=[],reportCode=null,encounter=null,nights=1,partition=null,
  survivalSourceComplete=true
}={}){
  const meaningful=meaningfulRowsByFight(meaningfulDeathsByFight);
  return arr(players).map(player=>{
    const fightIds=attendedFightIds(player,fights);
    const mechanic=mechanicLedger(player,mechanicOpportunities,mechanicFailures);
    const defensives=defensiveLedger(player,defensiveOpportunities);
    const duties=dutyLedger(player,dutyOpportunities);
    const survival=survivalLedger(player,fightIds,meaningful,{sourceComplete:survivalSourceComplete});
    const identity=reliabilityIdentity(player,{reportCode});
    const ledger={
      schemaVersion:1,
      identity:{...identity,actorId:Number(player.actorId),name:player.name||null,className:player.className||null,spec:player.spec||null,role:roleKey(player.role)},
      context:{reportCode,encounterId:encounter?.id??encounter?.encounterID??null,difficulty:encounter?.difficulty??null,partition,nights:Number(nights)||1},
      participation:{pullsAttended:fightIds.length,fightIds},
      mechanics:{opportunities:mechanic.scored,unscoredFailures:mechanic.unscoredFailures,unscoredOpportunities:mechanic.unscoredOpportunities},
      survival,
      defensives:{opportunities:defensives.scored,unscored:defensives.unscored},
      duties:{opportunities:duties.scored,unscored:duties.unscored},
      adaptation:adaptationSignal(mechanic.scored),
      integrity:{
        reportScopedIdentity:identity.status==='report-scoped',
        survivalSourceComplete:survival.sourceComplete,
        mechanicDenominatorComplete:mechanic.unscoredFailures.length===0&&mechanic.scored.length>0,
        defensiveAvailabilityComplete:defensives.scored.length>0&&defensives.unscored.length===0,
        dutyDenominatorComplete:duties.scored.length>0&&duties.unscored.length===0
      }
    };
    ledger.validation=validateReliabilityLedger(ledger);
    return ledger;
  });
}
