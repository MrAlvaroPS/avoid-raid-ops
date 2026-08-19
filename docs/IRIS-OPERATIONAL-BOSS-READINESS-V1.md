# Iris Operational Boss Readiness v1

## Purpose

Operational Boss Readiness exists so a newly released or newly selected boss can become useful in AvoiD Live **before** the full scientific GLOBAL knowledge pipeline reaches publication/promotion maturity.

It does not weaken that pipeline. It creates a separate, explicitly provisional contract:

```text
Official / structural boss context
        +
exact-difficulty public WCL availability
        +
bounded canonical public corpus
        +
fail-closed HOME/source isolation
        ↓
OPERATIONAL REFERENCE
        ↓
AvoiD observed completed pulls
        ↓
Operational Execution
        ↓
Longitudinal Raid Execution
```

## Operational Reference is not accepted knowledge

The default v1 operational floor is intentionally small:

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

## `prepare:boss`

The generic operator entry point is:

```powershell
npm run prepare:boss -- --encounter <WCL encounter id> --difficulty Normal
```

Preview is zero-network. It reads the persisted raid catalog, persisted exact-difficulty public availability and current corpus state.

Execution is explicit:

```powershell
npm run prepare:boss -- --encounter <WCL encounter id> --difficulty Normal --execute
```

The command:

1. resolves the current raid boss from the persisted catalog;
2. requires public evidence for the exact requested difficulty;
3. reuses/checkpoints any existing corpus;
4. starts only the bounded operational profile when missing;
5. advances acquisition under the normal rate/source protections;
6. performs a zero-WCL canonical recompile when ready;
7. refuses LIVE readiness unless fail-closed Operational Reference checks pass.

If acquisition pauses or reaches a rate reserve, rerunning the same command continues from persisted state. No boss-specific production constant is required.

## Active Report / Live

The lightweight Active Report manifest classifies every WCL fight by encounter+difficulty. A report itself is not assigned one global difficulty.

Live states are first-class:

```text
NO ACTIVE REPORT
LIVE · WAITING FOR FIRST COMBAT
LIVE · PULL IN PROGRESS
LIVE · ANALYSING COMPLETED PULL
LIVE · MECHANICS READY
```

No encounter fight and an in-progress first fight are both non-negative states. Iris does not manufacture a zero score or mechanic failure while waiting for completed evidence.

For a completed scope, Operational Execution combines:

- WCL report/telemetry facts;
- exact-difficulty observed mechanic events;
- the safe Operational/Published rule pack;
- death-chain association;
- current blocker;
- up to three next-pull calls.

Only reports proven to be HOME may persist into AvoiD longitudinal execution. An external report may be evaluated but never enters HOME history.

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

Overall kill readiness must later combine separate evidence dimensions such as:

- mechanical execution;
- throughput / damage requirement;
- healing/survivability requirement;
- phase coverage and repeatability;
- any mechanics not yet observed/reached;
- composition or assignment constraints where evidence exists.

This separation prevents a clean early-phase sample from becoming a false `boss is ready to die` conclusion.

## Product ownership

The top header controls execution context only:

```text
AvoiD History: LOG → PULL → UPDATE
Active WCL: URL → LIVE → LOAD/START LIVE → STOP
```

LOG and PULL selection are opt-in contexts, not global filters.

- GLOBAL Iris Boss Knowledge remains independent.
- Progress remains longitudinal HOME history unless explicitly migrated to another context.
- Live consumes Active Report.
- Pull Lab consumes exact pulls from Active Report and may use a compatible selected pull.
- Raid Execution consumes the longitudinal HOME mechanic aggregate for the selected boss+difficulty.

## Season/build automation direction

`prepare:boss` is the operator-safe primitive for automation. A future raid readiness planner may run its preview automatically whenever the persisted raid catalog/build changes and schedule missing exact-difficulty scopes. Network acquisition remains bounded/checkpointed; accepted knowledge still requires the normal independent evidence gates and cannot be auto-promoted by Operational Readiness.
