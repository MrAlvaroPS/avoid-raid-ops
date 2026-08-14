const TOKEN_URL = "https://www.warcraftlogs.com/oauth/token";
const API_URL = "https://www.warcraftlogs.com/api/v2/client";

const DEFAULT_REPORT_CODE = "28d9xF7GchL6ZPYt";
const DEFAULT_GUILD_ID = 788166;

let tokenCache = { token: null, expiresAt: 0 };

const METADATA_QUERY = `
query AvoidRaidOpsMetadata($code: String!, $guildId: Int!) {
  rateLimitData {
    limitPerHour
    pointsSpentThisHour
    pointsResetIn
  }
  guildData {
    guild(id: $guildId) {
      id
      name
      server {
        id
        name
        slug
        region {
          compactName
          name
          slug
        }
      }
    }
  }
  reportData {
    report(code: $code, allowUnlisted: true) {
      code
      title
      startTime
      endTime
      revision
      segments
      exportedSegments
      visibility
      region {
        compactName
        name
        slug
      }
      zone {
        id
        name
      }
      guild {
        id
        name
        server {
          id
          name
          slug
          region {
            compactName
            name
            slug
          }
        }
      }
      masterData {
        logVersion
        gameVersion
        actors(type: "Player") {
          id
          name
          server
          subType
          type
        }
      }
      fights(killType: Encounters) {
        id
        encounterID
        name
        difficulty
        kill
        startTime
        endTime
        fightPercentage
        bossPercentage
        averageItemLevel
        inProgress
        lastPhaseAsAbsoluteIndex
        phaseTransitions {
          id
          startTime
        }
        friendlyPlayers
        friendlySpecs
        friendlyItemLevels
        wipeCalledTime
      }
    }
  }
}
`;

const DETAIL_QUERY = `
query AvoidRaidOpsDetails(
  $code: String!,
  $bestFight: [Int],
  $compareFight: [Int],
  $allFights: [Int],
  $phaseStart: Float,
  $phaseEnd: Float
) {
  reportData {
    report(code: $code, allowUnlisted: true) {
      bestSummary: table(dataType: Summary, fightIDs: $bestFight)
      compareSummary: table(dataType: Summary, fightIDs: $compareFight)
      deaths: table(dataType: Deaths, fightIDs: $allFights)
      healing: table(dataType: Healing, fightIDs: $bestFight)
      damageGraph: graph(dataType: DamageDone, fightIDs: $bestFight)
      healingGraph: graph(dataType: Healing, fightIDs: $bestFight)
      executeSummary: table(
        dataType: Summary,
        fightIDs: $bestFight,
        startTime: $phaseStart,
        endTime: $phaseEnd
      )
    }
  }
}
`;

function response(status, body, cache = "no-store") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cache
    }
  });
}

async function getToken() {
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt > now + 60_000) return tokenCache.token;

  const id = process.env.WCL_CLIENT_ID;
  const secret = process.env.WCL_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Missing WCL_CLIENT_ID or WCL_CLIENT_SECRET in this Netlify site.");
  }

  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body: "grant_type=client_credentials"
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`WCL OAuth ${r.status}: ${text.slice(0, 600)}`);

  const data = JSON.parse(text);
  tokenCache = {
    token: data.access_token,
    expiresAt: now + Number(data.expires_in || 3600) * 1000
  };
  return tokenCache.token;
}

async function gql(query, variables) {
  const token = await getToken();
  const r = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  const text = await r.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`WCL returned non-JSON (${r.status}): ${text.slice(0, 600)}`);
  }

  if (!r.ok || payload.errors) {
    throw new Error(`WCL GraphQL ${r.status}: ${JSON.stringify(payload.errors || payload).slice(0, 1800)}`);
  }
  return payload.data;
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function median(values) {
  const xs = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return null;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
}

function durationMs(fight) {
  return Math.max(0, Number(fight.endTime || 0) - Number(fight.startTime || 0));
}

function maxPhaseForFight(fight) {
  const ids = (fight.phaseTransitions || []).map(x => Number(x.id)).filter(Number.isFinite);
  const abs = Number(fight.lastPhaseAsAbsoluteIndex);
  if (Number.isFinite(abs)) ids.push(abs + 1);
  return ids.length ? Math.max(...ids) : 1;
}

function phaseReached(fight, phaseId) {
  if (phaseId <= 1) return true;
  if ((fight.phaseTransitions || []).some(p => Number(p.id) === phaseId)) return true;
  return maxPhaseForFight(fight) >= phaseId;
}

function phaseStart(fight, phaseId) {
  const p = (fight.phaseTransitions || []).find(p => Number(p.id) === phaseId);
  return p ? Number(p.startTime) : null;
}

function groupEncounters(fights) {
  const map = new Map();
  for (const f of fights || []) {
    if (!f || Number(f.encounterID) <= 0) continue;
    const key = String(f.encounterID);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(f);
  }
  return map;
}

function pickEncounter(fights, requestedId) {
  const groups = groupEncounters(fights);
  if (requestedId && groups.has(String(requestedId))) {
    return groups.get(String(requestedId)).slice().sort((a,b) => a.startTime - b.startTime);
  }
  const latest = (fights || [])
    .filter(f => Number(f.encounterID) > 0)
    .slice()
    .sort((a,b) => Number(b.startTime) - Number(a.startTime))[0];
  return latest ? groups.get(String(latest.encounterID)).slice().sort((a,b) => a.startTime - b.startTime) : [];
}

function progressionBreakthrough(fights) {
  if (fights.length < 7) return null;
  const values = fights.map(f => Number(f.fightPercentage));
  if (values.some(v => !Number.isFinite(v))) return null;

  const rolling = [];
  for (let i = 2; i < values.length - 2; i++) {
    rolling.push({ index: i, value: median(values.slice(i - 2, i + 3)) });
  }

  for (let i = 1; i < rolling.length; i++) {
    const improvement = rolling[i - 1].value - rolling[i].value;
    if (improvement < 10) continue;

    const future = values.slice(rolling[i].index + 1, rolling[i].index + 6);
    if (future.length < 3) continue;

    const threshold = rolling[i - 1].value - improvement * 0.60;
    const maintained = future.filter(v => v <= threshold).length;
    if (maintained >= 3) {
      return {
        pullNumber: rolling[i].index + 1,
        improvementPctPoints: Number(improvement.toFixed(1)),
        maintained,
        sample: future.length
      };
    }
  }
  return null;
}

function unwrapTable(value) {
  if (!value || typeof value !== "object") return {};
  return value.data && typeof value.data === "object" ? value.data : value;
}

function entriesOf(value, key = "entries") {
  const x = unwrapTable(value);
  return Array.isArray(x[key]) ? x[key] : [];
}

function sumFriendly(rows, friendlyIds) {
  const ids = new Set((friendlyIds || []).map(Number));
  const matching = rows.filter(r => ids.has(Number(r.id)));
  const use = matching.length ? matching : rows;
  return use.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
}

function parseSummary(raw, fight) {
  const data = unwrapTable(raw);
  const damageRows = Array.isArray(data.damageDone) ? data.damageDone : [];
  const healingRows = Array.isArray(data.healingDone) ? data.healingDone : [];
  const ms = durationMs(fight);
  const seconds = ms > 0 ? ms / 1000 : null;

  const damage = sumFriendly(damageRows, fight.friendlyPlayers);
  const healing = sumFriendly(healingRows, fight.friendlyPlayers);

  const composition = (Array.isArray(data.composition) ? data.composition : []).map(p => {
    const specInfo = Array.isArray(p.specs) && p.specs.length ? p.specs[0] : {};
    return {
      id: num(p.id),
      name: p.name || "Unknown",
      className: p.type || "Unknown",
      spec: specInfo.spec || null,
      role: specInfo.role || null
    };
  });

  return {
    raidDps: seconds ? damage / seconds : null,
    raidHps: seconds ? healing / seconds : null,
    totalDamage: damage,
    totalHealing: healing,
    composition,
    rawShape: {
      hasDamageDone: Array.isArray(data.damageDone),
      hasHealingDone: Array.isArray(data.healingDone),
      hasComposition: Array.isArray(data.composition),
      totalTime: num(data.totalTime)
    }
  };
}

function parseOverheal(rawHealing, fight) {
  const rows = entriesOf(rawHealing);
  const ids = new Set((fight.friendlyPlayers || []).map(Number));
  const matching = rows.filter(r => ids.has(Number(r.id)));
  const use = matching.length ? matching : rows;

  let effective = 0, overheal = 0;
  for (const r of use) {
    effective += Number(r.total) || 0;
    overheal += Number(r.overheal) || 0;
  }
  const raw = effective + overheal;
  return raw > 0 ? 100 * overheal / raw : null;
}

function normalizeGraph(raw) {
  if (!raw || typeof raw !== "object") return null;
  const root = raw.data && typeof raw.data === "object" ? raw.data : raw;
  const series = Array.isArray(root.series) ? root.series : [];
  if (!series.length) return null;

  // Return the raw numeric series in a frontend-friendly form. We do not
  // pretend to know whether WCL chose cumulative or bucketed points here.
  const normalized = series.map(s => ({
    name: s.name || null,
    total: num(s.total),
    data: Array.isArray(s.data) ? s.data : []
  }));
  return { series: normalized };
}

function deathsByFight(rawDeaths, selectedFights) {
  const rows = entriesOf(rawDeaths);
  const byFight = new Map();

  for (const d of rows) {
    const fightId = Number(d.fight);
    if (!byFight.has(fightId)) byFight.set(fightId, []);
    byFight.get(fightId).push(d);
  }

  const result = {};
  for (const f of selectedFights) {
    const rowsForFight = (byFight.get(Number(f.id)) || []).slice().sort((a,b) => Number(a.timestamp) - Number(b.timestamp));
    result[f.id] = rowsForFight.map(d => {
      let rel = Number(d.timestamp);
      if (Number.isFinite(rel) && rel >= Number(f.startTime)) rel -= Number(f.startTime);
      return {
        player: d.name || "Unknown",
        actorId: num(d.id),
        timestampReportMs: num(d.timestamp),
        fightRelativeMs: Number.isFinite(rel) ? rel : null,
        overkill: num(d.overkill),
        killingBlow: d.killingBlow?.name || null
      };
    });
  }
  return result;
}

function formatSelected(fight, index, deaths, summary) {
  const first = deaths?.[0] || null;
  return {
    fightId: fight.id,
    pullNumber: index + 1,
    fightPercentage: num(fight.fightPercentage),
    bossPercentage: num(fight.bossPercentage),
    durationMs: durationMs(fight),
    kill: Boolean(fight.kill),
    inProgress: Boolean(fight.inProgress),
    maxPhase: maxPhaseForFight(fight),
    phaseTransitions: fight.phaseTransitions || [],
    averageItemLevel: num(fight.averageItemLevel),
    firstDeath: first,
    raidDps: summary?.raidDps ?? null,
    raidHps: summary?.raidHps ?? null
  };
}

function difficultyName(value) {
  const map = {
    1: "LFR",
    2: "Flexible",
    3: "Normal",
    4: "Heroic",
    5: "Mythic"
  };
  return map[Number(value)] || `Difficulty ${value ?? "?"}`;
}

export default async (req) => {
  if (req.method !== "GET") return response(405, { ok: false, error: "Method not allowed" });

  const url = new URL(req.url);
  const reportCode =
    url.searchParams.get("report") ||
    process.env.WCL_REPORT_CODE ||
    DEFAULT_REPORT_CODE;

  const guildId = Number(
    url.searchParams.get("guild") ||
    process.env.WCL_GUILD_ID ||
    DEFAULT_GUILD_ID
  );

  const requestedEncounter = url.searchParams.get("encounter");

  try {
    const metadata = await gql(METADATA_QUERY, {
      code: reportCode,
      guildId
    });

    const report = metadata?.reportData?.report;
    const configuredGuild = metadata?.guildData?.guild || null;

    if (!report) {
      return response(404, {
        ok: false,
        error: "Report not found or not accessible with the current WCL credentials.",
        reportCode
      });
    }

    const allBossFights = (report.fights || [])
      .filter(f => Number(f.encounterID) > 0)
      .sort((a,b) => Number(a.startTime) - Number(b.startTime));

    const selectedFights = pickEncounter(allBossFights, requestedEncounter);
    if (!selectedFights.length) {
      return response(200, {
        ok: true,
        report: { code: report.code, title: report.title },
        guild: configuredGuild,
        encounter: null,
        message: "No boss encounter fights found in this report."
      }, "public, max-age=15, s-maxage=15");
    }

    const closed = selectedFights.filter(f => !f.inProgress);
    const scored = closed
      .filter(f => Number.isFinite(Number(f.fightPercentage)))
      .slice()
      .sort((a,b) => Number(a.fightPercentage) - Number(b.fightPercentage));

    const best = scored[0] || closed[closed.length - 1] || selectedFights[selectedFights.length - 1];
    const compare = scored.find(f => f.id !== best.id) || best;

    const bestIndex = selectedFights.findIndex(f => f.id === best.id);
    const compareIndex = selectedFights.findIndex(f => f.id === compare.id);

    const maxPhase = Math.max(...selectedFights.map(maxPhaseForFight));
    const targetEarlyPhase = Math.min(3, Math.max(2, maxPhase));

    const p3Start = phaseStart(best, 3);
    const p3End = Number(best.endTime);

    let details = null;
    let detailError = null;

    try {
      const detailData = await gql(DETAIL_QUERY, {
        code: reportCode,
        bestFight: [Number(best.id)],
        compareFight: [Number(compare.id)],
        allFights: closed.map(f => Number(f.id)),
        phaseStart: p3Start,
        phaseEnd: p3End
      });
      details = detailData?.reportData?.report || null;
    } catch (err) {
      detailError = err instanceof Error ? err.message : String(err);
    }

    const bestSummary = details ? parseSummary(details.bestSummary, best) : null;
    const compareSummary = details ? parseSummary(details.compareSummary, compare) : null;
    const executeSummary = details && p3Start != null ? parseSummary(details.executeSummary, {
      ...best,
      startTime: p3Start,
      endTime: p3End
    }) : null;

    const deathMap = details ? deathsByFight(details.deaths, closed) : {};
    const bestDeaths = deathMap[best.id] || [];
    const compareDeaths = deathMap[compare.id] || [];

    let earlyDeaths = null;
    if (details) {
      earlyDeaths = 0;
      for (const f of closed) {
        const deaths = deathMap[f.id] || [];
        if (!deaths.length) continue;
        const first = deaths[0];
        const targetStart = phaseStart(f, targetEarlyPhase);
        if (targetStart == null || first.timestampReportMs < targetStart) earlyDeaths++;
      }
    }

    const p3Survivals = closed.map(f => {
      const start = phaseStart(f, 3);
      return start == null ? null : Number(f.endTime) - start;
    }).filter(Number.isFinite);

    const phaseCounts = {};
    for (let p = 1; p <= Math.max(3, maxPhase); p++) {
      phaseCounts[p] = closed.filter(f => phaseReached(f, p)).length;
    }

    const encounters = Array.from(groupEncounters(allBossFights).entries()).map(([id, fights]) => ({
      encounterId: Number(id),
      name: fights[0]?.name || `Encounter ${id}`,
      pulls: fights.length,
      completedPulls: fights.filter(f => !f.inProgress).length,
      latestStartTime: Math.max(...fights.map(f => Number(f.startTime) || 0))
    })).sort((a,b) => a.latestStartTime - b.latestStartTime);

    const actorMap = new Map(
      (report.masterData?.actors || []).map(a => [Number(a.id), a])
    );

    const bestRoster = (best.friendlyPlayers || []).map((id, idx) => {
      const actor = actorMap.get(Number(id)) || {};
      return {
        actorId: Number(id),
        name: actor.name || `Actor ${id}`,
        className: actor.subType || null,
        spec: best.friendlySpecs?.[idx] || null,
        itemLevel: num(best.friendlyItemLevels?.[idx])
      };
    });

    const bestPull = formatSelected(best, bestIndex, bestDeaths, bestSummary);
    const comparePull = formatSelected(compare, compareIndex, compareDeaths, compareSummary);

    const avgIlvlValues = closed.map(f => Number(f.averageItemLevel)).filter(Number.isFinite);
    const medianHp = median(closed.map(f => Number(f.fightPercentage)).filter(Number.isFinite));

    const reportGuild = report.guild;
    const guildMatches =
      !reportGuild ||
      !configuredGuild ||
      Number(reportGuild.id) === Number(configuredGuild.id);

    const output = {
      ok: true,
      generatedAt: Date.now(),
      source: "Warcraft Logs API v2",
      configured: {
        reportCode,
        guildId,
        requestedEncounter: requestedEncounter ? Number(requestedEncounter) : null
      },
      guild: configuredGuild ? {
        id: configuredGuild.id,
        name: configuredGuild.name,
        server: configuredGuild.server
      } : null,
      reportGuild: reportGuild ? {
        id: reportGuild.id,
        name: reportGuild.name,
        server: reportGuild.server
      } : null,
      guildMatchesReport: guildMatches,
      report: {
        code: report.code,
        title: report.title,
        startTime: report.startTime,
        endTime: report.endTime,
        revision: report.revision,
        segments: report.segments,
        exportedSegments: report.exportedSegments,
        visibility: report.visibility,
        region: report.region,
        zone: report.zone,
        logVersion: report.masterData?.logVersion ?? null,
        gameVersion: report.masterData?.gameVersion ?? null
      },
      encounters,
      encounter: {
        id: selectedFights[0].encounterID,
        name: selectedFights[0].name,
        difficulty: selectedFights[0].difficulty,
        difficultyName: difficultyName(selectedFights[0].difficulty),
        pulls: selectedFights.length,
        completedPulls: closed.length,
        kills: closed.filter(f => f.kill).length,
        inProgress: selectedFights.some(f => f.inProgress),
        maxObservedPhase: maxPhase,
        targetEarlyPhase
      },
      overview: {
        bestPull,
        comparePull,
        medianFightPercentage: medianHp,
        averageItemLevel: avgIlvlValues.length ? avgIlvlValues.reduce((a,b) => a+b, 0) / avgIlvlValues.length : null,
        phaseConversion: {
          denominator: closed.length,
          counts: phaseCounts,
          percentages: Object.fromEntries(
            Object.entries(phaseCounts).map(([p, count]) => [
              p,
              closed.length ? Math.round(100 * count / closed.length) : 0
            ])
          )
        },
        earlyDeaths,
        earlyDeathDefinition: details ? `First real death before P${targetEarlyPhase}` : null,
        p3SurvivalMedianMs: p3Survivals.length ? median(p3Survivals) : null,
        breakthrough: progressionBreakthrough(closed),
        raidDps: bestSummary?.raidDps ?? null,
        raidHps: bestSummary?.raidHps ?? null,
        executeDps: executeSummary?.raidDps ?? null,
        executeHps: executeSummary?.raidHps ?? null,
        overhealPct: details ? parseOverheal(details.healing, best) : null
      },
      progression: selectedFights.map((f, idx) => ({
        pullNumber: idx + 1,
        fightId: f.id,
        fightPercentage: num(f.fightPercentage),
        bossPercentage: num(f.bossPercentage),
        durationMs: durationMs(f),
        kill: Boolean(f.kill),
        inProgress: Boolean(f.inProgress),
        maxPhase: maxPhaseForFight(f),
        phaseTransitions: f.phaseTransitions || [],
        firstDeath: deathMap[f.id]?.[0] || null
      })),
      roster: bestRoster,
      summaryRoster: bestSummary?.composition || [],
      graphs: details ? {
        damage: normalizeGraph(details.damageGraph),
        healing: normalizeGraph(details.healingGraph)
      } : null,
      diagnostics: {
        detailStatus: details ? "ready" : "unavailable",
        detailError,
        rateLimit: metadata?.rateLimitData || null,
        bestSummaryShape: bestSummary?.rawShape || null,
        compareSummaryShape: compareSummary?.rawShape || null
      },
      confidence: {
        reportMetadata: "confirmed",
        bestPull: "confirmed",
        phaseConversion: "high",
        progression: "confirmed",
        raidDps: bestSummary ? "high" : "unknown",
        raidHps: bestSummary ? "high" : "unknown",
        earlyDeaths: details ? "high" : "unknown",
        p3Survival: p3Survivals.length ? "high" : "unknown",
        executeDps: executeSummary ? "high" : "unknown",
        overheal: details ? "medium" : "unknown",
        killReadiness: "not-calculated",
        currentBlocker: "not-calculated",
        wipeSignatures: "not-calculated",
        defensiveCoverage: "not-calculated",
        mechanicAccuracy: "not-calculated",
        peerBenchmark: "not-calculated"
      }
    };

    return response(
      200,
      output,
      "public, max-age=15, s-maxage=15, stale-while-revalidate=30"
    );
  } catch (err) {
    console.error(err);
    return response(500, {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      reportCode,
      guildId
    });
  }
};
