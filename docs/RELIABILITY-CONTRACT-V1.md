# Iris Reliability Contract v1

Status: **shadow / not yet a published roster score**  
Metric: `reliability.overall.v1`  
Current scoring revision: `1.1.0`  
Policy: `server/analysis/reliability/reliability-policy-v1.mjs`

## 1. What Reliability measures

Reliability estimates **dependable execution and availability when a raider has an observable progression responsibility**.

It answers:

> When this player is present and the logs can prove what responsibility/opportunity they had, how consistently do they execute it correctly and remain available to the raid?

Reliability is **not** a skill ranking, parse ranking, DPS/HPS ranking, attendance/punctuality score, popularity score or subjective officer grade.

### Parse/output is a separate product

DPS, HPS, WCL parse percentile, boss DPS, weighted DPS and rankings do **not** enter Reliability.

Performance may be displayed beside Reliability because the two are naturally related in raid outcomes, but neither number modifies the other.

- A 99 parse cannot compensate for repeated execution failures.
- A low parse cannot reduce Reliability by itself.
- Changing only DPS/HPS/parse data must leave the Reliability score and `scoreTrace` unchanged.

## 2. Dimensions and role weights

| Dimension | Meaning | DPS | HEAL | TANK |
| --- | --- | ---: | ---: | ---: |
| Mechanics | Player-owned mechanic execution with a proven denominator | 40% | 35% | 30% |
| Survival | Remaining available through meaningful pre-wipe windows | 25% | 25% | 30% |
| Defensives | Correct use when personal availability and danger window are proven | 20% | 25% | 30% |
| Duties | Explicitly assigned + observable interrupts/dispels/externals/tank duties | 15% | 15% | 10% |

Mechanics, Survival and Defensives are **mandatory publication dimensions**. Duties is optional because not every encounter gives every player enough provable assigned-duty opportunities.

`Adaptation / repeated mistake rate` is a separate coaching signal. It does not add another score weight because that would double-charge the same mechanic failure.

## 3. Opportunity-first rule

A player can only fail something they had a proven opportunity/responsibility to execute.

Every scored row must have an actor-scoped denominator:

```text
actor + canonical pull + responsibility/opportunity + occurrence -> success/failure
```

Raw counts are not Reliability metrics:

```text
4 mechanic failures    != Reliability evidence with denominator
3 interrupts           != interrupt Reliability
2 defensive casts      != defensive Reliability
```

Examples of valid forms are `4 / 47 player-owned mechanic opportunities`, `5 / 6 assigned interrupts`, or `8 / 10 confirmed-available defensive windows`.

### Absence is not automatically success

A clean success can only be inferred when the responsibility is proven **and the source needed to detect failure is proven complete**.

If Iris observes three classified player failures but cannot prove how many clean opportunities existed:

```text
show: 3 classified failures
score: Mechanics PENDING
```

If an event stream is truncated, absent events from that stream cannot become clean successes.

## 4. Evidence confidence

Evidence confidence weights **the opportunity mass itself**, so low-confidence clean rows cannot artificially inflate a score.

```text
confirmed -> 1.00
high      -> 0.90
medium    -> 0.65
low       -> 0.35
unknown   -> 0.00
```

A failed mechanic uses the lower defensible confidence between the opportunity and failure evidence.

## 5. Mechanics formula

Severity importance:

```text
severity 1 -> 0.40
severity 2 -> 0.55
severity 3 -> 0.70
severity 4 -> 0.85
severity 5 -> 1.00
```

For each proven player opportunity:

```text
opportunityMass += severityImportance * opportunityConfidence

if failed:
  failureMass += severityImportance * min(opportunityConfidence, failureConfidence)

successMass = opportunityMass - failureMass
rawSuccessRate = successMass / opportunityMass
```

A raid-wide failure without a proven responsible player never creates a player mechanic failure.

One actor + mechanic occurrence can score at most once, regardless of how many damage ticks/event rows were emitted.

## 6. Survival formula

Survival denominator is **eligible pulls actually attended by the player**, never guild pull count.

The source must be a complete meaningful-death population using the same wipe-cutoff semantics across all players. If that source is incomplete or completeness is unproven, Survival is PENDING rather than interpreting missing deaths as survival.

Per attended pull:

```text
no meaningful pre-wipe death -> penalty 0.00
later meaningful death       -> penalty 0.50
first meaningful death       -> penalty 1.00
```

Then:

```text
opportunityMass = attended pulls with complete death evidence
failureMass     = sum(per-pull incident penalty)
successMass     = opportunityMass - failureMass
```

Survival measures **raid availability, not proven blame**. A probable mechanic cause can explain the incident but does not add another Survival penalty.

## 7. Defensives formula

A defensive opportunity is scoreable only when Iris can prove all of these:

1. ability exists for the player's current class/spec/build;
2. it was available at the danger window;
3. the source used to reconstruct availability is complete;
4. the danger window is observable;
5. on-time use/non-use is observable.

Availability is tri-state:

```text
confirmed available
confirmed unavailable
unknown
```

Only `confirmed available` enters the denominator. `unknown` is never a miss.

Healthstone/healing potion receive no penalty from `no cast observed` alone because that does not prove inventory availability.

```text
mass = dangerWeight * evidenceConfidence
opportunityMass += mass
if missed/late: failureMass += mass
```

A preventable-death counterfactual can explain severity but does not charge the same defensive opportunity again.

## 8. Duties formula

Duties include responsibilities whose ownership is proven: assigned interrupt, dispel, external, tank responsibility, etc.

A duty scores only when:

```text
assigned === true
observable === true
sourceComplete === true
```

```text
mass = importance * evidenceConfidence
opportunityMass += mass
if failed: failureMass += mass
```

Raw utility counts remain descriptive and cannot become Reliability by themselves.

## 9. Absolute Bayesian/shrinkage scoring

Small samples must not produce extreme scores. Each dimension uses a weak **fixed, versioned policy prior**:

```text
posterior =
  (successMass + priorStrength * fixedPolicySuccessRate)
  / (opportunityMass + priorStrength)

componentScore = posterior * 100
```

Scoring revision 1.1.0:

```text
priorStrength = 8 equivalent opportunities
Mechanics prior  = 90%
Survival prior   = 92%
Defensives prior = 86%
Duties prior     = 90%
```

### Peer groups do not alter the score

This is a hard stability rule.

A raider's absolute Reliability must not change merely because somebody joins/leaves the roster or the peer population changes. Therefore same-spec/class/role peers are **comparison benchmarks only**; they never enter the scoring prior.

## 10. Peer comparison

Peer hierarchy within the same encounter/difficulty/partition context:

1. same spec + same role, minimum 3 peers;
2. same class + same role, minimum 3 peers;
3. same role, minimum 5 peers;
4. roster, minimum 10 peers;
5. labeled policy reference when no real peer sample exists.

Each component records the actual peer source, sample and delta. A policy reference is never called a real `peer median`.

External corpus peers can implement the same interface later without changing the absolute scoring formula.

## 11. Overall score

```text
scoredWeightCoverage = sum(base role weights of scored dimensions)
effectiveWeight(d)   = baseWeight(d) / sum(base weights of scored dimensions)
overall               = sum(componentScore(d) * effectiveWeight(d))
```

The engine returns an exact `scoreTrace` with component value, base weight, effective weight, contribution and `why`. Its contribution sum must reconstruct the displayed score.

### Publication gates

No overall Reliability is published unless **all** gates pass:

- >=15 pulls attended;
- >=2 raid nights;
- confidence >= **MEDIUM**;
- stable cross-report player identity;
- Mechanics scored;
- Survival scored;
- Defensives scored;
- >=3 scored dimensions;
- >=75% role weight coverage;
- Mechanics >=20 weighted effective opportunities;
- Survival >=15 attended pulls with complete source;
- Defensives >=8 weighted effective opportunities;
- Duties, if scored, >=8 weighted effective opportunities;
- no data-integrity error.

Until then `value=null`; engineering may expose a `shadowValue`, but the UI must not present it as the player's Reliability.

## 12. Confidence is independent from score

`Reliability 86 · HIGH` means two separate things.

Confidence depends on sample size, raid nights, effective scored opportunities, weight coverage and identity quality. It does not modify the score itself; it only controls how confidently the score can be published/compared.

A report-scoped actor identity caps confidence at LOW. A provisional name+realm identity caps it at MEDIUM. Strong longitudinal confidence requires canonical identity.

## 13. Player-vs-player comparison

An overall comparison is allowed only when both profiles:

- are actually published;
- use the same Reliability model version;
- belong to the same encounter/difficulty/partition context;
- have at least MEDIUM confidence;
- have the same scored dimensions;
- have no data-integrity errors.

If those conditions fail, Iris may compare shared component evidence but must explain why an overall `A > B` conclusion is unsafe.

The UI should prefer same-spec comparison, then clearly labeled same-class/role context. Same class is not treated as equivalent to same spec.

## 14. Adaptation / repeated mistakes

Adaptation answers a different question:

> After this raider has already failed a mechanic, how often do they repeat that mistake on later proven opportunities?

```text
repeatedFailureRate = repeatedFailures / repeatOpportunities
```

It is useful for coaching and current-form direction but does not multiply Mechanics or add another base-score dimension.

## 15. Scope separation

Never silently mix:

- **Current Form** — recent evidence, coaching/trend;
- **Encounter Reliability** — encounter+difficulty+partition;
- **Tier Reliability** — future aggregate under its own contract.

A Tier score must not raw-pool unlike mechanic denominators across bosses without an explicit tier aggregation contract.

## 16. Double-counting rules

- One player+mechanic occurrence -> maximum one Mechanics opportunity/failure.
- Repetition/adaptation does not multiply the original failure.
- `death-linked` is explanation, not an extra penalty.
- The same event may legitimately appear in Mechanics and Survival because those dimensions answer different questions; no third causal penalty is added.
- A preventable-death defensive counterfactual does not charge the missed defensive twice.
- Overlapping logger reports must map to the same canonical pull/opportunity before longitudinal persistence.

## 17. Data-truth hard rules

These can never reduce Reliability:

- unassigned raid-wide failures;
- mechanics with unknown player denominator;
- a mechanic opportunity whose assignment/outcome/failure source is not complete;
- unknown defensive availability;
- absent Healthstone/potion cast without availability proof;
- a defensive row with unknown outcome;
- post-wipe deaths;
- an incomplete/unverified death stream interpreted as clean survival;
- unverified corpus mechanic relations;
- raw DPS/HPS/parse/ranking;
- raw interrupt/dispels counts without assigned opportunity;
- a pull the player did not attend;
- another player's score or a changing peer population.

These are testable invariants, not UI suggestions.
