# External enrichment

External knowledge providers do not replace Warcraft Logs as the combat source of truth.

`wowhead.mjs` creates stable link/tooltip references for item and spell IDs already observed in WCL. Exact item/spell IDs use Wowhead entity links. Talent node/entry IDs that cannot be proven to be spell IDs use an explicit Wowhead search fallback.

No scraper is required by the runtime and no Wowhead failure can change a WCL metric.
