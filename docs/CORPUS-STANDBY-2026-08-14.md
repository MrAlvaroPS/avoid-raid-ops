# Iris corpus standby checkpoint — 2026-08-14

This document is the canonical restart point for the AvoiD Raid Operations encounter-research corpus while Vercel Blob is unavailable.

## Why the corpus is paused

The Vercel Hobby Blob store `avoid-raid-ops-blob` reached operation limits. The Vercel dashboard showed:

- Storage: 78.1 MB
- Storage average: 39.2 MB / 1 GB
- Simple Operations: **15.1k / 10k**
- Advanced Operations: **2.6k / 2k**
- Data Transfer: 1.31 GB / 10 GB
- Dashboard message: access resumes on **13/9/26** unless the plan/storage situation changes earlier.

The blocking resource is therefore Blob operation count, not storage capacity or data transfer.

Do not reset the corpus and do not blindly retry hosted corpus actions while this store is blocked.

## Research state when paused

Current research encounter:

- Encounter: Belo'ren, Child of Al'ar
- Encounter ID: 3182
- Difficulty: Mythic / WCL difficulty 5
- Architecture scope: `encounterId + difficulty + WCL partition`
- Belo'ren is a validation encounter only; the research engine remains generic and multi-encounter.

Last accessible Encounter Corpus presentation after the Wide run:

- Boss Learned: **87% · MATURE**
- Relations: **75%**
- Deep Reports: **58 / 50**
- Holdout: **53 / 50**
- WCL budget snapshot: **2053 / 3600**
- Next recommendation shown: **Reports First**
- Remaining report breadth shown: **5 Wide reports · 0 holdout reports**
- Signals: **84%**
- Validation: **87%**
- Data Depth: **100%**
- Accepted mechanics: **38**
- Rejected mechanics: **183**
- Publication gates still open: **1**
- Temporal relations: **6 verified · 44 unverified · 50 raw hypotheses**
- Deep origin provenance: **137 abilities with evidence · 38 encounter-side · 49 friendly-player**
- Relation provenance: **6 origin-verified · 11 friendly/noisy · 33 awaiting origin evidence**

Important: the Wide pull run finished, but the final report gate still displayed a deficit of five distinct Wide reports. The model was **not successfully recompiled after Blob access became blocked**, so these are the last accessible live/model diagnostics, not a guarantee that a hypothetical final recompile would produce exactly the same score.

## What was already fixed before standby

The latest deployed model policy before standby is v3.7.6 / relation-provenance-v2 on top of the v3.7.5 compiler policy.

Key protections already in place:

- Player/talent/item contamination is filtered by encounter-origin evidence.
- Friendly-player auras do not count as encounter temporal relations.
- Relation-derived mechanics require origin-verified cast → aura evidence.
- Light/Void encounter state structure can be retained without making unsupported player-level blame scoreable.
- Train/holdout remains source isolated.
- Publication remains under manual-review hold.
- Corpus and generated models are scoped per encounter/difficulty/partition.

## What remains when corpus work resumes

Resume in this order rather than starting a blind enrichment run:

1. Restore/migrate persistent corpus access without changing the corpus identity semantics.
2. Export or migrate the existing Vercel raw profiles if they are still needed; do not assume the local machine automatically has the current Blob contents.
3. Replace the hosted hot-path design with a local/persistent research store where operation counts are not a practical bottleneck.
4. Keep raw Wide/Deep profiles as cold evidence and maintain compact incremental encounter aggregates as warm state.
5. Make normal `RECOMPILE · 0 WCL` compile from the compact aggregate/model rather than listing/downloading every raw report profile.
6. Keep `FULL REBUILD FROM RAW CORPUS` as an explicit maintenance/migration operation.
7. Recompile the existing Belo'ren evidence first and inspect the publication gates.
8. If the five-Wide-report deficit remains, prioritize **distinct reports/sources**, not arbitrary additional pulls.
9. Then target the unresolved relation-provenance bottleneck: 44 temporal hypotheses were still unverified, with 33 awaiting origin evidence in the last accessible diagnostics.
10. Only after validation should the generated encounter model be eligible for production/live Iris decisions.

## Multi-encounter invariant

Corpus work must scale to every raid boss and future tiers. The intended hierarchy is:

```text
raid / tier
  ├─ encounter A
  │   ├─ raw Wide/Deep evidence
  │   ├─ compact aggregate
  │   ├─ generated model
  │   ├─ validation state
  │   └─ model history
  ├─ encounter B
  │   └─ ...
  └─ encounter N
      └─ ...
```

No generic research/compiler/live code should contain Belo'ren-specific behavior. Encounter-specific curated rules, if any, remain separate evaluation/fallback material and may not leak into generated inference.

## Storage redesign learned from the Vercel limit

The current hosted implementation generated too many small Blob operations. In particular, full recompilation lists raw profile keys and downloads every Wide/Deep JSON again. This does not scale economically to a full raid tier.

Target storage path:

```text
raw Wide/Deep profiles (cold/archive)
        ↓ incremental merge while ingesting
compact encounter aggregate (warm research state)
        ↓ compiler
versioned generated encounter model (hot production state)
        ↓
Iris live raid intelligence
```

A normal status/model UI read should require a tiny number of reads and should never enumerate all raw evidence.

## Product identity / north star

- Product: **AvoiD Raid Operations**
- Intelligence layer: **Iris**
- Raid Leader / primary live operator: **Onie**
- End goal: improve raid organization and decisions **before, during and after raid**, with the highest-value loop being the actionable brief between progression pulls.

## External log-derived reference products

The project has previously discussed several external websites/tools that derive useful analysis from combat logs. Treat those references as product-research inputs when designing each section. Their exact list is intentionally not reconstructed here from memory; add the literal URLs/names to a dedicated reference document when they are next supplied so Iris does not depend on an informal conversation record.
