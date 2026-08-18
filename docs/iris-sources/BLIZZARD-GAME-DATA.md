# Iris Source Contract — Blizzard Game Data

**Provider:** Blizzard Battle.net Game Data API  
**Auth:** OAuth 2.0 client credentials  
**Status for Iris:** official supported provider  
**Runtime integration:** available in v3.9.9  
**Reviewed:** 2026-08-18

Blizzard Game Data is Iris's highest-trust provider for published World of Warcraft encounter metadata. It is not combat telemetry: Warcraft Logs remains the canonical empirical source for what actually happened in a pull.

## Current Iris surfaces

v3.9.9 implements bounded server-side access to:

```text
POST https://oauth.battle.net/token
GET  /data/wow/search/journal-encounter
GET  /data/wow/journal-encounter/{journalEncounterId}
GET  /data/wow/spell/{spellId}              diagnostic/fallback
```

The encounter resolver follows the exact `key.href` returned by Blizzard search when available so the build-specific namespace supplied by Blizzard is retained.

## Credentials

Server-side environment only:

```text
BLIZZARD_CLIENT_ID
BLIZZARD_CLIENT_SECRET
BLIZZARD_REGION=eu
BLIZZARD_LOCALE=en_US
```

Never expose the client secret or OAuth access token in browser code, logs, API responses, Git or persisted encounter evidence.

The runtime reuses an access token in process memory until near expiry. It must not request a fresh token for every entity lookup.

## Primary role: Encounter Journal

The Encounter Journal is the authoritative semantic seed for encounter structure that Blizzard currently publishes. Iris can derive:

- official encounter identity;
- raid/instance identity;
- supported difficulty modes;
- encounter creatures;
- ordered/nested Journal sections;
- phase/stage-like structural sections where exposed;
- mechanic and submechanic hierarchy;
- spell IDs and names attached to sections;
- official overview/role/mechanic explanatory text;
- Blizzard's build-specific namespace/source revision.

This data forms `official-encounter-semantic-graph-v1`.

## Spell detail limitation

`/data/wow/spell/{id}` is useful when available, but it is **not** treated as a complete encounter-spell catalogue. During v3.9.9 validation, a working OAuth token and other Game Data endpoints could succeed while some spell-detail calls returned `403 Forbidden`.

Therefore failure semantics are deliberately non-negative:

```text
200 -> resolved
401 -> authentication-failed
403 -> provider-forbidden-or-unavailable
404 -> not-published-by-endpoint
5xx -> provider-unavailable
```

None of those failure states is evidence that a spell is absent from an encounter. Official encounter membership comes from the Journal graph when present.

## Trust position

```text
WCL observed combat             canonical empirical truth
Blizzard Encounter Journal      official published encounter semantics/membership
Blizzard spell detail           official identity/description when available
AvoiD versioned rule knowledge  product semantics
WoW client DB2                  structural implementation data when integrated
Lorrgs                           secondary encounter/timeline context
Wowhead / Parse Wowhead         secondary reference/corroboration
```

## What Blizzard Journal can prove

If Blizzard publishes a spell under a Journal section, Iris may state that the spell has official Journal membership in that encounter and preserve its official structural path.

It may also quote/paraphrase the official Journal semantics for explanation and planning.

## What it cannot prove

Journal metadata does **not** prove:

- that a spell occurred in a particular pull;
- its exact observed timestamp;
- its source/target actor in a log;
- that two combat events caused one another;
- that an observed player failed the mechanic;
- that an inferred mechanic satisfies promotion gates.

Those claims remain grounded in WCL empirical evidence and the appropriate Iris evidence contracts.

## Freshness and revisions

Blizzard is preferred for published encounter structure precisely because encounter mechanics, IDs and descriptions can change with builds/patches. The resolver records the provider namespace/build exposed by the current API response rather than silently treating old metadata as timeless.

A later durable knowledge refresh may compare graph fingerprints/build namespaces and invalidate/rederive affected derived interpretations. Raw WCL evidence remains immutable.

## Runtime API

Iris exposes official encounter resolution through:

```text
GET/POST /api/knowledge/encounter
```

Preview is zero-network. Resolution is fingerprinted and explicitly confirmed before server-side provider execution. It consumes zero WCL calls and zero third-party provider calls.
