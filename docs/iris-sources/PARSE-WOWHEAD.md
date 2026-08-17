# Iris Source Contract — Parse Wowhead API

**Marketplace:** `https://parse.bot/marketplace/dcf24c30-539c-47c6-ad80-e754dfb7e99e/wowhead-com-api`  
**Runtime API host:** `https://api.parse.bot/scraper/93b56483-7fc6-48da-bd9f-1310e3bca1c3`  
**Auth:** server-side `X-API-Key` (`PARSE_API_KEY`)  
**Status for Iris:** optional third-party maintained REST wrapper over public Wowhead data  
**Reviewed:** 2026-08-17

This is **not an official Wowhead developer API**. Parse operates and health-checks a maintained wrapper over publicly reachable Wowhead data. That makes it useful as a stable enrichment/fallback surface, but its trust class is below Warcraft Logs official metadata and below direct observed combat evidence.

## Current marketplace contract

The reviewed marketplace API exposes nine read endpoints:

| Endpoint | Current use |
|---|---|
| `GET search` | Free-text discovery across Wowhead database categories |
| `GET get_item` | Rich item identity/equip metadata |
| `GET get_npc` | NPC ID -> name + canonical URL |
| `GET get_spell` | Spell ID -> name + canonical URL |
| `GET get_quest` | Quest ID -> name + canonical URL |
| `GET get_database_list` | Paginated item/NPC/spell/quest browsing |
| `GET get_news` | Wowhead news feed |
| `GET get_news_article` | Article content/metadata |
| `GET get_today_in_wow` | Current regional game/event information |

For raid-mechanic intelligence the high-value calls are `get_spell`, `get_npc`, and selective `search`. The current `get_spell` response is intentionally modest: numeric ID, display name and canonical Wowhead URL. It does **not** currently provide a trustworthy boss-membership or mechanic-semantics field.

## Authentication, quotas and cost

Calls use:

```text
X-API-Key: $PARSE_API_KEY
```

The marketplace publishes per-call credit costs and account rate limits. At review time `get_spell` costs one Parse credit on success. Plans/limits can change, so Iris must treat the registry/documentation as descriptive rather than hard-code an account entitlement.

AvoiD rules:

- keep `PARSE_API_KEY` server-side only;
- never expose it in browser JS, Git, logs or API responses;
- preview the maximum Parse calls/credits before execution;
- `confirmParseCredits:true` is required when the provider is selected;
- do not call Parse merely to reproduce metadata already resolved by a higher-trust provider unless corroboration is explicitly useful.

## Where it helps Iris

### 1. Resolve opaque IDs

When WCL evidence produces an unfamiliar ability/NPC ID, Parse/Wowhead can turn it into a human-readable identity and canonical reference without Iris inventing a name.

### 2. Cross-provider disagreement detection

If WCL, Lorrgs and Parse/Wowhead resolve the same numeric ID to different names, Iris records a provider disagreement instead of silently choosing the most convenient label. Patch/version drift can then be investigated explicitly.

### 3. Fallback discovery

`search` can be useful when Iris has a mechanic name from a guide/reference but not yet an exact ID. Any discovered candidate must still be reconciled to WCL observed IDs before becoming combat knowledge.

### 4. NPC/entity enrichment

`get_npc` can complement WCL `GameData`/report actor identity when a readable canonical Wowhead reference is useful for raid-leader explanation or debugging.

## What it cannot prove

A successful Wowhead-wrapper lookup does **not** prove that:

- the ability belongs to the selected boss;
- the ability occurred in a pull;
- two abilities are causally related;
- a timing is universal;
- a player failed a mechanic;
- a candidate should be promoted into accepted boss knowledge.

Those require WCL observed combat, explicit encounter membership from a suitable provider, and/or AvoiD's own versioned evidence contracts.

## Trust position

```text
WCL observed combat             canonical empirical truth
WCL GameData / WorldData        official identity/scope metadata
AvoiD versioned rule knowledge  product semantics
Lorrgs boss/spell API           secondary semantic/discovery metadata
Parse Wowhead wrapper           reference identity/search fallback
```

Parse/Wowhead may enrich an interpretation. It never overwrites raw WCL facts and never directly changes Deep coverage, Reliability, semantic score or mechanic-promotion state.

## Runtime integration

v3.9.3 includes an optional server-side client. It is inactive unless `PARSE_API_KEY` is configured and the fingerprinted provider request explicitly enables `parseWowhead` and confirms Parse credit use.
