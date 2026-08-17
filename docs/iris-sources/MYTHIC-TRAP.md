# Iris Source Contract — Mythic Trap

**Site:** `https://www.mythictrap.com/en`  
**Status for Iris:** encounter/strategy human-reference source  
**Reviewed:** 2026-08-17

## Public API status

No supported public developer API for Mythic Trap was identified in the public material reviewed for this contract. Iris must not infer an API contract from page JSON, embed routes or browser requests.

Use Mythic Trap as a **semantic/reference source**, not as a programmatic combat-data provider.

## What Mythic Trap is useful for

Current guides expose a useful human model of encounters:

- raid/boss identity;
- difficulty-specific changes;
- role filters (healer/DPS/tank);
- fight overview;
- phases/intermissions;
- mechanic names/categories;
- concise `WHAT TO DO` instructions;
- timing/health/energy thresholds where the guide documents them;
- presentation/quick-strategy views.

For example, the current Belo'ren Mythic guide presents the encounter as repeating phases, explains color assignments, Mythic-specific Radiant Echo/Quill behavior, matching-color interrupts and the egg/Rebirth stage. This is valuable for checking whether Iris's generated model has sensible human semantics.

## Evidence boundary

A Mythic Trap statement is **guide knowledge**, not proof that an event happened in a particular pull.

Correct workflow:

```text
Mythic Trap says a mechanic is important / phase-specific / role-specific
    -> identify exact boss/spell/aura/NPC IDs from WCL/official metadata
    -> verify occurrence and timing in WCL
    -> encode the semantic rule in a versioned AvoiD rule/knowledge revision
    -> validate across reports/holdout
```

Do not make Mythic Trap prose itself a score denominator or failure event.

## Relationship with other sources

Mythic Trap's own resource page recommends Warcraft Logs for performance/fight understanding, Wowhead for formatted game information, Wipefest for log-based raid analysis, and WoWAnalyzer for player rotation/spec analysis. Its boss pages directly link to Wipefest analysis.

This reinforces Iris's source hierarchy rather than replacing it.

## Do not

- scrape the site into the canonical knowledge DB;
- assume embed/page structure is a stable API;
- automatically copy guide text or media;
- present strategy advice as a WCL-observed fact;
- overwrite a versioned AvoiD rule silently when a guide changes.

A future licensed/documented Mythic Trap API may be added only through a new reviewed registry version.
