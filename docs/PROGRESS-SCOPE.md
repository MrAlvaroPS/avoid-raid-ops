# Progress product scope

`Progress` is the historical / strategic progression view for a selected encounter. It is deliberately different from `Live`.

The normative technical definitions, parameters and versioning rules live in [`PROGRESS-METRICS-CONTRACT.md`](./PROGRESS-METRICS-CONTRACT.md). This file defines product intent; the metrics contract defines exact mathematics.

## Product boundary

### Progress

Answers raid-leader questions that need a longer horizon:

- Are we actually moving forward on this boss?
- Is our best pull becoming our normal pull, or is it still an outlier?
- Are more pulls reaching the real progression zone?
- Are we converting the deepest observed stage more consistently?
- When did the last meaningful breakthrough happen?
- Are we retaining the previous raid night's level when we come back?
- How efficiently are we converting scheduled raid time into useful pulls?
- How does one raid night compare with another?

The primary unit is the **canonical encounter progression history**, spanning reports and raid nights.

### Live

Owns the current raid night and the seconds between pulls:

- selected/current pull
- previous-pull comparison
- KEEP / FIX-WATCH / NEXT PULL
- current blocker
- player execution
- deaths / defensives / mechanic evidence
- immediate next-call recommendations

A between-pull brief must not live in `Progress`.

## Single-source data contract

Progress has exactly one strategic data owner:

`History endpoint -> canonical progressionPulls -> progress-model-v1 -> every Progress panel`

The browser must not independently recalculate strategic formulas. The canonical model is generated server-side by `server/analysis/progression/progress-metrics-v1.mjs` and returned as `history.progressModel`.

This is an architectural invariant because it prevents the chart, Night-over-night, KPIs, Stage matrix and Progression health from using different pull populations or different formula copies.

The same model is generic for every encounter and difficulty; no Belo'ren-specific condition is allowed in the generic Progress metrics engine.

## Interaction contract

Progress is a strategic dashboard, not a drill-down workspace.

**Indicators are not interactive.** Stat cards, banner values, Night-over-night rows, matrix cells, legends and Progression-health cards must never mutate another table, chart or page state when clicked.

The only currently supported Progress interaction is an **explicit chart control**:

- `ALL`
- `LAST 100`
- `LAST 50`
- `LAST 25`

The chart range affects **only All-pull progression**. It must not change:

- headline metrics
- Night-over-night
- Stage consistency matrix
- Progression health

Changing chart range issues **zero additional WCL requests**.

## Strategic headline metrics

The top row is intentionally limited to five raid-leader metrics. Their exact formula IDs are defined in the technical contract.

### TOTAL PROG PULLS

All deduplicated analytical pulls in the canonical loaded encounter history. Its night count must reconcile exactly with the sum of the Night-over-night pull counts.

### BEST PULL

Deepest observed progress-scored WCL `fightPercentage`; a kill is represented as `0%`.

### DEEP PULL RATE

Percentage of the latest 20 progress-scored pulls that finish within 10 percentage points of the current PB. This is a generic v1 product heuristic, not a mechanic claim.

### CONSISTENCY GAP

`latest 20 scored-pull median fightPercentage - current PB fightPercentage`

Lower is better. It measures whether normal progression is converging toward the raid's observed ceiling.

### LAST BREAKTHROUGH

Pull/night age of the last meaningful event: kill, first reach of a new absolute stage, or at least 2pp of new depth beyond the previous meaningful baseline.

## Progression state

The banner is a categorical synthesis of the canonical model, not a separate formula and not an independent source of truth. v1 can surface:

- `BUILDING BASELINE`
- `BREAKTHROUGH`
- `STABILIZING Sx`
- `CONVERTING Sx`
- `IMPROVING`
- `REGRESSING`
- `LEARNING Sx`
- `PLATEAU`
- `CLEARED`

The state considers multiple dimensions. For example, `STABILIZING` requires stage conversion, deep-pull repeatability and consistency to meet their documented thresholds; merely reaching S3 often is not enough.

## Stage consistency

The matrix uses the same canonical pull sequence, up to the latest 160 pulls, grouped into 20-pull windows. Each cell is the percentage reaching an absolute stage.

It is **independent of chart range**.

## Progression health

### PHASE / STAGE CONVERSION

Percentage of the latest 20 canonical pulls reaching the deepest absolute stage observed in loaded history, compared with the previous 20 where available.

### NIGHT RETENTION / WARM-UP TAX

The previous-night baseline is the median of its final five progress-scored pulls. The latest night is considered recovered at the first three-pull rolling median that is no more than 2pp shallower than that baseline.

A previous closing median of 97.5% or worse is considered too shallow to be a meaningful retention baseline. In that case Iris must show `NO VALID BASELINE`, not claim rapid retention of a 100% wipe level.

### RAID THROUGHPUT

Canonical analytical pulls per **active raid hour**. Active time is the sum of pull durations plus inter-pull gaps shorter than 30 minutes. Gaps of 30 minutes or more are treated as non-active breaks and excluded from the denominator and downtime median.

This is raid-time efficiency, not DPS and not a player-performance score.

## Night-over-night

Night-over-night is read-only and is generated from the same canonical sequence. Each row exposes:

- canonical pull count and global pull range;
- number of progress-scored pulls;
- best depth;
- median depth;
- deep-pull repeatability using the model's shared threshold;
- median-depth delta versus the preceding canonical raid night.

The sum of all night pull counts must equal `TOTAL PROG PULLS` for the same loaded history.

## Data-quality behavior

Missing data is metric-scoped rather than globally destructive. A canonical analytical pull can be present for stage conversion but unavailable for a depth median if WCL progress is missing.

Exact `100.0%` WCL progress values are not silently rewritten. The model counts them in diagnostics so that a suspicious concentration can be audited at the pull-eligibility/data-ingestion layer instead of being hidden by the UI.

If canonical invariants fail, the UI must show a warning/sync state rather than mix populations.

## Data-truth boundary

Progress may state observed historical facts and deterministic transformations of those facts. It may not use correlation to assign blame or explain a wipe.

Allowed examples include a deep-pull-rate change, a canonical night median delta, a retention recovery cost or a stage-conversion change. Claims that composition, a player or a mechanic caused the change require their own validated evidence engine.
