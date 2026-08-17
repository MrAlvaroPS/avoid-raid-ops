# v4.0.0 migration guardrails

These rules apply to the repository reorganization on `refactor/reorganizacion-2026-08-17`.

1. `golden-master/` is immutable.
2. `main` remains the Vercel production branch. The refactor branch must not be treated as production and must not require Vercel preview deployment to validate migration work.
3. `4.0.0` is the target stable release, not the in-progress package/product version. Do not declare the repository stable `4.0.0` until the final release gate is green.
4. `apps/web/src/` is the canonical destination for authored frontend code. Migration is a structural refactor, not permission to redesign the product.
5. No metric/table/card is deleted to make integration easier. Unsupported values remain present and are explicitly pending/N/A until a real engine supplies them.
6. Flexible WCL JSON ends in `server/wcl/normalization`; React never parses it as domain truth.
7. Metric/evidence contracts do not silently change formulas, populations, eligibility, denominators, null policy or confidence semantics during structural migration.
8. New domain logic is forbidden in `server/legacy-v2/`, `old/`, quarantined browser runtimes and deployment-specific compatibility files.
9. Netlify is not an active deployment target. Netlify-only assets are quarantine/removal candidates after reference checks; new Netlify dependencies are forbidden.
10. Boss-specific logic is forbidden outside `server/rule-packs/`.
11. Iris intelligence must expose/retain source, confidence, evidence and provenance semantics. Iris consumes analytical domains; it does not become the WCL parser or silently redefine Progress/Reliability.
12. Storage remains behind adapters/repositories; analyzers do not depend directly on a storage vendor implementation.
13. Active code must never import from `old/` or `old/quarantine/`.
14. Release-number filenames are not created for ordinary implementation changes. Versions remain in filenames/identifiers only for genuine contracts, persisted models or compatibility boundaries.
15. Every migration batch must be reversible and validated before the next ownership boundary is removed.
16. A source-built frontend cannot become the sole publish target until visual regression, data-truth, architecture, reconstruction, unit and Vercel build gates are green.
17. The final `4.0.0` merge happens only after the complete stability checklist in `CHANGELOG.md` passes.
