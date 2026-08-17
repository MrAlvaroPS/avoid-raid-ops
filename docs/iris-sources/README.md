# Iris External Source Directory

**Status:** v3.9.3 provider-aware knowledge contract  
**Reviewed:** 2026-08-17  
**Machine registry:** `server/iris/external-source-registry-v390.mjs`

This directory tells Iris where to look when developing raid intelligence, what each source can actually provide, and what evidence status it deserves. It is a consultation map, not blanket permission to scrape websites or treat every third-party result as truth.

## Decision hierarchy

| Priority | Source | Use in Iris | API posture |
|---|---|---|---|
| 1 | Warcraft Logs | Canonical observed combat/report/ranking/world data; official ability + encounter identity | Official OAuth2 + GraphQL v2 |
| 2 | AvoiD/Iris contracts and rule packs | Versioned product semantics and derived rules | Internal |
| 3 | Blizzard Game Data | Supported game metadata when provider is implemented | Official provider planned |
| 4 | Lorrgs | Secondary boss membership/spell discovery, top-parse timelines and composition context | Public FastAPI/OpenAPI; read-only runtime client available |
| 5 | Parse Wowhead API | Spell/NPC identity, canonical Wowhead reference and search fallback | Third-party maintained REST wrapper; optional keyed client |
| 6 | WoWAnalyzer | Player-analysis architecture and spec-analysis reference | Open-source/reference; no supported public data API identified |
| 7 | Wipefest | Mechanical-analysis/UX reference | Explicitly no public extraction API; use WCL instead |
| 8 | Mythic Trap | Encounter-guide, phase and role-strategy reference | Human/reference source; no supported public developer API identified |
| 9 | Archon.gg WoW pages | Meta/build/ranking product reference and WCL help/scripts | No separate supported Archon meta-data API identified; WCL API is the supported programmable surface |

## Hard rules

1. **Warcraft Logs observed evidence remains the combat source of truth.** Third-party interpretation cannot override an event, actor, fight, timestamp, cast, aura or result observed in WCL.
2. **Static identity is not combat evidence.** WCL GameData, Lorrgs and Parse/Wowhead can identify/enrich an ID without proving it occurred or caused another event.
3. **Do not invent endpoints.** If an API is undocumented or explicitly unavailable, Iris treats the site as reference-only until a supported contract is discovered and reviewed.
4. **Do not scrape RPGLogs/Archon/WCL/Wipefest pages to bypass an API.** Use documented APIs and respect authentication/rate constraints.
5. **Third-party aggregates are derived evidence.** Lorrgs/WoWAnalyzer/Wipefest/Archon/Mythic Trap may inspire algorithms or provide contextual benchmarks, but their outputs require provenance and must not silently become canonical evidence.
6. **A maintained wrapper is still a wrapper.** Parse Wowhead is useful enrichment, not an official Wowhead developer API and not a boss-membership authority.
7. **Open source does not mean unrestricted code reuse.** WoWAnalyzer is AGPL-3.0-or-later. Iris may study its architecture/patterns, but copying code requires an explicit licensing decision.
8. **Home-raid data and global research stay separated.** External benchmarks may inform comparisons; they never become AvoiD player facts.

## Source-specific documentation

- [`WARCRAFT-LOGS.md`](./WARCRAFT-LOGS.md) — official API, schema families, request strategy, permissions and rate budget.
- [`LORRGS.md`](./LORRGS.md) — public FastAPI/OpenAPI catalogue and safe read-only runtime posture.
- [`PARSE-WOWHEAD.md`](./PARSE-WOWHEAD.md) — Parse-maintained Wowhead wrapper, quotas, trust boundary and enrichment use.
- [`WOWANALYZER.md`](./WOWANALYZER.md) — analyzer architecture, event/normalizer patterns and licensing boundary.
- [`WIPEFEST.md`](./WIPEFEST.md) — mechanical-analysis reference and explicit no-public-API boundary.
- [`ARCHON.md`](./ARCHON.md) — Archon/WCL relationship, scripts, Report Components and unsupported/internal surfaces.
- [`MYTHIC-TRAP.md`](./MYTHIC-TRAP.md) — encounter/phase/role-guide reference and no-API boundary.

## How Iris should choose a source

```text
Need exact event/fight/player/raid evidence?
    -> Warcraft Logs ReportData

Need official ability identity or encounter identity/scope?
    -> Warcraft Logs GameData / WorldData

Need to know whether a candidate ID is listed in a boss's secondary spell catalogue?
    -> Lorrgs /bosses/{boss_slug}/spells
    -> keep secondary-derived provenance

Need a numeric spell/NPC ID resolved to a Wowhead name/reference or fallback search?
    -> Parse Wowhead wrapper, if configured and credit spend is approved

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

## Provider-aware ability knowledge

v3.9.3 adds `provider-aware-ability-knowledge-v1` and `/api/knowledge/ability`. The endpoint separates preview from execution, fingerprints the exact provider selection, batches WCL static ability metadata into one request when explicitly enabled, and reports provider disagreements instead of silently choosing one source. See [`../IRIS-PROVIDER-AWARE-ABILITY-KNOWLEDGE-V1.md`](../IRIS-PROVIDER-AWARE-ABILITY-KNOWLEDGE-V1.md).

## Review cadence

Recheck this directory when any of these occur:

- new WoW patch/season;
- WCL schema or API contract changes;
- provider announces or changes an API;
- provider changes ownership/host/terms/pricing;
- Iris gains a new direct integration;
- a new source is proposed as canonical or score-affecting evidence.

A source becoming technically reachable is **not** enough to upgrade its trust class. The registry and docs must be reviewed and versioned first.
