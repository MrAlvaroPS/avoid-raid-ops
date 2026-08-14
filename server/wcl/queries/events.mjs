export const BEST_PULL_EVENTS_QUERY = `
query AvoidBestPullEvents($code:String!,$best:[Int]) {
 reportData { report(code:$code, allowUnlisted:true) {
  casts:events(dataType:Casts,fightIDs:$best,limit:10000,useAbilityIDs:true,useActorIDs:true){data nextPageTimestamp}
  interrupts:events(dataType:Interrupts,fightIDs:$best,limit:10000,useAbilityIDs:true,useActorIDs:true){data nextPageTimestamp}
  dispels:events(dataType:Dispels,fightIDs:$best,limit:10000,useAbilityIDs:true,useActorIDs:true){data nextPageTimestamp}
  debuffs:events(dataType:Debuffs,fightIDs:$best,limit:10000,useAbilityIDs:true,useActorIDs:true){data nextPageTimestamp}
  buffs:events(dataType:Buffs,fightIDs:$best,limit:10000,useAbilityIDs:true,useActorIDs:true){data nextPageTimestamp}
  deaths:events(dataType:Deaths,fightIDs:$best,limit:10000,includeResources:true,useAbilityIDs:true,useActorIDs:true){data nextPageTimestamp}
 } }
}`;
