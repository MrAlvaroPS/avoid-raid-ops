# ADR 0004 — Legacy WCL runtime ownership

Status: accepted during the pre-4.0 repository reorganization.

## Problem

`public/wcl-runtime.js` is still active, but its historical shape hides several different kinds of code in one file: shared DOM/format helpers, WCL fetch orchestration, screen writers, Data Truth guards, Corpus controls and functions intercepted by newer domain runtimes.

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

## Progress interception is not the same as safe deletion

`public/progress-runtime-v3713.js` loads after the compatibility runtime and intercepts four global functions while the strategic Progress screen is active:

- `applyProgressPage`
- `applyProgressCurve`
- `applyHistoryData`
- `applyRealProgressMatrix`

However, only three are currently classified as Progress-only physical-retirement candidates:

- `applyProgressPage`
- `applyHistoryData`
- `applyRealProgressMatrix`

`applyProgressCurve` is deliberately excluded from that set. The compatibility implementation is also called by Command Center to render its progression curve, so removing it as if it were dead Progress code would create a cross-screen regression. It remains `shared-compatibility-helper` until that curve is extracted behind an explicit shared or Command Center owner.

This distinction is a migration invariant: interception proves who may write on a screen; it does not by itself prove a function has no callers elsewhere.

## Other domains

Players and Mechanics already have newer primary runtimes, but the compatibility monolith still supplies supporting telemetry/presentation behavior to them. They are therefore classified as compatibility support rather than falsely declared dead.

Live, Pull Lab, Damage & Healing, Composition and parts of Command Center still rely directly on compatibility writers and need source-native owners before their writers can leave the monolith.

Corpus functions remain classified for architectural cleanup only. This ADR does **not** resume Corpus enrichment, rebuilds, WCL probing or Blob-heavy operations.
