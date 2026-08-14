export const ENCOUNTER_META_QUERY=`
query AvoidTelemetryMeta($code:String!){reportData{report(code:$code,allowUnlisted:true){code startTime endTime masterData{actors{id name type subType server} abilities{gameID name icon type}} fights(killType:Encounters){id encounterID name difficulty kill startTime endTime fightPercentage bossPercentage averageItemLevel inProgress lastPhaseAsAbsoluteIndex phaseTransitions{id startTime} friendlyPlayers friendlySpecs friendlyItemLevels wipeCalledTime}}}}`;

export const THROUGHPUT_QUERY=`
query AvoidThroughput($code:String!,$all:[Int],$best:[Int],$compare:[Int],$p1s:Float,$p1e:Float,$p2s:Float,$p2e:Float,$p3s:Float,$p3e:Float){reportData{report(code:$code,allowUnlisted:true){
 playerDetails(fightIDs:$best,includeCombatantInfo:true)
 allCasts:table(dataType:Casts,fightIDs:$all)
 allHealing:table(dataType:Healing,fightIDs:$all)
 bestSummary:table(dataType:Summary,fightIDs:$best)
 bestDamageDone:table(dataType:DamageDone,fightIDs:$best)
 bestDamageTaken:table(dataType:DamageTaken,fightIDs:$best)
 bestHealing:table(dataType:Healing,fightIDs:$best)
 compareSummary:table(dataType:Summary,fightIDs:$compare)
 compareDamageDone:table(dataType:DamageDone,fightIDs:$compare)
 compareHealing:table(dataType:Healing,fightIDs:$compare)
 phase1:table(dataType:Summary,fightIDs:$best,startTime:$p1s,endTime:$p1e)
 phase2:table(dataType:Summary,fightIDs:$best,startTime:$p2s,endTime:$p2e)
 phase3:table(dataType:Summary,fightIDs:$best,startTime:$p3s,endTime:$p3e)
 damageGraph:graph(dataType:DamageDone,fightIDs:$best)
 healingGraph:graph(dataType:Healing,fightIDs:$best)
}}}`;

export const ACCOUNTABILITY_QUERY=`
query AvoidAccountability($code:String!,$all:[Int]){reportData{report(code:$code,allowUnlisted:true){
 allDamageTaken:table(dataType:DamageTaken,fightIDs:$all)
 allDeaths:table(dataType:Deaths,fightIDs:$all)
 allInterrupts:table(dataType:Interrupts,fightIDs:$all)
 allDispels:table(dataType:Dispels,fightIDs:$all)
 allBuffs:table(dataType:Buffs,fightIDs:$all)
 allDebuffs:table(dataType:Debuffs,fightIDs:$all)
 allSurvivability:table(dataType:Survivability,fightIDs:$all)
}}}`;

export const TELEMETRY_EVENTS_QUERY=`
query AvoidTelemetryEvents($code:String!,$all:[Int],$best:[Int]){reportData{report(code:$code,allowUnlisted:true){
 bestEnemyCasts:events(dataType:Casts,fightIDs:$best,hostilityType:Enemies,limit:10000,useAbilityIDs:true,useActorIDs:true){data nextPageTimestamp}
 allInterrupts:events(dataType:Interrupts,fightIDs:$all,hostilityType:Friendlies,limit:10000,useAbilityIDs:true,useActorIDs:true){data nextPageTimestamp}
 allDispels:events(dataType:Dispels,fightIDs:$all,hostilityType:Friendlies,limit:10000,useAbilityIDs:true,useActorIDs:true){data nextPageTimestamp}
 allDeaths:events(dataType:Deaths,fightIDs:$all,hostilityType:Friendlies,limit:10000,useAbilityIDs:true,useActorIDs:true){data nextPageTimestamp}
 meaningfulDeaths:events(dataType:Deaths,fightIDs:$all,hostilityType:Friendlies,wipeCutoff:5,limit:10000,useAbilityIDs:true,useActorIDs:true){data nextPageTimestamp}
 bestDeaths:events(dataType:Deaths,fightIDs:$best,hostilityType:Friendlies,limit:10000,includeResources:true,useAbilityIDs:true,useActorIDs:true){data nextPageTimestamp}
 bestDebuffs:events(dataType:Debuffs,fightIDs:$best,hostilityType:Friendlies,limit:10000,useAbilityIDs:true,useActorIDs:true){data nextPageTimestamp}
}}}`;

export const COMBATANT_INFO_QUERY=`
query AvoidCombatantInfo($code:String!,$best:[Int]){reportData{report(code:$code,allowUnlisted:true){
 bestCombatantInfo:events(dataType:CombatantInfo,fightIDs:$best,hostilityType:Friendlies,limit:1000,useAbilityIDs:true,useActorIDs:true){data nextPageTimestamp}
}}}`;
