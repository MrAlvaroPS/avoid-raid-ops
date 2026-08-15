# Progress metrics engine

The implementation in this directory is intentionally split into:

- `raid-sessions.mjs` — analytical pull deduplication and raid-session clustering.
- `progress-metrics-v1.mjs` — pure, boss-agnostic canonical progression calculations.
- `progress-metric-registry-v1.mjs` — stable semantic IDs and consumer metadata.

The normative formula/parameter contract is `docs/PROGRESS-METRICS-CONTRACT.md`.

Do not add page-specific copies of these calculations. A new interpretation receives a new metric ID/version rather than changing an existing metric silently.
