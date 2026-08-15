# Progress metrics changelog

## 1.0.0 — AvoiD Raid Ops v3.7.11

- Establishes `progress-model-v1` as the canonical strategic encounter-history model.
- Moves strategic formulas out of browser rendering and into a reusable server module.
- Adds stable metric IDs via `progress-metric-registry-v1.mjs`.
- Adds canonical invariants for total pulls, night sums and global numbering.
- Adds exact-100% WCL progress diagnostics instead of silently rewriting source data.
- Adds weak-baseline guardrail for Night Retention (`>=97.5%` closing median is not a useful retained-depth baseline).
- Defines raid throughput as pulls per active hour with gaps >=30 minutes excluded from active time.
