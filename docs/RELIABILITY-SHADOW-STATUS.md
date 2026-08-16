# Reliability v1 — shadow implementation checkpoint

Current scoring revision: **1.1.0**  
Public UI status: **PENDING by design**

This is the canonical restart point for Reliability work.

## What Reliability now means

Reliability measures **dependable execution and raid availability under proven, observable progression responsibility**.

It does not measure parse, damage, healing, attendance, popularity or subjective officer opinion.

DPS/HPS/parse are a separate Performance product. They may correlate with raid outcomes but never enter the Reliability score.

## Implemented brain

- Versioned semantic/scoring contract.
- Shared versioned metric registry.
- Explicit producer contracts for Mechanics, Survival, Defensives and Duties evidence.
- Role-aware base weights.
- Mandatory Mechanics + Survival + Defensives publication dimensions.
- Compact per-player evidence ledger.
- Attendance-derived player pull population.
- Source-completeness default is **unproven/false**.
- Mechanic failure evidence remains visible without fabricating clean denominators.
- Defensive tri-state availability contract (`confirmed available / confirmed unavailable / unknown`).
- Assigned-duty ownership contract.
- Severity × evidence-confidence opportunity weighting.
- Fixed/versioned Bayesian scoring prior.
- Peer benchmark hierarchy separated from absolute scoring.
- Exact component `why` text and exact overall contribution trace.
- Confidence independent from score.
- Minimum MEDIUM confidence required before overall publication.
- Safe player-vs-player comparison gates.
- Adaptation/repeated-mistake signal outside base score to avoid double charging.
- Ledger population/mass/data-integrity invariants.
- Intelligence endpoint shadow integration.

## Critical scoring-stability decisions

### Peer groups never move the absolute score

A player's Reliability is computed from their own evidence plus a fixed versioned weak prior. Loading/removing peers may change comparison text and `peerDelta`, but **must not change the player's score**.

This avoids the pathological case where the same performance receives a different Reliability simply because the roster changed.

### Low-confidence clean evidence cannot inflate the score

Evidence confidence weights opportunity mass itself. A low-confidence clean row contributes less evidence rather than behaving like a full clean success.

### Survival measures availability, not proven blame

A meaningful pre-wipe death can reduce the Survival availability component, but Iris does not claim that the player caused the death unless separate causal evidence exists. `death-linked` never creates another penalty.

### Missing/incomplete data defaults to PENDING

- no source-completeness proof -> no inferred clean success;
- no confirmed defensive availability -> no defensive miss;
- no proven duty assignment -> no duty miss;
- no player mechanic denominator -> classified failures remain visible but Mechanics remains pending.

## Current real-data behavior

`/api/wcl/intelligence` returns a `reliability` shadow object.

For the current AvoiD Belo'ren report the expected state remains:

- player attendance can be observed;
- classified player mechanic failures can be observed;
- clean player mechanic opportunity denominators are not yet generically produced;
- defensive availability opportunities are not yet produced;
- assigned duty opportunities are not yet produced;
- the shadow integration does not yet explicitly certify meaningful-death stream completeness, so Survival defaults to unscored rather than assuming missing deaths mean survival;
- scope is still one report/raid night;
- therefore **overall Reliability must remain `null / shadow-pending`**.

A visible player score now would still be evidence fabrication.

## Producer contract A — player mechanic opportunities

Required scoreable output:

```text
actorId
canonicalPullKey / fightId
mechanicKey
occurrenceKey
assigned=true
observable=true
sourceComplete=true
severity
confidence
success/failure
rule/model provenance
```

Rules:

- never convert one raid-level cast into twenty player opportunities;
- assignment must come from target/state/role/explicit assignment evidence;
- generated encounter rules score only after provenance validation;
- one actor + occurrence = at most one opportunity;
- clean success requires a complete failure-detection source.

Belo'ren already has player-attributed failures, but not a safe generic clean denominator. Keep those failures visible/unscored until this producer exists.

## Producer contract B — defensive availability

Build a versioned class/spec defensive catalog containing:

- spell/aura IDs;
- class/spec/build restrictions;
- base cooldown, charges and reset rules;
- talent modifiers from CombatantInfo;
- DR/immunity/absorb/heal semantics;
- applicability by damage type/window;
- cast/buff evidence needed to prove use;
- cooldown reconstruction and source-completeness rules.

Scoreable output:

```text
actorId
canonicalPullKey / fightId
opportunityKey
abilityId
availability=confirmed
sourceComplete=true
usedOnTime=true|false
confidence
dangerWeight
preventableDeath?   # explanatory only
```

Healthstone/healing potion remain non-penalizing until availability can actually be proven.

## Producer contract C — assigned duties

Raw interrupt/dispels counts are descriptive only.

Reliability needs:

```text
assignment/opportunity -> player -> observable outcome
```

Ownership can eventually come from encounter semantics, explicit Iris raid plans, target/debuff ownership or deterministic role duties.

No proven assignment = no penalty.

## Producer contract D — complete Survival source

The meaningful-death source must certify completeness for the scored pull population before clean Survival rows are emitted.

A truncated/unverified death stream yields PENDING Survival for affected pulls. It never means `no death observed = survived`.

## Longitudinal identity + persistence

Report actor IDs cannot support multi-night Reliability.

Target identity hierarchy:

1. canonical character identity;
2. provisional region+realm+name;
3. alias/migration handling for rename/transfer.

Persistence must use the same canonical/deduplicated pull identity as Progress/History so overlapping logger reports cannot double count opportunities.

Persist compact evidence rows, not raw WCL streams.

## Peer baselines

Production comparison hierarchy:

1. same spec + role + encounter + difficulty + partition;
2. same class + role when same-spec sample is insufficient, explicitly labeled;
3. same role;
4. roster;
5. policy reference.

Two future comparison datasets can coexist:

- internal AvoiD peers;
- external corpus peers.

Neither changes absolute Reliability.

## Scope separation

Never silently mix:

- `CURRENT FORM` — recent coaching/trend;
- `ENCOUNTER RELIABILITY` — encounter+difficulty+partition;
- `TIER RELIABILITY` — future aggregate under a separate contract.

## UI publication contract

Players/Composition continue to show `PENDING` until the profile clears publication gates.

When public, player detail must expose at minimum:

```text
Reliability 0–100
Confidence
Encounter / scope
Mechanics / Survival / Defensives / Duties
actual peer source + peer benchmark
WHY THIS SCORE?
per-component why
exact contribution trace
evidence coverage / pending evidence
current-form direction
```

No overall A-vs-B statement when coverage/confidence/context is incompatible.

## Definition of done for public Reliability v1

- player mechanic opportunity producer live and validated;
- defensive availability engine live for supported specs;
- complete Survival source wired explicitly;
- mandatory Mechanics + Survival + Defensives scoreable;
- >=75% role weight coverage;
- >=MEDIUM confidence;
- >=2 deduplicated raid nights;
- stable cross-report identity;
- same evidence model consumed everywhere Reliability appears;
- parse/output absent from score trace;
- changing peer population does not change absolute score;
- score trace exactly reconstructs the displayed score;
- several high/medium/low profiles manually audited against evidence;
- data-integrity error always blocks publication.
