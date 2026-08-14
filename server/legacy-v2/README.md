# Legacy v2 compatibility engine

This directory is intentionally quarantined. It preserves the already-working WCL behavior byte-for-behavior while v3 moves logic into the new domain layers.

**Rule:** do not add new product logic here. New queries, normalizers and analyzers go under `server/wcl`, `server/ingestion`, `server/analysis` and `server/rule-packs`. Services may switch individual capabilities from this compatibility engine to v3 modules only after tests prove parity.
