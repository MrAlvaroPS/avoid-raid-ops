# AvoiD Loot Simulation v0.1

## Engine ownership

AvoiD Loot uses the official `simulationcraft/simc` CLI as the simulation engine. Raidbots and third-party SimC API wrappers are not production dependencies.

## Managed nightly

`npm run sync:simc` checks the official SimulationCraft nightly index, selects the latest Windows x64 networking build, downloads the archive, records its SHA-256, verifies the commit prefix against `simulationcraft/simc` when GitHub is reachable, extracts with 7-Zip, runs `simc display_build=2`, and only then promotes it to current.

Managed binaries live under `.raidops-simc/` and are not committed.

State keeps `current` and `previous` metadata. If an update fails and a verified current build already exists, Loot keeps using that build and exposes the update failure instead of silently switching to an unverified binary.

`npm run dev` performs a bounded freshness check before Vite starts. Checks are cached for six hours. Simulation requests themselves do not download or update the engine.

`SIMC_PATH` is an explicit operator override and bypasses managed promotion. It can be used to pin/rollback a known build.

## Provenance

Every managed simulation result carries the nightly filename, upstream commit, archive SHA-256, build information and profile source. A percentage without engine provenance must not be treated as a valid loot signal.

## Character profile

Preferred source during raid is WCL CombatantInfo. For manual smoke tests or incomplete WCL profiles, the runner can use SimulationCraft's Battle.net Armory importer. When Raid Ops Blizzard credentials exist, the runner creates a temporary `apikey.txt` in the isolated sim working directory using `BLIZZARD_CLIENT_ID:BLIZZARD_CLIENT_SECRET`; the file is removed with the temp directory after the run.

## Temporary HOME roster

Until current-tier CombatantInfo exists for every raider, Loot can use a persisted temporary roster fetched explicitly from Warcraft Logs `Guild.members` for the configured HOME guild.

Authority is deliberately ordered:

1. **WCL CombatantInfo observed in an AvoiD report** — authoritative for spec, role, item level, gear and talents at that observation.
2. **WCL guild directory** — temporary identity/class/server bootstrap only.

Directory rows are persisted under HOME storage and are never GLOBAL Iris evidence. When HOME Operational Execution receives telemetry players, matching rows are enriched automatically with no extra WCL request. External reports are evaluation-only and never update the HOME roster.

The final expiry/removal rules for directory-only members are intentionally deferred. v0.1 keeps provenance visible (`TEMP DIRECTORY` vs `OBSERVED`) so those rules can later be introduced without losing evidence history.

## Eligibility is not simulation support

Loot keeps three questions separate:

- **Eligibility:** can the character equip this item?
- **Simulation support:** can the current verified SimulationCraft nightly safely model this specialization/role?
- **Raid value:** if supported, what is the raid-only delta versus the same character baseline?

An eligible character is never assigned `0%` merely because SimC cannot model the spec. For example, the current Midnight nightly explicitly rejects Mistweaver; that row remains eligible for loot and is surfaced as `ROLE MODEL PENDING / CURRENT SIMC UNSUPPORTED`.

## Metric

v0.1 supports `raid_st`: Patchwerk-like single-target raid DPS gain only. It is not a Mythic+ / DungeonSlice metric. Healer raid value and tank survivability are not fabricated; those roles remain `ROLE MODEL PENDING` until a defensible role-specific model exists.

Simulation gain is evidence for a loot decision, never an automatic award rule. Reliability, attendance, seniority and loot-received remain independent columns/signals.

## Commands

```powershell
npm run sync:simc
npm run status:simc
npm run sync:home-roster
npm run validate:home-roster
npm run validate:loot-roster -- --item ITEM_ID --ilevel ITEM_LEVEL --simulate 3
npm run validate:loot-simc -- --player NAME --realm REALM --item ITEM_ID --ilevel ITEM_LEVEL --iterations 500
```
