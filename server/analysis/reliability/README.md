# Reliability

Iris Reliability is a deterministic, auditable execution model for progression raiders.

It measures **dependable execution and raid availability under observable player responsibility**. It does not score DPS, HPS, WCL parse, ranking or raw throughput.

Current scoring revision: **1.1.0** (`reliability.*.v1` semantic metric family).

Core modules:

- `reliability-policy-v1.mjs` — versioned role weights, fixed scoring priors, thresholds and Data Truth policy.
- `reliability-metric-registry-v1.mjs` — one shared definition for every Reliability metric consumed by Iris.
- `evidence-contracts-v1.mjs` — contracts for mechanic/survival/defensive/duty evidence producers.
- `evidence-ledger-v1.mjs` — compact per-player opportunity ledger and integrity validation.
- `peer-baseline-v1.mjs` — deterministic, context-compatible same-spec/class/role comparison hierarchy. Peers never affect absolute score.
- `reliability-engine-v1.mjs` — absolute component scoring, confidence, publication gates, exact score trace and comparison safety.

Technical contracts/checkpoint:

- `docs/RELIABILITY-CONTRACT-V1.md`
- `docs/RELIABILITY-DATA-INTEGRITY-V1.md`
- `docs/RELIABILITY-SHADOW-STATUS.md`

The first deployment remains **shadow mode**. `value` stays `null` until Mechanics + Survival + Defensives have proven denominators/completeness, at least MEDIUM confidence, longitudinal identity and all publication gates.
