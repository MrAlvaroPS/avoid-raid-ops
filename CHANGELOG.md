# Changelog

All meaningful product changes are recorded here. Git history remains the detailed implementation history; release-specific `V*-CHANGES.*` files are legacy documentation and will be consolidated during the 4.0.0 repository refactor.

## [Unreleased] — target 4.0.0

### Repository refactor

- Started the 4.0.0 repository reorganization on `refactor/reorganizacion-2026-08-17`.
- `4.0.0` is the release target, not an in-progress version claim. The product/package version must not be changed to `4.0.0` until the refactor is complete and all required stability gates are green.
- `main` remains the production branch and is not modified by migration work until the refactor is ready to merge.
- Netlify is no longer part of the deployment architecture; Netlify-only files are migration candidates for quarantine/removal after reference checks.
- The Golden Master remains immutable and continues to define visual fidelity during the migration.
- Added canonical documentation and ADR boundaries for the 4.0.0 migration, plus `old/` quarantine rules that forbid active-code imports.
- Quarantined the obsolete `deploy-preview/` Netlify tree byte-for-byte and removed it from the active repository layout.
- Archived the obsolete root Netlify deployment guide and quarantined the unused Netlify storage adapter.
- Detached Golden, Data Truth and unit/regression verification from `deploy-preview/`; active verification now targets the Vercel/runtime asset tree.
- Promoted Golden, architecture, reconstruction and browser Data Truth checks into the normal CI gate and pinned the browser verifier dependency for reproducibility.
- Fixed a Linux case-sensitive Golden reconstruction check by falling back to the immutable Golden bundle when a historical extracted symbol collides by case.
- Reconciled the legacy WCL runtime ownership audit into the canonical refactor branch. Every legacy writer/helper now has an explicit domain, owner and retirement state.
- Established one active-asset manifest and one generated compatibility CSS transport while retaining the reviewed historical CSS source layers for visual-equivalence verification.
- Began physical legacy-runtime decomposition with one passive Command Center bridge. It consumes the already-loaded report and History payloads, owns only Command Center `What changed?` plus the Command Center progression curve, and adds no network request/timer/observer/animation loop. After two green shadow checkpoints and explicit approval, the legacy `applyProgressCurve` and mixed `applyHistoryData` declarations were physically retired; `wcl-runtime.js` now delegates those two responsibilities through optional bridge bindings. `neutralizeMissingHistory` remains the only Progress-specific compatibility function pending transfer to the canonical Progress owner.
- The physical-retirement implementation is anchored at commit `daadb4b700001845b44082157dab9e0eb8547579`; the following documentation-only push exists to exercise the normal full CI gate on that same functional tree.

### Mainline integration — v3.9.0 to v3.9.2

The 4.0.0 refactor baseline was updated to preserve the developments merged to `main` after the Phase 3 branch was created. Their stable release identity at that checkpoint was `3.9.2`; this integration did not claim 4.0.0.

Preserved developments include:

- Data Hub and its real-data/runtime ownership work;
- Players/Reliability evidence and dossier improvements, including the v3.9.2 dossier-header hotfix;
- Iris capability, operations and external-source registries;
- Knowledge Store/revision boundaries and report-catalog functionality;
- live-log controls and release-critical UI/ownership/spacing guards;
- canonical Deep top-up, signal triage and local mechanic synthesis;
- boss-agnostic learning and semantic/surgical probe planning/execution paths;
- the new release-critical regression suite and associated documentation/contracts.

Integration rules deliberately keep the Phase 3 architecture stronger than the pre-refactor layout: Netlify remains quarantined, tests continue to target active Vercel assets, browser Data Truth remains a CI gate, and the new critical test suite is additive rather than replacing existing verification.

### Mainline integration — v3.9.3 to v3.9.4

The refactor baseline was resynchronized after `main` advanced again. The functional baseline is now **v3.9.4** while 4.0.0 remains only the migration target.

Preserved developments include:

- `provider-aware-ability-knowledge-v1` with fingerprinted, bounded provider preview/resolve semantics;
- read-only Lorrgs boss/spell enrichment, optional server-keyed Parse/Wowhead reference enrichment and opt-in WCL GameData/WorldData static metadata;
- `/api/knowledge/ability` with explicit confirmation for provider execution, WCL budget and Parse credit use;
- `semantic-specificity-verification-v2`, including null/control specificity, actor topology, temporal consistency and provider-aware provenance;
- zero-WCL stored semantic re-verification using persisted diagnostic evidence and cached outer-flank controls;
- Iris source registry v2 and v3.9.4 capability contract;
- explicit invariants that provider metadata adds zero canonical Deep coverage, zero direct score delta and no automatic mechanic promotion.

The integration keeps the v4 route/service boundary: the Nitro semantic-probe route remains transport-only and the v3.9.4 `reverify` policy lives in `server/services/semantic-probe-service.mjs`.

Release-specific `V3.9.3-CHANGES.md` was intentionally not duplicated into the refactor root; its durable release information is consolidated here while the technical Iris contracts remain separately versioned.

### Verified checkpoint — Phase 3 / batch 1

At commit `21963c9b5c92f5745b4943f9aa190e99911dfbb6` the refactor branch passes:

- immutable Golden verification;
- architecture/quarantine verification;
- source reconstruction verification;
- browser Data Truth validation across all nine protected screens;
- all 244 unit/regression tests;
- the production Vercel build contract.

This checkpoint does **not** mean the refactor is complete or that the application is 4.0.0. It establishes the green baseline required before ownership/CSS/runtime consolidation begins.

### Stability gates before 4.0.0

The refactor may be called `4.0.0` only when all of the following are true:

- unit, architecture, data-truth and reconstruction verification pass;
- Golden Master / visual regression checks pass for all protected screens;
- Vercel production build succeeds from the final `main` candidate;
- WCL report ingestion and normalization retain existing data-truth semantics;
- Progress and Reliability retain their canonical contracts and denominators;
- Iris retains evidence, confidence and provenance guarantees;
- no application code imports from `old/` or quarantine paths;
- no active runtime depends on Netlify-only deployment files;
- the source frontend has a single owner for each migrated UI/data responsibility, with legacy double-writers removed or explicitly isolated.
