# Reliability Data Integrity v1

Reliability is personnel-facing data. A wrong denominator is more damaging than a missing score. This document defines the non-negotiable consistency rules for ingestion, persistence and comparison.

## Canonical entities

### Player identity

Preferred identity order:

1. WCL/Blizzard canonical character identity when available;
2. provisional `region + realm + character name`;
3. report-scoped actor ID only.

A report actor ID is not stable across reports and therefore cannot publish longitudinal Reliability. A provisional name+realm identity can accumulate evidence but caps confidence at MEDIUM because rename/transfer can break continuity.

Spec and role are **context**, not identity. A player changing spec remains the same character but the evidence must retain the spec/role used for each opportunity.

### Pull identity

Longitudinal Reliability must consume the same canonical/deduplicated pull identity used by Progress/History. Two logger reports of the same raid pull must count once.

Until a canonical cross-report pull key is provided, report-local evidence is allowed only in report-scoped shadow mode.

### Opportunity identity

Every scored row needs a deterministic key:

```text
canonicalPullKey + actorIdentity + dimension + responsibilityKey + occurrenceKey
```

Duplicate raw events that belong to the same mechanic occurrence must collapse before Reliability scoring.

## Population invariants

For each player profile:

```text
survival opportunities == eligible pulls attended by that player
mechanic failures <= mechanic player opportunities for scored mechanics
defensive failures <= confirmed-available defensive opportunities
duty failures <= proven assigned/observable duty opportunities
```

If any invariant fails, the affected dimension becomes `data-error`/pending rather than clamping the number into range.

The scorer may clamp floating point penalty mass for numerical safety, but upstream count inconsistencies must remain visible in diagnostics.

## Attendance

Guild pull count is never used as a player denominator unless the player is proven present in every pull.

Presence is derived from the fight roster (`friendlyPlayers`) or a future canonical attendance ledger.

Bench/substitution does not hurt Reliability.

## Death consistency

Reliability Survival uses meaningful Death events with the same wipe-cutoff semantics across every player.

- One player can contribute at most one Survival incident per pull.
- First meaningful death is determined within the same meaningful-death population.
- Raw post-wipe deaths are audit evidence only.
- Probable cause does not alter whether the Survival incident exists.

## Mechanics consistency

Mechanic failures and mechanic opportunities must come from the same rule/model version.

A generated encounter rule can score Reliability only if its player attribution is publishable under the encounter-model provenance policy. An unverified relation can never become a Reliability opportunity or failure.

Occurrence normalization happens before player scoring. Multiple damage ticks/rows from one failure are one failed opportunity.

If a failure is player-attributed but clean player opportunities cannot be proven, store it as `unscoredFailures`; never invent the denominator from raid-wide cast count.

## Defensive consistency

Availability state is tri-state:

```text
confirmed available
confirmed unavailable
unknown
```

Only `confirmed available` creates a scoreable defensive opportunity.

`unknown` is not equivalent to available.

Consumables require stronger proof than cast absence. No Healthstone/healing-potion penalty is allowed from `no cast observed` alone.

## Duty consistency

Raw utility counts are never denominators.

Examples:

- `5 interrupts` is descriptive.
- `5/6 assigned interrupt opportunities completed` is Reliability evidence.

If assignment ownership cannot be proven, keep the event outside Reliability.

## Spec/role changes

Evidence rows always retain `class + spec + role` at observation time.

Encounter Reliability may aggregate across a spec change only if the compared dimensions have compatible responsibilities; v1 defaults to segmenting peer baselines by current evidence context instead of pretending two specs are equivalent.

Same-class is a fallback peer context, not equivalent to same-spec.

## Peer consistency

Peer hierarchy is deterministic and recorded on every component.

The displayed statement must name the actual source:

```text
same-spec/role
same-class/role
same-role
roster
policy fallback
```

A policy fallback is never labeled `peer median`.

External peer datasets must include a benchmark timestamp/model version because rankings/corpus composition can evolve.

## Comparison consistency

Two overall Reliability values are directly comparable only when:

- both are published;
- both have sufficient confidence;
- both score the same dimensions under the same model version.

If component coverage differs, Iris must compare shared components and explain the mismatch.

## Parse separation invariant

No field named or derived from DPS, HPS, parse percentile, ranking, boss DPS, weighted DPS, damage amount or healing amount may enter `scoreReliabilityProfiles`.

Performance data can live next to Reliability in the UI and can be used in separate performance analysis, but Reliability's score trace must contain only Reliability dimensions.

## Auditability

Every published score must retain enough compact evidence to reconstruct:

- model/policy version;
- identity source;
- encounter/difficulty/partition;
- pull population;
- opportunity counts/mass;
- failure counts/mass;
- peer baseline source/rate/sample;
- component values;
- effective weights;
- exact contribution sum;
- confidence gates;
- publication gates.

If the displayed number cannot be recreated from this trace, it is a product bug.

## Persistence target

Do not persist raw WCL events for Reliability if a compact evidence row is sufficient.

Target flow:

```text
WCL events/tables
   -> encounter/duty/defensive analyzers
   -> compact player opportunity ledger
   -> versioned Reliability scorer
   -> player/encounter profile
   -> current-form / tier aggregates
```

This keeps the system scalable and avoids recreating the Blob hot-read problem discovered in the encounter corpus.
