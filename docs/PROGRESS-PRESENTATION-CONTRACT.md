# Iris Progress presentation contract

Status: **active from v3.7.13**  
Metric model: `progress-model-v2` / metrics `2.0.0`

This document governs how Progress presents already-defined strategic metrics to a Raid Leader. It does **not** redefine the v2 formulas in `PROGRESS-METRICS-CONTRACT-V2.md`.

## 1. Product rule: signal first, data quality second

The banner answers the Raid Leader's actual question first: **what is the progression signal?**

Examples:

- `YES — S3 IS BECOMING MORE REPEATABLE`
- `YES — S3 IS STABILIZING`
- `PROGRESS HAS PLATEAUED`
- `CURRENT FORM IS REGRESSING`
- `BUILDING A BASELINE`

Data-quality state is contextual confidence, not the headline. `REVIEW`/`PARTIAL`/`BLOCKED` remain available through the canonical model and audit disclosure, but a quality label may not replace a useful stage/repeatability signal when that signal is independently supported.

The presentation layer must use `progressModel.candidateState` when `progressModel.state` is held only by the Data Quality gate. It must not invent a new progression state.

## 2. Measured depth is a presentation concept, not a replacement metric

A pull has **measurable WCL depth for presentation** when:

- `progressMetricEligible === true`, and
- it is a kill, or its WCL `fightPercentage` is finite and `< 100%`.

An exact `100.0%` WCL fight-progress value remains raw, auditable and subject to the v2 eligibility contract. v3.7.13 simply refuses to draw that value as if it were a meaningful observed `100%` depth point when WCL itself has supplied no measurable completion.

This rule does **not** substitute `bossPercentage` for `fightPercentage` and does not change any v2 formula.

## 3. Depth coverage

`depth coverage = measured-depth pulls / raw canonical pulls`

It is a presentation diagnostic used to decide whether depth-derived cards are readable enough to foreground.

Default v3.7.13 presentation threshold: **65%**.

Depth is considered limited when either:

- canonical Data Quality is `REVIEW` or `BLOCKED`, or
- measured-depth coverage is below 65%.

When depth is limited, the first-glance KPI row prioritizes boss-agnostic evidence that is still interpretable:

1. Total progression pulls / raid nights
2. Best measured WCL pull
3. Deepest-stage conversion in CURRENT FORM
4. Depth coverage
5. Last meaningful breakthrough

`DEEP PULL RATE` and `CONSISTENCY GAP` remain defined by the v2 metric contract; v3.7.13 does not present those low-confidence numbers as first-glance truth while depth coverage is limited.

## 4. Progress trajectory chart

The chart's purpose is to show **direction**, not every raw value joined into a noisy polyline.

The x-axis remains chronological raw global pulls. `ALL / LAST 100 / LAST 50 / LAST 25` selects only the raw chart range and does not mutate strategic metrics or other panels.

The chart draws:

- **Best-so-far measured depth** — monotonic envelope of measurable WCL completion values.
- **5-measured-pull form median** — rolling median over the last five measurable depth observations, plotted at their real global-pull positions.
- **New measured PBs** — highlighted points.
- **WCL depth unavailable** — exact-100/non-measurable eligible attempts shown as neutral ticks in a separate baseline lane, never connected into the depth line.
- **Raid-night boundaries** — chronological session separators.

The chart never replaces WCL `fightPercentage` with `bossPercentage` silently.

## 5. Night-over-night fallback when depth is limited

If depth coverage is limited, `Night-over-night` must not lead with misleading `100%` medians. It switches to a stage-repeatability presentation:

- pulls in the night;
- deepest-stage reach rate;
- measured-depth coverage for that night;
- best measured WCL depth where available;
- interday delta in deepest-stage reach.

This uses the same deepest absolute stage already produced by `progress-model-v2`; no boss-specific stage rules are introduced.

## 6. Night retention

Night retention is inherently depth-based in v2. If presentation depth is limited, the UI reports `DEPTH LIMITED` rather than displaying a mathematically calculated but operationally misleading retention baseline.

The canonical v2 retention result remains available in the model for audit/replay.

## 7. Interaction contract

Progress remains strategic/read-only.

Interactive controls are limited to:

- explicit chart range buttons;
- the explicit `DATA QUALITY` disclosure.

KPI cards, night rows, matrix cells, health cards, banner state and legends are indicators and must not mutate page state on click.

## 8. Reuse rule

Any future Progress UI, export or Iris narrative layer must distinguish:

- **metric semantics** — versioned in the metric registry/contracts;
- **presentation confidence** — governed by this document;
- **raw WCL evidence** — never rewritten.

A presentation change must never silently change a metric formula, denominator, population or eligibility rule. If those semantics change, the metric/model version must change separately.