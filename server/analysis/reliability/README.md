# Reliability

Iris Reliability is a deterministic, auditable execution model for progression raiders.

It measures dependable execution under **observable player responsibility**. It does not score DPS, HPS, WCL parse, ranking or raw throughput.

v1 modules:

- `reliability-policy-v1.mjs` — versioned weights, thresholds and Data Truth policy.
- `evidence-ledger-v1.mjs` — compact per-player opportunity ledger.
- `peer-baseline-v1.mjs` — deterministic same-spec/class/role fallback hierarchy.
- `reliability-engine-v1.mjs` — component scoring, confidence, publication gates, score trace and comparison safety.

Technical contracts:

- `docs/RELIABILITY-CONTRACT-V1.md`
- `docs/RELIABILITY-DATA-INTEGRITY-V1.md`

The first deployment runs in **shadow mode**. `value` stays `null` until the publication gates prove enough player-specific mechanic/defensive/duty denominators and longitudinal identity coverage.
