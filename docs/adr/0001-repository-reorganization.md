# ADR 0001 — Repository reorganization for 4.0.0

- **Status:** Accepted
- **Date:** 2026-08-17
- **Target release:** 4.0.0
- **Migration branch:** `refactor/reorganizacion-2026-08-17`

## Context

AvoiD Raid Operations has accumulated multiple release-suffixed browser runtimes, CSS overlays, verification files and deployment remnants while the maintainable React source, server analysis modules and Iris research/knowledge systems evolved in parallel. This made ownership difficult to determine and created risk of double-writers, stale runtime code and release-number coupling in filenames.

Netlify is no longer part of the active deployment architecture. Development is local, GitHub is the source repository, and Vercel deploys production from `main`.

The repository already contains strong boundaries worth preserving: `apps/web/src` for reconstructed React source, `server/wcl` for WCL access/normalization, `server/analysis` for analytical domains, `server/rule-packs` for encounter-specific knowledge, and package foundations for contracts/domain/scoring.

## Decision

The 4.0.0 refactor will finish that architecture rather than replace it with a new framework.

### Frontend

`apps/web/src` becomes the canonical authored frontend. Hand-authored release runtimes in root `public/` are retired incrementally only after their responsibilities have been migrated and regression-tested. `public/` ultimately contains static assets rather than parallel application implementations.

### Styling

Release-suffixed CSS overlays are first consolidated without visual change, then split into maintainable source modules. The browser build may emit bundled/hashed CSS; source files are not versioned by product release number.

### Analysis and scoring

`server/analysis` owns evidence construction and analytical domain logic. Pure reusable scoring/formula logic is moved toward `packages/scoring` where doing so preserves the existing contracts. React must not independently recalculate canonical Progress or Reliability values.

### Iris

Iris remains the evidence-to-decision intelligence layer. It consumes analytical outputs rather than absorbing WCL normalization, Progress, Reliability or encounter-specific rules into a monolith. Research/corpus, knowledge and decision/orchestration responsibilities will receive explicit boundaries during migration.

### Encounter knowledge

Encounter-specific curated logic remains in `server/rule-packs/encounters`. Generic Iris/corpus/analysis code must remain multi-encounter.

### Versioning

The completed refactor is release **4.0.0**. During migration, the repository must not claim the stable `4.0.0` product version. Release-number filenames are retired unless the version identifies a genuine contract, model or compatibility boundary.

### Deployment

`main` remains the Vercel production branch. Refactor work happens off `main`. Netlify-only deployment assets are quarantine/removal candidates after dependency checks.

### Quarantine

Potentially obsolete files are moved to `old/quarantine/` before deletion when uncertainty remains. Active application code must never import from `old/`.

## Non-negotiable invariants

1. `golden-master/` is immutable.
2. Visual/UX fidelity is preserved unless a separate product decision explicitly changes it.
3. WCL remains combat truth; external enrichment never silently changes observed WCL metrics.
4. Observed, derived, pending/unknown and N/A semantics remain distinguishable.
5. Metric populations, denominators, eligibility, null policy and confidence/evidence rules cannot change silently during structural migration.
6. Boss-specific logic does not leak outside rule packs.
7. Iris claims retain source, confidence, evidence and provenance expectations.
8. No migration step deletes a metric/card/table merely to simplify implementation.
9. `main` is not used as a scratch migration branch.
10. The repository is not released as 4.0.0 until the full stability gate in `/CHANGELOG.md` is green.

## Migration strategy

The refactor proceeds in small reversible batches:

1. establish documentation, changelog, quarantine rules and branch guardrails;
2. remove/quarantine confirmed Netlify-only deployment duplication;
3. establish one application-version owner;
4. consolidate CSS while preserving Golden fidelity;
5. migrate release runtimes into canonical source one ownership boundary at a time;
6. consolidate Progress, Players/Reliability, Corpus and Iris frontend ownership;
7. strengthen package boundaries/contracts/scoring;
8. audit backend version-suffixed implementations for true compatibility requirements;
9. remove quarantine only after dependency, test and build proof;
10. run the final 4.0.0 release gate and merge to `main` only when stable.

## Consequences

The migration may temporarily contain both canonical and quarantined implementations. This is intentional, but the direction of travel is always toward one owner per responsibility. Git history and the changelog become the release history; copies of source files are no longer used as the primary versioning mechanism.
