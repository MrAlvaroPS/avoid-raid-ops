# Iris semantic provenance gate v1

## Purpose

A temporally specific neighbour is not automatically a boss mechanic. Player-applied buffs, debuffs, procs and damage can be highly synchronized with an encounter transition and can even use an ability identity that is known to belong to the encounter family.

Mechanical promotion therefore requires event-source provenance, not only provider identity or actor topology.

## Mechanical support contract

A candidate can reach `mechanically-supported` only when all of the following are true:

1. Structural recurrence is reproduced across the configured independent-source/window minimum.
2. Null/control windows satisfy the versioned specificity thresholds.
3. Actor provenance strongly attributes the candidate event source to `encounter-boss` or `encounter-npc`.
4. At least one independent corroborator is present: reviewed encounter relevance or consistent actor topology.

Provider identity and topology can strengthen encounter-side evidence. They cannot replace source provenance.

## Conservative statuses

- Strong friendly/player-owned source -> `player-origin-context-marker`.
- Mixed, weak, missing or unresolved source provenance -> `provenance-required`.
- Encounter-side source without provider/topology corroboration -> remains `specificity-supported`.
- Encounter-side source plus corroboration -> `mechanically-supported`.

No status in this contract auto-promotes a mechanic or changes Canonical Deep coverage / Iris score directly.

## Pattern-level provenance

Actor provenance v2 aggregates role evidence by the same semantic pattern key used by the verifier:

`relation | stream | abilityId | eventType`

The result still includes ability-level summaries for compatibility, but the verifier prefers exact pattern provenance. Older persisted v1 fingerprints that only contain ability-level summaries remain readable as `ability-fallback` and are handled conservatively.

Actor IDs and actor names are used only in-memory to classify roles. They are not persisted in provenance summaries.

## Privacy and scope

Global boss learning persists derived role classes only (`friendly-player`, `friendly-pet`, `encounter-boss`, `encounter-npc`, etc.). It does not persist reusable external player identities.

This remains diagnostic semantic evidence: 0 Canonical Deep contribution, 0 direct score delta, no automatic promotion.