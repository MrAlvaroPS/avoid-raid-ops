function ids(pack,fields){return [...new Set((pack?.mechanics||[]).flatMap(m=>fields.flatMap(f=>m?.[f]||[])).map(Number).filter(Number.isFinite))];}
export function filtersForPack(pack){
  const stateIds=(pack?.stateDimensions||[]).flatMap(d=>Object.values(d.values||{}).flatMap(v=>v?.ids||[]));
  const legacy=[...(pack?.auras?.lightFeather?.ids||[]),...(pack?.auras?.voidFeather?.ids||[])];
  return{damage:ids(pack,['damageIds','failureDamageIds']),casts:ids(pack,['castIds','opportunityCastIds']),enemyBuffs:ids(pack,['failureAuraIds']),friendlyAuras:[...new Set([...stateIds,...legacy].map(Number).filter(Number.isFinite))]};
}
