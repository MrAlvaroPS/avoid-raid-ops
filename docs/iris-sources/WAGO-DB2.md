# Wago DB2 — Iris source contract

## Status

- **Provider ID:** `wago-db2`
- **Runtime role:** bounded structural metadata provider
- **Trust class:** community-exported WoW client DB2 structure
- **Not:** Blizzard Game Data API
- **Not:** Warcraft Logs combat evidence
- **Not:** a source that can promote mechanics

## Why Iris uses it

Blizzard Encounter Journal is excellent for the human-facing semantic tree, but it does not expose every internal/helper spell relation used by the game client.

Wago exposes build-addressable CSV views of WoW DB2 tables. Public tooling such as `RPGLogs/wow-dbc` uses the same `db2/{table}/csv?build=...&filter[field]=...` pattern for programmatic extraction.

Iris uses that surface only for narrowly bounded, build-pinned structural lookups.

## Current production surface

v1 permits only:

```text
GET https://wago.tools/db2/SpellEffect/csv
    ?build=<exact WoW client build>
    &filter[SpellID]=<positive spell ID>
```

and:

```text
GET https://wago.tools/db2/SpellEffect/csv
    ?build=<exact WoW client build>
    &filter[EffectTriggerSpell]=<positive spell ID>
```

No browser HTML scraping is used.

## Build authority

Iris does not ask Wago what the current build is for a boss.

The build is derived from the already-persisted official Blizzard Encounter Journal namespace. Example:

```text
Blizzard namespace: static-12.1.0_68914-eu
Wago DB2 build:     12.1.0.68914
```

This keeps the semantic and structural products aligned to the same client build.

## Allowed use

- exact `SpellEffect` lookup by requested source spell ID;
- exact reverse lookup by `EffectTriggerSpell`;
- extracting `EffectTriggerSpell` spell-to-spell relations;
- retaining selected DB2 effect/target numbers for later reviewed interpretation;
- comparing relation endpoints with Blizzard official Journal membership;
- persisting normalized derived structural facts with build/source provenance.

## Forbidden use

- bulk mirroring the DB2 catalogue into Iris;
- recursive unbounded crawling;
- downloading entire tables as a fallback when a filtered request fails;
- treating Wago as an official Blizzard API;
- treating a DB2 relation as observed combat causality;
- treating Wago absence as proof that a mechanic/spell does not exist;
- using Wago to satisfy WCL provenance, matched-null, holdout or Promotion gates;
- persisting raw CSV responses as canonical evidence.

## Safety limits

Current implementation enforces:

```text
max seed abilities = 12
max calls/seed in both-direction mode = 2
max filtered response = 2 MB
max parsed rows/request = 5000
raw CSV persisted = false
```

If the filtered endpoint unexpectedly returns a broad result, Iris locally filters to the requested key and exposes whether the server-side filter was actually respected.

## Failure semantics

Wago errors are provider availability/schema errors, not mechanic-negative evidence.

A missing or changed DB2 row may be meaningful only after confirming the correct build/schema and reconciling with other evidence. Iris must not silently convert a 4xx/5xx, empty response or schema mismatch into "not a boss mechanic".

## Relationship to other providers

```text
Blizzard Encounter Journal
  -> official published encounter semantics

Wago DB2
  -> build-specific client structural implementation hints

Warcraft Logs
  -> observed combat truth

Lorrgs / Wowhead
  -> secondary/reference corroboration
```

There is no universal ranking: each provider answers a different claim class.

## Evidence effect

Every Wago relation has:

```text
observedCombat = false
causalCombatEvidence = false
promotionEffect = none
canonicalDeepContribution = 0
directScoreDelta = 0
automaticPromotion = false
```

See `docs/IRIS-SPELL-STRUCTURAL-KNOWLEDGE-V1.md` for the compiled product contract.
