# Changelog

All meaningful product changes are recorded here. Git history remains the detailed implementation history; release-specific `V*-CHANGES.*` files are legacy documentation and will be consolidated during the 4.0.0 repository refactor.

## [Unreleased] — target 4.0.0

### Repository refactor

- Started the 4.0.0 repository reorganization on `refactor/reorganizacion-2026-08-17`.
- `4.0.0` is the release target, not an in-progress version claim. The product/package version must not be changed to `4.0.0` until the refactor is complete and all required stability gates are green.
- `main` remains the production branch and is not modified by migration work until the refactor is ready to merge.
- Netlify is no longer part of the deployment architecture; Netlify-only files are migration candidates for quarantine/removal after reference checks.
- The Golden Master remains immutable and continues to define visual fidelity during the migration.

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
