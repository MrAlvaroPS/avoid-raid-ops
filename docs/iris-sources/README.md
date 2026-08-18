# Iris External Source Directory

**Status:** v3.9.9 official encounter knowledge contract  
**Reviewed:** 2026-08-18  
**Machine registry:** `server/iris/external-source-registry-v390.mjs`  
**Canonical source-selection doctrine:** [`../IRIS-KNOWLEDGE-EVIDENCE-DOCTRINE-V1.md`](../IRIS-KNOWLEDGE-EVIDENCE-DOCTRINE-V1.md)

This directory tells Iris where to look when developing raid intelligence, what each source can actually provide, and what evidence status it deserves. It is a consultation map, not blanket permission to scrape websites or treat every external result as combat truth.

There is deliberately **no universal provider ranking**. Authority depends on the question:

```text
official published encounter semantics -> Blizzard
observed combat / pull facts            -> Warcraft Logs ReportData
AvoiD-specific execution                -> AvoiD WCL evidence + accepted Iris evaluation contracts
secondary context/reference             -> reviewed supporting providers
```

## Authority by question

| Source | Authoritative/primary use in Iris | API posture |
|---|---|---|
| Blizzard Game Data | Official published Encounter Journal hierarchy, spell membership, descriptions and supported static metadata for the exposed build | Official OAuth2 Game Data API; runtime provider available |
| Warcraft Logs | Canonical observed combat/report/ranking data: what actually happened in a pull | Official OAuth2 + GraphQL v2 |
| AvoiD/Iris contracts and rule packs | Versioned product semantics, evaluation rules and accepted internal interpretation | Internal |
| Lorrgs | Secondary boss membership/spell discovery, top-parse timelines and composition context | Public FastAPI/OpenAPI; read-only runtime client available |
| Parse Wowhead API | Spell/NPC identity, canonical Wowhead reference and search fallback | Third-party maintained REST wrapper; optional keyed client |
| WoWAnalyzer | Player-analysis architecture and spec-analysis reference | Open-source/reference; no supported public data API identified |
| Wipefest | Mechanical-analysis/UX reference | Explicitly no public extraction API; use WCL instead |
| Mythic Trap | Encounter-guide, phase and role-strategy reference | Human/reference source; no supported public developer API identified |
| Archon.gg WoW pages | Meta/build/ranking product reference and WCL help/scripts | No separate supported Archon meta-data API identified; WCL API is the supported programmable surface |

## Hard rules

1. **Warcraft Logs observed evidence remains the combat source of truth.** No provider metadata can override an observed event, actor, fight, timestamp, cast, aura or result.
2. **Blizzard is authoritative for the published metadata it exposes, not for pull occurrence.** Journal hierarchy, names, descriptions and spell membership can be accepted as official encounter semantics for that build, but do not prove that an event occurred in a particular log or that two events are causally related.
3. **Use Blizzard before WCL for static semantic questions.** If the official Journal already answers hierarchy/membership, reuse or refresh that graph instead of spending combat-event budget rediscovering the same fact statistically.
4. **Use stored WCL before new WCL for empirical questions.** New event acquisition should target only the smallest unresolved exact-fight/window/stream evidence.
5. **Static identity is not combat evidence.** WCL GameData, Blizzard Game Data, Lorrgs and Parse/Wowhead can identify/enrich an ID without proving occurrence in a pull.
6. **Provider failure is not automatic negative evidence.** In particular, a Blizzard `/spell/{id}` 403/404 does not mean the spell is absent from the encounter; use Journal membership when available.
7. **Do not invent endpoints.** If an API is undocumented or explicitly unavailable, Iris treats the site as reference-only until a supported contract is discovered and reviewed.
8. **Do not bulk scrape websites to bypass APIs.** Targeted human/reference lookup of a known entity does not create a production scraping contract.
9. **Third-party aggregates are derived evidence.** Lorrgs/WoWAnalyzer/Wipefest/Archon/Mythic Trap may inspire algorithms or provide contextual benchmarks, but their outputs require provenance and must not silently become canonical evidence.
10. **A maintained wrapper is still a wrapper.** Parse Wowhead is useful enrichment, not an official Wowhead developer API and not a primary boss-membership authority.
11. **Open source does not mean unrestricted code reuse.** WoWAnalyzer is AGPL-3.0-or-later. Iris may study its architecture/patterns, but copying code requires an explicit licensing decision.
12. **Home-raid data and global research stay separated.** External benchmarks may inform comparisons; they never become AvoiD player facts.

## Source-specific documentation

- [`WARCRAFT-LOGS.md`](./WARCRAFT-LOGS.md) — official API, schema families, request strategy, permissions and rate budget.
- [`BLIZZARD-GAME-DATA.md`](./BLIZZARD-GAME-DATA.md) — official Encounter Journal/static metadata provider, OAuth, trust boundary and failure semantics.
- [`LORRGS.md`](./LORRGS.md) — public FastAPI/OpenAPI catalogue and safe read-only runtime posture.
- [`PARSE-WOWHEAD.md`](./PARSE-WOWHEAD.md) — Parse-maintained Wowhead wrapper, quotas, trust boundary and enrichment use.
- [`WOWANALYZER.md`](./WOWANALYZER.md) — analyzer architecture, event/normalizer patterns and licensing boundary.
- [`WIPEFEST.md`](./WIPEFEST.md) — mechanical-analysis reference and explicit no-public-API boundary.
- [`ARCHON.md`](./ARCHON.md) — Archon/WCL relationship, scripts, Report Components and unsupported/internal surfaces.
- [`MYTHIC-TRAP.md`](./MYTHIC-TRAP.md) — encounter/phase/role-guide reference and no-API boundary.

## How Iris should choose a source

```text
Need the official published encounter structure, stage/mechanic hierarchy,
spell membership or Blizzard mechanic/role description?
    -> first check persisted Blizzard official encounter knowledge
    -> refresh Blizzard only if missing/stale/build-changed
    -> retain build/namespace + fingerprint provenance

Need exact event/fight/player/raid evidence?
    -> first reuse persisted WCL evidence
    -> if still unresolved, query Warcraft Logs ReportData
    -> exact fight + bounded time window + relevant stream whenever possible

Need official spell identity/description and Blizzard publishes that spell record?
    -> Blizzard /data/wow/spell/{id}
    -> endpoint failure is non-negative evidence

Need official WCL ability/encounter identity or WCL-specific scope?
    -> Warcraft Logs GameData / WorldData

Need to know whether a candidate ID appears in a secondary boss timeline catalogue?
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

Need human strategy/reference beyond the official Journal?
    -> Mythic Trap / targeted Wowhead reference
    -> reconcile with official IDs and WCL evidence

Need WCL scripting/report-component capability or Archon product context?
    -> Archon/WCL help docs
```

## Official encounter knowledge

v3.9.9 adds `official-encounter-knowledge-v1`, `official-encounter-semantic-graph-v1` and `/api/knowledge/encounter`.

The resolver searches/fetches the current Blizzard Encounter Journal, follows Blizzard's build-specific `key.href`, compiles the nested Journal into a generic graph and exposes a `spellId -> official membership paths` index for reconciliation with WCL signals. See [`../IRIS-OFFICIAL-ENCOUNTER-KNOWLEDGE-V1.md`](../IRIS-OFFICIAL-ENCOUNTER-KNOWLEDGE-V1.md).

## Provider-aware ability knowledge

v3.9.3 added `provider-aware-ability-knowledge-v1` and `/api/knowledge/ability`. That endpoint remains useful for ID enrichment and secondary provider comparison. Official Encounter Knowledge now provides the preferred source for Blizzard-published encounter membership/hierarchy.

## Review cadence

Recheck this directory when any of these occur:

- new WoW patch/season/build;
- WCL schema or API contract changes;
- Blizzard Journal/Game Data schema or namespace behavior changes;
- provider announces or changes an API;
- provider changes ownership/host/terms/pricing;
- Iris gains a new direct integration;
- a new source is proposed as canonical or score-affecting evidence.

A source becoming technically reachable is **not** enough to upgrade its trust class. The registry and docs must be reviewed and versioned first.
