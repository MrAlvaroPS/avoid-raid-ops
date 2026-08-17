# AvoiD Raid Ops — v3.7 Encounter Discovery Engine

AvoiD Raid Ops is a raid-operations intelligence layer over Warcraft Logs. The recovered Golden Master remains the visual/UX reference; production values must be REAL, DERIVED, or explicitly PENDING/N/A.

## Mandatory WCL context

Before changing corpus acquisition, Iris enrichment, Reliability, Live, player evidence, or adding a Warcraft Logs query, read **`WCL-QUERY-PLAYBOOK.md`**.

The standing rule is: **WCL is a queryable evidence store, not merely a source of whole reports.** Prefer persisted evidence first, then exact fights/tables, then query-guided Deep, then surgical ability/actor/time-window probes. Do not spend broad event bandwidth when a narrower trustworthy query can answer the question.

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
- query-guided Deep using exact fight IDs from trusted cached Wide reports,
- surgical WCL probes kept separate from canonical Deep coverage,
- `RECOMPILE · 0 WCL` to reuse the existing persistent corpus with a newer compiler,
- local Iris worker with persistent checkpoints outside Vercel,
- live `resumeAt` countdown during WCL quota sleeps.

The Boss Learned percentage is an evidence-weighted model-maturity score, not a claim that a literal percentage of all encounter mechanics is known.

The curated Belo'ren pack remains a safe fallback until a generated model passes all statistical, semantic and unresolved-signal gates.

## Deployment

See:

- `VERCEL-DEPLOY.md`
- `GIT-DEPLOYMENT.md`
- `WCL-QUERY-PLAYBOOK.md`
- `IRIS-ARCHITECTURE.md`
- `V3.7-ENCOUNTER-DISCOVERY.md`
- `V3.7-CHANGES.md`
- `V3.7-VERIFICATION.md`

Do not rebuild a persistent corpus blindly. Use `RECOMPILE · 0 WCL` first and let the current model/evidence deficits choose the next query strategy.

## Source layout

- `routes/api/wcl/` — Nitro routes; public URL remains `/api/wcl/*`
- `workflows/` — durable hosted corpus orchestration
- `scripts/iris-local-worker.mjs` — persistent local corpus worker
- `server/corpus/` — provider-neutral corpus, sampling, query-guided acquisition, discovery engine and compiler
- `server/wcl/` — WCL client/queries
- `server/analysis/` — pull/mechanic/root-cause engines
- `apps/web/` — reconstructed maintainable React source
- `public/` — Golden-compatible production assets consumed by root Vite app
- `golden-master/` — immutable visual truth
- `tests/` — unit/data-truth/architecture checks

The original surviving prototype is never a deploy target from this package.
