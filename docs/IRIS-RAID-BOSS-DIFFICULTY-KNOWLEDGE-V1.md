# Iris Raid → Boss → Difficulty Knowledge v1

## Purpose

Mechanics is no longer report-first. Iris must be able to represent the current raid, its bosses and their published mechanics before AvoiD has a report and before Warcraft Logs exposes combat events for every difficulty.

The canonical product identity is:

```text
raid
  → boss
    → difficulty
```

The canonical GLOBAL BOSS empirical identity remains:

```text
encounterId + difficulty + partition
```

A difficulty is not a presentation filter. It is part of the evidence identity.

## Evidence planes

### 1. Boss Knowledge — report independent

Boss Knowledge may exist with zero reports.

Sources:

- Blizzard JournalExpansion: official raid classification.
- Blizzard JournalInstance: official boss list.
- Blizzard JournalEncounter: published hierarchy, mechanic names, descriptions and spell membership.
- build-pinned WoW DB2/Wago: difficulty applicability and structural spell wiring.

No provider metadata in this plane proves observed occurrence, timing, causal event relationships or player failure.

### 2. GLOBAL WCL — difficulty-specific empirical learning

Public Warcraft Logs supplies observed combat truth. Normal, Heroic and Mythic are independent empirical populations.

Normal/Heroic evidence may create or prioritize a hypothesis that Iris later tests in Mythic, but it does **not** count as Mythic observation, specificity, provenance, Matched Null, Independent Evidence Groups, Statistical Stability, Holdout or Promotion evidence.

### 3. AvoiD Execution — same boss+difficulty only

AvoiD historical/current reports answer how the guild executed a mechanic. They may only overlay Boss Knowledge when both encounter and difficulty match.

A report containing the same boss on multiple difficulties must be split into separate execution scopes. Raid Execution must never aggregate those pulls together.

## Raid discovery

Raid discovery must not rely on a hard-coded WCL zone ID or on combat-log availability.

```text
WCL WorldData zones
        +
Blizzard JournalExpansion.raids[]
        +
Blizzard JournalInstance.encounters[]
        ↓
current raid catalog
```

Blizzard classifies which Journal instances are raids. WCL supplies operational zone/encounter IDs, partitions and difficulty metadata when available. Journal encounter identity remains usable even if WCL has not yet published an operational encounter ID.

## Difficulty identity: WCL and DB2 are different namespaces

Never compare a WCL difficulty ID directly with a WoW client DB2 DifficultyID.

For example, the implementation must not assume that WCL Mythic `difficulty=5` means DB2 `Difficulty.ID=5`.

Difficulty applicability is resolved as:

```text
requested WCL difficulty
  id + name
      ↓
JournalEncounterXDifficulty
  encounter-scoped DB2 DifficultyIDs
      +
Difficulty
  DB2 ID → localized name
      ↓
match by canonical difficulty name
      ↓
resolved DB2 DifficultyID
      ↓
JournalSectionXDifficulty
      ↓
difficulty-filtered Journal sections / abilities
```

If the DB2 difficulty snapshot is absent, ambiguous or cannot map the requested difficulty, applicability is `difficulty-applicability-unresolved`. Iris may display the base Blizzard Journal content as unresolved context but may not assert that those abilities are verified for the requested difficulty.

## Mechanics UI

Mechanics owns one common scope bar:

```text
CURRENT RAID | BOSS | DIFFICULTY | KNOWLEDGE SCOPE
```

Both tabs use the same scope:

```text
RAID EXECUTION | IRIS BOSS KNOWLEDGE
```

`Iris Boss Knowledge` can render with no report.

`Raid Execution` requires an AvoiD report whose `encounter + difficulty` exactly matches the selected scope. If the open report differs, execution content is hidden and the UI offers to reload the same report with the selected encounter+difficulty when WCL has an operational encounter ID.

No silent Mythic default is allowed.

## RWF / partial-log behavior

A new tier can legitimately be in this state:

```text
Official boss knowledge     READY
DB2 difficulty semantics    READY / PARTIAL
Normal WCL corpus           AVAILABLE
Heroic WCL corpus           AVAILABLE
Mythic WCL corpus           EMBARGOED / EMPTY
AvoiD Mythic execution      NO PULLS YET
```

This is not a global failure. Iris learns Normal and Heroic independently while Mythic remains an official/structural-only scope until Mythic combat evidence becomes observable.

When the Mythic embargo ends, Mythic learning starts from its own WCL population. Earlier Normal/Heroic evidence may inform investigation ordering only; it never satisfies a Mythic empirical gate.

## Persistence and fingerprints

- base Blizzard encounter graph: build/namespace versioned.
- DB2 Journal difficulty snapshot: build-pinned immutable revisions.
- official difficulty view: separate latest/revisions per `journalEncounterId + WCL difficulty`.
- GLOBAL WCL corpus/Episode/Matched Null/Groups/Stability/Holdout: `encounterId + difficulty + partition`.
- AvoiD report analytics: `encounterId + difficulty`.

A change in one difficulty must not overwrite or promote another difficulty's empirical state.

## Permanent safety rules

1. No boss/raid/difficulty production hardcodes.
2. No WCL zone-ID fallback for the current raid.
3. No silent `difficulty=5` fallback in Mechanics or GLOBAL BOSS corpus APIs.
4. No cross-difficulty aggregation of report pulls.
5. No Normal/Heroic evidence counted as Mythic evidence.
6. No DB2 DifficultyID assumed equal to WCL difficulty ID.
7. Unresolved difficulty applicability stays explicitly unresolved.
8. Blizzard/DB2 metadata cannot satisfy observed combat or Promotion.
9. HOME/AvoiD data remains application/evaluation data, not GLOBAL BOSS train/holdout data.
10. Automatic Promotion remains disabled.
