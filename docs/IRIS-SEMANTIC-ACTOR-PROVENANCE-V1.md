# Iris Semantic Actor Provenance

**Status:** diagnostic semantic evidence enrichment  
**Current version:** `semantic-actor-provenance-v2`

## Purpose

Candidate-wise specificity can prove that an event pattern is tightly associated with an encounter signal without proving that the neighboring ability itself belongs to the encounter. A player-applied debuff, pet ability, proc or external effect may be highly synchronized with a boss transition.

Actor provenance adds the missing question: **who owns/applies the observed event?**

## Data source

The enrichment uses Warcraft Logs `ReportMasterData.actors` only. The query requests actor report id, type, subtype and pet owner. It does **not** request new combat events.

The already-persisted semantic evidence contains compact source/target report ids for each observed event. Actor metadata is held transiently and used to convert those ids into role labels.

## Role labels

- `friendly-player`
- `friendly-pet`
- `owned-actor`
- `pet-unknown-owner`
- `encounter-boss`
- `encounter-npc`
- `unknown`
- `none`

These labels describe actor provenance only. They do not by themselves prove causality or mechanic ownership.

## Pattern-scoped provenance contract

Actor provenance **must not** be applied at ability-ID scope. A single ability can appear in several streams, event types and temporal positions with different actor ownership. Aggregating all occurrences of one ability can therefore contaminate one semantic candidate with another.

v2 persists derived provenance for the exact verifier signature:

`relation | stream | abilityId | eventType`

Examples:

- `before-2.5s | enemyDebuffs | 123 | removedebuff`
- `after-1s | debuffs | 123 | removedebuff`

Those are separate provenance records even though they share the same ability ID.

The verifier may use actor provenance only when the persisted pattern key exactly matches the candidate key it is evaluating. Legacy v1 ability-level summaries are diagnostic history only and **must not** be silently reused as exact-pattern provenance.

## Privacy boundary

GLOBAL BOSS persisted output must never contain player names, actor names, raw source ids, raw target ids or a reusable actor-id map.

Persisted output contains only aggregated counts such as:

- number of reports/windows/events;
- exact pattern signature;
- source-role distribution;
- target-role distribution;
- dominant source/target role and share.

An ability-level aggregate may be retained for diagnostics, but it is never authoritative for candidate classification.

## Execution contract

Preview is `0 WCL` and produces a fingerprint.

Execution is manual-only and requires the matching preview fingerprint. Network upper bound is:

`1 rate-limit preflight + N report actor-metadata queries`

where `N` is the number of independent semantic evidence reports selected, capped by configuration.

No new ReportData combat-event query is made.

Changing the provenance schema/version changes the preview fingerprint. A v1 snapshot therefore cannot masquerade as v2 evidence.

## Interpretation

Examples:

- `friendly-player -> encounter-boss` on an `enemyDebuffs` pattern strongly suggests a player-applied debuff on the boss and should not be promoted as a boss-owned ability merely because it is specific to an encounter window.
- `encounter-boss -> friendly-player` is compatible with a boss-origin mechanic affecting a player.
- `encounter-boss -> encounter-boss` may represent boss state/aura lifecycle.
- `friendly-pet -> encounter-boss` is player-side provenance even though the source actor itself is a pet.

Actor provenance is an evidence layer. Promotion still requires the separately versioned mechanic/promotion contract.

## Invariants

- 0 canonical Deep reports/pulls.
- 0 direct Boss Learned score delta.
- no automatic promotion.
- no boss-specific IDs or names in generic logic/tests.
- provider identity metadata cannot override observed WCL event structure.
- no ability-level provenance may be used to classify an exact semantic pattern.
