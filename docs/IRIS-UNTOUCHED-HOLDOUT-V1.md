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
  -> bounded paired combat-evidence acquisition
  -> evaluation
```

Production Holdout code must never contain a current-boss encounter ID, Journal ID, spell ID, spell name, phase name or boss-specific interpretation. Known encounter values are allowed only in regression fixtures, smoke commands and documentation.

The CLI arguments used by development smoke tests are **validation controls**, not the intended production orchestration model. In production, Iris derives the active scope, candidate set and source lineage from persisted products and provider metadata. An operator does not hand-author a source list, choose Holdout reports based on outcomes, supply a block of Holdout evidence, or teach Iris a boss-specific rule.

## Automatic source discovery

`untouched-holdout-source-discovery-v1` provides a bounded, fingerprinted metadata-only discovery step:

```text
discover-sources-preview
  -> 0 network
  -> frozen Stability + lineage fingerprint
  -> conservative WCL-call upper bound

discover-sources
  -> confirmExecution:true + matching previewFingerprint
  -> fightRankings seed report codes only
  -> lightweight report identity only
  -> guild/uploader source identity
  -> ranking metrics discarded
  -> seeds reordered by a hash of the frozen Stability fingerprint + report code
  -> HOME + all prior-learning lineage automatically excluded
  -> persisted source pool
```

This phase makes **zero WCL combat-event/table calls**. It may spend bounded WCL metadata calls only after explicit confirmation. If Stability has no Holdout-ready pattern, or source lineage is incomplete, its network budget collapses to zero.

The source pool records explicit `homeSource`, `preexistingCorpusMember`, `priorLearningUse` and `combatEvidenceObservedBeforeReservation` states. Unknown is never converted to false. Reports uploaded by configured HOME uploaders are excluded even when the report belongs to another guild.

## Precommit contract

Reservation freezes everything that must be decided before Holdout combat evidence:

```text
stability fingerprint
  -> frozen candidate pattern set
  -> frozen unseen source set
  -> frozen metadata seed report per source
  -> fixed v1 thresholds
```

Source ranking is deterministic and uses source identity plus the already-frozen Stability fingerprint. It does not inspect combat outcomes.

After reservation:

- holdout may not add a new candidate;
- holdout may not change the candidate definition;
- holdout may not add a new source;
- holdout may not expand to another report/source because the seed was inconvenient;
- holdout may not retune thresholds;
- evidence from an unreserved source is rejected;
- evidence collected before reservation is rejected.

A candidate revised after seeing a failed holdout needs a **new candidate revision and a new reservation**. The old holdout may not be recycled as training and then called untouched again.

## Automatic bounded combat acquisition

`untouched-holdout-acquisition-v1` completes the automatic Holdout path after `reservation-ready`.

```text
acquire-evidence-preview
  -> 0 network
  -> reservation fingerprint + Episode fingerprint
  -> frozen candidate/source/seed-report inventory
  -> exact hard WCL-call upper bound
  -> cache/settled-source accounting

acquire-evidence
  -> confirmExecution:true + matching previewFingerprint
  -> WCL rate-limit preflight
  -> frozen seed report only
  -> exact encounter+difficulty fight header
  -> fight IDs selected by deterministic hash, never progress/outcome metrics
  -> signal-only anchor query on those exact fights
  -> narrow temporal context around selected anchors
  -> same-fight Matched Null control planning using the canonical Episode exclusion guard
  -> narrow control windows
  -> source-level matchedPairs / anchorHits / nullHits for frozen patterns only
  -> persisted actor-free Holdout evidence
```

The executor deliberately **does not expand to more reports** when a seed report lacks anchors or a viable control. That source becomes inconclusive instead of triggering search-until-success behavior.

The seed report identity is rechecked against the frozen guild/uploader before any combat-event query. A mismatch settles the source as inconclusive without reading events.

Stored Holdout evidence contains pattern/fight/window summaries only. Raw actor IDs and actor names are not persisted. Holdout acquisition contributes zero canonical Deep reports/pulls and zero direct score delta.

If pagination or the WCL rate reserve prevents completion, acquisition is resumable/limited by persisted source state and returns an incomplete/budget-capped status rather than relaxing the reservation.

## Why the historical `validation` split is not automatically an Untouched Holdout

The older corpus has a deterministic source-isolated `train` / `validation` split. That prevented guild/uploader leakage and remains useful historical validation infrastructure.

However, those validation sources have already been available to previous compiler/learning decisions. v1 therefore refuses to relabel an existing corpus/validation source as untouched merely because it belonged to the validation split.

A source is eligible for a new Untouched Holdout reservation only when the lineage establishes all of the following before holdout combat evidence is inspected:

- `homeSource === false`
- `preexistingCorpusMember === false`
- `priorLearningUse === false`
- `combatEvidenceObservedBeforeReservation === false`

Unknown is not treated as false.

If enough such sources do not exist, the result is `holdout-unavailable-insufficient-unseen-sources`.

## Evaluation

`evaluate` does **not** accept caller-authored `holdoutEvidence`. It loads the compatible persisted acquisition for the frozen reservation and then evaluates, for each frozen pattern and each evaluable reserved source:

```text
matchedPairs
anchorHits
nullHits
```

The same source weighs once regardless of its report/pull volume.

Default v1 gates:

```text
targetReservedSources           = 5
minimumEvaluableSources         = 3
minimumSupportiveSourceShare    = 2/3
maximumContradictorySourceShare = 0.25
minimumSourcePrevalenceDelta    = 0.15
minimumMedianPrevalenceDelta    = 0.20
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

Reservation and evaluation execute:

```text
WCL      0
Blizzard 0
Wago     0
```

Automatic source discovery may execute bounded **WCL metadata** calls after a fingerprinted preview, but has an explicit zero budget for combat-event/table calls.

Automatic combat acquisition may execute bounded WCL calls only after a frozen reservation and matching acquisition preview. It is restricted to the frozen seed reports, exact target encounter fights, signal anchors, narrow contexts and paired same-fight null windows. It may not expand sources/reports/candidates or query broad Wide/Deep tables.

WCL combat evidence remains canonical empirical truth. Blizzard and DB2 may provide semantic/structural context but cannot satisfy this Holdout gate.

## Current Voidlight Rupture expectation

The real Matched Null baseline for `1243866 Voidlight Rupture` has zero `matched-specificity-supported` patterns. Consequently Independent Evidence Groups and Statistical Stability also have zero eligible patterns.

Therefore the correct v1 Holdout path is:

```text
status = not-eligible-no-stability-supported-pattern
frozenCandidatePatterns = []
reservedSources = []
sourceDiscovery WCL budget = 0
combatAcquisition WCL budget = 0
```

No source-discovery or holdout-combat WCL acquisition should be spent on that hypothesis.
