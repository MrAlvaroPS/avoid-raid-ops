# Iris Canonical Deep Top-up Contract v1

This contract exists because acquisition counts and canonical counts are not the same thing.

A query-guided Deep run can successfully download complete 8/8 evidence for N fights, while the next canonical rebuild may retain fewer than N if some report is not part of the canonical Wide sample or if canonical sampling policy changes the retained set.

## Authority order

1. WCL acquisition count is provisional evidence collected.
2. Persisted 8/8 Deep profiles are reusable evidence.
3. The canonical rebuild is authoritative for publication gates.
4. `validation.publishChecks.deepPulls` and the post-rebuild canonical Deep pull count decide whether the Deep minimum is satisfied.

Never claim the Deep minimum is complete because a worker downloaded the requested number before the canonical rebuild.

## Canonical Deep must be inside canonical Wide

GLOBAL BOSS Deep training/holdout evidence is a subset of the current canonical Wide sample.

Therefore query-guided Deep must, whenever a sampling manifest is available:

- read `sampling.selectedWideCodes`,
- choose Deep candidates only from those canonical Wide report codes,
- preserve the existing canonical Wide pull target while the Deep-only job runs,
- avoid changing the Wide target merely to the currently retained/trimmed Wide pull count,
- keep exact fight IDs and source provenance.

This prevents spending WCL on an 8/8 Deep report that will predictably be discarded on the next canonical rebuild.

## Residual top-up rule

When all of the following are true:

- canonical Wide sampling is trustworthy,
- the Deep report minimum already passes,
- canonical Deep is short by only 1–12 pulls,
- unused canonical Wide reports remain,

Iris should use `canonical-deep-top-up` rather than the historical generic 12-report targeted-Deep floor.

For a small residual deficit, prefer one exact fight from each independent canonical Wide report until the pull deficit is covered. Example: `296 / 300` canonical Deep becomes a request for 4 reports / 4 exact fights, not 12 reports / 12 fights and not another broad Wide acquisition.

After the top-up, rebuild canonically again and judge the resulting canonical count. If the count is still below the threshold, expose the remaining shortfall honestly and repeat only the smallest justified query.

## What this does not change

- 8/8 Deep stream completeness remains mandatory.
- Surgical ability/time-window probes remain non-counting diagnostic evidence.
- Source concentration limits remain in force.
- A dense progression report remains valid; per-report caps control correlation rather than validity.
- AvoiD/home reports remain excluded from GLOBAL BOSS train/holdout evidence.

Policy implementation:

- recommendation: `query-guided-recommendation-v3`
- query-guided Deep: `query-guided-deep-v4`
- runtime policy: `3.7.8`
- package release: `v3.8.9`
