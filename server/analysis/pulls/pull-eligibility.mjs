import { durationMs } from '../../wcl/normalization/primitives.mjs';
import { stageCount } from '../../wcl/normalization/fights.mjs';

const finite=v=>Number.isFinite(Number(v));
const n=v=>finite(v)?Number(v):null;

function verdict({eligible,classification,reasons=[],evidence={}}){
  return {
    eligible:Boolean(eligible),
    classification,
    reason:reasons[0]||null,
    reasons,
    evidence
  };
}

/**
 * Decide whether a closed WCL fight is useful as an analytical pull.
 *
 * Exclusion never rewrites history: the WCL fight still exists and may be used
 * for diagnostics/polling. It is only removed from progression, comparisons,
 * reliability, mechanic/blocker scoring and raid-night rollups.
 */
export function classifyPullForAnalysis(fight,{firstDeathMs=null}={}){
  if(!fight) return verdict({eligible:false,classification:'missing-fight',reasons:['missing-fight']});
  const duration=durationMs(fight);
  const stages=stageCount(fight);
  const boss=n(fight.bossPercentage);
  const fightPct=n(fight.fightPercentage);
  const wipeCalledRaw=n(fight.wipeCalledTime);
  // WCL commonly serializes an unset wipeCalledTime as 0. Treat that as absent;
  // otherwise every normal pull becomes an "early-called-wipe".
  const wipeCalled=wipeCalledRaw!=null&&wipeCalledRaw>0?wipeCalledRaw:null;
  const start=n(fight.startTime)??0;
  const wipeCalledRelative=wipeCalled==null?null:Math.max(0,wipeCalled-start);
  const evidence={durationMs:duration,stageCount:stages,bossPercentage:boss,fightPercentage:fightPct,firstDeathMs:firstDeathMs==null?null:Number(firstDeathMs),wipeCalledRelativeMs:wipeCalledRelative};

  if(fight.kill) return verdict({eligible:true,classification:'kill',evidence});
  if(duration>0 && duration<20000){
    return verdict({eligible:false,classification:'called-wipe',reasons:['short-reset'],evidence});
  }
  if(wipeCalledRelative!=null && wipeCalledRelative<=20000){
    return verdict({eligible:false,classification:'called-wipe',reasons:['early-called-wipe'],evidence});
  }
  if(stages<=1 && duration<=45000 && boss!=null && boss>=95 && (fightPct==null || fightPct>=99)){
    return verdict({eligible:false,classification:'called-wipe',reasons:['early-reset-no-progress'],evidence});
  }
  if(firstDeathMs!=null && Number(firstDeathMs)<=12000 && stages<=1 && boss!=null && boss>=95){
    return verdict({eligible:false,classification:'called-wipe',reasons:['early-death-reset'],evidence});
  }
  return verdict({eligible:true,classification:'analytical-pull',evidence});
}

export function splitAnalyticalPulls(fights=[],deathAnalysis=null){
  const eligible=[],excluded=[];
  const ordered=(fights||[]).slice().sort((a,b)=>Number(a.startTime)-Number(b.startTime));
  for(const fight of ordered){
    const first=deathAnalysis?.rawByFight?.[fight.id]?.[0] || deathAnalysis?.meaningfulByFight?.[fight.id]?.[0];
    const verdictRow=classifyPullForAnalysis(fight,{firstDeathMs:first?.fightRelativeMs??null});
    const row={fight,verdict:verdictRow};
    (verdictRow.eligible?eligible:excluded).push(row);
  }
  return {
    eligible:eligible.map(x=>x.fight),
    excluded:excluded.map(({fight,verdict})=>({
      fightId:Number(fight.id),
      originalPullNumber:ordered.findIndex(x=>Number(x.id)===Number(fight.id))+1,
      classification:verdict.classification,
      reasons:verdict.reasons,
      reason:verdict.reason,
      durationMs:durationMs(fight),
      fightPercentage:n(fight.fightPercentage),
      bossPercentage:n(fight.bossPercentage),
      stageCount:stageCount(fight),
      firstDeathMs:verdict.evidence?.firstDeathMs??null,
      wipeCalledRelativeMs:verdict.evidence?.wipeCalledRelativeMs??null
    }))
  };
}
