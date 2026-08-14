# v3 migration guardrails

1. `golden-master/` is immutable.
2. Production/development deploy continues to publish the exact Golden `main.js` + `main.css` until source UI passes browser pixel regression on all 9 screens.
3. `apps/web/src/` is a deterministic split of the Golden React functions, not a redesign.
4. No metric/table/card is deleted to make integration easier. Unsupported values remain present and are marked pending until a real engine supplies them.
5. Flexible WCL JSON ends in `server/wcl/normalization`; React never parses it.
6. New domain logic is forbidden in `server/legacy-v2/` and Netlify Function files.
7. Boss-specific logic is forbidden outside `server/rule-packs/`.
8. Intelligence must expose source, confidence and evidence.
9. Netlify Blobs/Postgres are adapters; analyzers never depend on storage implementation.
10. A source-built frontend cannot become the publish target until visual regression is green.
