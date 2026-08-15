# Iris Progress Metrics Contract

Status: **normative**  
Model: `progress-model-v1`  
Metrics version: `1.0.0`  
Implementation: `server/analysis/progression/progress-metrics-v1.mjs`

This document is the technical contract for strategic progression metrics in Iris. A metric must not be redefined independently by a page, component, boss adapter or browser runtime.

## 1. Scope and architectural invariant

Progress is encounter-history intelligence. The canonical key is the selected **encounter + difficulty** inside a WCL partition/report-history context. The formulas are boss-agnostic and therefore reusable for every current and future raid encounter.

The data path is one-way:

`WCL fights -> analytical-pull eligibility -> session dedupe -> canonical pull series -> progress-model-v1 -> UI consumers`

`History` owns the canonical pull series. `progress-metrics-v1.mjs` owns the formulas. `Progress` panels render the resulting `progressModel`; they do not implement their own copies of strategic formulas.

A chart range (`ALL`, `LAST 100`, `LAST 50`, `LAST 25`) is presentation state only. It must not alter KPIs, Night-over-night, Stage consistency or Progression health and must not issue another WCL request.

## 2. Canonical pull contract

Each canonical pull has a contiguous `globalPullNumber` / `pullNumber` from `1..N` after deduplication and chronological sorting. The same canonical array is the parent population for every Progress metric.

A pull is **progress-scored** when:

- it is a kill, in which case progression value is `0`; or
- WCL `fightPercentage` is a finite number in `[0,100]`.

A pull can remain in the canonical analytical history while a particular metric excludes it because that metric lacks the required field. Metric-level missing data must not silently remove the pull from unrelated metrics.

Exact `100.0%` WCL fight-progress values are retained as source data. Iris records their count/share in `progressModel.diagnostics`; it must not silently rewrite or delete them to make medians look better. If they dominate a sample, the correct next action is a data-quality / pull-eligibility audit.

## 3. Required invariants

Before displaying a fully calculated Progress view, these invariants must hold:

1. `progressModel.totals.pulls === history.progressionPulls.length`.
2. `sum(progressModel.nights[].pulls) === progressModel.totals.pulls`.
3. Canonical global pull numbers are contiguous `1..N`.
4. Night global pull ranges refer to the same canonical sequence used by the chart and matrix.

If an invariant fails, the UI must show a data/model warning or syncing state. It must not combine figures from different populations.

## 4. Versioned metric registry

| Metric ID | UI label | Population | Formula / contract | Direction |
|---|---|---|---|---|
| `progress.total_pulls.v1` | TOTAL PROG PULLS | all canonical analytical pulls | `N` after dedupe and eligibility | descriptive |
| `progress.best_pull.v1` | BEST PULL | progress-scored canonical pulls | minimum WCL `fightPercentage`; kill = `0` | lower is deeper |
| `progress.deep_pull_rate.v1` | DEEP PULL RATE | latest 20 progress-scored pulls | `% with progress <= PB + 10pp` | higher is better |
| `progress.consistency_gap.v1` | CONSISTENCY GAP | latest 20 progress-scored pulls | `median(latest block) - current PB` | lower is better |
| `progress.breakthrough_age.v1` | LAST BREAKTHROUGH | canonical history | pulls/nights since new stage, kill, or >=2pp meaningful new depth | lower age = more recent |
| `progress.stage_conversion.v1` | PHASE/STAGE CONVERSION | latest 20 canonical pulls | `% reaching deepest absolute stage observed in loaded history` | higher is better |
| `progress.night_retention.v1` | NIGHT RETENTION | latest two eligible timestamped nights | first rolling 3-pull median that recovers prior-night closing 5-pull median within +2pp | fewer pulls/minutes is better |
| `progress.raid_throughput.v1` | RAID THROUGHPUT | latest timestamped raid night | canonical pulls / active raid hour; gaps >=30 min excluded from active-time accumulation | contextual; higher can mean more learning opportunities |
| `progress.night_summary.v1` | NIGHT-OVER-NIGHT | each canonical raid session | pulls, scored pulls, PB, median, deep-pull rate and delta to previous night | descriptive |
| `progress.stage_matrix.v1` | STAGE CONSISTENCY MATRIX | latest max 160 canonical pulls | 20-pull windows; `% reaching each absolute stage` | higher consistency is better |
| `progress.state.v1` | PROGRESSION STATE | canonical model outputs | categorical state from multiple strategic dimensions; see section 6 | descriptive synthesis |

## 5. Shared policy parameters

The authoritative defaults are exported as `PROGRESS_METRIC_POLICY`:

| Parameter | Default | Meaning |
|---|---:|---|
| `currentBlockPulls` | 20 | latest strategic comparison block |
| `previousBlockPulls` | 20 | previous comparison block |
| `deepPullMarginPp` | 10 | deep zone = PB + margin |
| `breakthroughDepthPp` | 2 | minimum depth improvement for a meaningful depth breakthrough |
| `retentionClosingPulls` | 5 | prior-night closing baseline window |
| `retentionRollingPulls` | 3 | current-night recovery median window |
| `retentionTolerancePp` | 2 | allowed shallower difference when declaring recovery |
| `retentionBaselineMaxPct` | 97.5 | baselines at/above this are too shallow to call meaningful retention |
| `throughputGapCapMinutes` | 30 | larger gaps are excluded from active raid time |
| `matrixWindowPulls` | 20 | Stage matrix window size |
| `matrixMaxPulls` | 160 | maximum matrix history shown |
| `stableStageConversionPct` | 70 | minimum stage conversion for STABILIZING |
| `stableDeepPullRatePct` | 50 | minimum deep-pull rate for STABILIZING |
| `stableConsistencyGapPp` | 15 | maximum consistency gap for STABILIZING |
| `convertingStageDeltaPp` | 10 | meaningful stage-conversion improvement |
| `improvingDeepDeltaPp` | 10 | meaningful deep-pull-rate improvement |
| `improvingGapPp` | 5 | meaningful consistency-gap improvement |
| `plateauPulls` | 40 | breakthrough-age pull threshold |
| `plateauNights` | 2 | breakthrough-age night threshold |
| `minScoredPullsForState` | 5 | minimum latest scored sample for a progression state |

These parameters are product policy, not magic numbers hidden in components. A change to a default requires a metrics-version review, tests and documentation update.

## 6. Progression state v1

`progress.state.v1` is deliberately multi-dimensional. It must not be inferred from one KPI alone.

Evaluation order:

1. `CLEARED` — a kill exists in canonical history.
2. `BUILDING BASELINE` — latest block has fewer than `minScoredPullsForState` scored pulls.
3. `BREAKTHROUGH` — meaningful breakthrough is very recent and deep-pull rate or stage conversion has materially improved.
4. `PLATEAU` — breakthrough age exceeds policy and none of deep-pull rate, consistency or stage conversion is currently improving.
5. `STABILIZING Sx` — stage conversion, deep-pull repeatability and consistency gap all meet their stability thresholds.
6. `CONVERTING Sx` — deepest-stage conversion is materially increasing and already meaningful.
7. `IMPROVING` — deep-pull repeatability or consistency materially improves.
8. `REGRESSING` — deep-pull repeatability and consistency both materially worsen.
9. `LEARNING Sx` — none of the stronger states is supported.

The banner is therefore a synthesis label, not an independent source of truth.

## 7. Night retention guardrail

A previous-night closing median near `100%` does not represent a meaningful learned depth. `progress.night_retention.v1` therefore returns `available:false` with reason `weak-closing-baseline` when the closing 5-pull median is `>=97.5%` by default.

This prevents claims such as “retained in 3 pulls” merely because both nights contain very shallow `100%` pulls.

## 8. Throughput guardrail

Raid throughput is **not player performance** and must never be used to assign blame. It measures how many analytical learning opportunities occur per active hour.

Active time is:

`sum(pull durations) + sum(inter-pull gaps < 30 minutes)`

Gaps of 30 minutes or more are treated as breaks / non-active blocks and excluded from the denominator. The median downtime shown likewise uses only eligible gaps below that cap.

## 9. Consumer rules

Any current or future consumer — Progress, Live summaries, Command Center, reports, exports or Iris-generated text — must either:

- consume a field from `progressModel`; or
- import and call the canonical function/module on the same canonical pull population server-side.

It must not copy a formula into another UI runtime. If a metric needs a different scope, it must receive a different metric ID/version rather than silently changing the meaning of an existing one.

Boss-specific knowledge may provide additional semantic milestones later, but it cannot mutate the generic v1 metric definitions invisibly. Encounter-model-derived metrics must be explicitly versioned and documented.

## 10. Change management

A formula, denominator, population, threshold or null-data rule is part of the metric definition. Changing any of them requires:

1. update `PROGRESS_METRICS_VERSION` when interpretation changes materially;
2. update this contract;
3. add/update deterministic unit tests;
4. verify all consumers use the same model version;
5. preserve old semantics under their old metric ID when historical comparability matters.

This is the standard for reusable Iris metrics across every boss and raid tier.
