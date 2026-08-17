# Iris Source Contract — Lorrgs

**Site:** `https://lorrgs.io`  
**API host observed/documented by project ecosystem:** `https://api2.lorrgs.io/api`  
**Open source:** `https://github.com/gitarrg/lorrgs`  
**Status for Iris:** public third-party FastAPI/OpenAPI, **secondary derived data**  
**Reviewed:** 2026-08-17

Lorrgs is unusually useful among the reference sites because its backend is open source and defines a real FastAPI API. The app config exposes Swagger docs at `/api/docs` and OpenAPI at `/api/openapi.json`.

This does **not** make Lorrgs canonical. Its ranking/timeline products are derived from Warcraft Logs and are primarily useful as discovery/benchmark context.

## Safe read-only endpoint catalogue

### Static world/spec data

| Endpoint | What it returns | Iris use |
|---|---|---|
| `GET /api/roles` | role list | Normalize Lorrgs role labels |
| `GET /api/classes` | class dictionary | Reference/discovery |
| `GET /api/specs` | specs | Reference/discovery |
| `GET /api/specs/{spec_slug}` | one spec | Resolve spec metadata |
| `GET /api/specs/{spec_slug}/spells` | spec spells + buffs + debuffs + events | Candidate spell-ID discovery; verify currentness |
| `GET /api/spells/{spell_id}` | one spell | Secondary spell metadata |
| `GET /api/spells` | all known spells | Bulk reference only; avoid unless necessary |
| `GET /api/trinkets` | known trinkets | Secondary reference |
| `GET /api/zones` | raid zones | Discovery |
| `GET /api/zones/{zone_id}` | one raid zone | Discovery |
| `GET /api/zones/{zone_id}/bosses` | bosses in zone | Discovery |
| `GET /api/bosses` | all known bosses | Discovery |
| `GET /api/bosses/{boss_slug}` | one boss | Resolve boss metadata |
| `GET /api/bosses/{boss_slug}/spells` | boss spells/buffs/debuffs/events | Candidate mechanic-ID discovery |
| `GET /api/seasons/{season_slug}` | season name/slug/raid IDs; `current` supported | Current-season reference |

For spell/boss metadata, WCL GameData/WorldData or later Blizzard provider remains preferred when the same fact is available officially.

### Spec rankings / cooldown timeline context

```text
GET /api/spec_ranking/{spec_slug}/{boss_slug}
    ?difficulty=mythic
    &metric=<metric>
```

Returns cached ranking data for a spec/boss. The default metric follows the spec role when omitted. The source code uses a short cache window near tier start.

Useful for:

- samples of top-parse fights;
- cooldown/cast timeline research;
- peer/spec performance context;
- discovering reports/fights worth validating directly in WCL.

Do **not** interpret top-parse cooldown timings as a universal strategy. Kill time, phase timing, externals, composition and objective differ.

Lighter metadata path:

```text
GET /api/spec_ranking/{spec_slug}/{boss_slug}/info
```

This removes the report list and is preferred when Iris only needs ranking metadata/freshness/context.

### Composition rankings

```text
GET /api/comp_ranking/{boss_slug}
    ?limit=<n>
    &role=<filter expression, repeatable>
    &spec=<filter expression, repeatable>
    &killtime_min=<seconds>
    &killtime_max=<seconds>
```

Returns ranked report/fight compositions for a boss with optional role/spec and kill-time filters.

Useful for composition research and prevalence questions; never a direct recommendation that AvoiD should copy a comp.

### Already-cached user-report data

Prefix: `/api/user_reports`.

```text
GET /api/user_reports/{report_id}
```

Reads an already-known Lorrgs report overview; 404 if unavailable.

```text
GET /api/user_reports/{report_id}/fights
    ?fight=2.4.15
    &player=1.5.20
```

Reads selected already-cached fights and optional player subsets.

Iris may use these only as secondary cached context. If exact report data is needed, query WCL directly.

## Endpoints Iris must NOT call by default

These perform/queue mutations or external acquisition in Lorrgs infrastructure and are not AvoiD's resources to operate:

```text
GET   /api/spec_ranking/load
PATCH /api/spec_ranking/dirty
GET   /api/comp_ranking/load/{boss_slug}
GET   /api/user_reports/{report_id}/load_overview?refresh=...
GET   /api/user_reports/{report_id}/load?...        # queues SQS work
```

Likewise, `/api/auth/*`, user refresh endpoints and Lorrgs account/session internals are outside Iris's integration scope.

Task status endpoints (`GET`/WebSocket `/api/tasks/{task_id}`) are only meaningful for tasks legitimately created in Lorrgs; AvoiD should not create those tasks merely to obtain data it can query from WCL.

## Trust and provenance

Every Lorrgs-derived fact shown or used by Iris must retain:

```text
provider = lorrgs
source endpoint/query
time retrieved
boss/spec/difficulty/metric scope
secondaryDerived = true
verification = WCL when score/decision critical
```

Lorrgs can speed up **discovery**. It must not become a shortcut around AvoiD evidence contracts.

## Runtime status in AvoiD

This document means Iris **knows the API exists and how it works**. It does not mean AvoiD currently has a production Lorrgs client. Until a reviewed client is implemented, the machine registry marks direct runtime integration as planned/reference rather than executable.
