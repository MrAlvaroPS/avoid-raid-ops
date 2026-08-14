import {
  json, gql, num, median, durationMs, maxPhase, phaseStart,
  groupEncounter, bestFight, unwrap, entries, aggregateAbilities,
  playerRows, indexByActor, matchActor, safeShape
} from "./shared.mjs";

const DEFAULT_REPORT = "28d9xF7GchL6ZPYt";

const META = `
query AvoidTelemetryMeta($code: String!) {
  reportData {
    report(code: $code, allowUnlisted: true) {
      code
      startTime
      endTime
      masterData {
        actors {
          id
          name
          type
          subType
          server
        }
        abilities {
          gameID
          name
          icon
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
        phaseTransitions { id startTime }
        friendlyPlayers
        friendlySpecs
        friendlyItemLevels
        wipeCalledTime
      }
    }
  }
}
`;

const TABLES = `
query AvoidTelemetryTables(
  $code: String!,
  $all: [Int],
  $best: [Int],
  $compare: [Int],
  $p1s: Float, $p1e: Float,
  $p2s: Float, $p2e: Float,
  $p3s: Float, $p3e: Float
) {
  reportData {
    report(code: $code, allowUnlisted: true) {
      playerDetails(fightIDs: $all, includeCombatantInfo: true)

      allSummary: table(dataType: Summary, fightIDs: $all)
      allDamageDone: table(dataType: DamageDone, fightIDs: $all)
      allDamageTaken: table(dataType: DamageTaken, fightIDs: $all)
      allHealing: table(dataType: Healing, fightIDs: $all)
      allDeaths: table(dataType: Deaths, fightIDs: $all)
      allInterrupts: table(dataType: Interrupts, fightIDs: $all)
      allDispels: table(dataType: Dispels, fightIDs: $all)
      allBuffs: table(dataType: Buffs, fightIDs: $all)
      allCasts: table(dataType: Casts, fightIDs: $all)
      allDebuffs: table(dataType: Debuffs, fightIDs: $all)
      allSurvivability: table(dataType: Survivability, fightIDs: $all)

      bestSummary: table(dataType: Summary, fightIDs: $best)
      bestDamageDone: table(dataType: DamageDone, fightIDs: $best)
      bestDamageTaken: table(dataType: DamageTaken, fightIDs: $best)
      bestHealing: table(dataType: Healing, fightIDs: $best)
      bestDeaths: table(dataType: Deaths, fightIDs: $best)
      bestInterrupts: table(dataType: Interrupts, fightIDs: $best)
      bestDispels: table(dataType: Dispels, fightIDs: $best)
      bestBuffs: table(dataType: Buffs, fightIDs: $best)
      bestCasts: table(dataType: Casts, fightIDs: $best)
      bestDebuffs: table(dataType: Debuffs, fightIDs: $best)

      compareSummary: table(dataType: Summary, fightIDs: $compare)
      compareDamageDone: table(dataType: DamageDone, fightIDs: $compare)
      compareHealing: table(dataType: Healing, fightIDs: $compare)
      compareDeaths: table(dataType: Deaths, fightIDs: $compare)

      phase1: table(dataType: Summary, fightIDs: $best, startTime: $p1s, endTime: $p1e)
      phase2: table(dataType: Summary, fightIDs: $best, startTime: $p2s, endTime: $p2e)
      phase3: table(dataType: Summary, fightIDs: $best, startTime: $p3s, endTime: $p3e)

      damageGraph: graph(dataType: DamageDone, fightIDs: $best)
      healingGraph: graph(dataType: Healing, fightIDs: $best)
    }
  }
}
`;

const BEST_EVENTS = `
query AvoidBestPullEvents($code: String!, $best: [Int]) {
  reportData {
    report(code: $code, allowUnlisted: true) {
      casts: events(dataType: Casts, fightIDs: $best, limit: 10000, useAbilityIDs: true, useActorIDs: true) {
        data
        nextPageTimestamp
      }
      interrupts: events(dataType: Interrupts, fightIDs: $best, limit: 10000, useAbilityIDs: true, useActorIDs: true) {
        data
        nextPageTimestamp
      }
      dispels: events(dataType: Dispels, fightIDs: $best, limit: 10000, useAbilityIDs: true, useActorIDs: true) {
        data
        nextPageTimestamp
      }
      debuffs: events(dataType: Debuffs, fightIDs: $best, limit: 10000, useAbilityIDs: true, useActorIDs: true) {
        data
        nextPageTimestamp
      }
      buffs: events(dataType: Buffs, fightIDs: $best, limit: 10000, useAbilityIDs: true, useActorIDs: true) {
        data
        nextPageTimestamp
      }
      deaths: events(dataType: Deaths, fightIDs: $best, limit: 10000, includeResources: true, useAbilityIDs: true, useActorIDs: true) {
        data
        nextPageTimestamp
      }
    }
  }
}
`;

function summaryMetrics(raw, fight) {
  const x = unwrap(raw);
  const duration = Math.max(1, durationMs(fight) / 1000);

  const damageRows = Array.isArray(x.damageDone) ? x.damageDone : [];
  const healRows = Array.isArray(x.healingDone) ? x.healingDone : [];
  const friendly = new Set((fight.friendlyPlayers || []).map(Number));

  const sumRows = (rows) => {
    const selected = rows.filter(r => friendly.has(Number(r.id)));
    return (selected.length ? selected : rows).reduce((s,r) => s + (Number(r.total)||0), 0);
  };

  const damage = sumRows(damageRows);
  const healing = sumRows(healRows);
  return {
    damage,
    healing,
    dps: damage / duration,
    hps: healing / duration,
    composition: Array.isArray(x.composition) ? x.composition : [],
    raw: safeShape(raw)
  };
}

function parseEvents(paginator) {
  const raw = paginator?.data;
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.data)) return raw.data;
  return [];
}

function firstCastByAbility(events, fightStart) {
  const map = new Map();
  for (const e of events || []) {
    const id = e.abilityGameID ?? e.ability?.guid ?? e.ability?.id;
    const name = e.ability?.name ?? e.abilityName ?? null;
    if (id == null && !name) continue;
    const key = String(id ?? name);
    const ts = Number(e.timestamp);
    if (!Number.isFinite(ts)) continue;
    const rel = ts >= Number(fightStart) ? ts - Number(fightStart) : ts;
    if (!map.has(key) || rel < map.get(key).ms) map.set(key, { ms: rel, name, id: num(id) });
  }
  return map;
}

function normalizeRole(role) {
  const s = String(role || "").toLowerCase();
  if (s.includes("tank")) return "TANK";
  if (s.includes("heal")) return "HEAL";
  if (s.includes("dps")) return "DPS";
  return null;
}

function rolesFromPlayerDetails(value) {
  const result = new Map();
  function walk(node, inheritedRole = null) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, inheritedRole);
      return;
    }
    for (const [k,v] of Object.entries(node)) {
      let role = inheritedRole;
      const kl = k.toLowerCase();
      if (kl.includes("tank")) role = "TANK";
      else if (kl.includes("heal")) role = "HEAL";
      else if (kl === "dps" || kl.includes("damage")) role = "DPS";

      if (v && typeof v === "object" && !Array.isArray(v) && (v.name || v.id != null)) {
        const r = normalizeRole(v.role) || role;
        if (r) {
          if (v.id != null) result.set(`id:${v.id}`, r);
          if (v.name) result.set(`name:${String(v.name).toLowerCase()}`, r);
        }
      }
      walk(v, role);
    }
  }
  walk(value);
  return result;
}

function playerMetrics(report, fight, tables) {
  const actors = new Map((report.masterData?.actors || []).map(a => [Number(a.id), a]));
  const detailsRoles = rolesFromPlayerDetails(tables.playerDetails);

  const dpsIndex = indexByActor(tables.bestDamageDone);
  const healIndex = indexByActor(tables.bestHealing);
  const takenIndex = indexByActor(tables.bestDamageTaken);
  const deathIndex = indexByActor(tables.allDeaths);
  const intIndex = indexByActor(tables.allInterrupts);
  const dispelIndex = indexByActor(tables.allDispels);
  const castIndex = indexByActor(tables.allCasts);
  const buffIndex = indexByActor(tables.allBuffs);

  const seconds = Math.max(1, durationMs(fight) / 1000);

  return (fight.friendlyPlayers || []).map((id, idx) => {
    const actor = actors.get(Number(id)) || {};
    const base = {
      actorId: Number(id),
      name: actor.name || `Actor ${id}`,
      className: actor.subType || actor.type || null,
      spec: fight.friendlySpecs?.[idx] || null,
      itemLevel: num(fight.friendlyItemLevels?.[idx])
    };

    const role = detailsRoles.get(`id:${id}`) ||
      detailsRoles.get(`name:${String(base.name).toLowerCase()}`) || null;

    const d = matchActor(dpsIndex, base);
    const h = matchActor(healIndex, base);
    const t = matchActor(takenIndex, base);
    const de = matchActor(deathIndex, base);
    const it = matchActor(intIndex, base);
    const di = matchActor(dispelIndex, base);
    const ca = matchActor(castIndex, base);
    const bu = matchActor(buffIndex, base);

    return {
      ...base,
      role,
      damage: num(d?.total) || 0,
      dps: (num(d?.total) || 0) / seconds,
      healing: num(h?.total) || 0,
      hps: (num(h?.total) || 0) / seconds,
      damageTaken: num(t?.total) || 0,
      deaths: num(de?.total ?? de?.count) || 0,
      interrupts: num(it?.total ?? it?.count) || 0,
      dispels: num(di?.total ?? di?.count) || 0,
      casts: num(ca?.total ?? ca?.count) || 0,
      buffScoreRaw: num(bu?.total ?? bu?.count) || 0
    };
  });
}

function consumableUses(castTable, healingTable) {
  const rows = [...playerRows(castTable), ...playerRows(healingTable)];
  const out = new Map();

  function get(name) {
    const key = String(name || "").toLowerCase();
    if (!out.has(key)) out.set(key, { healthstone: 0, potion: 0 });
    return out.get(key);
  }

  for (const r of rows) {
    const bucket = get(r.name);
    for (const a of (r.abilities || [])) {
      const n = String(a.name || "").toLowerCase();
      const count = Number(a.count ?? a.uses ?? 0) || 0;
      const totalFallback = count || (Number(a.total) > 0 ? 1 : 0);
      if (n.includes("healthstone")) bucket.healthstone += totalFallback;
      if (n.includes("healing potion") || n.includes("health potion") || n.includes("poción de sanación") || n.includes("poción de salud")) {
        bucket.potion += totalFallback;
      }
    }
  }
  return Object.fromEntries(out);
}

function topObservedMechanics(damageTakenTable, castEvents, fight) {
  const casts = firstCastByAbility(castEvents, fight.startTime);
  const abilities = aggregateAbilities(damageTakenTable)
    .filter(a => Number(a.total) > 0)
    .sort((a,b) => Number(b.total)-Number(a.total))
    .slice(0, 8);

  const total = abilities.reduce((s,a) => s + (Number(a.total)||0), 0) || 1;
  return abilities.map(a => {
    const byId = a.guid != null ? casts.get(String(a.guid)) : null;
    const byName = casts.get(String(a.name));
    const first = byId || byName || null;
    return {
      id: a.guid,
      name: a.name,
      totalDamageTaken: a.total,
      shareOfTopObservedDamagePct: 100 * Number(a.total) / total,
      firstCastMs: first?.ms ?? null,
      source: "WCL DamageTaken + Casts",
      classification: "observed",
      failures: null,
      wipeImpact: null
    };
  });
}

function countEventList(v) {
  return parseEvents(v).length;
}

export default async (req) => {
  if (req.method !== "GET") return json(405, { ok:false, error:"Method not allowed" });
  const url = new URL(req.url);
  const reportCode = url.searchParams.get("report") || process.env.WCL_REPORT_CODE || DEFAULT_REPORT;
  const requestedEncounter = url.searchParams.get("encounter");

  try {
    const metaData = await gql(META, { code: reportCode });
    const report = metaData?.reportData?.report;
    if (!report) return json(404, { ok:false, error:"Report not found", reportCode });

    const selected = groupEncounter(report.fights, requestedEncounter);
    const closed = selected.filter(f => !f.inProgress);
    const best = bestFight(selected);
    if (!best) return json(200, { ok:true, reportCode, telemetry:null, reason:"No completed encounter pull." });

    const scored = closed
      .filter(f => Number.isFinite(Number(f.fightPercentage)))
      .slice().sort((a,b) => Number(a.fightPercentage)-Number(b.fightPercentage));
    const compare = scored.find(f => f.id !== best.id) || best;

    const p1s = Number(best.startTime);
    const p2sReal = phaseStart(best, 2);
    const p3sReal = phaseStart(best, 3);
    const end = Number(best.endTime);

    const p1e = p2sReal ?? p3sReal ?? end;
    const p2s = p2sReal ?? p1e;
    const p2e = p3sReal ?? end;
    const p3s = p3sReal ?? end;
    const p3e = end;

    let tableData = null, tableError = null;
    try {
      const d = await gql(TABLES, {
        code: reportCode,
        all: closed.map(f => Number(f.id)),
        best: [Number(best.id)],
        compare: [Number(compare.id)],
        p1s, p1e, p2s, p2e, p3s, p3e
      });
      tableData = d?.reportData?.report || null;
    } catch (e) {
      tableError = e instanceof Error ? e.message : String(e);
    }

    let eventData = null, eventError = null;
    try {
      const d = await gql(BEST_EVENTS, {
        code: reportCode,
        best: [Number(best.id)]
      });
      eventData = d?.reportData?.report || null;
    } catch (e) {
      eventError = e instanceof Error ? e.message : String(e);
    }

    if (!tableData) {
      return json(200, {
        ok: true,
        reportCode,
        encounter: { id: best.encounterID, name: best.name },
        telemetry: null,
        errors: { tables: tableError, events: eventError }
      }, "public, max-age=30, s-maxage=30");
    }

    const bestSummary = summaryMetrics(tableData.bestSummary, best);
    const compareSummary = summaryMetrics(tableData.compareSummary, compare);
    const p1 = summaryMetrics(tableData.phase1, { ...best, startTime:p1s, endTime:p1e });
    const p2 = summaryMetrics(tableData.phase2, { ...best, startTime:p2s, endTime:p2e });
    const p3 = summaryMetrics(tableData.phase3, { ...best, startTime:p3s, endTime:p3e });

    const players = playerMetrics(report, best, tableData);
    const consumables = consumableUses(tableData.allCasts, tableData.allHealing);

    const castEvents = eventData ? parseEvents(eventData.casts) : [];
    const mechanics = topObservedMechanics(tableData.allDamageTaken, castEvents, best);

    const output = {
      ok: true,
      generatedAt: Date.now(),
      reportCode,
      encounter: {
        id: best.encounterID,
        name: best.name,
        pulls: selected.length,
        completedPulls: closed.length
      },
      bestPull: {
        fightId: best.id,
        pullNumber: selected.findIndex(f => f.id === best.id) + 1,
        fightPercentage: num(best.fightPercentage),
        durationMs: durationMs(best)
      },
      comparePull: {
        fightId: compare.id,
        pullNumber: selected.findIndex(f => f.id === compare.id) + 1,
        fightPercentage: num(compare.fightPercentage),
        durationMs: durationMs(compare)
      },
      throughput: {
        best: bestSummary,
        compare: compareSummary,
        phases: {
          p1: p2sReal != null ? p1 : null,
          p2: p2sReal != null ? p2 : null,
          p3: p3sReal != null ? p3 : null
        }
      },
      players,
      mechanics: {
        observedAbilities: mechanics,
        interruptsDetected: playerRows(tableData.allInterrupts).reduce((s,r)=>s+(Number(r.total)||Number(r.count)||0),0),
        dispelsDetected: playerRows(tableData.allDispels).reduce((s,r)=>s+(Number(r.total)||Number(r.count)||0),0),
        deathsDetected: playerRows(tableData.allDeaths).reduce((s,r)=>s+(Number(r.total)||Number(r.count)||0),0),
        debuffRows: playerRows(tableData.allDebuffs).length,
        castRows: playerRows(tableData.allCasts).length,
        rulePackStatus: "pending"
      },
      consumables: {
        detectedUsesByPlayerName: consumables,
        availability: "not-proven-by-wcl"
      },
      bestPullEvents: eventData ? {
        castCount: countEventList(eventData.casts),
        interruptCount: countEventList(eventData.interrupts),
        dispelCount: countEventList(eventData.dispels),
        debuffEventCount: countEventList(eventData.debuffs),
        buffEventCount: countEventList(eventData.buffs),
        deathCount: countEventList(eventData.deaths),
        pagesIncomplete: {
          casts: eventData.casts?.nextPageTimestamp != null,
          interrupts: eventData.interrupts?.nextPageTimestamp != null,
          dispels: eventData.dispels?.nextPageTimestamp != null,
          debuffs: eventData.debuffs?.nextPageTimestamp != null,
          buffs: eventData.buffs?.nextPageTimestamp != null,
          deaths: eventData.deaths?.nextPageTimestamp != null
        }
      } : null,
      graphs: {
        damage: tableData.damageGraph || null,
        healing: tableData.healingGraph || null
      },
      rawShapes: {
        playerDetails: safeShape(tableData.playerDetails),
        damageDone: safeShape(tableData.allDamageDone),
        damageTaken: safeShape(tableData.allDamageTaken),
        healing: safeShape(tableData.allHealing),
        deaths: safeShape(tableData.allDeaths),
        interrupts: safeShape(tableData.allInterrupts),
        dispels: safeShape(tableData.allDispels),
        buffs: safeShape(tableData.allBuffs),
        casts: safeShape(tableData.allCasts),
        debuffs: safeShape(tableData.allDebuffs),
        survivability: safeShape(tableData.allSurvivability)
      },
      evidence: {
        source: "Warcraft Logs API v2",
        tables: "confirmed",
        events: eventData ? "confirmed-first-page" : "unavailable",
        mechanicClassification: "not-classified",
        defensiveAvailability: "not-calculated",
        wipeCausality: "not-calculated"
      },
      errors: {
        tables: tableError,
        events: eventError
      }
    };

    return json(200, output, "public, max-age=30, s-maxage=30, stale-while-revalidate=60");
  } catch (e) {
    console.error(e);
    return json(500, { ok:false, error:e instanceof Error ? e.message : String(e), reportCode });
  }
};
