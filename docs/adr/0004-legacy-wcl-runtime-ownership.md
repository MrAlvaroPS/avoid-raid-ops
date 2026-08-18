# ADR 0004 — Legacy WCL runtime ownership

Status: accepted during the pre-4.0 repository reorganization.

## Problem

`public/wcl-runtime.js` is still active, but its historical shape hides several different kinds of code in one file: shared DOM/format helpers, WCL fetch orchestration, screen writers, Data Truth guards, Corpus controls and functions intercepted by newer domain runtimes.

Treating the whole file as either "legacy" or "owner" is unsafe. Removing it wholesale would lose active behavior; allowing it to remain an undefined catch-all would let ownership drift back into a monolith.

## Decision

`config/legacy-runtime-ownership.mjs` classifies every named function declaration that remains in `public/wcl-runtime.js` into a named product/domain responsibility with an explicit status, canonical owner and retirement path.

`scripts/verify-legacy-runtime-ownership.mjs` extracts function declarations from the active file and fails when:

- a function is unclassified;
- the manifest references a function that no longer exists;
- a function belongs to two responsibilities;
- an ownership bucket is vague (`misc`, `other`, `unknown`);
- `wcl-runtime.js` is promoted from compatibility authority;
- a known primary owner loses its ownership relationship.

Physical retirement is allowed only after the replacement owner has been isolated, browser-validated and explicitly approved.

## Progress interception and physical retirement

`public/progress-runtime-v3713.js` retains historical interception knowledge for five global functions:

- `applyProgressPage`
- `applyProgressCurve`
- `applyHistoryData`
- `applyRealProgressMatrix`
- `neutralizeMissingHistory`

All five declarations are now physically absent from `public/wcl-runtime.js`.

`applyProgressPage` and `applyRealProgressMatrix` were retired after the canonical Progress runtime demonstrated independent rendering. `applyProgressCurve` and `applyHistoryData` required an additional shadow checkpoint because Command Center still consumed their behavior.

That cross-screen behavior now belongs to the passive `public/command-center-history-bridge-v4.js` migration bridge. The bridge:

- consumes the already-loaded `window.__AVOID_WCL__` and `window.__AVOID_WCL_HISTORY__` payloads;
- owns only the Command Center progression curve and cross-night `What changed?` presentation;
- issues no additional WCL/network request;
- creates no timer, polling loop, `MutationObserver` or animation loop;
- loads after the compatibility runtime and before the canonical Progress runtime.

The compatibility monolith therefore calls the extracted behavior only through optional global bindings (`window.applyProgressCurve?.()` and `window.applyHistoryData?.()`). The canonical Progress runtime may continue to wrap historical names as an active-screen safety guard even when declarations no longer exist in the monolith.

Interception remains an ownership/safety mechanism, not evidence by itself that arbitrary compatibility code is removable. Every physical retirement still requires caller analysis and a validated replacement.

## Missing-history physical retirement

`neutralizeMissingHistory` completed the same shadow-first retirement process rather than being removed on assumption.

Before retirement, canonical `public/progress-runtime-v3713.js`:

- took explicit ownership of the missing-history policy in its runtime metadata;
- rendered `Raid-session history unavailable · no Golden fallback` and the corresponding neutral night rows itself;
- consumed only the already-loaded `window.__AVOID_WCL_HISTORY__` state;
- added zero direct network requests;
- suppressed the compatibility writer only while the Progress screen was active.

The shadow checkpoint at `8202dca10abe420b4288f27797851a6def3bba8c` passed the repository `AvoiD Validation` gate. The Vercel status at that checkpoint was limited by deployment quota rather than a repository test failure.

After that validation and explicit continuation approval, both the `neutralizeMissingHistory` declaration and its `applySupplemental()` call were retired from `public/wcl-runtime.js`. Missing-History presentation is now exclusively a canonical Progress responsibility. The historical interception name remains recorded in Progress during the v4 migration as a defensive compatibility guard, but there is no current compatibility writer left for it to suppress.

## Other domains

Players and Mechanics already have newer primary runtimes, but the compatibility monolith still supplies supporting telemetry/presentation behavior to them. They remain compatibility support until those dependencies are isolated and validated.

Live, Pull Lab, Damage & Healing, Composition and parts of Command Center still rely directly on compatibility writers and need source-native owners before their writers can leave the monolith.

Corpus functions remain classified for architectural cleanup only. This ADR does **not** resume Corpus enrichment, rebuilds, WCL probing or Blob-heavy operations.
