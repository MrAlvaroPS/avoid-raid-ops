# Reliability v1 implementation audit

Status: **shadow / publication blocked by design**  
Scoring revision: `1.1.0`  
Product owner: Iris / AvoiD Raid Operations

## Purpose of the metric

Reliability estimates **dependable execution and raid availability when a player has a responsibility that the combat evidence can prove**.

It is intended to help a Raid Leader answer:

- Can this raider repeatedly execute assigned progression responsibilities?
- Which dimension explains their Reliability result?
- Is the evidence sufficient to trust the number?
- Why does this player differ from a comparable player?
- Is a weakness persistent, recent, or already improving?

It is not a skill rank, player-worth score, parse rank, attendance grade, DPS/HPS score or officer opinion.

## Parse boundary

Parse and performance are separate products.

- DPS, HPS, parse percentile, ranking and raw throughput do not enter the Reliability evidence ledger.
- They do not appear in the score trace.
- They cannot compensate for mechanic, survival, defensive or duty failures.
- They cannot reduce Reliability by themselves.
- They may be displayed alongside Reliability as independent context.

This boundary is structural, not merely presentational.

## Canonical dimensions

- **Mechanics** — player-owned, observable mechanic opportunities with a proven denominator.
- **Survival** — raid availability across attended pulls using the shared meaningful pre-wipe death population. It does not claim fault.
- **Defensives** — on-time use in danger windows only when ability availability and outcome are proven.
- **Duties** — explicitly assigned and observable interrupts, dispels, externals, tank responsibilities or equivalent duties.
- **Adaptation** — repeated-mistake signal for coaching only; excluded from the base score to avoid double charging.

## Formula authority

The only scoring authority is:

- `server/analysis/reliability/reliability-policy-v1.mjs`
- `server/analysis/reliability/reliability-metric-registry-v1.mjs`
- `server/analysis/reliability/reliability-engine-v1.mjs`

UI layers and other product sections must consume the returned metric. They must not reimplement or reinterpret formulas.

## Absolute score stability

The absolute score uses a fixed, versioned weak Bayesian prior. The currently loaded roster or peer group never changes the player's absolute Reliability.

Peers are explanatory only:

1. same spec + role + encounter + difficulty + partition;
2. same class + role in the same context;
3. same role in the same context;
4. roster in the same context;
5. labeled policy reference.

Changing the comparison population may change comparison text, but must not change the absolute score.

## Publication gates

No overall number is public unless all versioned gates pass, including:

- stable cross-report identity;
- enough attended pulls and raid nights;
- Mechanics scored;
- Survival scored from a complete source;
- Defensives scored from confirmed availability;
- sufficient scored role-weight coverage;
- at least MEDIUM confidence;
- no data-integrity failure.

`shadowValue` is engineering diagnostics only and must never be rendered as player Reliability.

## Data-integrity invariants

- One canonical pull + actor + opportunity can score at most once.
- Pull attendance equals unique attended fight IDs.
- Survival has one row per attended pull only when the death source is certified complete.
- Incomplete sources cannot prove clean success.
- Unknown defensive availability is not a miss.
- An unassigned raid-wide failure is not an individual failure.
- Probable death causality is explanatory and does not add a second penalty.
- Failed opportunity mass cannot exceed total opportunity mass.
- Overall score trace must reconstruct the displayed score exactly.
- Overall comparisons require compatible model, context, dimensions and confidence.

## Current real-data state

The Intelligence endpoint runs the engine in shadow mode. Current evidence can prove attendance and some classified player failures, but it cannot yet publish a defensible overall number.

Current blockers:

1. **Player mechanic opportunity producer** — the mechanics engine can identify some player failures, but it does not yet generically prove all clean player opportunities. Failures without denominators remain visible and unscored.
2. **Defensive availability producer** — requires a versioned class/spec/build catalog, cooldown reconstruction, source-complete casts/buffs and danger-window applicability.
3. **Assigned duty producer** — raw interrupt/dispel counts are not assignments. Ownership and observable outcomes must be proven.
4. **Longitudinal identity and compact persistence** — evidence must be deduplicated across overlapping reports and joined by stable character identity.
5. **Multi-night scope** — current endpoint scope is report/encounter; publication requires deduplicated cross-night evidence.
6. **External peer dataset** — same-spec corpus peers can improve explanations later, but never alter the absolute score.

## Next implementation order

1. Certify/paginate complete meaningful-death sources for Survival.
2. Build the union participant roster across all eligible pulls, not only the best-pull roster.
3. Persist compact per-player/per-pull evidence using canonical pull identity.
4. Produce player mechanic denominators from validated assignment/target/state evidence.
5. Build defensive catalog and availability reconstruction.
6. Build explicit duty ownership and outcome producers.
7. Run several raid nights in shadow mode and manually audit representative high/medium/low profiles.
8. Publish UI scores only after all gates and audits pass.

## Definition of done

Reliability v1 becomes public only when:

- every displayed score has an exact score trace and explanation;
- parse/output is absent from all score inputs;
- peer population changes do not move the absolute score;
- duplicate logger reports do not duplicate evidence;
- unknown/incomplete data never becomes success or failure;
- comparisons use compatible scope and dimensions;
- several real profiles have been manually reconciled against WCL evidence;
- the same canonical metric object is consumed by Players, Composition and any future Live roster decision.
