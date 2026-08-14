import { eventsForFight,eventTargetId } from '../../wcl/normalization/events.mjs';

function timestamp(e){const n=Number(e?.timestamp);return Number.isFinite(n)?n:null;}
function normalizeOne(e,fight,actors){
  const actorId=eventTargetId(e);
  const actor=actors?.get?.(Number(actorId));
  const ts=timestamp(e);
  const fightStart=Number(fight?.startTime||0);
  return {
    fightId:Number(fight?.id),
    actorId,
    player:actor?.name||e?.target?.name||e?.name||null,
    timestampReportMs:ts,
    fightRelativeMs:ts==null?null:(ts>=fightStart?ts-fightStart:ts),
    abilityId:Number.isFinite(Number(e?.ability))?Number(e.ability):Number.isFinite(Number(e?.abilityGameID))?Number(e.abilityGameID):null,
    killingBlow:e?.ability?.name||e?.abilityName||e?.killingBlow?.name||null,
    overkill:Number.isFinite(Number(e?.overkill))?Number(e.overkill):null
  };
}

export function analyzeDeaths({events=[],meaningfulEvents=[],fights=[],actors=new Map(),wipeCutoff=5}){
  const rawByFight={},meaningfulByFight={},firstDeaths=[];
  for(const fight of fights){
    const raw=eventsForFight(events,fight).map(e=>normalizeOne(e,fight,actors)).sort((a,b)=>(a.timestampReportMs??0)-(b.timestampReportMs??0));
    const meaningful=eventsForFight(meaningfulEvents,fight).map(e=>normalizeOne(e,fight,actors)).sort((a,b)=>(a.timestampReportMs??0)-(b.timestampReportMs??0));
    rawByFight[fight.id]=raw;
    meaningfulByFight[fight.id]=meaningful;
    if(raw[0]) firstDeaths.push(raw[0]);
  }
  const countByPlayer=(rows)=>{const m=new Map();for(const r of rows){if(r.actorId==null)continue;m.set(Number(r.actorId),(m.get(Number(r.actorId))||0)+1)}return m;};
  const rawFlat=Object.values(rawByFight).flat(), meaningfulFlat=Object.values(meaningfulByFight).flat();
  return {
    rawByFight,meaningfulByFight,firstDeaths,
    rawCount:rawFlat.length,
    meaningfulCount:meaningfulFlat.length,
    firstDeathCount:firstDeaths.length,
    rawByPlayer:countByPlayer(rawFlat),
    meaningfulByPlayer:countByPlayer(meaningfulFlat),
    firstDeathByPlayer:countByPlayer(firstDeaths),
    wipeCutoff,
    semantics:{raw:'All friendly death events returned by WCL',meaningful:`WCL Death events with wipeCutoff=${wipeCutoff}`,firstDeath:'First friendly death event in each pull'}
  };
}
