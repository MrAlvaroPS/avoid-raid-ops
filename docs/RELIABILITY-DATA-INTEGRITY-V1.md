# Reliability Data Integrity v1

Reliability is personnel-facing data. **A wrong denominator is more damaging than a missing score.** These rules are non-negotiable for ingestion, scoring, persistence and comparison.

## Canonical entities

### Player identity

Preferred identity order:

1. canonical WCL/Blizzard character identity when available;
2. provisional `region + realm + character name`;
3. report-scoped actor ID only.

A report actor ID is not stable across reports and cannot publish longitudinal Reliability. Provisional name+realm may accumulate evidence but caps confidence at MEDIUM because rename/transfer can break continuity.

Spec and role are context, not identity. Every opportunity retains the spec/role observed at that time.

### Pull identity

Longitudinal Reliability must consume the same canonical/deduplicated pull identity used by Progress/History. Two logger reports of the same raid pull count once.

Until a canonical cross-report pull key exists, report-local evidence is shadow-only.

### Opportunity identity

Every scoreable row needs a deterministic identity:

```text
canonicalPullKey + actorIdentity + dimension + responsibilityKey + occurrenceKey
```

Multiple raw rows/ticks for one occurrence collapse before Reliability.

## Source-completeness invariant

**Missing evidence can only prove success if the source needed to observe failure is known complete.**

Every scoreable Mechanics/Defensives/Duties opportunity must explicitly carry `sourceComplete=true`. Survival must have a complete meaningful-death source for the whole scored pull population.

Default completeness is **unproven/false**, never true by omission.

Examples:

- truncated mechanic damage stream -> no inferred clean mechanic successes;
- incomplete death stream -> no clean Survival rows;
- incomplete defensive cast/buff stream -> no inferred non-use/use timing;
- missing duty event pages -> no inferred duty success.

## Population invariants

For each player:

```text
survival opportunities == eligible pulls attended
  ONLY when Survival source is complete

mechanic failures <= proven player mechanic opportunities
confirmed defensive failures <= confirmed-available defensive opportunities
assigned duty failures <= proven assigned/observable duty opportunities
```

If an invariant fails, publication is blocked. Do not fix impossible inputs with a presentation-layer clamp.

Weighted-mass invariant:

```text
0 <= failureMass <= opportunityMass
```

The scorer records whether this holds and publication fails if it does not.

## Attendance

Guild pull count is never a player denominator unless presence is proven for every pull.

Presence comes from `friendlyPlayers` or a future canonical attendance ledger. Bench/substitution cannot lower Reliability.

## Survival consistency

Reliability Survival uses one complete meaningful-death population with identical wipe-cutoff semantics.

- max one Survival row per actor/pull;
- first meaningful death is determined within that same population;
- post-wipe deaths are audit-only;
- probable cause does not change whether a Survival incident exists;
- incomplete source means **all affected clean Survival outcomes are unscored**.

## Mechanics consistency

Mechanic failures and opportunities must come from compatible rule/model provenance.

A generated encounter rule may score Reliability only when player attribution is publishable under encounter-model provenance policy. Unverified relations never score.

A scoreable player mechanic opportunity requires:

```text
assigned === true
observable === true
sourceComplete === true
```

Occurrence normalization happens before scoring. Multiple hits from one failure are one failed opportunity.

A player-attributed failure without a proven clean denominator stays in `unscoredFailures`; never infer the denominator from raid-wide cast count.

## Defensive consistency

Availability is tri-state:

```text
confirmed available
confirmed unavailable
unknown
```

A scoreable defensive opportunity requires:

```text
availability == confirmed
sourceComplete == true
outcome observable == true
```

`unknown` is not available. Healthstone/healing-potion absence is never penalized without availability proof.

## Duty consistency

Raw utility counts are descriptive only.

`5 interrupts` is not Reliability evidence. `5 / 6 explicitly assigned, observable, complete interrupt opportunities` can be.

Scoreable duty rows require assignment, observable outcome and complete source.

## Spec/role consistency

Evidence retains `class + spec + role` at observation time.

Same-class is a fallback comparison context, not equivalent to same-spec. Cross-spec evidence must not silently form a same-spec benchmark.

## Absolute-score stability invariant

**Peer population must never change the player's absolute Reliability score.**

Absolute component scoring uses only:

- the player's own evidence mass;
- the fixed/versioned policy prior.

Peers are comparison/explanation only. Adding/removing a raider, changing the roster median or loading an external corpus may change `peerDelta`, but must leave the player's score and `scoreTrace` unchanged.

This is regression-tested.

## Peer consistency

Peer selection is limited to compatible encounter+difficulty+partition context and follows:

1. same spec + role;
2. same class + role;
3. same role;
4. roster;
5. labeled policy reference.

Every component records the actual peer source and sample. A policy reference is never called `peer median`.

External peer datasets must retain benchmark timestamp and model version.

## Comparison consistency

Two overall Reliability values are directly comparable only when:

- both are published;
- same Reliability model revision;
- same encounter+difficulty+partition context;
- >=MEDIUM confidence;
- same scored dimensions;
- no data-integrity errors.

If not, Iris may show shared components but cannot conclude `A is more reliable than B` overall.

## Parse separation invariant

No field named or derived from DPS, HPS, parse percentile, ranking, boss DPS, weighted DPS, raw damage or healing may enter Reliability scoring.

Performance may be displayed alongside Reliability and analyzed elsewhere. Reliability's score trace contains execution dimensions only.

## Auditability

Every published score must reconstruct from compact evidence:

- metric/model/policy version;
- identity source;
- encounter/difficulty/partition;
- canonical pull population and attendance;
- source completeness;
- opportunity counts/mass;
- failure counts/mass;
- fixed scoring prior;
- peer benchmark source/value/sample separately;
- component values;
- base/effective weights;
- exact contribution sum;
- confidence and publication gates;
- pending/unscored evidence with reasons.

If the number cannot be recreated from this trace, it is a product bug.

## Persistence target

Persist compact derived evidence, not raw WCL streams when avoidable:

```text
WCL events/tables
   -> encounter / defensive / duty evidence producers
   -> compact player opportunity ledger
   -> versioned Reliability scorer
   -> player+encounter profile
   -> current-form / tier aggregates
```

This must reuse canonical pull deduplication and avoid recreating the corpus Blob hot-read pattern.
