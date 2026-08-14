# Iris corpus standby checkpoint — 2026-08-14

This document is the canonical, detailed restart point for the AvoiD Raid Operations encounter-research corpus while Vercel Blob is unavailable. It is intentionally explicit enough that corpus work can resume later without reconstructing the conversation that produced it.

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

## Blob Observability evidence: where the calls went

The Vercel Blob Observability view supplied at standby showed a very important pattern. The hottest objects were the compact state objects, not individual raw profiles:

| Blob | Transfer out | Downloads |
| --- | ---: | ---: |
| `/avoid-raid-ops-encounter-corpus-v1/aggregates/3182/d5/p4.json` | **775.51 MB** | **3.9K** |
| `/avoid-raid-ops-encounter-corpus-v1/jobs/3182/d5/p4.json` | **425.84 MB** | **4.8K** |
| `/avoid-raid-ops-encounter-corpus-v1/models/3182/d5/p4.json` | **59.43 MB** | **2.9K** |
| individual `/profiles/3182/d5/p4/*.json` examples | ~0.4–0.5 MB each | **7** each |

This makes **excessive aggregate/job/model polling and repeated reads a first-class problem to audit**, in addition to the already-known expense of rebuilding from raw profiles.

Do not assume one source without measuring it when the local redesign starts. Instrument the caller and distinguish at least:

1. browser status/model polling;
2. workflow/job heartbeats and resume checks;
3. corpus API status requests;
4. compiler/recompile reads;
5. enrichment merges/writes;
6. explicit maintenance operations.

For each operation, record logical action, object kind, encounter/difficulty/partition, bytes read/written, cache hit/miss and caller. We need to know **why** an aggregate was downloaded 3.9K times and a job 4.8K times, not merely hide the symptom.

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

The latest encounter-model policy before standby is relation-provenance-v2 on top of the v3.7.5 compiler policy; v3.7.7 subsequently added hosted-storage failure UX/circuit breaking without changing the model policy.

Key protections already in place:

- Player/talent/item contamination is filtered by encounter-origin evidence.
- Friendly-player auras do not count as encounter temporal relations.
- Relation-derived mechanics require origin-verified cast → aura evidence.
- Light/Void encounter state structure can be retained without making unsupported player-level blame scoreable.
- Train/holdout remains source isolated.
- Publication remains under manual-review hold.
- Corpus and generated models are scoped per encounter/difficulty/partition.
- A confirmed Blob storage block stops further browser-side corpus polling for that page session rather than hammering a known-unavailable store.
- Corpus action failures have an explicit visible error state instead of a silent button failure.

## Required normal-recompile I/O contract

This is now a hard architectural target, not an optimization note.

A normal compiler update must use:

```text
RECOMPILE · 0 WCL
        ↓
read 1 aggregate
+ read 1 job/state
+ read 1 model
        ↓
compile / validate
        ↓
write only compact objects that actually changed
```

In plain terms: **`RECOMPILE · 0 WCL` should read 1 aggregate + 1 job + 1 model, not 308 files of raw profiles.**

Normal recompile requirements:

- **0 WCL calls**;
- **0 raw-profile listing operations**;
- **0 raw-profile downloads**;
- no reconstruction of the aggregate from all stored evidence;
- use the persisted compact aggregate as the compiler input;
- preserve source-isolated train/holdout statistics and provenance inside that aggregate in enough detail to re-run the model policy truthfully;
- write aggregate/job/model only when the corresponding content/version actually changed;
- model/status reads should be cacheable/version-addressable and should not repeatedly download unchanged JSON.

The exceptional operation is explicitly separate:

```text
FULL REBUILD FROM RAW CORPUS
        ↓
list/read raw Wide + Deep profiles
        ↓
reconstruct compact aggregate
        ↓
validate aggregate invariants/checksums
        ↓
compile generated model
```

`FULL REBUILD FROM RAW CORPUS` is a **maintenance, migration or recovery operation**. It is not what we do every time a compiler rule changes.

This separation becomes mandatory when Iris expands from one validation boss to every boss in a raid tier.

## Storage/call redesign to review when work resumes

The local/persistent redesign must address both raw-rebuild cost and hot compact-object polling.

Target controls:

- Make the aggregate the durable incremental research state. Every successful Wide/Deep ingest merges its evidence once rather than making later compiler versions reread every profile.
- Keep raw profiles immutable/cold for audit, migration and full rebuild.
- Consolidate ordinary corpus UI status into the smallest practical state object rather than separately downloading aggregate + job + model on every poll when the UI only needs a few fields.
- Use content/version IDs, ETag/If-None-Match or an equivalent local revision check so unchanged state does not move hundreds of kilobytes repeatedly.
- Poll only while a job can actually change. Completed/blocked/idle corpus state should not have a permanent high-frequency poller.
- Back off polling during WCL sleep and long workflow waits.
- Server-side API handlers should avoid internally rereading the same Blob several times in one logical request; share a request-scoped snapshot/cache.
- Do not fetch a full model just to learn job progress. Do not fetch a full aggregate just to draw a progress indicator.
- Expose operation telemetry so a future UI can show “reads/writes this job” and make regressions obvious before a quota is exhausted.
- Add an automated budget regression test around expected store operations for `status`, `recompile`, one Wide merge and one Deep merge.

The Vercel evidence above is a regression test target: a quiet corpus must never generate thousands of downloads of aggregate/job/model objects merely because the app was open.

## What remains when corpus work resumes

Resume in this order rather than starting a blind enrichment run:

1. Restore/migrate persistent corpus access without changing the corpus identity semantics.
2. Before changing formats, export a recoverable inventory of the existing store: object keys, sizes, versions/checksums where available, aggregate/job/model snapshots and raw-profile count. Keep the storage prefix `avoid-raid-ops-encounter-corpus-v1` readable until migration is verified.
3. Export or migrate the existing Vercel raw profiles if they are still needed; do not assume the local machine automatically has the current Blob contents.
4. Preserve the exact scope key: encounter + difficulty + WCL partition. Do not merge bosses/difficulties/partitions into one undifferentiated corpus.
5. Implement and measure the compact-state access path described above, including caller-level operation telemetry.
6. Replace the hosted hot-path design with a local/persistent research store where operation counts are not a practical bottleneck.
7. Keep raw Wide/Deep profiles as cold evidence and maintain compact incremental encounter aggregates as warm state.
8. Make normal `RECOMPILE · 0 WCL` satisfy the 1 aggregate + 1 job + 1 model contract and add a regression test proving it does not enumerate raw profiles.
9. Keep `FULL REBUILD FROM RAW CORPUS` as an explicit maintenance/migration operation and test that it reproduces the compact aggregate/model from raw evidence.
10. Recompile the existing Belo'ren evidence first and inspect the publication gates before consuming more WCL budget.
11. If the five-Wide-report deficit remains, prioritize **distinct reports/sources**, not arbitrary additional pulls.
12. Then target the unresolved relation-provenance bottleneck: 44 temporal hypotheses were still unverified, with 33 awaiting origin evidence in the last accessible diagnostics.
13. Re-audit the Blob-call equivalent under the local store: idle UI, active enrichment, durable sleep, recompile and full rebuild should each have known expected operation counts.
14. Only after validation should the generated encounter model be eligible for production/live Iris decisions.

## Recovery acceptance checklist

Do not call the migration complete until all of these are true:

- Existing Belo'ren aggregate can be loaded under the same encounter/difficulty/partition identity.
- Existing raw profiles have an inventory/checksum or an explicitly documented known subset.
- `RECOMPILE · 0 WCL` produces a model without WCL traffic and without raw-profile enumeration.
- `FULL REBUILD FROM RAW CORPUS` can be run deliberately and produces an equivalent aggregate within documented schema/version rules.
- Source-isolated train/holdout counts survive migration.
- Encounter-origin provenance survives migration.
- Generated model history is versioned rather than silently overwritten with no audit trail.
- Status polling has bounded/readable operation counts.
- A storage error cannot silently appear as a button that does nothing.
- Belo'ren remains a validation case, not a hard-coded branch in the generic engine.

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

## Storage redesign summary

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

A normal status/model UI read should require a tiny, known number of reads and should never enumerate all raw evidence.

## Product identity / north star

- Product: **AvoiD Raid Operations**
- Intelligence layer: **Iris**
- Raid Leader / primary live operator: **Onie**
- End goal: improve raid organization and decisions **before, during and after raid**, with the highest-value loop being the actionable brief between progression pulls.

## External log-derived reference products

The literal reference list is now persisted in [`docs/PRODUCT-REFERENCES.md`](./PRODUCT-REFERENCES.md):

- WoWAnalyzer — https://wowanalyzer.com
- Wipefest — https://www.wipefest.gg/?gameVersion=warcraft-live
- Archon — https://www.archon.gg/wow
- Lorrgs — https://lorrgs.io
- Mythic Trap — https://www.mythictrap.com/en
- Wowhead — https://www.wowhead.com

Use these for product research, useful metrics, workflows and explanatory reference data. Do not clone proprietary implementation/UI, and do not let external guide text substitute for WCL-derived evidence in generated encounter inference.
