# Iris Independent Evidence Groups v1

## Purpose

`independent-evidence-groups-v1` is the first evidence layer after Matched Null that asks whether eligible mechanic evidence is distributed across genuinely independent public sources rather than being concentrated in many pulls/reports from one uploader or guild.

It performs **zero WCL calls and zero provider calls**. It only reuses persisted matched anchor/control evidence.

It does not claim statistical stability, holdout success or mechanic Promotion.

## Position

```text
Episode Graph
  ↓
Matched Null Baseline
  ↓
INDEPENDENT EVIDENCE GROUPS v1
  ↓
Statistical Stability        [later]
  ↓
Untouched Holdout            [later]
  ↓
Promotion Contract           [later]
```

## Candidate eligibility

A pattern can enter Independent Evidence Groups only when the current Matched Null evaluation says:

```text
matched-specificity-supported
```

Patterns classified as:

```text
matched-specificity-partial
matched-background-noise
matched-baseline-insufficient
```

are excluded.

This is a hard ordering rule. The layer must never resurrect a candidate merely because it appears in many sources when the paired matched-null baseline did not establish sufficient specificity.

For the current Belo'ren / Voidlight Rupture evidence, Matched Null returned **zero** `matched-specificity-supported` patterns. Therefore the expected current Evidence Groups result is:

```text
matchedSupportedPatterns = 0
independentEvidenceGroupsGate = not-eligible-no-matched-supported-pattern
```

That is a successful negative gate result, not a pipeline error.

## Independent source unit

The group identity follows the canonical corpus `reportSourceKey` policy:

```text
guild:<guild id>
else user:<uploader/owner id>
else report:<report code>
```

Reports from the same guild/uploader do **not** become separate independent evidence groups.

The semantic probe planner already selects at most one canonical report per independent source for a signal. Evidence Groups preserves that isolation rather than counting pulls as independent replication.

## Paired source-level evidence

Each compatible Matched Null control already retains:

- independent `source` key;
- exact report/fight;
- the Episode patterns observed at the paired anchor;
- the pattern events observed in its matched null window;
- complete pagination and contamination guards.

For each Matched Null-supported pattern, v1 aggregates those paired records by source and records:

```text
matchedPairs
anchorHits
nullHits
anchorPrevalence
nullPrevalence
supportivePairs
contradictoryPairs
neutralPairs
direction
```

Direction is descriptive only:

```text
supportive-direction
contradictory-direction
neutral-direction
```

A source group is eligible when it has at least the configured minimum paired records. The default is one pair per source because statistical reliability of that direction is deliberately deferred to the next layer.

## Coverage gate

Default minimum:

```text
minimumIndependentGroups = 3
```

If a Matched Null-supported pattern has at least three eligible independent source groups, its status is:

```text
independent-groups-evidence-available
```

Otherwise:

```text
independent-groups-insufficient
```

`evidence-available` is deliberately not named `passed` or `stable`.

## Separation from Statistical Stability

Evidence Groups answers:

> Is the evidence distributed across independent source identities?

It does **not** answer:

> Is the effect direction/magnitude statistically stable across those sources?

The later Statistical Stability layer must evaluate source-level consistency, contradiction, effect dispersion and minimum support under its own versioned contract.

Therefore Evidence Groups may expose supporting/contradictory/neutral group counts while keeping:

```text
statisticalStabilityNotYetClaimed = true
```

## Matched Null evidence reuse across reinterpretation

Blizzard/DB2 enrichment can change an Episode's interpretation fingerprint without changing its empirical pattern/window definition.

Matched Null controls are expensive empirical evidence and must not be reacquired merely because provider semantics changed.

The route therefore distinguishes:

```text
interpretationBuildFingerprint
empiricalEvidenceFingerprint
```

The empirical fingerprint defaults to the original pre-provider Episode build fingerprint retained as `empiricalBuildFingerprint`.

Matched Null control storage is addressed by the empirical evidence fingerprint. A newer official/structural interpretation can reuse compatible controls at zero WCL calls as long as the empirical Episode definition remains compatible.

If the empirical Episode itself changes — pattern set, anchor identity, time-window semantics or another evidence-defining contract — it receives a new empirical fingerprint and old controls are not silently reused.

## HOME/AvoiD isolation

Independent Evidence Groups is a GLOBAL BOSS learning layer.

```text
HOME/AvoiD data used = false
```

AvoiD reports do not provide groups for this gate and remain application/evaluation data only.

## Persistence/API

Endpoint:

```text
POST /api/wcl/evidence-groups
```

Actions:

```text
preview
build
result
latest
```

All actions are zero-network with respect to WCL and external providers.

Revisions are stored by Episode interpretation fingerprint and Evidence Groups fingerprint. The product also retains the empirical evidence fingerprint used to locate its matched controls.

## Promotion boundary

Independent Evidence Groups cannot promote a mechanic.

Permanent v1 boundaries:

```text
matchedNullSupportedPatternsOnly = true
sourceIndependenceClaimLimitedToGroupIdentity = true
statisticalStabilityNotYetClaimed = true
holdoutNotYetClaimed = true
directScoreDelta = 0
automaticPromotion = false
```

The next layer must evaluate statistical stability before any holdout/promotion claim can exist.
