const arr=v=>Array.isArray(v)?v:[];
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const pct=(n,d)=>d>0?Math.round((1000*n/d))/10:null;

function directoryRow(directory,key){
  if(directory instanceof Map)return directory.get(key)||{};
  return directory?.[key]||{};
}

/**
 * Build a compact, deduplicated encounter-attendance model from canonical raid
 * sessions. `rosterKeys` must already have been unioned across duplicate logger
 * views of the same pull.
 *
 * "Since incorporation" cannot be proven from WCL alone, so the contract uses
 * the first indexed appearance as the denominator boundary. This avoids
 * penalising a player for raid nights/pulls that happened before we first saw
 * that character in the indexed encounter history.
 */
export function buildPlayerAttendance(sessions=[],directory=new Map()){
  const pulls=arr(sessions).flatMap((session,sessionIndex)=>
    arr(session?.progressionPulls).map((pull,pullIndex)=>({
      sessionId:session?.sessionId||`session-${sessionIndex+1}`,
      sessionIndex:Number(session?.sessionIndex)||sessionIndex+1,
      sessionStartTime:finite(session?.startTime),
      pullIndex:pullIndex+1,
      absoluteStartTime:finite(pull?.absoluteStartTime),
      rosterKeys:[...new Set(arr(pull?.rosterKeys).filter(Boolean))]
    }))
  ).filter(p=>p.absoluteStartTime!=null).sort((a,b)=>a.absoluteStartTime-b.absoluteStartTime);

  const byPlayer=new Map();
  for(const pull of pulls){
    for(const key of pull.rosterKeys){
      let row=byPlayer.get(key);
      if(!row){
        const meta=directoryRow(directory,key);
        row={
          key,
          name:meta?.name||null,
          className:meta?.className||meta?.subType||null,
          server:meta?.server||null,
          firstIndexedAt:pull.absoluteStartTime,
          lastIndexedAt:pull.absoluteStartTime,
          attendedPullKeys:new Set(),
          attendedSessions:new Set()
        };
        byPlayer.set(key,row);
      }
      row.firstIndexedAt=Math.min(row.firstIndexedAt,pull.absoluteStartTime);
      row.lastIndexedAt=Math.max(row.lastIndexedAt,pull.absoluteStartTime);
      row.attendedPullKeys.add(`${pull.sessionId}:${pull.pullIndex}:${pull.absoluteStartTime}`);
      row.attendedSessions.add(pull.sessionId);
    }
  }

  const players=[];
  for(const row of byPlayer.values()){
    const eligiblePulls=pulls.filter(p=>p.absoluteStartTime>=row.firstIndexedAt);
    const eligibleSessions=new Set(eligiblePulls.map(p=>p.sessionId));
    const pullsAttended=row.attendedPullKeys.size;
    const pullsEligible=eligiblePulls.length;
    const sessionsAttended=row.attendedSessions.size;
    const sessionsEligible=eligibleSessions.size;
    players.push({
      key:row.key,
      name:row.name,
      className:row.className,
      server:row.server,
      firstIndexedAt:row.firstIndexedAt,
      lastIndexedAt:row.lastIndexedAt,
      pullsAttended,
      pullsEligible,
      pullAttendancePct:pct(pullsAttended,pullsEligible),
      sessionsAttended,
      sessionsEligible,
      sessionAttendancePct:pct(sessionsAttended,sessionsEligible),
      denominatorBoundary:'first-indexed-appearance',
      source:'canonical-deduplicated-encounter-history'
    });
  }

  players.sort((a,b)=>(a.firstIndexedAt-b.firstIndexedAt)||String(a.name||a.key).localeCompare(String(b.name||b.key)));
  return{
    status:players.length?'observed':'pending',
    denominatorBoundary:'first-indexed-appearance',
    semantics:'Attendance since first indexed appearance; WCL does not prove guild join date.',
    indexedPulls:pulls.length,
    indexedSessions:new Set(pulls.map(p=>p.sessionId)).size,
    players
  };
}
