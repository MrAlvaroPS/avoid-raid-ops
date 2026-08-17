// Generic event bundle used by Iris semantic surgical probes.
//
// The same query serves two narrow purposes:
// - anchor discovery: exact fightIDs + one abilityID, no time range;
// - temporal context: one exact fightID + a bounded start/end window, abilityID=null.
//
// Eight aliases mirror the canonical Deep evidence families, but this evidence remains
// diagnostic-semantic-surgical and never contributes to canonical Deep coverage.
export const SEMANTIC_PROBE_EVENTS_QUERY = `
query AvoidSemanticProbeEvents(
 $code:String!,$fightIDs:[Int]!,$abilityID:Int,$windowStart:Float,$windowEnd:Float,$limit:Int!
){
 rateLimitData{limitPerHour pointsSpentThisHour pointsResetIn}
 reportData{report(code:$code,allowUnlisted:false){
  enemyCasts:events(dataType:Casts,fightIDs:$fightIDs,hostilityType:Enemies,abilityID:$abilityID,startTime:$windowStart,endTime:$windowEnd,limit:$limit,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  friendDamage:events(dataType:DamageTaken,fightIDs:$fightIDs,hostilityType:Friendlies,abilityID:$abilityID,startTime:$windowStart,endTime:$windowEnd,limit:$limit,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  interrupts:events(dataType:Interrupts,fightIDs:$fightIDs,hostilityType:Friendlies,abilityID:$abilityID,startTime:$windowStart,endTime:$windowEnd,limit:$limit,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  debuffs:events(dataType:Debuffs,fightIDs:$fightIDs,hostilityType:Friendlies,abilityID:$abilityID,startTime:$windowStart,endTime:$windowEnd,limit:$limit,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  buffs:events(dataType:Buffs,fightIDs:$fightIDs,hostilityType:Friendlies,abilityID:$abilityID,startTime:$windowStart,endTime:$windowEnd,limit:$limit,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  enemyBuffs:events(dataType:Buffs,fightIDs:$fightIDs,hostilityType:Enemies,abilityID:$abilityID,startTime:$windowStart,endTime:$windowEnd,limit:$limit,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  enemyDebuffs:events(dataType:Debuffs,fightIDs:$fightIDs,hostilityType:Enemies,abilityID:$abilityID,startTime:$windowStart,endTime:$windowEnd,limit:$limit,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  deaths:events(dataType:Deaths,fightIDs:$fightIDs,startTime:$windowStart,endTime:$windowEnd,limit:$limit,useAbilityIDs:true,useActorIDs:true,translate:false,wipeCutoff:5){data nextPageTimestamp}
 }}
}`;

// Each alias has an independent continuation cursor. @include lets one request advance
// only the aliases that still paginate, matching the canonical Deep safety semantics.
export const SEMANTIC_PROBE_EVENTS_CONTINUATION_QUERY = `
query AvoidSemanticProbeEventsContinuation(
 $code:String!,$fightIDs:[Int]!,$abilityID:Int,$windowEnd:Float,$limit:Int!,
 $enemyCastsOn:Boolean!,$enemyCastsStart:Float,
 $friendDamageOn:Boolean!,$friendDamageStart:Float,
 $interruptsOn:Boolean!,$interruptsStart:Float,
 $debuffsOn:Boolean!,$debuffsStart:Float,
 $buffsOn:Boolean!,$buffsStart:Float,
 $enemyBuffsOn:Boolean!,$enemyBuffsStart:Float,
 $enemyDebuffsOn:Boolean!,$enemyDebuffsStart:Float,
 $deathsOn:Boolean!,$deathsStart:Float
){
 rateLimitData{limitPerHour pointsSpentThisHour pointsResetIn}
 reportData{report(code:$code,allowUnlisted:false){
  enemyCasts:events(dataType:Casts,fightIDs:$fightIDs,hostilityType:Enemies,abilityID:$abilityID,startTime:$enemyCastsStart,endTime:$windowEnd,limit:$limit,useAbilityIDs:true,useActorIDs:true,translate:false) @include(if:$enemyCastsOn){data nextPageTimestamp}
  friendDamage:events(dataType:DamageTaken,fightIDs:$fightIDs,hostilityType:Friendlies,abilityID:$abilityID,startTime:$friendDamageStart,endTime:$windowEnd,limit:$limit,useAbilityIDs:true,useActorIDs:true,translate:false) @include(if:$friendDamageOn){data nextPageTimestamp}
  interrupts:events(dataType:Interrupts,fightIDs:$fightIDs,hostilityType:Friendlies,abilityID:$abilityID,startTime:$interruptsStart,endTime:$windowEnd,limit:$limit,useAbilityIDs:true,useActorIDs:true,translate:false) @include(if:$interruptsOn){data nextPageTimestamp}
  debuffs:events(dataType:Debuffs,fightIDs:$fightIDs,hostilityType:Friendlies,abilityID:$abilityID,startTime:$debuffsStart,endTime:$windowEnd,limit:$limit,useAbilityIDs:true,useActorIDs:true,translate:false) @include(if:$debuffsOn){data nextPageTimestamp}
  buffs:events(dataType:Buffs,fightIDs:$fightIDs,hostilityType:Friendlies,abilityID:$abilityID,startTime:$buffsStart,endTime:$windowEnd,limit:$limit,useAbilityIDs:true,useActorIDs:true,translate:false) @include(if:$buffsOn){data nextPageTimestamp}
  enemyBuffs:events(dataType:Buffs,fightIDs:$fightIDs,hostilityType:Enemies,abilityID:$abilityID,startTime:$enemyBuffsStart,endTime:$windowEnd,limit:$limit,useAbilityIDs:true,useActorIDs:true,translate:false) @include(if:$enemyBuffsOn){data nextPageTimestamp}
  enemyDebuffs:events(dataType:Debuffs,fightIDs:$fightIDs,hostilityType:Enemies,abilityID:$abilityID,startTime:$enemyDebuffsStart,endTime:$windowEnd,limit:$limit,useAbilityIDs:true,useActorIDs:true,translate:false) @include(if:$enemyDebuffsOn){data nextPageTimestamp}
  deaths:events(dataType:Deaths,fightIDs:$fightIDs,startTime:$deathsStart,endTime:$windowEnd,limit:$limit,useAbilityIDs:true,useActorIDs:true,translate:false,wipeCutoff:5) @include(if:$deathsOn){data nextPageTimestamp}
 }}
}`;
