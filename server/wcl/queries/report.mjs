export const REPORT_METADATA_QUERY = `
query AvoidReport($code: String!, $guildId: Int!) {
  rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }
  guildData { guild(id: $guildId) { id name server { id name slug region { compactName name slug } } } }
  reportData { report(code: $code, allowUnlisted: true) {
    code title startTime endTime revision segments exportedSegments visibility
    region { compactName name slug } zone { id name }
    guild { id name server { id name slug region { compactName name slug } } }
    masterData { logVersion gameVersion actors { id name server subType type } abilities { gameID name icon type } }
    fights(killType: Encounters) {
      id encounterID name difficulty kill startTime endTime fightPercentage bossPercentage averageItemLevel inProgress
      lastPhaseAsAbsoluteIndex phaseTransitions { id startTime }
      friendlyPlayers friendlySpecs friendlyItemLevels wipeCalledTime
    }
  } }
}`;
