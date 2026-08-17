# Iris Semantic Specificity Verifier v2

**Release:** v3.9.4  
**Verifier:** `semantic-specificity-verification-v2`

## Why v2 exists

v1 answered a deliberately narrow question: does a structural temporal neighbor recur around a target signal across enough independent sources and anchor windows?

That is useful, but recurrence is not mechanical specificity. A high-frequency player buff can recur around almost every timestamp in a fight and therefore reproduce around a boss signal without being caused by, or meaningfully related to, that signal.

v2 keeps structural recurrence as one layer and adds independent tests for specificity, actor topology, timing consistency and provider-aware encounter provenance.

## Evidence layers

```text
STRUCTURAL RECURRENCE
  same candidate appears across independent sources/windows
            |
            v
BACKGROUND / NULL SPECIFICITY
  candidate is enriched around target anchors versus control windows
            |
            v
ACTOR TOPOLOGY + TEMPORAL CONSISTENCY
  relation of source/target roles and timing is reproducible
            |
            v
PROVIDER-AWARE PROVENANCE
  reviewed metadata may support encounter membership
            |
            v
MECHANICALLY-SUPPORTED CANDIDATE
```

None of these layers can automatically promote a mechanic.

## Pattern accounting

For each complete anchor context, v2 groups a neighbor by:

```text
relative temporal bucket
+ event stream
+ ability ID
+ event type
```

Within one window, only the nearest occurrence of a pattern contributes to window prevalence. Raw event count is retained separately. This prevents a rapidly refreshing aura from outranking a once-per-anchor relationship merely because it emitted dozens of events in the same window.

Ranking is therefore source/window oriented rather than event-volume oriented.

## Temporal consistency

For the nearest per-window occurrences v2 records:

- signed median delta from the anchor;
- P80-P20 temporal spread;
- versioned labels `strong`, `moderate`, or `diffuse`.

Current v2 thresholds are 750 ms for strong spread and 1500 ms for moderate spread. These are verifier-version parameters, not universal WoW truths, and may be recalibrated through fixtures/holdout evidence without rewriting raw evidence.

## Actor topology

Numeric report actor IDs are not compared across guilds. v2 only derives within-report structural relations to the anchor:

- `same-edge`
- `reverse-edge`
- `same-source`
- `same-target`
- `from-anchor-target`
- `to-anchor-source`
- `unrelated`
- unknown/no-actor states

The dominant topology must cover at least 60% of candidate windows before v2 calls it consistent. This can strengthen a mechanical candidate but is not required when legitimate mechanics have broader targeting and provider provenance supplies the other support leg.

## Null / background baseline

A reproduced neighbor cannot become mechanically supported without sufficient control evidence.

Current minimum: 6 complete background/control windows.

For the candidate pattern v2 compares:

```text
anchor prevalence     = anchor windows containing pattern / complete anchor windows
background prevalence = control windows containing pattern / complete control windows
```

A smoothed prevalence lift is calculated with a 0.5 pseudocount. Current versioned support thresholds:

- anchor prevalence >= 0.60;
- lift >= 1.75;
- prevalence delta >= 0.25.

If background prevalence is at least 80% of anchor prevalence and the absolute prevalence delta is <= 0.15, the candidate is classified as `background-noise`.

Intermediate evidence is `specificity-partial`; it is not forced into pass/fail.

### Stored flank baseline

v3.9.4 can reuse wider semantic windows already stored from previous adaptive probes. For a cached radius wider than the standard 2.5 s anchor window, the outer before/after bands can be converted into `cached-outer-flank` controls with **0 WCL calls**.

This is useful opportunistic evidence, not a substitute for a deliberately sampled null baseline when no wider cached windows exist. If fewer than the minimum controls are available, v2 returns `background-required`.

Iris must never fabricate null evidence just to finish verification.

## Provider-aware provenance

Caller-supplied output from `provider-aware-ability-knowledge-v1` may enrich the candidate.

`encounterAssociation.status = supported` is positive encounter-membership evidence. `not-listed-by-lorrgs` is deliberately weak negative evidence, **not a hard contradiction**, because a secondary provider can lag or be incomplete.

Provider metadata never proves causality or that an event occurred in a particular pull.

## Mechanical statuses

- `background-required` — structural recurrence exists but no sufficient null/control baseline exists.
- `background-noise` — recurrence also occurs approximately as often in control windows.
- `specificity-partial` — some enrichment exists, thresholds not satisfied.
- `specificity-supported` — anchor enrichment passes the null baseline, but provenance/topology is not strong enough for mechanical support.
- `mechanically-supported` — specificity passes and at least reviewed encounter membership or consistent actor topology supports the relationship candidate.
- `unverified` — structural prerequisites are absent or insufficient.

`mechanically-supported` still means **candidate**, not accepted mechanic.

## Stored re-verification API

```text
POST /api/wcl/semantic-probe
{
  "action": "reverify",
  "encounterId": <id>,
  "difficulty": <difficulty>,
  "partition": <partition>,
  "signalId": <optional signal>,
  "abilityKnowledge": <optional provider-aware resolver result>
}
```

Contract:

```text
WCL calls:              0
provider network calls: 0
Deep reports/pulls:     +0 / +0
direct score delta:     0
automatic promotion:    false
```

The endpoint reconstructs source/anchor topology from persisted diagnostic semantic evidence. When both 2.5 s and wider contexts exist for the same anchor, the narrowest complete context is used as anchor evidence so a single anchor is not double-counted.

## Portability

Learning code contains no current boss/spell literal. Synthetic tests use arbitrary encounter/ability IDs. Boss-specific fixtures may exist only as regression/golden validation and never as learning shortcuts.

## Next contract after v2

Once a candidate is mechanically supported, a separate versioned promotion contract must define:

- required evidence sources and holdout;
- contradiction tolerance;
- confidence calibration;
- accepted mechanic representation;
- patch/season validity;
- revocation/revalidation behavior.

Until that contract exists, `promotion.eligible=false` and `promotion.automatic=false` are immutable outputs of v2.
