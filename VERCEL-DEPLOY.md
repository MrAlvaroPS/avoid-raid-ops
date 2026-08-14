# AvoiD Raid Ops v3.7 — Vercel deployment

v3.7 keeps the successfully deployed Vite + Nitro + Vercel Workflow architecture and upgrades only the research/compiler layer plus additive corpus UI.

## Required

Environment variables:

- `WCL_CLIENT_ID`
- `WCL_CLIENT_SECRET`

Storage:

- one **Private Vercel Blob** store connected to the project
- project-scoped OIDC is supported; legacy `BLOB_READ_WRITE_TOKEN` stores remain compatible

Optional:

- `WCL_REPORT_CODE`
- `WCL_GUILD_ID`
- `ANALYSIS_VERSION=3.7.0`

## Vercel project settings

Use defaults/auto-detection:

- Node: 22.x
- Build: `npm run build`
- Output Directory: blank/default
- Framework: Vite/Nitro auto-detected

Do not add a root source `api/` directory. Nitro handlers live in `routes/api/wcl/` while public URLs remain `/api/wcl/*`.

Workflow is integrated only through `workflow/nitro` in `nitro.config.js`. Do not add `workflow/vite`.

## Post-deploy order

1. `/api/wcl/report`
2. `/api/wcl/telemetry`
3. `/api/wcl/history`
4. `/api/wcl/intelligence`
5. `/api/wcl/corpus?encounter=3182&action=health`

Expected corpus health includes:

- `engineVersion: "3.7.0"`
- `corpusBuilder: "vercel-workflow"`
- durable workflow enabled
- `vercel-blob-private`
- persistent + consistent reads

## Existing v3.6 corpus: do not rebuild it

After the health check, open Mechanics. The existing Private Blob corpus is intentionally reused.

Press:

`RECOMPILE · 0 WCL`

This must not spend WCL quota. It rebuilds the aggregate and candidate with the v3.7 Encounter Discovery Engine.

Then inspect:

`/api/wcl/corpus?encounter=3182&action=model`

Check for:

- `engineVersion: "3.7.0"`
- `schemaVersion: 2`
- `corpus.splitPolicy: "source-isolated-train-holdout"`
- `learning.scorePct`
- `learning.components`
- `learning.enrichmentRecommendation`
- `discovery.stateDimensions`
- `discovery.variantFamilies`
- represented/train/validation source counts

Only enrich after reviewing the model recommendation. New v3.7 Deep profiles collect enemy Buff/Debuff streams that old v3.6 profiles did not, so relation-driven mechanics may require targeted Deep enrichment.
