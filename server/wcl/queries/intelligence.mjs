export const ENCOUNTER_INTELLIGENCE_QUERY = `
query AvoidEncounterIntelligence(
  $code:String!, $all:[Int],
  $damageFilter:String!, $castFilter:String!, $enemyBuffFilter:String!, $featherFilter:String!
){reportData{report(code:$code,allowUnlisted:true){
 mechanicDamage:events(dataType:DamageTaken,fightIDs:$all,hostilityType:Friendlies,filterExpression:$damageFilter,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
 mechanicCasts:events(dataType:Casts,fightIDs:$all,hostilityType:Enemies,filterExpression:$castFilter,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
 mechanicEnemyBuffs:events(dataType:Buffs,fightIDs:$all,hostilityType:Enemies,filterExpression:$enemyBuffFilter,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
 featherDebuffs:events(dataType:Debuffs,fightIDs:$all,hostilityType:Friendlies,filterExpression:$featherFilter,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
 featherBuffs:events(dataType:Buffs,fightIDs:$all,hostilityType:Friendlies,filterExpression:$featherFilter,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
 meaningfulDeaths:events(dataType:Deaths,fightIDs:$all,limit:10000,wipeCutoff:5,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
}}}`;

export function idsFilter(ids=[]){
  const values=[...new Set(ids.map(Number).filter(Number.isFinite))];
  return values.length ? `ability.id in (${values.join(',')})` : 'ability.id = -999999';
}

export const MECHANIC_DAMAGE_PAGE_QUERY=`
query AvoidMechanicDamagePage($code:String!,$all:[Int],$damageFilter:String!,$start:Float){
 reportData{report(code:$code,allowUnlisted:true){
  mechanicDamage:events(dataType:DamageTaken,fightIDs:$all,hostilityType:Friendlies,filterExpression:$damageFilter,startTime:$start,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
 }}}
`;

export const FEATHER_DEBUFF_PAGE_QUERY=`
query AvoidFeatherDebuffPage($code:String!,$all:[Int],$featherFilter:String!,$start:Float){
 reportData{report(code:$code,allowUnlisted:true){
  feather:events(dataType:Debuffs,fightIDs:$all,hostilityType:Friendlies,filterExpression:$featherFilter,startTime:$start,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
 }}}
`;

export const FEATHER_BUFF_PAGE_QUERY=`
query AvoidFeatherBuffPage($code:String!,$all:[Int],$featherFilter:String!,$start:Float){
 reportData{report(code:$code,allowUnlisted:true){
  feather:events(dataType:Buffs,fightIDs:$all,hostilityType:Friendlies,filterExpression:$featherFilter,startTime:$start,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
 }}}
`;
