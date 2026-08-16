# Reliability v1 — shadow implementation status

This is the restart/checkpoint document for Reliability work.

## Implemented now

- Versioned semantic/scoring contract.
- Parse/output hard-separated from Reliability.
- Role-aware base weights.
- Compact per-player evidence ledger.
- Attendance-derived Survival denominator.
- WCL meaningful-death / wipe-cutoff Survival evidence.
- Mechanic failure evidence ingestion without inventing clean player opportunities.
- Defensive tri-state availability contract (`confirmed available / confirmed unavailable / unknown`).
- Assigned-duty opportunity contract.
- Severity and evidence-confidence weighting.
- Weak Bayesian/shrinkage prior.
- Deterministic peer fallback hierarchy.
- Exact score contribution trace.
- Confidence independent from score.
- Publication gates.
- Safe player-vs-player comparison gates.
- Adaptation/repeated-mistake signal kept outside base score to avoid double charging.
- Ledger invariants/data-error diagnostics.
- Intelligence endpoint shadow integration.

## Current real-data behavior

`/api/wcl/intelligence` now returns `reliability` in shadow mode.

Expected for the current AvoiD Belo'ren report:

- player attendance and Survival evidence can be derived;
- classified player mechanic failures can be observed;
- current encounter engine does **not** yet prove a generic clean player-opportunity denominator for those mechanics;
- confirmed defensive availability opportunities are not yet produced;
- assigned duty opportunities are not yet produced;
- scope is one report/raid night;
- therefore **overall Reliability must remain null/pending**.

This is intentional. A visible number at this point would be denominator fabrication.

## Workstream A — player mechanic opportunities

Required output contract from encounter analysis:

```text
actorId
canonicalPullKey / fightId
mechanicKey
occurrenceKey
assigned=true
observable=true
severity
confidence
success/failure
model/rule provenance
```

Rules:

- do not convert raid-level cast count into 20 player opportunities;
- player opportunity must be attributable from assignment/target/role/state evidence;
- generated encounter mechanics can only score after provenance validation;
- one player+occurrence = maximum one opportunity;
- clean success must be observable, not inferred from missing data on a truncated stream.

Belo'ren currently has several player-attributed failures but insufficient generic proof of clean denominators. Keep them visible/unscored until the opportunity model is implemented safely.

## Workstream B — defensive availability engine

Build a versioned class/spec defensive catalog with:

- spell ID / aura ID;
- class/spec restrictions;
- base cooldown / charges;
- talent modifiers from CombatantInfo;
- mitigation type and applicable damage schools/categories;
- immunity/DR/absorb/heal semantics;
- buff/cast evidence needed to prove use;
- cooldown reconstruction rules.

The engine then emits only confirmed opportunities:

```text
player
window
ability
availability=confirmed
usedOnTime
confidence
dangerWeight
preventableDeath? (optional explanatory counterfactual)
```

Healthstone/healing potion must remain non-penalizing until inventory/availability can be proven.

## Workstream C — duty ownership

Raw interrupt/dispels counts are descriptive only.

Reliability needs ownership:

```text
assignment/opportunity -> player -> success/failure
```

Sources may include encounter-model assignment semantics, explicit raid plans in a future Iris planning layer, target/debuff ownership, or deterministic tank-role duties.

No assignment = no player penalty.

## Workstream D — longitudinal identity and persistence

Current report actor IDs are not enough for multi-night scoring.

Target identity:

1. canonical WCL/character identity;
2. provisional region+realm+name fallback;
3. alias/migration support for rename/transfer.

Reliability persistence must use the same deduplicated canonical pull identity as Progress/History so overlapping logger reports cannot double count an opportunity.

Persist compact evidence rows, not raw event streams.

## Workstream E — peer baselines

Current scorer already supports a peer interface and fallback hierarchy.

Target production hierarchy:

1. same spec + role + encounter + difficulty + partition + comparable progress context;
2. same class + role only when same-spec sample is insufficient, clearly labeled;
3. role/context fallback;
4. versioned global prior.

Two peer products should eventually coexist:

- **AvoiD internal peers** for roster comparison;
- **external corpus peers** for broader same-spec benchmarking.

Parse/ranking data remains a separate Performance product and never becomes a Reliability component.

## Workstream F — scopes

Do not silently mix these:

- `CURRENT FORM` — recent window for coaching/trend;
- `ENCOUNTER RELIABILITY` — encounter+difficulty+partition;
- `TIER RELIABILITY` — future aggregate of published encounter scores under its own contract.

## UI publication rule

Players/Composition may continue showing `PENDING` until the shadow profile is publishable.

When enabled, a player detail must show at minimum:

```text
Reliability 0-100
Confidence
scored dimensions
peer source + peer baseline
data coverage
WHY THIS SCORE?
exact contribution trace
primary positive/negative evidence
current-form direction
```

A player-vs-player overall comparison is hidden when score coverage/confidence is not comparable; shared component comparison may still be shown.

## Definition of done for public Reliability v1

- mechanics player denominator live and validated;
- defensive availability engine live for supported specs;
- at least 75% role-weight coverage for published players;
- two or more nights of deduplicated evidence;
- stable cross-report identity;
- same evidence population used everywhere Reliability appears;
- no raw parse/output input in score trace;
- score trace exactly reconstructs displayed number;
- manual audit of several high/medium/low profiles agrees with underlying evidence;
- no score is published for data-integrity failures.
