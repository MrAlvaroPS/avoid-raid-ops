import { abilityBreakdown } from '../../wcl/normalization/tables.mjs';
import { firstCastByAbility } from '../../wcl/normalization/events.mjs';
export function observedAbilityDisclaimer(){return{classification:'observed',failure:null,wipeImpact:null,rulePackStatus:'pending'};}
export function topObservedAbilities(damageTakenTable,castEvents,fight,limit=8){
  const casts=firstCastByAbility(castEvents,fight?.startTime||0);
  const abilities=abilityBreakdown(damageTakenTable).filter(a=>Number(a.total)>0 && !(Number(a.id)===1 || String(a.name||'').toLowerCase()==='melee')).sort((a,b)=>Number(b.total)-Number(a.total)).slice(0,limit);
  const total=abilities.reduce((s,a)=>s+(Number(a.total)||0),0)||1;
  return abilities.map(a=>{const first=(a.id!=null?casts.get(String(a.id)):null)||casts.get(String(a.name))||null;return{id:a.id,name:a.name,totalDamageTaken:a.total,shareOfTopObservedDamagePct:100*Number(a.total)/total,firstCastMs:first?.ms??null,source:'WCL DamageTaken abilities + Cast events',classification:'observed',failures:null,wipeImpact:null}});
}
