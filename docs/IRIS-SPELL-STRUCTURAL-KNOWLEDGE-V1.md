# Iris Spell Structural Knowledge v1

## Purpose

`spell-structural-knowledge-v1` fills the gap between the official Blizzard Encounter Journal and observed Warcraft Logs combat.

It answers a narrower question:

> How are spell IDs structurally wired in the WoW client data for the exact build that Blizzard says this encounter belongs to?

It does **not** answer whether an event occurred in a pull, whether a player failed a mechanic, or whether one combat event caused another in observed logs.

## Source model

```text
Blizzard Encounter Journal
  -> official encounter hierarchy / spell membership / build namespace

WoW client DB2 exported through Wago
  -> structural SpellEffect rows for that exact build

Warcraft Logs
  -> observed combat truth
```

Wago is not promoted to the same trust class as Blizzard. It is a practical build-addressable export surface for WoW client DB2 tables. Every stored relation retains provider/build/table provenance and has `promotionEffect = none`.

## Build pinning

Structural lookup never uses `latest`.

The Wago build is derived from the already-persisted official Blizzard namespace:

```text
static-12.1.0_68914-eu
        ↓
12.1.0.68914
```

If the official encounter graph changes build, subsequent structural resolution receives a different build and therefore a different derived fingerprint/revision.

Historical WCL and historical structural revisions remain immutable.

## v1 table scope

v1 deliberately starts with one table:

```text
SpellEffect
```

and one structural field:

```text
EffectTriggerSpell
```

A normalized relation is:

```text
source SpellID
  -- SpellEffect.EffectTriggerSpell -->
target spell ID
```

The relation kind emitted in Iris is:

```text
trigger-spell
```

This is intentionally generic. v1 does not guess from an Effect integer that the row is a missile, aura application, proc or other higher-level gameplay semantic unless another reviewed contract explicitly interprets it.

## Bounded lookup

The provider uses build-pinned filtered CSV requests:

```text
/db2/SpellEffect/csv
  ?build=<exact-build>
  &filter[SpellID]=<id>

/db2/SpellEffect/csv
  ?build=<exact-build>
  &filter[EffectTriggerSpell]=<id>
```

Both directions are useful:

- `SpellID` finds outbound triggered spells from a known seed;
- `EffectTriggerSpell` finds internal/helper spell IDs that point into a known official/WCL spell.

Default mode is `both`.

Hard limits:

- maximum 12 seed abilities per request;
- at most 2 Wago calls per seed in `both` mode;
- 2 MB maximum response body per filtered request;
- 5000 parsed rows maximum;
- no bulk table download fallback;
- no recursive graph crawl;
- no automatic expansion beyond relations returned for requested seeds.

## Persistence

Raw CSV is **never** persisted.

Only normalized derived facts are stored:

- provider = `wago-db2`;
- exact client build;
- table = `SpellEffect`;
- source/target spell IDs;
- DB2 row ID/effect index when present;
- selected structural numeric fields;
- exact filtered source URL;
- official Blizzard context for either endpoint;
- fingerprint and previous revision metadata.

Latest lookup:

```text
knowledge/spell-structure/wago/by-wcl/{wclEncounterId}/latest.json
```

Immutable revision:

```text
knowledge/spell-structure/wago/by-wcl/{wclEncounterId}/builds/{build}/revisions/{fingerprint}.json
```

## Official reconciliation

Each structural relation is compared with the persisted Blizzard Journal graph.

Possible context labels include:

```text
official-to-official-structural-link
unlisted-source-to-official-target
official-source-to-unlisted-target
official-context-unresolved
```

`unlisted` is not negative evidence. An internal/helper DB2 spell can be absent from the human-facing Journal and still structurally point to an official mechanic spell.

## Evidence contract

A DB2 relation may explain implementation structure, but it cannot by itself establish:

- observed occurrence;
- actor provenance in a pull;
- timing in a pull;
- combat causality;
- mechanic failure;
- exact-pattern provenance;
- matched-null specificity;
- independent evidence groups;
- holdout success;
- promotion eligibility.

Therefore:

```text
providerRelationsCannotSatisfyExactPatternProvenance = true
providerRelationsCannotPromoteMechanic = true
automaticPromotion = false
```

## API

Endpoint:

```text
/api/knowledge/spell-structure
```

Actions:

```text
preview
resolve
latest
```

`preview` reads only persisted official knowledge and performs zero provider calls.

`resolve` requires:

```text
confirmExecution = true
previewFingerprint = current fingerprint
```

Only Wago DB2 is contacted. Blizzard and WCL network calls remain zero.

`latest` is zero-network.

## Belo'ren validation target

The current diagnostic fixture is:

```text
1243560
  ? SpellEffect.EffectTriggerSpell
  -> 1241163 Void Feather
```

The fixture is never hard-coded into production logic. The smoke test only reports whether the exact current build contains that relation.

If confirmed, the correct interpretation is initially only:

> build-pinned client structural metadata links 1243560 to the official encounter spell 1241163.

It is **not** automatically:

> 1243560 is a boss cast, 1243560 caused a particular observed aura event, or a player failed because of this relation.

Those claims remain WCL/evidence-contract questions.

## Position in the Iris pipeline

```text
Official Encounter Knowledge (Blizzard)
        ↓
Spell Structural Knowledge (DB2/Wago)
        ↓
WCL empirical reconciliation
        ↓
Specificity / provenance / Episode / Matched Null
        ↓
Evidence Groups / Stability / Holdout / Promotion
        ↓
AvoiD-specific diagnosis
```

The practical benefit is that Iris can stop treating every nearby numeric ID as an unrelated mystery. It gains a build-specific implementation map while preserving the hard distinction between structural metadata and observed combat truth.
