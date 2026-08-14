import { json, gql, groupEncounter } from "./shared.mjs";
const DEFAULT_REPORT = "28d9xF7GchL6ZPYt";

const QUERY = `
query AvoidLiveStatus($code: String!) {
  reportData {
    report(code: $code, allowUnlisted: true) {
      code
      endTime
      revision
      segments
      exportedSegments
      fights(killType: Encounters) {
        id encounterID name startTime endTime inProgress kill fightPercentage
      }
    }
  }
}
`;

export default async (req) => {
  if (req.method !== "GET") return json(405, { ok:false, error:"Method not allowed" });
  const url = new URL(req.url);
  const code = url.searchParams.get("report") || process.env.WCL_REPORT_CODE || DEFAULT_REPORT;
  const encounter = url.searchParams.get("encounter");

  try {
    const data = await gql(QUERY, { code });
    const report = data?.reportData?.report;
    if (!report) return json(404, { ok:false, error:"Report not found" });

    const fights = groupEncounter(report.fights, encounter);
    const latest = fights[fights.length-1] || null;

    return json(200, {
      ok:true,
      generatedAt:Date.now(),
      report:{
        code:report.code,
        endTime:report.endTime,
        revision:report.revision,
        segments:report.segments,
        exportedSegments:report.exportedSegments
      },
      encounter: latest ? {
        id: latest.encounterID,
        name: latest.name,
        totalPulls:fights.length,
        latestFight:{
          id:latest.id,
          inProgress:Boolean(latest.inProgress),
          kill:Boolean(latest.kill),
          fightPercentage:latest.fightPercentage,
          startTime:latest.startTime,
          endTime:latest.endTime
        }
      } : null
    }, "public, max-age=10, s-maxage=10");
  } catch(e) {
    return json(500, { ok:false, error:e instanceof Error ? e.message : String(e) });
  }
};
