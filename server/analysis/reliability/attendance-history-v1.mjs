const norm=v=>String(v||'').trim().toLowerCase();

export const ATTENDANCE_HISTORY_VERSION='1.0.0';

export function canonicalActorIdentity(actor={}){
  const name=String(actor.name||'').trim();
  if(!name)return null;
  const server=String(actor.server||actor.serverName||'').trim();
  return{
    key:`${norm(server)||'unknown'}:${norm(name)}`,
    name,
    server:server||null,
    className:actor.subType||actor.type||null
  };
}

export function buildIndexedRaidAttendance(sessions=[]){
  const ordered=(sessions||[]).filter(s=>Array.isArray(s.progressionPulls)&&s.progressionPulls.length).slice().sort((a,b)=>Number(a.startTime)-Number(b.startTime));
  const sessionRows=ordered.map((session,index)=>{
    const pulls=session.progressionPulls||[];
    const playerPulls=new Map();
    for(const pull of pulls){
      const seen=new Set();
      for(const identity of pull.rosterIdentities||[]){
        if(!identity?.key||seen.has(identity.key))continue;
        seen.add(identity.key);
        const row=playerPulls.get(identity.key)||{identity,pullsAttended:0};
        row.pullsAttended++;
        playerPulls.set(identity.key,row);
      }
    }
    return{
      sessionId:session.sessionId,
      sessionIndex:index,
      startTime:session.startTime,
      endTime:session.endTime,
      pulls:pulls.length,
      players:playerPulls
    };
  });

  const identities=new Map();
  for(const session of sessionRows){
    for(const [key,row] of session.players){
      const current=identities.get(key)||{identity:row.identity,firstSessionIndex:session.sessionIndex,lastSessionIndex:session.sessionIndex};
      current.firstSessionIndex=Math.min(current.firstSessionIndex,session.sessionIndex);
      current.lastSessionIndex=Math.max(current.lastSessionIndex,session.sessionIndex);
      identities.set(key,current);
    }
  }

  const players=[];
  for(const [key,meta] of identities){
    const scope=sessionRows.slice(meta.firstSessionIndex);
    const attended=scope.filter(s=>s.players.has(key));
    const pullsAttended=attended.reduce((sum,s)=>sum+Number(s.players.get(key)?.pullsAttended||0),0);
    const eligiblePulls=scope.reduce((sum,s)=>sum+Number(s.pulls||0),0);
    const sessionsAttended=attended.length;
    const eligibleSessions=scope.length;
    players.push({
      identity:meta.identity,
      firstIndexedAt:scope[0]?.startTime??null,
      lastIndexedAt:sessionRows[meta.lastSessionIndex]?.endTime??null,
      sessionsAttended,
      eligibleSessions,
      sessionAttendancePct:eligibleSessions?100*sessionsAttended/eligibleSessions:null,
      pullsAttended,
      eligiblePulls,
      pullPresencePct:eligiblePulls?100*pullsAttended/eligiblePulls:null
    });
  }

  players.sort((a,b)=>String(a.identity?.name||'').localeCompare(String(b.identity?.name||'')));
  return{
    version:ATTENDANCE_HISTORY_VERSION,
    scope:'indexed-comparable-raid-sessions-since-first-appearance',
    semantics:'Observed WCL presence from the first indexed appearance onward; this is not a guild-membership or excused-absence register.',
    sessions:sessionRows.length,
    players
  };
}
