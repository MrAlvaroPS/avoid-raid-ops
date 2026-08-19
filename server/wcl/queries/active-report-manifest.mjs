export const ACTIVE_REPORT_MANIFEST_QUERY=`
query AvoidActiveReportManifest($code: String!) {
  rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }
  reportData { report(code: $code, allowUnlisted: true) {
    code title startTime endTime revision visibility
    zone { id name }
    guild { id name }
    fights(killType: Encounters) {
      id encounterID name difficulty kill startTime endTime fightPercentage bossPercentage inProgress
    }
  } }
}`;
