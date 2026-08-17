# AvoiD Raid Operations documentation

This directory is the canonical documentation home for the 4.0.0 repository structure. Existing root/versioned documents are migrated here incrementally; do not delete or rewrite a legacy document until references and historical value have been checked.

## Canonical areas

- `architecture/` — system boundaries, frontend/backend structure, data flow and deployment.
- `iris/` — Iris architecture, knowledge contracts, corpus/research and operational decision intelligence.
- `progress/` — Progress scope, metric contracts, data integrity and presentation rules.
- `reliability/` — Reliability contracts, evidence/data integrity and shadow/implementation status.
- `operations/` — local development, Vercel deployment and WCL operational playbooks.
- `adr/` — architectural decision records.
- `archive/` — historical release/verification material retained for reference but not treated as current architecture.

## Documentation rules

1. Current architecture has one canonical document per topic.
2. Release history belongs in `/CHANGELOG.md`, not in new `V*-CHANGES.*` files.
3. Generated verification output belongs in CI artifacts where practical, not as a new root file for every release.
4. Version suffixes are retained only when they identify a real contract/model compatibility boundary, not merely the application release that introduced a file.
5. Historical documents are archived before deletion when they still contain evidence that is not represented elsewhere.
6. Documentation must preserve the product invariants: WCL is combat truth; observed/derived/pending remain distinguishable; Iris intelligence exposes evidence/confidence/provenance; encounter-specific knowledge remains inside rule packs.
