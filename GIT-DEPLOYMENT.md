# Git / CI deployment path

The v3.5.1 package is not only a Netlify Drop bundle. It is a complete project
root that can be committed to Git and connected directly to Netlify.

## Current safe production path

Keep `netlify.toml` as the Netlify configuration. It publishes the recovered
Golden-compatible frontend in `deploy-preview/public` and deploys the Functions
from `netlify/functions`.

This path requires no local frontend compilation during Netlify deploy and is
therefore suitable for Git-based deployment immediately.

## Environment variables

Configure in the Netlify site:
- `WCL_CLIENT_ID`
- `WCL_CLIENT_SECRET`

Never commit either value.

## Source-owned React frontend

`apps/web/src` is maintained alongside the compatibility deployment, including
WCL API client/data hook and current Composition logic. The alternate
`netlify.source-ui.toml` builds `apps/web` with Vite, but it must **not** replace
the active publish target until all nine screens pass visual and Data Truth
parity.

The migration is intentionally reversible: backend/domain work is shared, while
switching the UI publish target is a separate decision.

## v3.5.1 persistent corpus

The full Git project includes `server/corpus/` and the `/api/wcl/corpus` Function. Corpus checkpoints/models live in the site-wide Netlify Blobs store and therefore survive Git-triggered deploys of the same Netlify site. v3.5.1 also resolves the WCL partition before choosing the persistent corpus key and refuses to mix later partitions into an existing model.
