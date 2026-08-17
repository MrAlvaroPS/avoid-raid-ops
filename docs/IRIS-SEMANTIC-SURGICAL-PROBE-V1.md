# Iris semantic surgical probe plan v1

This planner is a generic escalation stage in the boss-agnostic Iris learning pipeline. It is **not** tied to Belo'ren, Voidlight Rupture, or any named encounter/ability.

## Entry condition

A signal may enter this planner only when all of the following are true:

- it is part of the current GLOBAL BOSS scope (`encounter + difficulty + partition`),
- signal triage classified it as encounter-side rather than friendly-player,
- local mechanic synthesis marks it `external-evidence-needed`,
- persisted canonical evidence cannot settle the explicit missing semantic question.

The target list is derived from `model.learning.localMechanicSynthesis.signals`. No boss/ability constants are accepted as planner inputs.

## Goal

Answer one narrow semantic question with the smallest trustworthy WCL evidence set while preserving independent-source reproduction.

The v1 planner is **dry-run only**:

- `executesWcl = false`,
- `wclCallsExecuted = 0`,
- it changes no accepted mechanic,
- it changes no score,
- it contributes 0 canonical Deep reports/pulls.

## Generic two-stage query shape

### Stage A — anchor occurrence

For each unresolved target signal, select high-value canonical reports from independent sources and exact fight IDs. Query only the target ability to establish real occurrence timestamps and actor/target identity.

Conceptually:

```text
reportCode: selected canonical report
fightIDs: exact selected fights
abilityID: learned target ability id
filterExpression: ability.id IN (<learned target id>)
includeResources: false
```

The target ability ID is discovered from model state; it is never hard-coded.

### Stage B — temporal context

Only after an anchor occurrence exists, inspect a narrow time window around that exact occurrence (default ±5 s). Prefer context ability IDs already derived from:

- origin-verified relation neighbors,
- discovered variant-family members,
- rejected mechanic candidates containing the target.

If no useful context IDs exist, query the narrow exact-fight time window and retain encounter event identity. Do not broaden to the whole report by default.

## Selection rules

- canonical Wide pool only when a canonical manifest exists,
- independent source first,
- prefer persisted complete Deep reports that already prove target presence,
- sample fight progression bands rather than assuming one outcome is sufficient,
- exact fights only,
- no home/AvoiD GLOBAL BOSS contamination,
- report-level target presence is only a selection hint; anchor queries establish exact occurrences.

## Verification contract

A future executor/verification stage must require at minimum:

- reproduction across at least 3 independent sources,
- at least 6 anchor occurrences in total,
- no semantic inference from spell names,
- explicit source/target/timestamp evidence,
- no direct score change,
- no automatic mechanic promotion.

A valid result can also be: **still unresolved**. Failure to find a reproducible pattern is not permission to invent one.

## Promotion boundary

This planner cannot turn a result into an accepted or scoreable mechanic. Promotion requires a separate versioned contract that defines:

- mechanic semantics,
- eligibility/opportunity denominator,
- null/unknown policy,
- player attribution/blame rules,
- validation requirements,
- score impact.

## Portability

The same planner must operate without modification when a different boss produces `external-evidence-needed` signals. The only encounter-specific values in a plan are data values learned/resolved at runtime: encounter ID, ability IDs, report codes, fight IDs, actor IDs, timestamps, phases and discovered context IDs.
