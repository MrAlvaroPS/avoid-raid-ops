# AvoiD Loot Simulation v1

## Purpose

Loot answers a raid-leadership question: **which eligible raider receives the largest defensible raid-only improvement from a candidate item, alongside the social and operational context required for a fair award?**

Simulation gain is evidence. It is never an automatic award decision.

## Authoritative sources

- **SimulationCraft official repository (`simulationcraft/simc`, GPL-3.0):** simulation engine, class modules, APLs, DBC-backed game data, character imports, profilesets and JSON reports.
- **Blizzard Game Data:** canonical item identity, item class/subclass and inventory type used by search and preliminary eligibility.
- **Warcraft Logs CombatantInfo:** preferred observed roster, gear, talents, spec and role for the raid currently loaded by AvoiD.
- **Battle.net Armory through SimulationCraft:** fallback profile bootstrap when the observed WCL profile is incomplete.
- **Iris Reliability / HOME History:** independent context. Reliability, attendance and seniority do not modify the SimulationCraft gain.
- **AvoiD local loot ledger:** award count until a future WoWAudit synchronization is explicitly implemented.

Wowhead is a human-readable reference link only and is not the canonical item API.

## Execution architecture

```text
Loot UI
  -> POST /api/loot { action: simulate }
  -> eligibility filter
  -> AvoiD SimulationCraft worker
  -> official simc executable
  -> raid single-target profilesets
  -> SimulationCraft JSON
  -> baseline vs candidate gain for each eligible raider
```

The official SimulationCraft repository is the engine dependency. AvoiD owns the HTTP/job wrapper. Raidbots and third-party SimulationCraft web wrappers are not production dependencies.

## Runtime environments

For local v0.1, set `SIMC_PATH` to the official SimulationCraft executable. The Nitro/Vercel application cannot be assumed to execute a large native binary reliably, so hosted production will move the same runner contract to a bounded container/worker.

The UI remains usable when the worker is offline. It must show `SIMC OFFLINE`; it may still search items, calculate eligibility and display ledger/reliability/attendance context. It must never fabricate gain percentages.

## Raid-only contract

v0.1 supports the `raid_st` scenario:

- Patchwerk-style single-target raid simulation.
- Explicit iteration count.
- Baseline character and item-candidate profilesets use the same engine build and scenario.
- Normal, Heroic and Mythic item identity/ilevel remain explicit in the request.
- DungeonSlice, Mythic+ and mixed encounter profiles are forbidden in this result.

A future raid-value model may add multi-target and encounter-specific profiles, but those must remain separate scenarios and may not silently replace the single-target result.

## Role limitations

SimulationCraft DPS gain is suitable for DPS-role comparison when profiles are complete enough. v0.1 does not publish a fabricated healer throughput value or tank survival value. Healers and tanks remain `role-model-pending` until their raid value can be defended with an explicit model.

## Eligibility

Blizzard item class/subclass/inventory type is used to exclude obviously incompatible classes before simulations are queued. SimulationCraft performs the final validation. Unknown class, weapon subclass or slot mappings fail closed rather than entering the ranking.

## Data truth and ranking

Each row reports independently:

- item eligibility and reason;
- baseline and candidate metric;
- percentage gain or loss;
- statistical signal/confidence exposed by the simulation;
- profile source and completeness;
- Iris Reliability status/value;
- attendance;
- seniority;
- loot received count.

No hidden combined score is allowed in v1. The UI may sort by raid gain, but the raid leader sees every factor and explicitly records the award.

## Licensing

SimulationCraft is GPL-3.0. AvoiD must preserve license notices and provide corresponding source when distributing a modified SimulationCraft binary or container under conditions that trigger GPL distribution obligations. AvoiD's HTTP wrapper communicates with the executable as a separate process; any future packaging or modifications must be reviewed against the exact distribution model. This document is an engineering guardrail, not legal advice.

## v0.1 readiness

A scope is usable tonight when:

1. Blizzard credentials resolve the item.
2. A static/live WCL report has at least one completed pull and CombatantInfo roster data, or Armory fallback identities are complete.
3. `SIMC_PATH` resolves the official executable.
4. A real smoke simulation completes and the JSON exposes baseline and profileset DPS.
5. Loot never auto-awards and never invents healer/tank raid gain.
