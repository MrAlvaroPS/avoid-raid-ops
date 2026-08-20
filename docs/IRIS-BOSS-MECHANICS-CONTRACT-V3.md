# Iris Boss Mechanics Contract v3

## Purpose

This is the canonical implementation contract for the final stage of Iris GLOBAL BOSS KNOWLEDGE mechanic learning.

The contract deliberately models only information Iris can observe, derive reproducibly, validate across independent evidence, baseline/control, attribute through actor provenance, persist and revalidate. If a property cannot be obtained or validated with the data sources actually available to Iris, it is outside this contract.

Out of scope by design: spatial positioning, movement instructions, geometry-derived spread/soak/bait/LOS, optimal strategy, assignments, inventory, mathematically asserted causality, exact wipe cause and generic "correct player response" inferred only from kill/wipe correlation.

## Pipeline boundary

```text
Canonical acquisition (Wide + Deep)
  -> Signal discovery
  -> Origin triage
  -> Local mechanic synthesis
  -> Semantic evidence planning
  -> Candidate-wise specificity verification
  -> Pattern-level actor provenance
  -> Hard provenance gate
  -> Episode construction
  -> Mechanic Candidate
  -> Promotion Contract
  -> Mechanic Registry
  -> GLOBAL BOSS KNOWLEDGE
```

This contract begins after the hard provenance gate. It does not replace existing corpus, discovery, synthesis, surgical probe, specificity or provenance systems.

## Non-negotiable invariants

- WCL observed combat is the primary empirical truth.
- Raw evidence is immutable; interpretation is versioned.
- Diagnostic probes contribute 0 Canonical Deep and 0 direct Boss Learned score.
- Repetition does not imply specificity; null/control comparison is mandatory.
- Specificity does not imply encounter origin.
- Provider metadata can corroborate evidence but never substitute for actor provenance.
- Spell names are labels only and never classification logic.
- Generic learning code cannot hardcode boss names, encounter IDs or ability IDs.
- GLOBAL BOSS KNOWLEDGE and HOME/PLAYER knowledge remain isolated.
- Nothing is merged to `main` without explicit operator approval.

## Entity model

Iris separates:

```text
PATTERN -> EPISODE -> MECHANIC
```

### Pattern

Canonical pattern key:

```text
relation|stream|abilityId|eventType
```

A Pattern is an observation, not a mechanic. It may be encounter evidence, player context, noise, precursor, aftermath or another contextual event.

### Episode

An Episode groups reproducible Patterns around an anchor into precursor/simultaneous/aftermath/context-marker roles. It is composite evidence and is not automatically accepted knowledge.

### Mechanic

A Mechanic is an interpretation of an anchor/Episode that has passed Promotion. A mechanic may be supported by one strong encounter-origin signal or by several related Patterns.

## Stable mechanic identity

`mechanic_id` must not be a hash of one `pattern_key`.

A persistent mechanic seed is based on:

```text
encounterId|difficulty|partition|primaryAnchorAbilityId|primaryAnchorEventType|stateDiscriminator
```

The Episode may evolve without changing the mechanic identity. If later evidence shows two mechanics were the same, historical records are superseded/aliased rather than rewritten.

## Actor provenance

Actor roles:

```text
friendly-player
friendly-pet
owned-actor
encounter-boss
encounter-npc
encounter-environment
unknown
```

Provenance status:

```text
player-origin
encounter-origin
mixed-or-unknown
unresolved
```

`encounter-origin` is a provenance result, not an actor role.

For mechanical support, encounter-origin must come from **exact pattern-level provenance**. Ability-level summaries are diagnostic fallback only and can never establish encounter-origin for a Pattern.

Strong player-owned source may conservatively mark a Pattern as `player-origin-context-marker`. This context is retained in Episodes but cannot promote a native encounter mechanic.

`encounter-environment` is accepted only when an explicit provenance policy establishes it for the exact Pattern; source-less events are not automatically treated as environment mechanics.

## Episode graph

Nodes reference Patterns and their Episode role.

Edges contain only observable/derived relationships:

```text
from_pattern_key
to_pattern_key
temporal_relation: before|simultaneous|after
temporal_window_ms
median_delta_ms
temporal_spread_p80_p20_ms
anchor_prevalence
background_prevalence
lift
prevalence_delta
source_role
target_role
actor_provenance_status
actor_topology
independent_evidence_groups
source_support_rate
edge_class
evidence_refs
verifier_version
provenance_version
```

Allowed initial edge classes:

```text
temporal-association
state-transition
actor-linked
mechanically-supported
```

There is no generic automatic `causal-edge`.

## Baselines

Two levels exist.

### Local flank baseline

Nearby windows around an anchor. Useful for discovery and rapid noise rejection. Not sufficient alone for final acceptance.

### Matched null baseline

Required for Promotion. Controls should match encounter/difficulty/partition and, when observable, phase/state and comparable fight timing/outcome context. They must exclude the target anchor and avoid Episode overlap.

If sufficient matched controls cannot be built, the candidate remains `promotion-pending`.

## Independent evidence groups

A raw source ID is not automatically independent. Promotion uses `independent_evidence_group`, with a versioned grouping policy that can account for guild/owner, report duplication, temporal overlap, roster similarity and other evidence that multiple reports represent the same raid population.

Promotion counts independent evidence groups, not raw report count.

## Specificity policy v3.0 initial calibration

Initial versioned configuration:

```text
minimum_independent_evidence_groups = 5
minimum_anchor_windows              = 8
minimum_matched_controls            = 6
minimum_anchor_prevalence           = 0.60
minimum_specificity_lift            = 1.75
minimum_prevalence_delta            = 0.25
minimum_positive_group_support      = 0.60
bootstrap_resamples                 = 1000
confidence_level                    = 0.95
minimum_delta_lower_bound           = 0
discovery_fraction                  = 0.80
holdout_fraction                    = 0.20
```

These are policy values to calibrate from real data, not permanent truths.

Windows from one evidence group are not treated as IID. Promotion uses evidence-group/source-stratified uncertainty; initial hard gate requires the lower confidence bound of prevalence delta to remain above zero.

## Discovery and untouched holdout

Independent evidence groups are deterministically split into discovery and untouched holdout.

Discovery may be used to find candidates, build Episodes, rank candidate-wise and calibrate policy.

Holdout cannot participate in discovery, candidate selection, threshold tuning or interpretation. It is consulted only after `promotion-eligible`.

Insufficient holdout leaves the candidate `promotion-eligible`; it never forces `accepted`.

## Candidate-wise meaning

Every relevant structural candidate must be evaluated independently. A valid Pattern does **not** need to be rank #1. Multiple Patterns can simultaneously support the same Episode.

Ranking is for prioritization/explanation, not exclusive truth selection.

## Promotion Contract

All hard gates are required for `promotion-eligible`:

1. valid encounter-side anchor/signal;
2. candidate-wise evaluation completed;
3. sufficient matched null baseline;
4. specificity contract passed;
5. exact pattern-level actor provenance available;
6. at least one central Pattern/edge is encounter-origin;
7. enough independent evidence groups;
8. positive replication across evidence groups;
9. statistical stability meets policy;
10. Episode reconstructs stably;
11. no open material contradiction;
12. no hard gate depends on provider metadata.

Failure through missing evidence -> `promotion-pending`.
Material negative evidence may -> `rejected`.

`promotion-eligible` means discovery evidence is strong enough for untouched holdout validation. It is not accepted knowledge.

`accepted` requires `promotion-eligible` plus holdout reproduction with compatible specificity, provenance, Episode structure and no material contradiction.

## Contradictions

One anomalous pull does not automatically block a mechanic. Contradictions are persisted with supporting evidence groups/windows/prevalence/severity and become material only under a versioned policy.

## Mechanic Registry

The registry stores observable mechanic knowledge, including:

- scope;
- lifecycle;
- stable identity/anchor;
- observable family/tags;
- Episode references;
- timing/cadence;
- target-role distributions;
- observed effects;
- detection signatures;
- evidence summary;
- confidence/evidence per field;
- policy/verifier/provenance versions;
- changelog/supersession history.

Confidence is per field, not a single blanket mechanic confidence.

Field states:

```text
observed
derived
supported
pending
```

`pending` is used only for properties Iris could realistically resolve with more evidence. Permanently unobservable properties are not created.

## Observable mechanic families

Initial families are limited to structures Iris can observe robustly:

```text
interrupt-window
periodic-effect
stacking-effect
multi-target-effect
raidwide-damage
dispel-window
tank-targeted-pressure
encounter-actor-appearance
encounter-spawn
phase-transition
cast-impact-sequence
aura-state-transition
other-observed
```

`multi-target-effect` is not automatically called spread/soak.
`tank-targeted-pressure` is not automatically called tank swap.
`encounter-actor-appearance` uses MasterData only for actor classification and combat evidence for first observed fight timestamp; it does not pretend MasterData contains spawn timing.
`encounter-spawn` requires explicit summon/spawn evidence.

## Observed effects, not invented failure semantics

The registry may store:

```text
damage_patterns
aura_changes
death_association
wipe_association
target_changes
actor_changes
```

It does not automatically store `correct_resolution`, `failure_causes_wipe` or exact causal semantics.

Kill/wipe remains useful contextual evidence but cannot by itself determine what players should do.

## Negative knowledge / Disposition Registry

Persist dispositions such as:

```text
discarded-noise
context-only
rejected-mechanic-candidate
```

with reason, evidence references and policy versions.

Revalidation triggers can include patch/partition/state changes, verifier/provenance/baseline/schema policy changes, material new evidence or distribution drift.

A player-origin Pattern normally becomes `context-only`; it remains usable in Episode Graph while being blocked from native mechanic Promotion.

A discard is scoped and versioned; `pattern_key rejected forever` is forbidden.

## Lifecycle

```text
signal
 -> episode candidate
 -> promotion-pending
 -> promotion-eligible
 -> holdout verification
 -> accepted
```

Alternative paths:

```text
promotion-pending -> rejected
accepted -> superseded
```

Only `accepted` means globally learned mechanic.

## Provider role

WCL GameData/WorldData and secondary providers may resolve identity/context. They cannot pass specificity, resolve actor provenance, establish encounter-origin, accept a mechanic, increase Canonical Deep or directly raise Boss Learned.

Lorrgs boss spell catalog remains a curated timeline/analysis marker catalog, not an exhaustive spellbook; absence is weak-negative only.

## Recompile and acquisition

`RECOMPILE` uses persisted corpus/evidence/Episodes/registries/policies and performs no routine WCL re-fetch.

Missing evidence produces a surgical plan with explicit question, missing evidence, expected decision, source/fight selection, query shape, cache reuse and hard call cap.

## Required regression cases

### Fel Armor
High anchor recurrence plus high baseline recurrence must remain `background-noise` / `discarded-noise`.

### Void Feather false positive
Specificity + provider encounter support + mixed/player or only ability-level provenance must never become mechanically supported.

### Player debuff on boss
High specificity + player -> encounter-boss remains `player-origin-context-marker` / `context-only`.

## Current validation case: Voidlight Rupture

Current expected state before exact pattern-level provenance is completed:

```text
anchor encounter-side        supported
structural recurrence        supported
specific neighbours          present
player context markers       present
exact encounter-origin edge  not yet established
mechanic lifecycle           promotion-pending
```

No mechanic is accepted merely to complete boss coverage.

## Implementation order

A. Close hard provenance + exact pattern provenance + regressions.
B. Episode Graph.
C. Matched null baseline.
D. Independent evidence groups.
E. Promotion policy + stratified statistics + holdout.
F. Mechanic Registry + field evidence + Disposition Registry + revalidation.

## Definition of Done

Without boss-specific rules, Iris can:

```text
discover
-> triage
-> synthesize
-> surgically acquire only missing evidence
-> verify specificity
-> resolve exact pattern provenance
-> construct Episode
-> separate encounter evidence from player context
-> evaluate matched controls
-> validate independent evidence groups
-> produce Promotion decision
-> validate untouched holdout
-> persist accepted Mechanic
```

and can explain what it knows, why, which evidence supports it, what it rejected, why it rejected it, what remains pending and what would trigger revalidation.
