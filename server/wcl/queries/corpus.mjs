export const CORPUS_RANKINGS_QUERY = `
query AvoidCorpusRankings($encounter:Int!,$difficulty:Int!,$page:Int!,$partition:Int){
 rateLimitData{limitPerHour pointsSpentThisHour pointsResetIn}
 worldData{encounter(id:$encounter){id name journalID zone{id name partitions{id name compactName default}} fightRankings(difficulty:$difficulty,page:$page,partition:$partition,includeOtherPlayers:false)}}
}`;

// Lightweight seed metadata. Used only to discover independent report sources (guild/user)
// before any event/table query is attempted.
export const CORPUS_REPORT_IDENTITY_QUERY = `
query AvoidCorpusReportIdentity($code:String!){
 rateLimitData{limitPerHour pointsSpentThisHour pointsResetIn}
 reportData{report(code:$code,allowUnlisted:false){
  code title startTime endTime visibility
  zone{id name}
  guild{id name}
  owner{id}
 }}
}`;

// Paginated public report expansion for either a guild or a personal-log owner.
// ReportData.reports accepts null for the unused source selector.
export const CORPUS_SOURCE_REPORTS_QUERY = `
query AvoidCorpusSourceReports($guildID:Int,$userID:Int,$zoneID:Int!,$page:Int!,$limit:Int!,$startTime:Float,$endTime:Float){
 rateLimitData{limitPerHour pointsSpentThisHour pointsResetIn}
 reportData{reports(guildID:$guildID,userID:$userID,zoneID:$zoneID,page:$page,limit:$limit,startTime:$startTime,endTime:$endTime){
  total per_page current_page last_page has_more_pages
  data{code title startTime endTime visibility zone{id name}}
 }}
}`;

// First half of wide/deep profiling. WCL tables/events cannot be filtered only by
// encounter+difficulty; they require fightIDs and/or a time range. We therefore fetch
// the exact matching fights first, then pass their ids to the second query.
export const CORPUS_REPORT_HEADER_QUERY = `
query AvoidCorpusReportHeader($code:String!,$encounter:Int!,$difficulty:Int!){
 rateLimitData{limitPerHour pointsSpentThisHour pointsResetIn}
 reportData{report(code:$code,allowUnlisted:false){
  code title startTime endTime visibility
  zone{id name}
  guild{id name}
  owner{id}
  fights(encounterID:$encounter,difficulty:$difficulty,translate:false){
   id name encounterID difficulty startTime endTime kill fightPercentage bossPercentage averageItemLevel friendlyPlayers
   phaseTransitions{id startTime}
  }
  masterData(translate:false){abilities{gameID name type}}
 }}
}`;

export const CORPUS_WIDE_TABLES_QUERY = `
query AvoidCorpusWideTables($code:String!,$killFightIDs:[Int],$wipeFightIDs:[Int],$hasKills:Boolean!,$hasWipes:Boolean!){
 rateLimitData{limitPerHour pointsSpentThisHour pointsResetIn}
 reportData{report(code:$code,allowUnlisted:false){
  killCasts:table(dataType:Casts,fightIDs:$killFightIDs,hostilityType:Enemies,viewBy:Ability,translate:false) @include(if:$hasKills)
  wipeCasts:table(dataType:Casts,fightIDs:$wipeFightIDs,hostilityType:Enemies,viewBy:Ability,translate:false) @include(if:$hasWipes)
  killDamage:table(dataType:DamageTaken,fightIDs:$killFightIDs,hostilityType:Friendlies,viewBy:Ability,translate:false) @include(if:$hasKills)
  wipeDamage:table(dataType:DamageTaken,fightIDs:$wipeFightIDs,hostilityType:Friendlies,viewBy:Ability,translate:false) @include(if:$hasWipes)
  killDebuffs:table(dataType:Debuffs,fightIDs:$killFightIDs,hostilityType:Friendlies,viewBy:Ability,translate:false) @include(if:$hasKills)
  wipeDebuffs:table(dataType:Debuffs,fightIDs:$wipeFightIDs,hostilityType:Friendlies,viewBy:Ability,translate:false) @include(if:$hasWipes)
  killBuffs:table(dataType:Buffs,fightIDs:$killFightIDs,hostilityType:Friendlies,viewBy:Ability,translate:false) @include(if:$hasKills)
  wipeBuffs:table(dataType:Buffs,fightIDs:$wipeFightIDs,hostilityType:Friendlies,viewBy:Ability,translate:false) @include(if:$hasWipes)
  killInterrupts:table(dataType:Interrupts,fightIDs:$killFightIDs,hostilityType:Friendlies,translate:false) @include(if:$hasKills)
  wipeInterrupts:table(dataType:Interrupts,fightIDs:$wipeFightIDs,hostilityType:Friendlies,translate:false) @include(if:$hasWipes)
  killDeaths:table(dataType:Deaths,fightIDs:$killFightIDs,translate:false) @include(if:$hasKills)
  wipeDeaths:table(dataType:Deaths,fightIDs:$wipeFightIDs,translate:false,wipeCutoff:5) @include(if:$hasWipes)
 }}
}`;

export const CORPUS_DEEP_EVENTS_QUERY = `
query AvoidCorpusDeepEvents($code:String!,$fightIDs:[Int]!){
 rateLimitData{limitPerHour pointsSpentThisHour pointsResetIn}
 reportData{report(code:$code,allowUnlisted:false){
  enemyCasts:events(dataType:Casts,fightIDs:$fightIDs,hostilityType:Enemies,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  friendDamage:events(dataType:DamageTaken,fightIDs:$fightIDs,hostilityType:Friendlies,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  interrupts:events(dataType:Interrupts,fightIDs:$fightIDs,hostilityType:Friendlies,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  debuffs:events(dataType:Debuffs,fightIDs:$fightIDs,hostilityType:Friendlies,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  buffs:events(dataType:Buffs,fightIDs:$fightIDs,hostilityType:Friendlies,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  enemyBuffs:events(dataType:Buffs,fightIDs:$fightIDs,hostilityType:Enemies,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  enemyDebuffs:events(dataType:Debuffs,fightIDs:$fightIDs,hostilityType:Enemies,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  deaths:events(dataType:Deaths,fightIDs:$fightIDs,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false,wipeCutoff:5){data nextPageTimestamp}
 }}
}`;

// Compatibility names retained so older imports/tests fail loudly only at runtime semantics,
// not module resolution. New code uses the split header/table/event queries above.
export const CORPUS_WIDE_PROFILE_QUERY = CORPUS_REPORT_HEADER_QUERY;
export const CORPUS_DEEP_PROFILE_QUERY = CORPUS_REPORT_HEADER_QUERY;

export const CORPUS_RATE_LIMIT_QUERY = `query AvoidCorpusRateLimit{rateLimitData{limitPerHour pointsSpentThisHour pointsResetIn}}`;
