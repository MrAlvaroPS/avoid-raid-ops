# Progress Data Integrity v2

This is the operational audit contract for Iris Progress. It exists because strategic raid decisions are only useful when every panel is derived from the same traceable pull population.

## Canonical source identity

Every raw Progress pull must retain enough source identity to trace it back to Warcraft Logs:

- `globalPullNumber`
- `sessionId` / `sessionIndex`
- `reportCodes[]`
- `fightIds[]`
- absolute start/end timestamps
- duration
- WCL `fightPercentage`
- WCL `bossPercentage`
- absolute `stageCount`
- kill flag

No quality rule is allowed to delete the raw pull. Exclusion means only `progressMetricEligible=false` for strategic Progress formulas.

## Audit states

Each pull receives:

- `progressMetricEligible`
- `progressMetricReason`
- `progressMetricSeverity`
- `progressMetricFlags[]`
- `progressMetricValue`

The UI exposes flagged/excluded rows through the explicit **DATA QUALITY** disclosure in Progression Health.

## Exact 100% handling

Warcraft Logs documents `fightPercentage` as actual fight completion and the field used to represent wipe progress in complicated encounters. Therefore Iris keeps it as the authoritative generic depth source.

An exact `100.0%` value is not silently rewritten to `bossPercentage`.

Rules:

1. `100%` + Stage 1 remains raw and metric-eligible, but is flagged `exact-100-fight-progress` because it provides no measurable WCL completion depth.
2. `100%` + Stage 2 or later is excluded from strategic formulas as `fight-progress-100-after-stage-transition`; the values contradict one another and require audit.
3. A large `fightPercentage`/`bossPercentage` disagreement is flagged only. Boss HP can be misleading on encounters with healing, multiple bosses or other structures.
4. A high share of exact `100%` values can hold the synthetic Progression State at `DATA REVIEW`. This prevents Iris from saying `CONVERTING S3` with high confidence while the history is dominated by low-information values.

## Data Quality grades

`GOOD` — strategic evidence is internally coherent.

`PARTIAL` — warnings or a small number of exclusions exist; the model remains usable but the audit disclosure should explain them.

`REVIEW` — a material anomaly/exclusion share or a high exact-100 share means the synthetic strategic state is withheld. Candidate calculations remain visible in model diagnostics.

`BLOCKED` — canonical invariants fail. Strategic output must not be trusted.

## What the UI must reconcile

For every boss:

- top-level raw pull total = sum of Night-over-night raw pull counts;
- eligible total = sum of Night-over-night eligible counts;
- the chart uses metric-eligible pulls only;
- CURRENT FORM = latest 20 metric-eligible pulls;
- previous comparison block = previous 20 metric-eligible pulls;
- Stage matrix windows are 20 metric-eligible pulls and retain the corresponding global raw pull range;
- chart range affects only chart presentation;
- throughput is the one deliberate exception: it uses raw timestamped attempts because its denominator is active raid time rather than progression depth.

## Debug procedure for an implausible chart

Do not adjust formulas first.

1. Open DATA QUALITY.
2. Inspect exact-100 and excluded rows.
3. Use `reportCodes` + `fightIds` to compare the WCL fight directly.
4. Check duration, stage and boss percentage without replacing `fightPercentage` automatically.
5. Decide whether the generic eligibility classifier is missing a reusable rule.
6. If a new rule is justified, add it to `progress-metrics-v2.mjs`, document it, write a deterministic test, and version semantics if the population changes materially.

Boss-specific exceptions are not allowed inside the generic classifier. If a future encounter needs semantic interpretation unavailable from generic WCL fields, that must come from a versioned encounter-model adapter and remain explicit.

## Reuse rule

No component may independently decide what an “eligible Progress pull” is. Consumers must use `progressMetricEligible` from `progress-model-v2` or call the canonical classifier server-side. This is a shared Iris primitive across bosses and future raid tiers.
