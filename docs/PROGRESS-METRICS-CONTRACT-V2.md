# Iris Progress Metrics Contract v2

Status: **normative**  
Model: `progress-model-v2`  
Metrics version: `2.0.0`  
Implementation: `server/analysis/progression/progress-metrics-v2.mjs`  
Registry: `server/analysis/progression/progress-metric-registry-v2.mjs`

## 1. Purpose

Progress is strategic encounter-history intelligence for a Raid Leader. It answers whether the raid is learning an encounter across many pulls and raid nights. It does **not** own current-night between-pull decisions; Live owns that scope.

Every formula, denominator, null rule, threshold and eligibility rule is centralized and versioned. Browser components render model outputs; they must not invent alternative formulas under the same metric name.

The generic data path is:

`WCL fights -> analytical-pull eligibility -> cross-report/session dedupe -> raw canonical pull history -> Progress metric eligibility -> progress-model-v2 -> all Progress consumers`

The model is encounter-agnostic and reusable for every boss. The encounter key remains encounter/difficulty/history context; no Belo'ren-specific behavior belongs in this module.

## 2. Two populations, explicitly separated

### 2.1 Raw canonical pulls

All deduplicated analytical pulls that survive the generic pull-eligibility layer. They retain the original WCL values and source identity.

Used for:

- TOTAL PROG PULLS raw count;
- auditability;
- raid-night cadence / throughput;
- source diagnostics.

Raw values are never rewritten to make progression look cleaner.

### 2.2 Metric-eligible pulls

The subset for which `progressMetricEligible === true` after the Progress data-integrity classifier.

Used for every strategic depth/repeatability metric:

- BEST PULL;
- DEEP PULL RATE;
- CONSISTENCY GAP;
- LAST BREAKTHROUGH;
- PHASE/STAGE CONVERSION;
- NIGHT RETENTION;
- Night-over-night depth statistics;
- Stage consistency matrix;
- Progression State.

Every eligible pull retains its original `globalPullNumber`, so strategic calculations remain traceable to raw history.

## 3. CURRENT FORM contract

`CURRENT FORM` is the latest **20 metric-eligible pulls** by default.

`PREVIOUS FORM` is the immediately preceding **20 metric-eligible pulls**.

These are the only strategic comparison blocks in v2. Deep-pull rate, consistency gap, phase conversion and Progression State all use these exact blocks. A UI chart filter does not alter either block.

If fewer than 20 eligible pulls exist, CURRENT FORM uses all available eligible pulls. Progression State requires at least five eligible CURRENT FORM pulls before it can leave `BUILDING BASELINE`.

## 4. Metric eligibility v1

The classifier is `classifyProgressMetricEligibility()`.

### Eligible

- kill -> eligible, progress value `0`;
- finite WCL `fightPercentage` in `[0,100]`, unless a hard integrity contradiction below applies.

### Excluded from strategic formulas, retained raw

- missing/invalid `fightPercentage`;
- non-positive duration;
- exact `100.0% fightPercentage` while a later absolute stage (`stageCount >= 2`) is reported.

The last case is treated as a hard contradiction because a pull cannot simultaneously report zero fight completion and a later encounter stage under the generic model. The raw WCL fields are preserved in the audit record.

### Review flags that do not automatically exclude

- exact `100.0% fightPercentage` in Stage 1 -> `exact-100-fight-progress`;
- large difference between WCL `fightPercentage` and `bossPercentage` -> `boss-fight-percentage-disagreement`.

The disagreement is diagnostic only because WCL documents `fightPercentage` as the authoritative completion field for encounters with multiple bosses, healing or other complicated structures. Iris must not replace it generically with boss HP.

## 5. Shared metric definitions

| Metric ID | Population | Formula |
|---|---|---|
| `progress.total_raw_pulls.v2` | raw canonical | raw pull count after dedupe |
| `progress.metric_eligible_pulls.v2` | metric eligible | eligible pull count |
| `progress.best_pull.v2` | metric eligible history | minimum WCL `fightPercentage`; kill = 0 |
| `progress.deep_pull_rate.v2` | CURRENT FORM | `% with progress <= global eligible PB + 10pp` |
| `progress.consistency_gap.v2` | CURRENT FORM | `median(CURRENT FORM progress) - global eligible PB`; lower is better |
| `progress.breakthrough_age.v2` | metric eligible history | eligible pulls/nights since new stage, kill, or >=2pp meaningful new depth |
| `progress.stage_conversion.v2` | CURRENT FORM | `% reaching deepest absolute stage observed in eligible history` |
| `progress.night_retention.v2` | last two nights, eligible subset | first 3-pull eligible rolling median recovering previous-night closing 5 eligible-pull median within +2pp |
| `progress.raid_throughput.v2` | raw timestamped latest night | raw analytical pulls / active hour; gaps >=30m excluded |
| `progress.night_summary.v2` | each raid session | raw pull count plus eligible PB/median/deep rate |
| `progress.stage_matrix.v2` | metric eligible history | 20 eligible-pull windows; `% reaching each absolute stage` |
| `progress.state.v2` | CURRENT FORM synthesis | state machine below, gated by data quality |
| `progress.data_quality.v2` | raw canonical | eligibility, anomalies, source audit and invariant status |

## 6. Shared default parameters

The authoritative values are exported as `PROGRESS_METRIC_POLICY`.

| Parameter | Default |
|---|---:|
| `currentFormPulls` | 20 |
| `previousFormPulls` | 20 |
| `deepPullMarginPp` | 10 |
| `breakthroughDepthPp` | 2 |
| `retentionClosingPulls` | 5 |
| `retentionRollingPulls` | 3 |
| `retentionTolerancePp` | 2 |
| `retentionBaselineMaxPct` | 97.5 |
| `throughputGapCapMinutes` | 30 |
| `matrixWindowPulls` | 20 |
| `matrixMaxPulls` | 160 |
| `stableStageConversionPct` | 70 |
| `stableDeepPullRatePct` | 50 |
| `stableConsistencyGapPp` | 15 |
| `convertingStageDeltaPp` | 10 |
| `improvingDeepDeltaPp` | 10 |
| `improvingGapPp` | 5 |
| `plateauPulls` | 40 |
| `plateauNights` | 2 |
| `minEligiblePullsForState` | 5 |
| `qualityExactHundredReviewSharePct` | 35 |
| `qualityExcludedReviewSharePct` | 10 |
| `qualityWarningPartialSharePct` | 15 |

Changing population, denominator, threshold, null behavior or eligibility semantics requires a metric-version review. It must not be changed only in CSS/JS/UI copy.

## 7. Data-quality gate

The model emits `dataQuality.grade`:

- `GOOD` — no material integrity concern;
- `PARTIAL` — warnings/exclusions exist but strategic state can still be shown;
- `REVIEW` — the evidence population requires explicit review;
- `BLOCKED` — canonical invariants fail.

`REVIEW` or `BLOCKED` can hold back the synthetic progression state. In that case the banner shows `DATA REVIEW` rather than an overconfident `CONVERTING`, `IMPROVING`, etc. The underlying candidate state remains in `candidateState` for diagnostics but is not presented as trusted truth.

A high share (default >=35%) of exact `100.0%` WCL completion values triggers `REVIEW`. This does **not** silently declare those fights invalid; it says the history is too dominated by low-information completion values for Iris to present a strong strategic synthesis without review.

## 8. Progression State v2

Candidate evaluation order:

1. `CLEARED`
2. `BUILDING BASELINE`
3. `BREAKTHROUGH`
4. `PLATEAU`
5. `STABILIZING Sx`
6. `CONVERTING Sx`
7. `IMPROVING`
8. `REGRESSING`
9. `LEARNING Sx`

The candidate is then passed through the Data Quality gate. A held candidate is exposed diagnostically but the UI shows `DATA REVIEW`.

## 9. Required invariants

The model must verify all of the following:

1. sum of raw pulls across nights equals raw canonical total;
2. sum of metric-eligible pulls across nights equals eligible total;
3. global raw pull numbers are contiguous `1..N`;
4. every eligible pull references the same object/position in raw canonical history;
5. CURRENT FORM contains exactly `min(20, eligible count)` pulls.

Any invariant failure is a model/data problem, never something the UI may paper over.

## 10. UI and reuse rules

- `ALL / LAST 100 / LAST 50 / LAST 25` is an **eligible chart presentation filter only**.
- KPIs, nights, matrix and health do not change when chart range changes.
- Indicator cards are not clickable.
- The only diagnostic disclosure is an explicit `DATA QUALITY` details control.
- Night-over-night shows both raw night size and eligible depth statistics so different populations are never hidden.
- Throughput is explicitly labelled `RAW NIGHT SCOPE`; it is intentionally different because cadence is about attempts/time, not WCL depth quality.

Any future consumer — Live, Command Center, exports, reports or Iris text generation — must import/consume the versioned model/registry. If it wants a different formula, it gets a new semantic metric ID.
