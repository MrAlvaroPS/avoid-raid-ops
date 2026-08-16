# Iris Knowledge Boundary — Implementation Audit v1

Branch: `feat/iris-local-worker`
Contract: `iris-knowledge-contract-v1`
Sampling: `boss-corpus-sampling-v2`

This document records the implementation review performed while separating GLOBAL BOSS KNOWLEDGE from AvoiD HOME RAID / PLAYER KNOWLEDGE.

## Final population boundary

### GLOBAL BOSS KNOWLEDGE

Hard scope: `encounterId + difficulty + partition`.

Allowed population: public WCL reports from trusted independent external sources.

Forbidden population:

- AvoiD guild reports;
- reports owned by a known/configured AvoiD uploader, including personal/un-guilded logs;
- reports from another encounter/difficulty/partition;
- reports without a trustworthy guild/uploader source identity.

### HOME RAID / PLAYER KNOWLEDGE

Hard population: AvoiD/home source only.

External reports can be evaluated against boss knowledge, but external players cannot enter Reliability, the AvoiD player matrix, player-focus calls or the home raid ledger.

`AVOID_HOME_WCL_OWNER_IDS` may contain comma/semicolon/space-separated WCL owner ids for known personal uploaders. During corpus discovery, an uploader id observed on an AvoiD guild report is also retained on the local job and excluded during canonical rebuild.

`AVOID_HOME_GUILD_ID` is the explicit home guild override; `WCL_GUILD_ID` is used as the compatibility fallback before the AvoiD default id.

## Sampling implementation

The raw report cache and canonical model sample are separate.

1. WCL acquisition discovers encounter rankings and independent guild/uploader sources.
2. Source history expansion rotates one page at a time instead of draining a single source first.
3. Mapped Wide candidates prefer the source with fewer already-processed reports.
4. Persisted evidence is rebalanced again locally at compile/recompile time.
5. Canonical selection is strict source round-robin.
6. Within a source round, the report that best closes pull-outcome deficits is chosen.
7. Outcome accounting is per fight, not per report.
8. Deep evidence is selected only from reports present in the canonical Wide sample.
9. Train/holdout remains source-isolated after canonical selection.

Target pull mix is currently 20% kill / 30% deep wipe / 30% mid wipe / 20% early wipe. These are sampling targets, never fabricated observations.

## Logic defects found and corrected during implementation

### 1. Ranking-seed bias

Risk: many cached reports could originate from a small set of ranked/prolific sources.

Fix: source-page round-robin during discovery, source-aware Wide acquisition, and a second canonical source-round-robin at compile time.

### 2. Mixed report misclassification

Risk: a report containing one kill plus many progression wipes could be treated as a pure kill report.

Fix: actual fight-level outcome histogram. Every pull contributes to its real stratum.

### 3. Fake diversity from unknown reports

Risk: using `report:<code>` as a source fallback would make every unknown report look independent.

Fix: canonical sampling requires guild id or uploader owner id. Missing-source reports are cached/audited but contribute zero canonical evidence.

### 4. Difficulty/partition leakage

Risk: the storage path was partition-scoped, while older profile JSON did not carry an explicit partition field.

Fix: new profiles persist exact partition. Legacy profiles are migrated only from their already partition-scoped storage path and stamped with `partitionProvenance=partition-scoped-storage-key-v1`. Wrong encounter/difficulty/partition profiles are excluded.

### 5. Player ids in global profiles

Risk: `friendlyPlayers` actor ids were useful for Deep origin provenance but must not become persistent global player identity.

Fix: actor ids exist only in the transient header, are used to classify friendly vs encounter-side source, and are removed before Wide/Deep persistence.

### 6. Premature actor-id stripping

Risk discovered while applying item 5: stripping actor ids before Deep provenance would make friendly/encounter origin classification impossible.

Fix: sanitization is explicitly after provenance derivation.

### 7. Home guild configuration drift

Risk: corpus isolation could use a hard-coded guild while runtime analysis used `WCL_GUILD_ID`.

Fix: one home guild resolver: `AVOID_HOME_GUILD_ID -> WCL_GUILD_ID -> default AvoiD id`.

### 8. Personal AvoiD uploader leakage

Risk: an AvoiD uploader can have a report with no guild association and therefore look external.

Fix: home-source semantics include both guild and known uploader owner ids. Guild source discovery retains the report uploader id; configured owner ids are supported through `AVOID_HOME_WCL_OWNER_IDS`. Canonical rebuild purges both guild and known-owner home profiles.

### 9. Legacy published-model bypass

Risk: an old model previously marked `published` could bypass the new population contract.

Fix: application runtime now uses `loadPublishedEncounterModelV2`. It requires the exact sampling/knowledge contract and rejects home-source contamination, wrong scope and missing source identity.

### 10. External player contamination

Risk: loading a public external report through the app could construct Reliability/player-specific output.

Fix: report guild + owner are resolved before player intelligence. External source => boss evaluation allowed, Reliability/player matrix disabled.

### 11. Sampling audit self-trust

Risk: contamination counters in a manifest could be hard-coded to zero and cease to be a meaningful guard.

Fix: selected-home, selected-wrong-scope and selected-missing-source counters are computed from selected evidence itself and then used as publication gates.

### 12. Recompile wasting WCL

Risk: changing sampling policy could force a new multi-thousand-pull crawl.

Fix: canonical rebuild operates exclusively on persisted Wide/Deep profiles. `RECOMPILE · 0 WCL` migrates/sanitizes/rebalances/recompiles locally.

## Publication gates added

Default canonical sampling gates:

- one source <= 10% of Wide reports;
- one source <= 12% of Wide pulls;
- one source <= 20% of Deep reports;
- every Wide outcome stratum represented by >= 8 independent sources;
- every Deep outcome stratum represented by >= 3 independent sources;
- zero selected home-source reports;
- zero selected wrong-scope reports;
- zero selected missing-source reports.

Failure to meet these gates caps Boss Learned. Any selected AvoiD/home-source contamination forces the score to zero.

These gates are additive to relation provenance, semantic resolution, signal coverage, corpus depth and source-isolated validation.

## Migration of the current Belo'ren cache

Do not discard the current local WCL download.

After the current worker has finished and the branch is pulled locally, `RECOMPILE · 0 WCL` will:

1. read only `3182/d5/p4` cached profiles;
2. stamp legacy partition metadata from the trusted storage key;
3. strip legacy `friendlyPlayers` lists;
4. exclude/purge AvoiD guild and known AvoiD uploader profiles;
5. exclude wrong-scope and missing-source evidence from canonical selection;
6. source-round-robin the Wide sample;
7. balance actual kill/deep/mid/early pull outcomes;
8. select balanced Deep evidence from canonical Wide reports only;
9. rebuild source-isolated train/holdout;
10. compile the model;
11. persist `sampling/3182/d5/p4.json` for audit.

No WCL request is required by those migration steps.

## Runtime contract

The dependency direction is one-way:

`GLOBAL BOSS KNOWLEDGE -> evaluate HOME RAID / PLAYER KNOWLEDGE`

The following dependency is forbidden:

`HOME RAID -> teach GLOBAL BOSS -> score the same HOME RAID as independent truth`

External players never contribute to AvoiD Reliability, even when their report is useful public boss evidence.
