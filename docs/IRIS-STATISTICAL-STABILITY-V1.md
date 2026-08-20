# Iris Source-Stratified Statistical Stability v1

## Purpose

`source-stratified-statistical-stability-v1` is the layer after Independent Evidence Groups.

It asks:

> For a candidate that already survived Matched Null and has enough independent source groups, is the observed specificity direction reasonably stable across those sources rather than being driven by one guild/uploader?

It performs **zero WCL calls and zero provider calls**. It only consumes the persisted Independent Evidence Groups product.

It is deliberately conservative and does **not** pretend that a handful of source groups justifies formal hypothesis-test significance.

## Position

```text
Matched Null
  ↓
Independent Evidence Groups
  ↓
SOURCE-STRATIFIED STATISTICAL STABILITY v1
  ↓
Untouched Holdout      [later]
  ↓
Promotion Contract     [later]
```

## Eligibility

Only patterns with:

```text
independent-groups-evidence-available
```

are evaluated.

If Evidence Groups has no eligible patterns, this layer returns:

```text
statisticalStabilityGate = not-eligible-no-independent-evidence-pattern
```

It must never recreate a candidate that failed Matched Null or lacked independent-source coverage.

## Equal source weighting

Each independent guild/uploader group contributes one source-level effect regardless of how many reports or matched pairs it contains.

This prevents:

```text
one guild with 100 pulls
  != 100 independent confirmations
```

Within a source group the paired evidence is summarized as:

```text
anchorPrevalence
nullPrevalence
prevalenceDelta = anchorPrevalence - nullPrevalence
supportive / contradictory / neutral direction
```

The number of pairs remains visible for evidence sufficiency/audit but does not multiply source weight.

## v1 stability gates

Defaults:

```text
minimumEligibleGroups          = 3
minimumSupportiveGroupShare    = 2/3
maximumContradictoryGroupShare = 0.25
minimumMedianPrevalenceDelta   = 0.25
maximumDeltaMad                = 0.50
```

For every eligible pattern v1 calculates:

- eligible source groups;
- supportive / contradictory / neutral group counts and shares;
- source-level prevalence deltas;
- median prevalence delta;
- median absolute deviation (MAD) of source-level deltas;
- minimum and maximum source-level delta.

A pattern is:

```text
source-stratified-stability-supported
```

only when all configured gates pass.

Otherwise:

```text
source-stratified-stability-insufficient
```

## Why median + MAD

Public raid-source evidence is small and heterogeneous. Mean effect sizes can be disproportionately moved by one source. Median and MAD are simple robust summaries that keep the v1 contract auditable and source-balanced.

They do not magically turn the evidence into a large-sample statistical study.

## What v1 explicitly does not claim

```text
formalNullHypothesisSignificanceClaimed = false
confidenceIntervalClaimed = false
causalCombatEvidenceAdded = false
holdoutNotYetExecuted = true
automaticPromotion = false
```

The word “Statistical” here refers to source-stratified quantitative stability checks, not a claim of formal inferential significance.

A future contract may add bootstrap/confidence-interval or exact-binomial procedures if the number and quality of independent sources make that useful. Such a change must be versioned rather than silently changing v1.

## Contradiction handling

Contradiction is not hidden in an average.

A pattern can have a healthy median delta yet still fail because too many independent sources point in the opposite direction.

Example:

```text
guild A  supportive  (100 matched pairs)
guild B  supportive  (1 matched pair)
guild C  contradictory (1 matched pair)
```

The group shares are:

```text
supportive = 2/3
contradictory = 1/3
```

The 100-pair guild does not count 100 times. With the default `maximumContradictoryGroupShare = 0.25`, the candidate fails v1 stability.

## Holdout handoff

Only:

```text
source-stratified-stability-supported
```

patterns receive:

```text
holdoutEligible = true
```

That flag means only that a later holdout planner may consider the pattern.

It does **not** mean the holdout has been selected, executed or passed.

## HOME/AvoiD isolation

This remains GLOBAL BOSS learning.

```text
homeAvoidDataUsed = false
```

AvoiD data is reserved for later application/evaluation of accepted/official knowledge.

## Persistence/API

Endpoint:

```text
POST /api/wcl/statistical-stability
```

Actions:

```text
preview
build
result
latest
```

All are zero-network.

`preview` / `build` consume a persisted Evidence Groups revision (explicit fingerprint or current latest for the Episode interpretation).

A built revision stores the exact Evidence Groups fingerprint it consumed, preserving the evidence chain:

```text
empirical Episode fingerprint
  → Matched Null paired controls
  → Independent Evidence Groups fingerprint
  → Statistical Stability fingerprint
```

## Current Belo'ren expectation

Voidlight Rupture currently has:

```text
Matched Null supported patterns = 0
```

Therefore Independent Evidence Groups has no eligible candidate and Statistical Stability must return:

```text
eligibleEvidenceGroupPatterns = 0
stabilitySupportedPatterns = 0
statisticalStabilityGate = not-eligible-no-independent-evidence-pattern
```

No new WCL is required to reach that result.

This is the correct pipeline behavior: failure at an earlier hard gate propagates forward as non-eligibility rather than being repaired by later statistics.
