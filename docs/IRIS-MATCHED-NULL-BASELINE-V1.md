# Iris Matched Null Baseline v1

## Purpose

This module implements the first Promotion-v3 baseline that is stronger than the diagnostic flank baseline used by the semantic verifier.

It answers a narrow question:

> Does an Episode pattern occur materially more often around the target anchor than in comparable windows from the same encounter evidence where the target anchor is absent?

It does **not** promote a mechanic, claim source independence, run holdout validation or change Boss Learned.

## Why cached flanks are not enough

The semantic specificity verifier can use cached outer flanks around an anchor for fast local noise detection. Those bands may still belong to the same mechanical Episode, so Contract v3 forbids treating them as the final Promotion baseline.

Matched Null v1 therefore sets:

```text
localFlankControlsUsed = false
localFlankBaselineIsPromotionBaseline = false
```

## What Iris can match with data we actually have

Persisted Wide/Deep profiles retain fight metadata, outcome and WCL phase transitions when present. They do **not** retain arbitrary raw event timelines after Deep normalization.

The planner can therefore choose candidate null windows at **0 WCL**, but a new exact event-window read is required if that control window was never queried before.

Each control is selected from the same:

```text
report/fight
encounter
 difficulty
partition
outcome
phase, when WCL supplied phase transitions
```

and is constrained to a comparable normalized point in the fight.

No synthetic phase is invented when phase data is absent.

## Control selection

Default policy:

```text
control radius             2500 ms
episode guard              2500 ms
offset candidates          ±12s, ±18s, ±24s, ±30s
max controls               10
max controls per source     2
max normalized fight delta  0.20
minimum controls             6
minimum matched sources      3
```

The Episode temporal radius is added to the control radius and guard when excluding target-anchor neighborhoods.

A control is rejected by the planner when it:

- leaves the fight bounds;
- changes WCL phase when phase data exists;
- crosses a phase transition;
- is too far from the anchor in normalized fight time;
- overlaps a known target-anchor Episode exclusion area;
- overlaps another selected control too closely.

The final network evidence adds a second safety gate: if the target signal itself is observed inside the queried control window, the control is persisted as contaminated and **does not count** toward the baseline.

## Preview and execution

Endpoint:

```text
POST /api/wcl/matched-null-baseline
```

Actions:

```text
preview   0 WCL, builds plan + fingerprint
evaluate  0 WCL, re-evaluates persisted control evidence
result    0 WCL, reads a persisted execution result
execute   explicit approval + matching fingerprint required
```

Execution uses exact fight IDs and exact time windows only.

There is no whole-report fallback.

Execution is bounded by:

- hard WCL call cap;
- live rate-limit preflight;
- hourly reserve;
- resumable per-stream pagination;
- persistent evidence after every successful page.

## Persisted evidence

Matched-control evidence persists only the fields needed for pattern prevalence:

```text
stream
timestamp
fightID
event type
abilityId
```

Actor IDs and actor names are deliberately not persisted by this module.

Pattern-level actor provenance remains a separate evidence product.

## Evaluation

The evaluator compares every Episode supporting `pattern_key` against valid complete controls.

The pattern key remains:

```text
relation | stream | abilityId | eventType
```

Default exploratory thresholds remain aligned with Contract v3:

```text
minimum anchor prevalence  0.60
minimum lift               1.75
minimum prevalence delta   0.25
```

Outputs:

```text
matched-baseline-insufficient
matched-background-noise
matched-specificity-partial
matched-specificity-supported
```

A sufficient matched baseline only means:

```text
matchedNullBaselineGate = evidence-available
```

It does **not** mean:

```text
promotion-eligible
accepted
```

## Explicitly not implemented here

Matched Null v1 does not claim:

- independent evidence groups;
- source-stratified statistical stability;
- untouched holdout;
- Promotion eligibility;
- Mechanic Registry acceptance;
- causal mechanics.

Those remain later Contract-v3 phases.

## Safety invariants

```text
Canonical Deep contribution = 0
Direct Boss Learned delta    = 0
Automatic promotion          = false
Provider network calls       = 0
Whole-report fallback        = false
```

## Expected Belo'ren validation

The current Voidlight Rupture Episode remains `promotion-pending` because it has no exact-pattern encounter-origin supporting edge.

Matched Null v1 can still validate whether its player-origin/context patterns are genuinely Episode-specific or common in same-fight null windows. Passing this baseline cannot bypass the missing provenance gate.
