# Historical Netlify deployment notes

> Archived during the 4.0.0 repository refactor. Netlify is no longer part of the active AvoiD Raid Operations deployment architecture. This document is retained only as historical migration evidence and must not be followed as current deployment guidance.

---

# Deploy AvoiD Raid Ops v3.5.1 to Netlify

Deploy the ZIP to the existing development Netlify site, not to the surviving
original ChatGPT prototype.

Required environment variables remain:
- `WCL_CLIENT_ID`
- `WCL_CLIENT_SECRET`

No new credential is required.

Validation endpoints:
- `/api/wcl/report`
- `/api/wcl/telemetry?report=28d9xF7GchL6ZPYt`
- `/api/wcl/history?report=28d9xF7GchL6ZPYt&guild=788166`
- `/api/wcl/status`
- `/api/wcl/intelligence?report=28d9xF7GchL6ZPYt`
- `/api/wcl/corpus?encounter=3182&action=health`
- `/api/wcl/corpus?encounter=3182`

The intelligence endpoint is optional to the basic Data Truth boot: if it fails,
core WCL data remains usable and encounter-specific conclusions stay pending.

The corpus pipeline additionally uses the `@netlify/blobs` package declared in the root `package.json`. In hosted Netlify, persistent Blobs storage is mandatory: v3.5.1 refuses a silent local-filesystem fallback. Build progress and generated encounter models persist across deploys on the same Netlify site. After the first BUILD CORPUS action, verify `/api/wcl/corpus?encounter=3182` reports `storage.kind: "netlify-blobs"` and `storage.persistent: true` before allowing a long run.
