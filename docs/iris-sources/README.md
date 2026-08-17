# Iris External Source Directory

**Status:** v3.9 refactor contract · feature branch only  
**Reviewed:** 2026-08-17  
**Machine registry:** `server/iris/external-source-registry-v390.mjs`

This directory tells Iris where to look when developing raid intelligence, what each source can actually provide, and what evidence status it deserves. It is a consultation map, not blanket permission to scrape websites or treat every third-party result as truth.

## Decision hierarchy

| Priority | Source | Use in Iris | API posture |
|---|---|---|---|
| 1 | Warcraft Logs | Canonical observed combat/report/ranking/world data | Official OAuth2 + GraphQL v2 |
| 2 | AvoiD/Iris contracts and rule packs | Versioned product semantics and derived rules | Internal |
| 3 | Blizzard Game Data | Supported game metadata when provider is implemented | Official provider planned |
| 4 | Lorrgs | Secondary benchmark/discovery: top-parse timelines, comp rankings, spell/boss/spec metadata | Public FastAPI/OpenAPI, third-party |
| 5 | WoWAnalyzer | Player-analysis architecture and spec-analysis reference | Open-source/reference; no supported public data API identified |
| 6 | Wipefest | Mechanical-analysis/UX reference | Explicitly no public extraction API; use WCL instead |
| 7 | Mythic Trap | Encounter-guide, phase and role-strategy reference | Human/reference source; no supported public developer API identified |
| 8 | Archon.gg WoW pages | Meta/build/ranking product reference and WCL help/scripts | No separate supported Archon meta-data API identified; WCL API is the supported programmable surface |

## Hard rules

1. **Warcraft Logs observed evidence remains the combat source of truth.** Third-party interpretation cannot override an event, actor, fight, timestamp, cast, aura or result observed in WCL.
2. **Do not invent endpoints.** If an API is undocumented or explicitly unavailable, Iris treats the site as reference-only until a supported contract is discovered and reviewed.
3. **Do not scrape RPGLogs/Archon/WCL/Wipefest pages to bypass an API.** Use documented APIs and respect their authentication and rate constraints.
4. **Third-party aggregates are derived evidence.** Lorrgs/WoWAnalyzer/Wipefest/Archon/Mythic Trap may inspire algorithms or provide contextual benchmarks, but their outputs require provenance and must not silently become canonical evidence.
5. **Open source does not mean unrestricted code reuse.** WoWAnalyzer is AGPL-3.0-or-later. Iris may study its architecture/patterns, but copying code requires an explicit licensing decision.
6. **Home-raid data and global research stay separated.** External benchmarks may inform comparisons; they never become AvoiD player facts.

## Source-specific documentation

- [`WARCRAFT-LOGS.md`](./WARCRAFT-LOGS.md) — official API, schema families, request strategy, permissions and rate budget.
- [`WOWANALYZER.md`](./WOWANALYZER.md) — open-source analyzer architecture, event/normalizer patterns and licensing boundary.
- [`WIPEFEST.md`](./WIPEFEST.md) — mechanical-analysis reference and explicit no-public-API boundary.
- [`ARCHON.md`](./ARCHON.md) — Archon/WCL relationship, scripts, Report Components and unsupported/internal surfaces.
- [`LORRGS.md`](./LORRGS.md) — public FastAPI/OpenAPI endpoint catalogue and safe read-only posture.
- [`MYTHIC-TRAP.md`](./MYTHIC-TRAP.md) — encounter/phase/role-guide reference and no-API boundary.

## How Iris should choose a source

```text
Need exact event/fight/player/raid evidence?
    -> Warcraft Logs

Need WCL game/world metadata or ranking primitives?
    -> Warcraft Logs GameData / WorldData / CharacterData / GuildData

Need examples of player-performance analyzer architecture?
    -> WoWAnalyzer source/docs, concept/reference only

Need raid-mechanic analysis ideas or failure UX?
    -> Wipefest reference, rebuild from WCL evidence

Need top-parse cooldown timelines or composition samples?
    -> Lorrgs read-only API as secondary context, then verify relevant facts in WCL

Need encounter explanation, phase flow, role instructions?
    -> Mythic Trap reference, reconcile with WCL IDs/rule packs

Need WCL scripting/report-component capability or Archon product context?
    -> Archon/WCL help docs
```

## Review cadence

Recheck this directory when any of these occur:

- new WoW patch/season;
- WCL schema or API contract changes;
- provider announces an API;
- provider changes ownership/host/terms;
- Iris gains a new direct integration;
- a new source is proposed as canonical or score-affecting evidence.

A source becoming technically reachable is **not** enough to upgrade its trust class. The registry and docs must be reviewed and versioned first.
