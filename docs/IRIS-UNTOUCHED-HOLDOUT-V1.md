# Iris Untouched Holdout v1

Untouched Holdout is the post-Stability replication gate for GLOBAL BOSS mechanic knowledge.

It answers one narrow question:

> Does a candidate that was already frozen before holdout evidence still replicate in independent sources whose combat evidence was not previously used or observed for learning?

It is **not** another discovery stage and it is **not** Promotion.

## Position in the evidence ladder

```text
Specificity
  -> exact actor provenance
  -> Episode Graph
  -> Matched Null
  -> Independent Evidence Groups
  -> Source-Stratified Statistical Stability
  -> Untouched Holdout
  -> Promotion Contract
  -> Mechanic Registry
```

Only patterns with `source-stratified-stability-supported` and `holdoutEligible=true` may be frozen into a holdout reservation.

## Boss-agnostic and automatic execution contract

Untouched Holdout is a generic stage for **any** GLOBAL BOSS scope. Production logic is driven only by persisted state and versioned evidence contracts:

```text
encounterId + difficulty + partition
  -> persisted Episode / Stability
  -> frozen candidate patterns
  -> metadata-only discovery of independent unseen sources
  -> automatic exclusion of HOME + prior-learning lineage
  -> deterministic source reservation
  -> bounded evidence acquisition only when reservation-ready
  -> evaluation
```

Production Holdout code must never contain a current-boss encounter ID, Journal ID, spell ID, spell name, phase name or boss-specific interpretation. Known encounter values are allowed only in regression fixtures, smoke commands and documentation.

The CLI arguments used by development smoke tests are **validation controls**, not the intended production orchestration model. In production, Iris must derive the active scope, candidate set and source lineage from persisted products and provider metadata. An operator must not need to hand-author a source list or teach Iris a boss-specific rule.

Source discovery for reservation may inspect metadata needed to establish independent source identity and scope membership, but it must not inspect the candidate's combat outcome before the reservation is frozen. If Iris cannot prove that a candidate source is unseen because the learning/source lineage is incomplete, the source is ineligible rather than assumed clean.

The current v1 reservation/evaluator is complete. The bounded metadata-source discovery and WCL holdout-evidence acquisition executor are separate orchestration components; until those are implemented, Iris must report that acquisition automation is unavailable rather than silently asking for boss-specific manual inputs in production.

## Why the historical `validation` split is not automatically an Untouched Holdout

The older corpus has a deterministic source-isolated `train` / `validation` split. That prevented guild/uploader leakage and remains useful historical validation infrastructure.

However, those validation sources have already been available to previous compiler/learning decisions. v1 therefore refuses to relabel an existing corpus/validation source as untouched merely because it belonged to the validation split.

A source is eligible for a new Untouched Holdout reservation only when the caller can explicitly establish all of the following before holdout combat evidence is inspected:

- `homeSource === false`
- `preexistingCorpusMember === false`
- `priorLearningUse === false`
- `combatEvidenceObservedBeforeReservation === false`

Unknown is not treated as false.

If enough such sources do not exist, the result is `holdout-unavailable-insufficient-unseen-sources`.

## Precommit contract

Reservation freezes both dimensions that matter before holdout evidence:

```text
stability fingerprint
  -> frozen candidate pattern set
  -> frozen unseen source set
  -> fixed v1 thresholds
```

Source ranking is deterministic and uses source identity plus the already-frozen Stability fingerprint. It does not inspect combat outcomes.

After reservation:

- holdout may not add a new candidate;
- holdout may not change the candidate definition;
- holdout may not retune thresholds;
- evidence from an unreserved source is rejected;
- evidence collected before reservation is rejected.

A candidate revised after seeing a failed holdout needs a **new candidate revision and a new reservation**. The old holdout may not be recycled as training and then called untouched again.

## Evaluation

For each frozen pattern and each reserved source, v1 consumes paired holdout evidence summarized as:

```text
matchedPairs
anchorHits
nullHits
```

The same source weighs once regardless of its report/pull volume.

Default v1 gates:

```text
targetReservedSources          = 5
minimumEvaluableSources        = 3
minimumSupportiveSourceShare   = 2/3
maximumContradictorySourceShare= 0.25
minimumSourcePrevalenceDelta   = 0.15
minimumMedianPrevalenceDelta   = 0.20
```

Statuses:

- `untouched-holdout-supported`
- `untouched-holdout-rejected`
- `untouched-holdout-inconclusive`

A supported result contributes only:

```text
untouchedHoldoutGate = evidence-available
```

It still has:

```text
automaticPromotion = false
promotionEligible  = false
```

Promotion remains a later explicit contract.

## Network and truth boundaries

The reservation builder and evaluator themselves execute:

```text
WCL      0
Blizzard 0
Wago     0
```

A later bounded acquisition executor may collect the precommitted holdout evidence from WCL. That executor must not change the frozen candidates or reserved sources.

WCL combat evidence remains canonical empirical truth. Blizzard and DB2 may provide semantic/structural context but cannot satisfy this Holdout gate.

## Current Voidlight Rupture expectation

The real Matched Null baseline for `1243866 Voidlight Rupture` has zero `matched-specificity-supported` patterns. Consequently Independent Evidence Groups and Statistical Stability also have zero eligible patterns.

Therefore the correct v1 holdout preview is:

```text
status = not-eligible-no-stability-supported-pattern
frozenCandidatePatterns = []
reservedSources = []
acquisitionRequired = false
```

No holdout WCL acquisition should be spent on that hypothesis.
