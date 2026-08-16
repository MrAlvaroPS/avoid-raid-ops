import { RELIABILITY_POLICY,roleKey } from './reliability-policy-v1.mjs';

const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const arr=v=>Array.isArray(v)?v:[];

const dedupeBy=(rows,keyFn)=>{
  const map=new Map();
  for(const row of rows||[]){const key=keyFn(row);if(key!=null&&!map.has(key))map.set(key,row);}
  return [...map.values()];
};

const playerServerKey=player=>{
  const server=player?.server||player?.realm||null;
  const region=server?.region?.slug||server?.region?.compactName||player?.region||null;
  const realm=server?.slug||server?.name||player?.serverName||null;
  return region&&realm?`${String(region).toLowerCase()}:${String(realm).toLowerCase()}`:null;
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

function survivalLedger(player,fightIds,meaningfulByFight){
  const actorId=Number(player.actorId),rows=[];
  for(const fightId of fightIds){
    const deaths=arr(meaningfulByFight.get(Number(fightId))).slice().sort((a,b)=>Number(a.timestampReportMs||a.timestamp||0)-Number(b.timestampReportMs||b.timestamp||0));
    const playerDeath=deaths.find(d=>Number(d.actorId??d.targetID)===actorId)||null;
    const first=deaths[0]||null;
    const isFirst=Boolean(playerDeath&&Number(first?.actorId??first?.targetID)===actorId);
    const incidentPenalty=playerDeath?(isFirst?RELIABILITY_POLICY.survivalIncidentPenalty.firstMeaningfulDeath:RELIABILITY_POLICY.survivalIncidentPenalty.meaningfulDeath):0;
    rows.push({
      key:`${fightId}:survival:${actorId}`,
      actorId,fightId,kind:'survival',observable:true,
      success:!playerDeath,incidentPenalty,
      firstMeaningfulDeath:isFirst,meaningfulDeath:Boolean(playerDeath),
      timestampReportMs:finite(playerDeath?.timestampReportMs??playerDeath?.timestamp),
      evidenceSource:'WCL Deaths events with wipeCutoff=5'
    });
  }
  return rows;
}

function mechanicLedger(player,opportunities,failures){
  const actorId=Number(player.actorId);
  const actorOpps=dedupeBy(arr(opportunities).filter(o=>Number(o.actorId)===actorId&&o.eligible!==false),o=>`${actorId}:${o.occurrenceKey||`${o.fightId}:${o.mechanicKey}:${o.timestampReportMs||''}`}`);
  const actorFailures=dedupeBy(arr(failures).filter(f=>Number(f.actorId)===actorId),f=>`${actorId}:${f.occurrenceKey||`${f.fightId}:${f.mechanicKey}:${f.timestampReportMs||''}`}`);
  const failureMap=new Map(actorFailures.map(f=>[f.occurrenceKey||`${f.fightId}:${f.mechanicKey}:${f.timestampReportMs||''}`,f]));
  const scored=actorOpps.map(o=>{
    const key=o.occurrenceKey||`${o.fightId}:${o.mechanicKey}:${o.timestampReportMs||''}`;
    const failure=failureMap.get(key)||null;
    return{
      key:`mechanic:${actorId}:${key}`,actorId,kind:'mechanic',fightId:Number(o.fightId),mechanicKey:o.mechanicKey||null,
      occurrenceKey:key,severity:Math.max(1,Math.min(5,Number(o.severity)||3)),confidence:o.confidence||'high',
      observable:true,assigned:Boolean(o.assigned??true),success:!failure,failure:failure||null,
      evidenceSource:o.evidenceSource||o.source||'encounter-rule-engine'
    };
  });
  const matched=new Set(scored.filter(x=>x.failure).map(x=>x.occurrenceKey));
  const unscoredFailures=actorFailures.filter(f=>!matched.has(f.occurrenceKey||`${f.fightId}:${f.mechanicKey}:${f.timestampReportMs||''}`)).map(f=>({
    actorId,kind:'mechanic-failure-without-player-denominator',fightId:Number(f.fightId),mechanicKey:f.mechanicKey||null,
    occurrenceKey:f.occurrenceKey||null,severity:Number(f.severity)||null,confidence:f.confidence||'unknown',reason:f.reason||null,
    evidenceSource:'classified-mechanic-failure'
  }));
  return{scored,unscoredFailures};
}

function defensiveLedger(player,opportunities){
  const actorId=Number(player.actorId),scored=[],unscored=[];
  for(const o of dedupeBy(arr(opportunities).filter(x=>Number(x.actorId)===actorId),x=>`${actorId}:${x.opportunityKey||`${x.fightId}:${x.abilityId||''}:${x.timestampReportMs||''}`}`)){
    const availability=String(o.availability||o.available||'unknown').toLowerCase();
    const row={...o,actorId,kind:'defensive',observable:availability==='confirmed',availability};
    if(availability!=='confirmed'){unscored.push({...row,reason:'defensive-availability-not-confirmed'});continue;}
    scored.push({
      ...row,success:Boolean(o.usedOnTime??(o.used&&!o.late)),dangerWeight:clamp(Number(o.dangerWeight)||1,0.25,1),
      preventableDeath:o.preventableDeath===true,confidence:o.confidence||'high'
    });
  }
  return{scored,unscored};
}

function dutyLedger(player,opportunities){
  const actorId=Number(player.actorId),scored=[],unscored=[];
  for(const o of dedupeBy(arr(opportunities).filter(x=>Number(x.actorId)===actorId),x=>`${actorId}:${x.opportunityKey||`${x.fightId}:${x.dutyKey||''}:${x.timestampReportMs||''}`}`)){
    if(o.assigned!==true||o.observable!==true){unscored.push({...o,actorId,kind:'duty',reason:o.assigned!==true?'duty-not-proven-assigned':'duty-outcome-not-observable'});continue;}
    scored.push({...o,actorId,kind:'duty',success:Boolean(o.success),importance:clamp(Number(o.importance)||1,0.25,1),confidence:o.confidence||'high'});
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

export function buildReliabilityEvidenceLedger({
  players=[],fights=[],mechanicFailures=[],mechanicOpportunities=[],meaningfulDeathsByFight={},
  defensiveOpportunities=[],dutyOpportunities=[],reportCode=null,encounter=null,nights=1
}={}){
  const meaningful=meaningfulRowsByFight(meaningfulDeathsByFight);
  return arr(players).map(player=>{
    const fightIds=attendedFightIds(player,fights);
    const mechanic=mechanicLedger(player,mechanicOpportunities,mechanicFailures);
    const defensives=defensiveLedger(player,defensiveOpportunities);
    const duties=dutyLedger(player,dutyOpportunities);
    const identity=reliabilityIdentity(player,{reportCode});
    return{
      schemaVersion:1,
      identity:{...identity,actorId:Number(player.actorId),name:player.name||null,className:player.className||null,spec:player.spec||null,role:roleKey(player.role)},
      context:{reportCode,encounterId:encounter?.id??encounter?.encounterID??null,difficulty:encounter?.difficulty??null,nights:Number(nights)||1},
      participation:{pullsAttended:fightIds.length,fightIds},
      mechanics:{opportunities:mechanic.scored,unscoredFailures:mechanic.unscoredFailures},
      survival:{opportunities:survivalLedger(player,fightIds,meaningful)},
      defensives:{opportunities:defensives.scored,unscored:defensives.unscored},
      duties:{opportunities:duties.scored,unscored:duties.unscored},
      adaptation:adaptationSignal(mechanic.scored),
      integrity:{
        reportScopedIdentity:identity.status==='report-scoped',
        mechanicDenominatorComplete:mechanic.unscoredFailures.length===0&&mechanic.scored.length>0,
        defensiveAvailabilityComplete:defensives.scored.length>0&&defensives.unscored.length===0,
        dutyDenominatorComplete:duties.scored.length>0&&duties.unscored.length===0
      }
    };
  });
}
