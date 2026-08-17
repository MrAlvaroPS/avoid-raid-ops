# ADR 0004 — Legacy WCL runtime ownership

Status: accepted during the pre-4.0 repository reorganization.

## Problem

`public/wcl-runtime.js` is still active, but its historical shape hides several different kinds of code in one file: shared DOM/format helpers, WCL fetch orchestration, screen writers, Data Truth guards, Corpus controls and writers that have already been superseded by newer domain runtimes.

Treating the whole file as either "legacy" or "owner" is unsafe. Deleting it would lose active behavior; allowing it to remain an undefined catch-all would let ownership drift back into a monolith.

## Decision

`config/legacy-runtime-ownership.mjs` classifies every named function declaration in `public/wcl-runtime.js` into a named product/domain responsibility with an explicit status, canonical owner and retirement path.

`scripts/verify-legacy-runtime-ownership.mjs` extracts function declarations from the active file and fails when:

- a function is unclassified;
- the manifest references a function that no longer exists;
- a function belongs to two responsibilities;
- an ownership bucket is vague (`misc`, `other`, `unknown`);
- `wcl-runtime.js` is promoted from compatibility authority;
- a known primary owner loses its ownership relationship.

This first stage is intentionally observational: it does not move or delete runtime behavior.

## Progress is the first retirement candidate

Four Progress functions remain physically present in the compatibility runtime:

- `applyProgressPage`
- `applyProgressCurve`
- `applyHistoryData`
- `applyRealProgressMatrix`

They are not the active Progress owner. `public/progress-runtime-v3713.js` loads after the compatibility runtime and wraps those exact global functions so they do nothing while the strategic Progress screen is active. Its declared policy remains `single-progress-writer`.

That existing handoff makes Progress the safest first domain for physical retirement from `wcl-runtime.js`, but removal will be a separate gated change. The next stage must prove the canonical Progress runtime no longer needs wrapper interception before those legacy functions are deleted.

## Other domains

Players and Mechanics already have newer primary runtimes, but the compatibility monolith still supplies supporting telemetry/presentation behavior to them. They are therefore classified as compatibility support rather than falsely declared dead.

Live, Pull Lab, Damage & Healing, Composition and parts of Command Center still rely directly on compatibility writers and need source-native owners before their writers can leave the monolith.

Corpus functions remain classified for architectural cleanup only. This ADR does **not** resume Corpus enrichment, rebuilds, WCL probing or Blob-heavy operations.
