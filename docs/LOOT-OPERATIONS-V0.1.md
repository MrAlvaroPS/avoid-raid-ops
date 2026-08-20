# AvoiD Loot Operations v0.1

## Product goal

Loot answers a raid-lead question without turning one number into an automatic award decision:

> For this exact raid item, which current raiders can use it, what is the measured raid-only DPS gain, and what distribution context should the loot council see?

The surface lives below **Composition** and is independent from Mechanics/Active Pull filtering unless it explicitly consumes the active roster.

## Evidence planes

| Signal | Source | v0.1 semantics |
|---|---|---|
| Item identity / class / inventory type | Blizzard Game Data | Canonical item lookup/search |
| Item reference | Wowhead | Link/tooltips only; not canonical API truth |
| Current roster / spec / role / gear | WCL CombatantInfo from an explicitly loaded report | Exact observed raid roster; never fetched at page boot |
| Raid DPS delta | Official SimulationCraft CLI | Patchwerk raid single-target profileset comparison |
| Reliability | Iris Reliability | Published value only; otherwise `PENDING` |
| Attendance | Persisted HOME history | Observed pull presence since first indexed appearance |
| Seniority proxy | Persisted HOME history | `firstIndexedAt`; not a claim about guild join date |
| Loot received | Local AvoiD ledger | Explicit awards; WoWAudit sync is future work |

## SimulationCraft

The authoritative engine is the GPL SimulationCraft project (`simulationcraft/simc`). AvoiD runs the official CLI as an external process through `SIMC_PATH`; it does not depend on Raidbots or an abandoned hosted API.

v0.1 scenario is deliberately narrow:

```text
fight_style=Patchwerk
max_time=300
profileset_metric=dps
```

Mythic+/dungeon profiles are forbidden for Loot v0.1. The metric is **raid single-target DPS gain**, not generic character value.

The preferred base profile is reconstructed from the explicitly loaded WCL CombatantInfo snapshot: observed item IDs, item levels, gems, enchants and talent import code. This keeps the baseline tied to the gear actually observed in the raid. Because v0.1 does not yet preserve every bonus ID/crafted option from WCL, that limitation is carried in `profileCompleteness`. If the observed profile is incomplete, SimulationCraft falls back to Battle.net (`armory=region,realm,character`) rather than fabricating missing equipment.

The candidate item is applied through SimulationCraft profilesets. Rings/trinkets are tested in both possible slots and the best valid replacement is returned.

### Tanks and healers

v0.1 does **not** fabricate raid value for healers or tanks. They may be eligible for an item, but the sim column returns `ROLE MODEL PENDING` until we have a role-appropriate, auditable raid value model. A DPS delta on a healer/tank must not be presented as their loot upgrade value.

## Eligibility

Armor specialization, shields/off-hands and weapon proficiency are filtered server-side before any SimC job starts. SimulationCraft remains the final technical validator. Unsupported or unresolved weapon/slot types fail closed rather than simming everybody.

## Distribution table

The initial table includes:

- Raider / spec / role / class
- Current item(s) in the affected slot from CombatantInfo
- Raid-only SimC gain %
- Sim signal confidence
- Iris Reliability (or `PENDING`)
- Indexed pull attendance %
- First indexed appearance
- Number of loot awards in the local ledger
- Eligibility status and reason
- Explicit `AWARD` action

No formula automatically decides who receives loot. The raid leader sees independent facts side-by-side.

## Item catalogue

v0.1 searches Blizzard's global item index by name or exact item ID and allows an item-level override because the base item document does not necessarily encode the exact raid-difficulty scaled item instance.

The next catalogue layer should be build-pinned DB2:

```text
JournalEncounterItem
+ JournalItemXDifficulty
+ Difficulty
```

This will derive the actual drop pool for the selected boss+difficulty. ItemBonus/bonus-list data can then resolve exact difficulty item levels/bonus IDs automatically.

## Local setup for v0.1

Use an official SimulationCraft release for the current patch and set:

```text
SIMC_PATH=C:\path\to\SimulationCraft\simc.exe
```

in `.env.local`.

Then:

```text
npm run validate:loot-simc
```

For a real end-to-end smoke:

```text
npm run validate:loot-simc -- --player NAME --realm REALM --item ITEM_ID --ilevel ITEM_LEVEL
```

A self-built SimC may require Blizzard API credentials in SimC's supported API-key configuration. This is a SimC runtime concern, separate from AvoiD's own Blizzard Game Data credentials.

## Hosted architecture after tonight

Vercel should not execute long CPU-heavy SimulationCraft jobs inline. The durable architecture is:

```text
AvoiD web/API
  -> create LootSim job
  -> dedicated SimC worker/container pinned to a known SimC revision
  -> persist result/fingerprint
  -> UI polls job status
```

The old `mckilem/simcraft-api` repository is useful only as prior art for the async UUID/job pattern. It is not a production dependency.
