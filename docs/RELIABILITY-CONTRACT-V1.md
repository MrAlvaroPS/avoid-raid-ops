# Iris Reliability Contract v1

Status: **shadow / not yet a published roster score**  
Model: `reliability.overall.v1`  
Policy: `server/analysis/reliability/reliability-policy-v1.mjs`

## 1. What Reliability measures

Reliability estimates how dependable a raider is **when they have an observable progression responsibility**.

It is intended to answer:

> When this player is present and has a responsibility that the logs can actually prove, how consistently do they execute it correctly and remain available to the raid?

Reliability is not a skill ranking, parse ranking, DPS/HPS ranking, popularity score, attendance score, or subjective officer grade.

### Explicit non-goal: parse

Damage/healing performance is deliberately outside Reliability.

- DPS, HPS, WCL parse percentile, boss DPS, weighted DPS and rankings do **not** enter the Reliability formula.
- Performance may be displayed alongside Reliability as context.
- Natural correlation is allowed: a mechanically reliable player may also parse well, but one number never changes the other.
- A 99 parse cannot compensate for repeated execution failures.
- A low parse cannot by itself reduce Reliability.

This is enforced in code by keeping performance fields outside the Reliability evidence ledger and scorer.

## 2. Scored dimensions

Reliability v1 has four possible dimensions.

| Dimension | Meaning | Base weight DPS | HEAL | TANK |
| --- | --- | ---: | ---: | ---: |
| Mechanics | Player-owned mechanic execution with a proven denominator | 40% | 35% | 30% |
| Survival | Remaining alive through meaningful pre-wipe windows | 25% | 25% | 30% |
| Defensives | Correct use of a defensive when availability and opportunity are proven | 20% | 25% | 30% |
| Duties | Explicitly assigned/observable role duties such as an interrupt/dispelling/tank duty | 15% | 15% | 10% |

`Adaptation / repeated mistake rate` is a separate coaching signal. It does not add another score weight because that would double-charge the same mechanic failure.

## 3. Opportunity-first rule

A player can only fail something they had a proven opportunity/responsibility to execute.

Every scored row must have an explicit player denominator:

```text
actor + canonical pull + responsibility/opportunity -> success/failure
```

Raw counts such as `4 mechanic failures`, `3 interrupts` or `2 defensives used` are not Reliability metrics without their opportunity denominator.

### Never infer a clean success from absence alone

If the log proves a failure but cannot prove how many clean opportunities that player had, the failure remains visible evidence but is **unscored**.

Example:

```text
3 wrong-colour exposures observed
player-specific clean exposure opportunities unknown
=> show 3 classified failures
=> Mechanics score remains pending
```

This prevents severe denominator bias.

## 4. Mechanics formula

Mechanic opportunities are weighted by severity:

```text
severity 1 -> 0.40
severity 2 -> 0.55
severity 3 -> 0.70
severity 4 -> 0.85
severity 5 -> 1.00
```

A failed opportunity is discounted by evidence confidence:

```text
confirmed -> 1.00
high      -> 0.90
medium    -> 0.65
low       -> 0.35
unknown   -> 0.00
```

For each player:

```text
opportunityMass = sum(severityImportance)
failureMass     = sum(severityImportance * evidenceConfidence) for failed opportunities
successMass     = opportunityMass - failureMass
rawSuccessRate  = successMass / opportunityMass
```

A raid-wide failure without a proven responsible player does not create a player mechanic failure.

## 5. Survival formula

The denominator is **pulls attended by that player**, not guild pulls.

Only meaningful deaths before the WCL wipe cutoff are considered.

Per attended pull:

```text
no meaningful death        -> penalty 0.00
meaningful non-first death -> penalty 0.50
first meaningful death     -> penalty 1.00
```

Then:

```text
opportunityMass = pulls attended
failureMass     = sum(per-pull incident penalty)
successMass     = opportunityMass - failureMass
rawSuccessRate  = successMass / opportunityMass
```

The death does not have to be proven self-caused to exist as a Survival event. Probable mechanic causality is explanatory only and does not add a second Survival penalty.

Deaths after the wipe cutoff are excluded.

## 6. Defensive formula

A defensive opportunity is scoreable only when all of these are proven:

1. the relevant defensive existed for the player's current class/spec/build;
2. it was available at the window;
3. the danger window is observable;
4. on-time use can be determined.

Unknown availability is never a missed defensive.

This is especially important for Healthstone/healing potion: observing no cast does not prove the consumable was available in inventory.

```text
opportunityMass = sum(dangerWeight)
failureMass     = sum(dangerWeight * evidenceConfidence) when not used on time
```

A preventable-death counterfactual may explain severity but does not add another penalty to the same opportunity.

## 7. Duty formula

Duties include responsibilities where ownership is proven: assigned interrupt, dispel, external, tank assignment, etc.

A raw interrupt/dispels count is not a score.

A duty row scores only if:

```text
assigned === true
observable === true
```

The score then uses weighted successful opportunities exactly like other binary execution dimensions.

## 8. Bayesian/shrinkage scoring

Small samples must not produce extreme scores.

Each scored dimension uses a weak peer prior:

```text
posterior =
  (successMass + priorStrength * peerSuccessRate)
  / (opportunityMass + priorStrength)

componentScore = posterior * 100
```

v1 `priorStrength = 8` equivalent opportunities.

Peer hierarchy:

1. same spec + same role, minimum 3 peers;
2. same class + same role, minimum 3 peers;
3. same role, minimum 5 peers;
4. roster, minimum 10 peers;
5. versioned policy fallback prior.

The peer source is always returned with the component. A fallback prior must never be presented as a real same-spec benchmark.

External WCL/corpus peers can later implement the same peer interface without changing the scoring formula.

## 9. Overall score

Base weights are role-aware. Missing optional dimensions can only be renormalized after publication gates are satisfied.

```text
scoredWeightCoverage = sum(base weights of scored dimensions)
effectiveWeight(d)   = baseWeight(d) / sum(base weights of scored dimensions)
overall               = sum(componentScore(d) * effectiveWeight(d))
```

The engine returns an exact `scoreTrace` containing every component value, base weight, effective weight and contribution. The trace sum must equal the displayed score.

### Publication gates

An overall Reliability number is not published unless all gates pass:

- at least 15 pulls attended;
- at least 2 raid nights;
- stable cross-report player identity;
- Mechanics scored;
- Survival scored;
- at least 3 scored dimensions;
- at least 75% of role weight covered;
- component-specific minimum samples:
  - Mechanics: 20 weighted opportunities;
  - Survival: 15 pulls;
  - Defensives: 8 weighted opportunities;
  - Duties: 8 weighted opportunities.

If gates fail, `value=null` and status is `shadow-pending`. A shadow calculation may exist for engineering diagnosis but must not be rendered as the player's Reliability.

## 10. Confidence is separate from score

`Reliability 86` and `Confidence HIGH` are independent values.

Confidence depends on:

- pulls attended;
- raid nights;
- effective scored opportunities;
- scored weight coverage;
- stable identity quality.

A report-scoped identity caps confidence at LOW. A name+realm provisional identity caps it at MEDIUM. Canonical identity is required for the strongest longitudinal confidence.

## 11. Comparison rules

Comparative statements must not compare two overall scores unless both players:

- have at least MEDIUM confidence;
- have the same set of scored dimensions.

Otherwise Iris compares individual dimensions only and says why the overall comparison is unsafe.

Preferred peer display is same-spec+role. Same-class/role or role-only fallbacks must be labeled as such.

## 12. Current form vs encounter vs tier

These are different products and must never be silently mixed.

- **Current form**: recent evidence window; trend/coaching, not a replacement for the historical score.
- **Encounter Reliability**: one encounter+difficulty+partition.
- **Tier Reliability**: future aggregate of published encounter profiles; do not raw-pool unlike mechanic denominators across bosses without an explicit tier contract.

v1 shadow integration is report+encounter scoped until cross-report identity/ledger persistence is wired.

## 13. Double-counting rules

- One mechanic occurrence can create at most one mechanic failure for the same actor/opportunity.
- Repetition/adaptation does not multiply the base mechanic penalty.
- `death-linked` is explanation, not an extra penalty.
- The same death may legitimately appear in Mechanics and Survival because those dimensions answer different questions, but no third causal penalty is added.
- Duplicate logger reports must eventually map to the same canonical pull/opportunity before longitudinal persistence.

## 14. Data-truth hard rules

The following can never reduce Reliability:

- unassigned raid-wide mechanic failures;
- mechanics whose player denominator is unknown;
- a defensive whose availability is unknown;
- absent Healthstone/potion use without proof of availability;
- post-wipe deaths;
- unverified corpus mechanic relations;
- raw DPS/HPS/parse/ranking;
- interrupt/dispels counts without assigned opportunity;
- an encounter pull the player did not attend.

These are testable invariants, not UI guidance.
