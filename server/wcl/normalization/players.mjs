import { durationMs, num } from './primitives.mjs';
import { indexEntriesByActor, matchActor, compositionIndex } from './tables.mjs';
import { countByActor } from './events.mjs';

export function normalizePlayers({report,fight,bestSummary,bestDamageDone,bestHealing,bestDamageTaken,allCasts,interruptEvents=[],dispelEvents=[],deathAnalysis=null,profiles=new Map(),encounterPulls=0}){
  const actors=new Map((report.masterData?.actors||[]).map(a=>[Number(a.id),a]));
  const roleIndex=compositionIndex(bestSummary);
  const dpsIndex=indexEntriesByActor(bestDamageDone),healIndex=indexEntriesByActor(bestHealing),takenIndex=indexEntriesByActor(bestDamageTaken),castIndex=indexEntriesByActor(allCasts);
  const interruptCounts=countByActor(interruptEvents,{actor:'source'}),dispelCounts=countByActor(dispelEvents,{actor:'source'});
  const seconds=Math.max(1,durationMs(fight)/1000);
  return (fight.friendlyPlayers||[]).map((id,idx)=>{
    const actor=actors.get(Number(id))||{}; const keyById=roleIndex.get(`id:${id}`), keyByName=roleIndex.get(`name:${String(actor.name||'').toLowerCase()}`); const roleData=keyById||keyByName||{};
    const base={actorId:Number(id),name:actor.name||roleData.name||`Actor ${id}`,className:roleData.className||actor.subType||actor.type||null,spec:roleData.spec||fight.friendlySpecs?.[idx]||null,itemLevel:num(fight.friendlyItemLevels?.[idx]),role:roleData.role||null,server:actor.server||null};
    const d=matchActor(dpsIndex,base),h=matchActor(healIndex,base),t=matchActor(takenIndex,base),c=matchActor(castIndex,base),profile=profiles.get(Number(id))||null;
    const bestPull={damage:num(d?.total)||0,dps:(num(d?.total)||0)/seconds,healing:num(h?.total)||0,hps:(num(h?.total)||0)/seconds,damageTaken:num(t?.total)||0,casts:num(c?.total??c?.count)||0};
    const encounter={pulls:Number(encounterPulls)||0,deaths:deathAnalysis?.rawByPlayer?.get(Number(id))||0,meaningfulDeaths:deathAnalysis?.meaningfulByPlayer?.get(Number(id))||0,firstDeaths:deathAnalysis?.firstDeathByPlayer?.get(Number(id))||0,interrupts:interruptCounts.get(Number(id))||0,dispels:dispelCounts.get(Number(id))||0};
    const character={gear:profile?.gear||[],gearCount:profile?.gearCount||0,powerGearCount:profile?.powerGearCount||0,recordedItemLevelMean:profile?.recordedItemLevelMean??null,gearAverageItemLevel:null,talents:profile?.talents||[],talentCount:profile?.talentCount||0,talentPoints:profile?.talentPoints||0,buildFingerprint:profile?.buildFingerprint||null,talentImportCode:profile?.talentImportCode||null,talentWowheadUrl:profile?.talentWowheadUrl||null,combatantInfoSource:profile?.source||null};
    const reliability={value:null,status:'shadow-pending',confidence:'unknown',reason:'Reliability v1 requires player-specific mechanic denominators, defensive availability and longitudinal coverage before publication.'};
    return {
      ...base,bestPull,encounter,character,reliability,
      // Compatibility aliases for the current golden-master data adapter. They are
      // explicitly scoped above and will disappear once source React becomes deploy target.
      damage:bestPull.damage,dps:bestPull.dps,healing:bestPull.healing,hps:bestPull.hps,damageTaken:bestPull.damageTaken,casts:bestPull.casts,
      deaths:encounter.deaths,meaningfulDeaths:encounter.meaningfulDeaths,firstDeaths:encounter.firstDeaths,interrupts:encounter.interrupts,dispels:encounter.dispels
    };
  });
}
