function confidenceRank(c){return c==='confirmed'?4:c==='high'?3:c==='medium'?2:c==='low'?1:0;}
function recencyWeight(deltaMs,windowMs){return Math.max(0,1-deltaMs/windowMs);}

export function buildDeathChains({deathAnalysis,mechanicFailures=[],windowMs=10000,actors=new Map()}){
  const deaths=Object.values(deathAnalysis?.meaningfulByFight||{}).flat();
  const chains=deaths.map(death=>{
    const candidates=mechanicFailures.filter(f=>{
      if(Number(f.fightId)!==Number(death.fightId)||f.timestampReportMs==null||death.timestampReportMs==null||f.timestampReportMs>death.timestampReportMs)return false;
      const delta=death.timestampReportMs-f.timestampReportMs;if(delta>windowMs)return false;
      if(f.actorId!=null)return Number(f.actorId)===Number(death.actorId);
      // Raid-wide failures can correlate with many later deaths by chance. Keep
      // them eligible only when the WCL signal is strong and temporally tight.
      return f.scope==='raid'&&['confirmed','high'].includes(f.confidence)&&delta<=3000;
    }).map(f=>{
      const delta=death.timestampReportMs-f.timestampReportMs;
      const actorSpecific=f.actorId!=null;
      const scopePenalty=actorSpecific?1:0.55;
      const score=(Number(f.severity)||1)*recencyWeight(delta,windowMs)*(1+0.15*confidenceRank(f.confidence))*scopePenalty;
      return{...f,deltaMs:delta,causalScore:score};
    }).sort((a,b)=>b.causalScore-a.causalScore);
    const primary=candidates[0]||null;
    const conf=primary?(primary.confidence==='confirmed'&&primary.deltaMs<=5000?'high':primary.confidence==='high'&&primary.deltaMs<=5000?'high':'medium'):'unknown';
    return{
      fightId:death.fightId,actorId:death.actorId,player:death.player||actors.get?.(Number(death.actorId))?.name||null,
      deathAtMs:death.timestampReportMs,fightRelativeMs:death.fightRelativeMs,killingBlow:death.killingBlow||null,
      probableCause:primary?{mechanicKey:primary.mechanicKey,mechanicName:primary.mechanicName,reason:primary.reason,occurredMsBeforeDeath:primary.deltaMs,occurrenceKey:primary.occurrenceKey||null}:null,
      confidence:conf,evidence:candidates.slice(0,5)
    };
  });
  const linkedByMechanic=new Map();
  for(const c of chains){if(!c.probableCause)continue;const k=c.probableCause.mechanicKey;linkedByMechanic.set(k,(linkedByMechanic.get(k)||0)+1);}
  return{status:'probable-causality',windowMs,chains,linkedByMechanic:Object.fromEntries(linkedByMechanic),classified:chains.filter(c=>c.probableCause).length,total:chains.length,disclaimer:'Probable cause is an evidence-ranked temporal association, not proof of causation.'};
}

function recentOccurrenceCount(failures,recent){
  const keys=new Set();
  for(const f of failures){
    if(!recent.has(Number(f.fightId)))continue;
    keys.add(f.occurrenceKey||`${f.fightId}:${f.mechanicKey}:${Math.round(Number(f.timestampReportMs||0)/500)}`);
  }
  return keys.size;
}

export function findCurrentBlocker({mechanicsAnalysis,deathChains,recentFightIds=[]}){
  const recent=new Set(recentFightIds.map(Number));
  const mechanicByKey=new Map((mechanicsAnalysis?.mechanics||[]).map(m=>[m.key,m]));
  const failuresByKey=new Map();
  for(const f of mechanicsAnalysis?.failures||[]){
    if(!failuresByKey.has(f.mechanicKey))failuresByKey.set(f.mechanicKey,[]);
    failuresByKey.get(f.mechanicKey).push(f);
  }
  const linkedByKey=new Map();
  for(const c of deathChains?.chains||[]){
    const k=c.probableCause?.mechanicKey;if(k)linkedByKey.set(k,(linkedByKey.get(k)||0)+1);
  }

  const rows=[];
  for(const [key,meta] of mechanicByKey){
    if(!meta?.scoreable||Number(meta.failedOccurrences||0)<=0)continue;
    const failures=failuresByKey.get(key)||[];
    const fights=[...new Set(failures.map(f=>Number(f.fightId)).filter(Number.isFinite))];
    const recurrence=fights.length;
    const failedOccurrences=Number(meta.failedOccurrences)||0;
    const recentFailures=recentOccurrenceCount(failures,recent);
    const opportunities=Number(meta.opportunities)||0;
    const failureRate=meta.denominatorStatus==='normalized'&&opportunities>0?failedOccurrences/opportunities:null;
    const linkedDeaths=Number(linkedByKey.get(key)||0);
    const recencyRatio=failedOccurrences>0?recentFailures/failedOccurrences:0;
    const severity=Math.max(1,Number(meta.severity)||1);
    // Occurrence-normalized blocker score. Player splash/ticks can increase
    // evidence detail, but never increase the numerator beyond one failed
    // mechanic execution.
    const score=severity
      * Math.max(1,recurrence)
      * (1+(failureRate??0.15)*2)
      * (1+Math.min(1,recencyRatio)*2)
      * (1+Math.min(3,linkedDeaths)*0.6);
    rows.push({
      key,name:meta.name,severity,failedOccurrences,failures:failedOccurrences,recentFailures,fights,linkedDeaths,score,recurrence,
      opportunities,failureRate,executionSuccessPct:meta.executionSuccessPct??null,playerExposures:Number(meta.playerExposures)||0,
      denominatorStatus:meta.denominatorStatus
    });
  }
  rows.sort((a,b)=>b.score-a.score);
  const top=rows[0]||null;
  return{
    status:top?'derived':'insufficient-data',blocker:top,ranking:rows,
    confidence:top&&top.linkedDeaths>0&&top.recurrence>=2?'high':top&&top.recurrence>=2?'medium':'low',
    scoringModel:'severity × recurrence × normalized failure rate × recency × capped death evidence'
  };
}
