# AvoiD Raid Ops — v3.7 Encounter Discovery Engine

AvoiD Raid Ops is a raid-operations intelligence layer over Warcraft Logs. The recovered Golden Master remains the visual/UX reference; production values must be REAL, DERIVED, or explicitly PENDING/N/A.

## v3.7 objective

The Encounter Intelligence Corpus is no longer intended to learn a boss as a flat list of frequent abilities. v3.7 learns reusable semantic relationships so encounter support can scale across bosses, difficulties and seasons without hand-authoring every rule.

Key additions:

- generic mirrored/opposite mechanic family discovery,
- inferred player-state dimensions,
- state-aware mechanic classification,
- cast → enemy aura failure relations,
- kill-vs-wipe contrast,
- guild/uploader-isolated train/holdout validation,
- stronger publication safety gates,
- **Boss Learned %** with DATA / HOLDOUT / SIGNALS / SEMANTICS / DIVERSITY components,
- recommendation-driven enrichment,
- `RECOMPILE · 0 WCL` to reuse the existing persistent Blob corpus with a newer compiler,
- live `resumeAt` countdown during WCL quota sleeps.

The Boss Learned percentage is an evidence-weighted model-maturity score, not a claim that a literal percentage of all encounter mechanics is known.

The curated Belo'ren pack remains a safe fallback until a generated model passes all statistical, semantic and unresolved-signal gates.

## Deployment

See:

- `VERCEL-DEPLOY.md`
- `V3.7-ENCOUNTER-DISCOVERY.md`
- `V3.7-CHANGES.md`
- `V3.7-VERIFICATION.md`

The existing v3.6 Private Blob corpus should **not** be rebuilt after deploy. Use `RECOMPILE · 0 WCL` first and enrich only if the v3.7 model says data—not semantics—is the limiting factor.

## Source layout

- `routes/api/wcl/` — Nitro routes; public URL remains `/api/wcl/*`
- `workflows/` — durable hosted corpus orchestration
- `server/corpus/` — provider-neutral corpus, discovery engine and compiler
- `server/wcl/` — WCL client/queries
- `server/analysis/` — pull/mechanic/root-cause engines
- `apps/web/` — reconstructed maintainable React source
- `public/` — Golden-compatible production assets consumed by root Vite app
- `golden-master/` — immutable visual truth
- `tests/` — unit/data-truth/architecture checks

The original surviving prototype is never a deploy target from this package.
