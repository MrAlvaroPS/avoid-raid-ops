export function paginatorEvents(value){
  const raw=value?.data;
  if(Array.isArray(raw)) return raw;
  if(raw&&Array.isArray(raw.data)) return raw.data;
  return [];
}
export function eventAbilityId(e){
  if(typeof e?.ability==='number') return Number(e.ability);
  const v=e?.abilityGameID ?? e?.ability?.guid ?? e?.ability?.id; const n=Number(v); return Number.isFinite(n)?n:null;
}
export function eventAbilityName(e){return e?.ability?.name ?? e?.abilityName ?? null;}
export function eventSourceId(e){const n=Number(e?.sourceID ?? e?.source?.id); return Number.isFinite(n)?n:null;}
export function eventTargetId(e){const n=Number(e?.targetID ?? e?.target?.id); return Number.isFinite(n)?n:null;}
export function countByActor(events,{actor='source'}={}){
  const map=new Map();
  for(const e of events||[]){const id=actor==='target'?eventTargetId(e):eventSourceId(e); if(id==null)continue; map.set(id,(map.get(id)||0)+1)}
  return map;
}
export function firstCastByAbility(events,fightStart=0){
  const map=new Map();
  for(const e of events||[]){const id=eventAbilityId(e),name=eventAbilityName(e); if(id==null&&!name)continue; const ts=Number(e.timestamp); if(!Number.isFinite(ts))continue; const rel=ts>=Number(fightStart)?ts-Number(fightStart):ts; const item={ms:rel,name,id}; if(id!=null&&(!map.has(String(id))||rel<map.get(String(id)).ms))map.set(String(id),item); if(name&&(!map.has(String(name))||rel<map.get(String(name)).ms))map.set(String(name),item)}
  return map;
}
export function eventsForFight(events,fight){
  if(!fight)return[]; return (events||[]).filter(e=>{
    if(Number.isFinite(Number(e.fight))) return Number(e.fight)===Number(fight.id);
    const ts=Number(e.timestamp); return Number.isFinite(ts)&&ts>=Number(fight.startTime)&&ts<=Number(fight.endTime);
  });
}
