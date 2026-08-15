# Iris Progress metrics — active contract

**Active production target from v3.7.12:** `progress-model-v2` / metrics `2.0.0`.

Normative specification: [`PROGRESS-METRICS-CONTRACT-V2.md`](./PROGRESS-METRICS-CONTRACT-V2.md)  
Data-integrity and audit workflow: [`PROGRESS-DATA-INTEGRITY-V2.md`](./PROGRESS-DATA-INTEGRITY-V2.md)  
Implementation: `server/analysis/progression/progress-metrics-v2.mjs`  
Semantic registry: `server/analysis/progression/progress-metric-registry-v2.mjs`

`PROGRESS-METRICS-CONTRACT.md` and the `*-v1.mjs` modules are retained as **historical v1 semantics only**. New consumers must not import v1 unless they deliberately need historical comparison/replay.

## Reuse rule

A metric name is not enough. Consumers must use the exact versioned semantic metric ID from the active registry. If population, denominator, threshold or null/eligibility behavior changes, the semantics must be versioned instead of silently replacing an existing metric.

This index is the starting point for developers resuming Progress work so the active contract is unambiguous.
