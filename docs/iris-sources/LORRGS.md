# Iris Source Contract — Lorrgs

**Site:** `https://lorrgs.io`  
**API host:** `https://api2.lorrgs.io/api`  
**Open source:** `https://github.com/gitarrg/lorrgs`  
**Status for Iris:** public third-party FastAPI/OpenAPI, **secondary derived data**, bounded read-only runtime client available  
**Reviewed:** 2026-08-17

Lorrgs is unusually useful among the reference sites because its backend is open source and defines a real FastAPI API. The app config exposes Swagger docs at `/api/docs` and OpenAPI at `/api/openapi.json`.

This does **not** make Lorrgs canonical. Its data is secondary/derived and primarily useful as discovery, semantic enrichment and benchmark context. WCL observed combat remains the source of truth for what actually happened.

## Safe read-only endpoint catalogue

### Static world/spec data

| Endpoint | What it returns | Iris use |
|---|---|---|
| `GET /api/roles` | role list | Normalize Lorrgs role labels |
| `GET /api/classes` | class dictionary | Reference/discovery |
| `GET /api/specs` | specs | Reference/discovery |
| `GET /api/specs/{spec_slug}` | one spec | Resolve spec metadata |
| `GET /api/specs/{spec_slug}/spells` | spec spells + buffs + debuffs + events | Candidate player/spec spell discovery |
| `GET /api/spells/{spell_id}` | one `WowSpell` | Secondary spell metadata |
| `GET /api/spells` | all known spells | Bulk reference only; avoid unless necessary |
| `GET /api/trinkets` | known trinkets | Secondary reference |
| `GET /api/zones` | raid zones | Discovery |
| `GET /api/zones/{zone_id}` | one raid zone | Discovery |
| `GET /api/zones/{zone_id}/bosses` | bosses in zone | Discovery |
| `GET /api/bosses` | all known bosses | Discovery |
| `GET /api/bosses/{boss_slug}` | one boss | Resolve boss metadata |
| `GET /api/bosses/{boss_slug}/spells` | boss spells/buffs/debuffs/events | Candidate mechanic-ID discovery + secondary boss-membership evidence |
| `GET /api/seasons/{season_slug}` | season name/slug/raid IDs; `current` supported | Current-season reference |

The open-source route implementation constructs boss spell output from `boss.all_spells + boss.all_buffs + boss.all_debuffs + boss.all_events`. That makes exact membership in `/bosses/{boss_slug}/spells` materially useful to Iris: it is stronger semantic evidence than merely finding a spell in Lorrgs' global spell table, while still remaining secondary to official/observed WCL data.

`WowSpell` includes useful fields such as `spell_id`, name, icon, cooldown, duration, `spell_type`, tags, event type, variations and tooltip information. The boss-list endpoint returns its `as_dict()` representation, while the direct `/spells/{id}` route can expose the fuller spell model.

For identity and encounter scope, WCL GameData/WorldData remains preferred when the same fact is available officially.

## v3.9.3 runtime strategy

AvoiD now has a server-side read-only Lorrgs client used by `provider-aware-ability-knowledge-v1`.

For a batch of candidate IDs with a boss slug:

```text
1. GET /bosses/{boss_slug}/spells once
2. mark exact listed IDs as secondary boss-membership support
3. only unresolved IDs fall back to GET /spells/{id}
```

This avoids one boss-membership request per ability and prevents a global spell lookup from being misrepresented as evidence that the spell belongs to that boss.

Lorrgs membership can upgrade an opaque ability from `unknown` to a **boss-ability candidate**. It cannot prove that the ability occurred in a specific pull or that a temporal neighbor caused the target signal.

## Rankings / cooldown timeline context

`GET /api/spec_ranking/{spec_slug}/{boss_slug}` and `/info` provide cached top-parse context. `GET /api/comp_ranking/{boss_slug}` provides composition samples. These remain useful for research, but top-parse timings and comps are not universal strategy.

## Already-cached user-report data

`GET /api/user_reports/{report_id}` and `/fights` may be read as secondary cached context. If exact report evidence is needed, query WCL directly.

## Endpoints Iris must NOT call by default

These perform/queue mutations or external acquisition in Lorrgs infrastructure and are outside AvoiD's read-only contract:

```text
GET   /api/spec_ranking/load
PATCH /api/spec_ranking/dirty
GET   /api/comp_ranking/load/{boss_slug}
GET   /api/user_reports/{report_id}/load_overview?refresh=...
GET   /api/user_reports/{report_id}/load?...
```

Likewise `/api/auth/*`, user refresh endpoints and Lorrgs account/session internals are out of scope.

## Trust and provenance

Every Lorrgs-derived fact used by Iris retains:

```text
provider = lorrgs
source endpoint/query
time retrieved
boss/spec/difficulty/metric scope when relevant
secondaryDerived = true
verification = WCL when combat/score/decision critical
```

Lorrgs can speed up discovery and classify a candidate as boss-listed. It must not become a shortcut around AvoiD evidence contracts, Deep coverage rules, Reliability gates or the mechanic-promotion contract.
