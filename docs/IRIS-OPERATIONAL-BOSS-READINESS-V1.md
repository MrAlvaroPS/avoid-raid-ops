# Iris Operational Boss Readiness v1

## Purpose

Operational Boss Readiness exists so a newly released raid can become useful in AvoiD Live **before** the full scientific GLOBAL knowledge pipeline reaches publication/promotion maturity.

It does not weaken that pipeline. It creates a separate provisional path:

```text
Official / structural boss context
        +
exact-difficulty public WCL availability
        +
bounded canonical public corpus
        +
fail-closed HOME/source isolation
        ↓
DATA READY · OPERATIONAL REFERENCE
        ↓
deterministic external rehearsal
through production Operational Execution
        ↓
MECHANIC COVERAGE READY
        ↓
LIVE READY
        ↓
AvoiD observed completed pulls
        ↓
Longitudinal Raid Execution
```

## DATA READY is not accepted knowledge

The default v1 operational floor is intentionally bounded:

- 100 Wide pulls
- 20 Deep pulls
- 8 independent Wide sources
- 3 independent Deep sources

Before it can be consumed, canonical sampling must prove:

- exact encounter + difficulty + partition;
- no HOME guild reports;
- no known HOME uploader reports;
- no anonymous/unverified source identity selected;
- no wrong-scope report;
- current source-isolation/knowledge contract.

An Operational Reference may classify observed AvoiD mechanics. It **cannot** satisfy Promotion, become accepted boss knowledge, or establish a combat fact by itself.

## LIVE READY adds an Operational Rehearsal

A safe corpus existing is not enough to claim the production Live path is useful. `Operational Rehearsal` selects a small deterministic set of reports from the canonical Wide sample and runs them through the same Operational Execution engine used by Live.

Report selection:

- comes only from canonical `selectedWideCodes`;
- is stable for the exact boss+difficulty+partition;
- does not use ranking, parse, kill/wipe result, mechanic outcome or player performance;
- never adds the external report to HOME execution;
- never trains or promotes knowledge.

Default v1 coverage gate:

- up to 3 deterministic rehearsal reports;
- at least 2 successful production-path executions when that many reports exist;
- at least 3 distinct mechanics observed, capped by the pack size;
- at least 30% of rule-pack mechanics observed across rehearsal reports;
- zero truncated rehearsal reports.

This is an **operational smoke/coverage gate**, not a scientific significance test. Failure produces `COVERAGE REVIEW`, never weaker thresholds or fabricated Live readiness.

A mechanic may be **observed without being a failure**. Observational inferences such as pressure windows, state-linked impacts, phase-boundary casts or damage-distribution signals increment observation coverage when their exact event evidence appears, but they do not create `failedOccurrences`, player blame or mechanical accuracy. This distinction prevents the rehearsal gate from treating real observation as absence while preserving scoring safety.

```powershell
npm run validate:operational-rehearsal -- --encounter <id> --difficulty Normal
npm run validate:operational-rehearsal -- --encounter <id> --difficulty Normal --execute
```

The first command is zero-network. It also exposes `packDiagnostics` from the persisted canonical corpus: generated mechanic inference/IDs, Wide/Deep presence and available actor-origin evidence. This diagnostic does not reclassify, train or promote anything. The second command explicitly executes bounded WCL observation.

## `prepare:boss`

The boss-level primitive remains:

```powershell
npm run prepare:boss -- --encounter <WCL encounter id> --difficulty Normal
npm run prepare:boss -- --encounter <WCL encounter id> --difficulty Normal --execute
```

Preview is zero-network. Execution resolves the persisted raid catalog and exact-difficulty public availability, reuses checkpoints, acquires only the bounded operational corpus, canonicalizes source isolation and reports DATA readiness.

It remains useful for diagnosis or one specific boss. It is no longer the intended manual workflow for every boss in a raid.

## `prepare:raid`

The current-raid operational preflight is:

```powershell
npm run prepare:raid -- --difficulty Normal
npm run prepare:raid -- --difficulty Normal --execute
npm run prepare:raid:watch -- --difficulty Normal
```

Preview is zero-network and lists every current-raid boss with:

- public evidence availability;
- corpus phase/pulls/sources;
- DATA readiness;
- rehearsal/coverage status;
- LIVE readiness.

Execution walks the persisted current raid in encounter order. For every boss with public evidence in the exact difficulty it:

1. reuses any existing corpus/checkpoint;
2. starts the bounded operational profile only if missing;
3. advances acquisition under the existing WCL source/rate protections;
4. performs the zero-WCL canonical HOME/source-isolation rebuild;
5. runs deterministic Operational Rehearsal when DATA READY;
6. persists `LIVE READY` or `COVERAGE REVIEW`.

The bounded `--execute` form stops safely when it reaches the configured global step budget or WCL rate reserve. Rerunning the same command resumes unfinished bosses. A systemic/operator pause is preserved rather than blindly retried.

The `--watch` form is the unattended operator path. Known unchanged `COVERAGE REVIEW` scopes are skipped at zero WCL unless `--force-rehearsal` is explicitly requested. Timed WCL checkpoints sleep until `resumeAt`. A raw HTTP/GraphQL 429 is also treated as a transient global throttle: current corpus/readiness state is preserved, the watcher backs off and retries instead of terminating or immediately hammering the endpoint again. `Ctrl+C` remains a safe manual stop.

No boss IDs or names are embedded in production raid preparation.

## New tier / build automation

The intended autonomous lifecycle is:

```text
raid catalog/build fingerprint changes
        ↓
official boss bootstrap
        ↓
exact-difficulty WCL availability scan
        ↓
prepare:raid preview
        ↓
prepare missing public scopes under bounded budget
        ↓
Operational Rehearsal
        ↓
per-scope readiness ledger
```

Normal, Heroic and Mythic remain separate. Heroic evidence may suggest a future Mythic hypothesis, but it never satisfies Mythic DATA/LIVE readiness. During RWF, Mythic may legitimately remain `waiting-for-public-evidence` while Normal/Heroic become LIVE READY.

## Multi-boss Live report

A WCL report is never assigned one trusted difficulty or boss globally. The lightweight Active Report manifest classifies every encounter fight by `encounterId + difficulty`.

When one live report moves from boss A to boss B, the browser immediately clears rich report/telemetry/Operational Execution state from boss A before hydrating boss B. The persisted HOME history and GLOBAL knowledge planes are not cleared or changed.

Healthy Live states include:

```text
NO ACTIVE REPORT
LIVE · WAITING FOR FIRST COMBAT
LIVE · PULL IN PROGRESS
LIVE · ANALYSING COMPLETED PULL
LIVE · MECHANICS READY
```

No encounter fight and an in-progress first fight are non-negative states. Iris does not manufacture a zero score or mechanic failure while waiting for completed evidence.

For a completed scope, Operational Execution combines:

- WCL report/telemetry facts;
- exact-difficulty observed mechanic events;
- the safe Operational/Published rule pack;
- death-chain association;
- current blocker;
- up to three next-pull calls.

Only reports proven to be HOME may persist into AvoiD longitudinal execution. An external rehearsal/report may be evaluated but never enters HOME history.

## Raid Execution semantics

Raid Execution answers:

> How is AvoiD executing this boss+difficulty **now**, based on everything we have observed so far?

It is not the score of the selected/latest pull.

Each HOME report contributes an immutable execution revision. The current read model merges the latest revision for every report and deduplicates pulls by `reportCode + fightId`.

For every classified mechanic Iris retains all-time denominators and compares a recent pull window against the previous window. Current states include:

```text
NO AVOID DATA
BASELINE
LEARNING
MECHANICS BLOCKING
STABILIZING
MECHANICS TO CLEAN
MECHANICALLY STABLE
```

When a normalized denominator exists, mechanical accuracy means:

```text
clean observed mechanic opportunities
-------------------------------------
all observed mechanic opportunities
```

That is aggregated across the persisted AvoiD scope. It is never a single-pull parse or arbitrary score.

## Mechanical readiness is not total killability

`MECHANICALLY STABLE` / mechanics gate PASS means the mechanics Iris can currently measure are stable in the recent execution window. It does **not** by itself claim the boss is killable.

Overall kill readiness must later combine separate evidence dimensions such as mechanical execution, throughput, healing/survivability, phase coverage/repeatability, unobserved mechanics and composition/assignment constraints where evidence exists.

## Product ownership

The top header controls execution context only:

```text
AvoiD History: LOG → PULL → UPDATE
Active WCL: URL → LIVE → LOAD/START LIVE → STOP
```

LOG and PULL selection are opt-in contexts, not global filters.

- GLOBAL Iris Boss Knowledge remains independent.
- Progress remains longitudinal HOME history unless explicitly migrated to another context.
- Live consumes Active Report and follows the latest classified boss+difficulty scope.
- Pull Lab consumes exact pulls from Active Report and may use a compatible selected pull.
- Raid Execution consumes the longitudinal HOME mechanic aggregate for the selected boss+difficulty.
