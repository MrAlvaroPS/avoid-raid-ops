# Encounter rule packs

One directory per encounter/partition.

These packs are **application/evaluation fallbacks only** for report-scoped analysis when no published generated encounter model is available. They may contain encounter-specific IDs and semantics, but they do not train, validate, stabilize, hold out, or promote GLOBAL BOSS knowledge.

GLOBAL BOSS learning (`server/corpus`, official/structural knowledge, semantic probes, Matched Null, Evidence Groups, Stability, Holdout and later Promotion) must never import these packs or depend on their constants.

The preferred product path is always the generated/published encounter model. Curated packs are legacy/fallback behavior and must not become learning shortcuts.
