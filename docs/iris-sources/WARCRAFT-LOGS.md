# Iris Source Contract — Warcraft Logs

**Provider:** Warcraft Logs / RPGLogs / Archon  
**Status for Iris:** primary official API + canonical observed combat evidence  
**Reviewed:** 2026-08-17

Official documentation:

- `https://www.warcraftlogs.com/api/docs`
- `https://www.warcraftlogs.com/v2-api-docs/warcraft/`
- API terms are published in the Archon/RPGLogs help centre.

## 1. Authentication and API endpoints

Warcraft Logs v2 uses OAuth 2.0 and GraphQL.

### Public API

```text
https://www.warcraftlogs.com/api/v2/client
```

Use **client credentials**. Public information only. This is AvoiD's normal server-side path.

### User/private API

```text
https://www.warcraftlogs.com/api/v2/user
```

Use Authorization Code or PKCE and explicit user authorization. This is required for private/user-scoped data where the schema says user authentication is necessary.

### OAuth

```text
Authorization: https://www.warcraftlogs.com/oauth/authorize
Token:         https://www.warcraftlogs.com/oauth/token
```

Never expose `client_secret` in browser code or the repository.

## 2. Root GraphQL families

The current Retail schema exposes these root query families:

| Root | What Iris can obtain | Primary use |
|---|---|---|
| `reportData` | reports, fights, events/tables/graphs, master data, rankings | Core AvoiD ingestion |
| `characterData` | characters and character ranking/report context | Player benchmark/context |
| `guildData` | guilds, members, attendance, zone ranking | Roster/attendance/context |
| `gameData` | abilities, classes/specs, items, NPCs and other static game metadata | Knowledge enrichment |
| `worldData` | expansions, zones, encounters, regions, servers | Exact raid/encounter scope |
| `rateLimitData` | hourly point limit, points spent, seconds to reset | Budget controller |
| `progressRaceData` | current race data; upstream notes 30s update interval | Optional world-progression context |
| `userData` | authorized user data | User-auth workflows only |
| `reportComponentData` / `systemReportComponentData` | Report Component definitions | WCL scripting/component research |

`ArchonViewModels` also exists in the schema, but many fields/arguments are undocumented JSON view-model surfaces. Iris must not prefer it over the typed documented roots; treat it as internal/brittle unless RPGLogs documents a supported integration contract.

## 3. ReportData and Report — highest-value surface

`reportData.report(code, allowUnlisted)` loads one report. `reportData.reports(...)` can enumerate reports by guild/user/time/zone and supports pagination.

A `Report` exposes the main primitives AvoiD needs:

### `fights(...)`

Fight identity and encounter rows. Use this first to establish fight IDs, encounter, difficulty, kill/in-progress state and time windows before buying event data.

### `masterData(...)`

Contains report `logVersion`, `gameVersion`, source language, every ability in the report and actors (players/NPCs/pets), optionally filtered by actor type/subtype. Use for canonical actor/ability identity within a report.

### `events(...)`

Paginated event stream. It supports surgical filters such as:

- `dataType`;
- `fightIDs`;
- `encounterID` / `difficulty`;
- `startTime` / `endTime`;
- `sourceID` / `targetID`;
- `abilityID`;
- source/target class and aura filters;
- `filterExpression`;
- hostility/resource/kill/view options;
- death/wipe cutoff behavior;
- translation options.

Current event families include:

```text
All
Buffs
Casts
CombatantInfo
DamageDone
DamageTaken
Deaths
Debuffs
Dispels
Healing
Interrupts
Resources
Summons
Threat
```

**Iris rule:** never request `All` for a whole report by default. Resolve the smallest fight/time/actor/ability/event-family window that can answer the question. Follow pagination completely when completeness is required; otherwise mark the probe as partial/diagnostic.

### `table(...)`

Server-aggregated report table for a selected data type/source/target/ability/fight scope. Prefer it over raw events when the question is an aggregate and the table preserves the required evidence semantics.

### `graph(...)`

Server-generated graph data for filtered report scope. Useful for temporal shapes when exact raw events are unnecessary.

### `rankings(...)`

Report ranking JSON filtered by fight/encounter/difficulty/player metric and comparison/timeframe. WCL explicitly marks ranking data as **not frozen** and able to change. Store provenance/time of retrieval and never treat a ranking snapshot as immutable combat truth.

### `playerDetails(...)`

Player/spec/talent/gear-oriented report detail. WCL also marks some report-derived summary surfaces as non-frozen. Use as context; verify score-affecting facts from appropriate underlying evidence when necessary.

## 4. GameData — patch-aware static metadata

WCL documents `GameData` as long-lived static game data that mainly changes with major patches and recommends long caching/update on new content.

Useful families include:

- `abilities` / `ability(id)` — player/enemy ability ID, localized name, icon;
- classes/specs;
- items/item sets/enchants;
- NPCs;
- maps/zones;
- achievements/affixes/factions and other schema-exposed game objects.

Use this to map IDs and bootstrap Game Knowledge, but do not infer combat behavior from a name/icon alone.

## 5. WorldData — exact scope, not title heuristics

Useful lookups include:

- `encounter(id)`;
- `zone(id)` / `zones(expansion_id)`;
- expansions;
- regions/subregions;
- servers.

`Zone` exposes difficulties, encounters, brackets and partitions. This is the correct family for defining current-raid scope and partition boundaries.

`Encounter` exposes its identity/zone and fight-ranking queries. Keep encounter + difficulty + partition explicit in global boss models.

## 6. CharacterData / Character

Character lookup supports ID or name/server/region context. Useful Character surfaces include:

- `encounterRankings(...)` with encounter, difficulty, partition, role, spec, metric, bracket, compare/timeframe and optional combatant/player context;
- recent reports;
- guild membership/context;
- game/spec data.

Use these for peer/output context, **not as a hidden input to Reliability unless the Reliability contract explicitly versions that dimension**. Parse remains a separate metric.

## 7. GuildData / Guild

Useful fields include:

- `members(limit,page)`;
- `attendance(guildTagID,limit,page,zoneID)`;
- `zoneRanking(zoneId)`;
- teams/parent guild;
- user-specific guild rank on the user-auth endpoint.

WCL guild attendance can be compared with AvoiD's own indexed presence model, but differences in denominator/session semantics must be shown rather than silently reconciled.

## 8. Rate limit control

Query `rateLimitData`:

```text
limitPerHour
pointsSpentThisHour
pointsResetIn
```

Iris should make acquisition decisions against remaining points, reuse stored/compact derived state first, avoid duplicate OAuth/GraphQL work and retain resume/checkpoint behavior.

## 9. Script Pins and Report Components

RPGLogs documents a JavaScript report scripting API used by Script Pins and Report Components. Relevant concepts include:

- `reportGroup` with actors, abilities, fights and reports;
- per-event predicate scripts such as `pinMatchesFightEvent`;
- custom Report Component dashboards;
- JsonTree, EnhancedMarkdown, Table and Chart components;
- report-component storage/evaluation GraphQL surfaces.

This is useful for prototyping analysis close to WCL, but it is a different execution environment from AvoiD. Iris should reuse concepts/filters, not make its core analytics depend on a user's WCL dashboard configuration.

## 10. Operational API safety

Iris must keep a small set of non-negotiable operational boundaries around the API itself:

- use documented WCL API surfaces instead of scraping WCL/Archon pages to evade the API;
- keep OAuth credentials and `client_secret` server-side;
- do not expose private report/user data without the required authorization;
- protect the WCL rate budget and preserve bounded/checkpointed acquisition;
- recheck the live schema before depending on fields that WCL documents as non-frozen or subject to change.

There is deliberately **no permanent-storage prohibition in the AvoiD/Iris source contract**. Storage/retention policy can be revisited independently later without blocking the current local data-platform design.

## 11. Iris query-selection rule

```text
Need identity/scope?       -> fights + masterData + WorldData
Need aggregate?            -> table/graph first if semantically sufficient
Need exact causality/time? -> surgically filtered events + complete pagination
Need output context?       -> rankings/Character encounterRankings, provenance required
Need static IDs/names?     -> GameData
Need guild attendance?     -> Guild.attendance + AvoiD attendance contract
Need budget state?         -> rateLimitData
```

See also `WCL-QUERY-PLAYBOOK.md`. That playbook governs how AvoiD turns these official capabilities into bounded queries.
