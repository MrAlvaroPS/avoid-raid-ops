export const LIVE_RL_DIAGNOSTIC_QUERY=`
query AvoidLiveRlDiagnostic($code:String!,$fight:[Int]){reportData{report(code:$code,allowUnlisted:true){
 fights(killType:Encounters){id encounterID name difficulty kill startTime endTime fightPercentage bossPercentage inProgress}
 masterData{actors{id name type subType}}
 currentDamageTaken:table(dataType:DamageTaken,fightIDs:$fight)
 currentEnemyCasts:events(dataType:Casts,fightIDs:$fight,hostilityType:Enemies,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
 currentInterrupts:events(dataType:Interrupts,fightIDs:$fight,hostilityType:Friendlies,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
 currentDispels:events(dataType:Dispels,fightIDs:$fight,hostilityType:Friendlies,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
 currentDebuffs:events(dataType:Debuffs,fightIDs:$fight,hostilityType:Friendlies,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
 currentDeaths:events(dataType:Deaths,fightIDs:$fight,hostilityType:Friendlies,limit:1000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
}}}`;
