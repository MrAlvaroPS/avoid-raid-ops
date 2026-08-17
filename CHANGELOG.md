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

### Mainline integration — v3.9.0 to v3.9.2

The 4.0.0 refactor baseline has been updated to preserve the developments merged to `main` after the Phase 3 branch was created. Their current stable release identity remains `3.9.2`; this integration does not claim 4.0.0.

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
