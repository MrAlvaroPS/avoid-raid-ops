import { json, gql, num, median, groupEncounter } from "./shared.mjs";

const DEFAULT_REPORT = "28d9xF7GchL6ZPYt";
const DEFAULT_GUILD = 788166;

const CURRENT = `
query AvoidHistoryCurrent($code: String!) {
  reportData {
    report(code: $code, allowUnlisted: true) {
      code
      startTime
      endTime
      zone { id name }
      fights(killType: Encounters) {
        id encounterID name difficulty startTime endTime kill
        fightPercentage bossPercentage inProgress
      }
    }
  }
}
`;

const HISTORY = `
query AvoidGuildHistory(
  $guildId: Int!, $start: Float!, $end: Float!, $zoneId: Int!,
  $encounterId: Int!, $difficulty: Int!
) {
  reportData {
    reports(
      guildID: $guildId,
      startTime: $start,
      endTime: $end,
      zoneID: $zoneId,
      limit: 100
    ) {
      total
      has_more_pages
      data {
        code
        title
        startTime
        endTime
        zone { id name }
        fights(encounterID: $encounterId, difficulty: $difficulty, killType: Encounters) {
          id
          encounterID
          name
          difficulty
          startTime
          endTime
          kill
          fightPercentage
          bossPercentage
          inProgress
          friendlyPlayers
        }
      }
    }
  }
}
`;

function nightSummary(report) {
  const fights = (report.fights || []).filter(f => !f.inProgress);
  const pct = fights.map(f => Number(f.fightPercentage)).filter(Number.isFinite);
  if (!fights.length || !pct.length) return null;
  return {
    reportCode: report.code,
    title: report.title,
    startTime: report.startTime,
    endTime: report.endTime,
    pulls: fights.length,
    kills: fights.filter(f => f.kill).length,
    bestFightPercentage: Math.min(...pct),
    medianFightPercentage: median(pct),
    rosterSizeMedian: median(fights.map(f => (f.friendlyPlayers || []).length))
  };
}

export default async (req) => {
  if (req.method !== "GET") return json(405, { ok:false, error:"Method not allowed" });
  const url = new URL(req.url);
  const reportCode = url.searchParams.get("report") || process.env.WCL_REPORT_CODE || DEFAULT_REPORT;
  const guildId = Number(url.searchParams.get("guild") || process.env.WCL_GUILD_ID || DEFAULT_GUILD);
  const requestedEncounter = url.searchParams.get("encounter");

  try {
    const currentData = await gql(CURRENT, { code: reportCode });
    const current = currentData?.reportData?.report;
    if (!current) return json(404, { ok:false, error:"Current report not found" });

    const selected = groupEncounter(current.fights, requestedEncounter);
    const anchor = selected[0];
    if (!anchor) return json(200, { ok:true, nights:[], reason:"No selected encounter." });

    const end = Date.now();
    const start = end - 35 * 24 * 60 * 60 * 1000;

    const historyData = await gql(HISTORY, {
      guildId,
      start,
      end,
      zoneId: Number(current.zone.id),
      encounterId: Number(anchor.encounterID),
      difficulty: Number(anchor.difficulty)
    });

    const page = historyData?.reportData?.reports;
    const nights = (page?.data || [])
      .map(nightSummary)
      .filter(Boolean)
      .sort((a,b) => Number(a.startTime)-Number(b.startTime));

    const latest = nights.slice(-5);
    const currentNight = nights.find(n => n.reportCode === reportCode) || latest[latest.length-1] || null;
    const previousNight = latest.filter(n => n.reportCode !== currentNight?.reportCode).slice(-1)[0] || null;

    const delta = currentNight && previousNight ? {
      medianPctPoints: Number(previousNight.medianFightPercentage) - Number(currentNight.medianFightPercentage),
      bestPctPoints: Number(previousNight.bestFightPercentage) - Number(currentNight.bestFightPercentage),
      pullDelta: Number(currentNight.pulls) - Number(previousNight.pulls)
    } : null;

    return json(200, {
      ok: true,
      generatedAt: Date.now(),
      guildId,
      zone: current.zone,
      encounter: {
        id: anchor.encounterID,
        name: anchor.name,
        difficulty: anchor.difficulty
      },
      nights,
      recentNights: latest,
      currentNight,
      previousNight,
      delta,
      pagination: {
        total: page?.total ?? nights.length,
        hasMore: Boolean(page?.has_more_pages)
      },
      evidence: {
        nightProgress: "confirmed",
        resetBoundary: "not-calculated",
        rosterCausality: "not-calculated"
      }
    }, "public, max-age=300, s-maxage=300, stale-while-revalidate=600");
  } catch (e) {
    console.error(e);
    return json(500, { ok:false, error:e instanceof Error ? e.message : String(e), reportCode, guildId });
  }
};
