# WCL Query-Guided Enrichment v1

Status: required execution contract for Iris GLOBAL BOSS enrichment.

This contract extends `IRIS-KNOWLEDGE-CONTRACT-V1` without changing its population boundaries.

## Goal

Warcraft Logs exposes precise report queries (`fightIDs`, `encounterID`, `difficulty`, `killType`, `abilityID`, `filterExpression`, `startTime`, `endTime`, source/target filters). Iris should use that precision instead of repeatedly downloading broad event streams when the model already knows which evidence is missing.

The enrichment planner therefore separates two evidence classes.

### 1. Canonical Deep evidence

Canonical Deep evidence may raise Deep report/pull coverage and model maturity only when it is a complete event profile for the exact fights selected.

Rules:

- select persisted external Wide reports first when they can close the active Deep deficit;
- select independent sources before repeated reports from a source;
- choose individual fight IDs from each report instead of automatically Deep-profiling every fight in that report;
- choose fights against pull-level outcome deficits (`kill`, `deepWipe`, `midWipe`, `earlyWipe`);
- cap the default query-guided batch at six fights per report to reduce event volume and paginator overflow risk;
- retrieve the complete required streams for those selected fights;
- require all canonical Deep streams to be complete before the profile may count toward canonical Deep reports/pulls;
- stop only when BOTH the requested Deep report target and Deep pull target have been satisfied, or when trustworthy candidates are exhausted.

Required complete streams:

`enemyCasts`, `friendDamage`, `interrupts`, `debuffs`, `buffs`, `enemyBuffs`, `enemyDebuffs`, `deaths`.

An incomplete profile may remain cached for diagnostics, but it MUST NOT inflate canonical Deep publication gates.

## 2. Surgical evidence probes

When Iris already has a concrete unresolved ability/relation hypothesis, it may construct narrow WCL queries using fields such as:

- `fightIDs`;
- `abilityID` or `filterExpression` (`ability.id IN (...)`);
- `encounterID` and `difficulty`;
- `killType`;
- `startTime` / `endTime`;
- source/target/hostility filters.

Surgical probes are intended for questions such as:

- Is this ability actually encounter-origin rather than player-origin?
- Does this aura occur after the suspected boss cast inside the expected window?
- Does the relation reproduce in independent reports?
- Does a mechanic appear only in a particular progression depth, phase or difficulty?

Surgical probe evidence MUST be stored/audited separately from canonical Deep coverage. A filtered query cannot pretend to be a complete Deep report.

Therefore:

- surgical probes count as **0 Deep reports**;
- surgical probes count as **0 Deep pulls**;
- they may resolve provenance or a specific hypothesis only when the query semantics prove the required fact;
- their report source still has to satisfy the GLOBAL BOSS source contract;
- AvoiD/home-source evidence is never allowed to validate GLOBAL BOSS truth.

## Planner order

When sampling is already balanced and `dataDepthPct` is the active bottleneck:

1. reuse persisted Wide evidence;
2. query-guide Deep over exact fight IDs from independent sources;
3. target unresolved encounter abilities/relations with surgical filters only if broad complete Deep is unnecessary;
4. only then broaden report discovery if publication still needs additional Wide/validation reports or missing outcome bands.

This prevents a generic `+1000 Wide / +230 Deep` request from being treated as the only possible response to every model deficit.

## Current Belo'ren application

The v3 model can already distinguish that source diversity/sampling are healthy while Deep depth, validation breadth, signal coverage and unresolved provenance remain open. The planner should therefore consume existing Wide reports for Deep first, using exact fight IDs and the model's focus ability IDs, before paying WCL to discover another large generic corpus.

## Invariants

1. Query precision never relaxes `encounter + difficulty + partition` isolation.
2. Exact fight selection is persisted in the job plan and auditable.
3. A filtered/probe query never increments canonical Deep counters.
4. Partial event pagination never counts as complete canonical Deep evidence.
5. Deep stop conditions require both report and pull targets.
6. Independent-source selection precedes repeated-source selection.
7. Outcome targeting uses actual fight outcomes, not report labels.
8. WCL rate reserve protection remains active during query-guided execution.
9. If exact candidates run out, Iris compiles with the honest deficit instead of fabricating coverage.
10. Query plans are deterministic from the same persisted evidence and model deficits.
