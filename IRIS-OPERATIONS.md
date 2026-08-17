# Iris — Data & Operations Management Contract

**Status:** v3.9 refactor contract · feature branch only  
**Branch:** `refactor/v3.9-panel-data-platform`  
**Machine-readable contract:** `server/iris/capability-contract-v390.mjs`  
**Runtime API:** `GET /api/iris/capabilities`

This document tells Iris, maintainers and future agents what Iris is allowed to inspect, control and manage in the AvoiD Raid Operations data platform. It is deliberately operational: these are not merely UI buttons owned by the raid leader. They are platform capabilities that Iris may use through the same bounded contracts when the relevant operation is implemented and permitted.

## 1. Core rule

Iris may manage data-flow state, log selection, live polling and versioned game knowledge, but must never blur the difference between:

- observed WCL evidence;
- stored/cached evidence;
- derived interpretations;
- versioned game knowledge;
- pending/planned capability.

Raw Warcraft Logs evidence is immutable. A new knowledge revision may change how Iris interprets old evidence, but never rewrites what WCL originally reported.

## 2. Machine access

Canonical capability metadata is available from:

```text
GET /api/iris/capabilities
```

The returned contract includes:

- capability IDs;
- implementation status;
- domain;
- autonomy level;
- endpoint or browser bridge;
- side effect;
- description and evidence limits.

Browser-side operational methods are exposed through:

```js
window.__AVOID_IRIS_OPERATIONS__
```

Iris/future assistant surfaces should use this bridge instead of reproducing button-click logic or reaching into private DOM internals.

The Iris runtime advertises the contract and bridge through `window.__AVOID_IRIS__`.

## 3. Autonomy levels

### `automatic`

Read-only or safe housekeeping. Iris may perform it when needed.

Examples: inspect activity, inspect knowledge revision state, inspect a cached/current log catalogue.

### `bounded`

Iris may perform the action when it directly serves the active raid workflow and request/storage budgets permit it. It must reuse stored/compact evidence first and avoid unbounded WCL acquisition.

Examples: refresh recent log catalogue, load a wider bounded historical catalogue, stage a knowledge candidate when a supported provider/update workflow exists.

### `operatorRequested`

Iris can execute the action, but changing the user's active context or operational mode should happen when Onie asks for it or confirms it.

Examples: switch report, enter stored mode, start/pause/stop live polling.

### `explicitApproval`

The action changes durable/derived interpretation or can incur meaningful research/storage cost. Iris must explain the consequence and receive explicit approval before execution.

Examples: activate a new knowledge revision, start resource-heavy corpus mutation/full maintenance rebuilds.

### `unavailable`

The contract describes the intended capability, but Iris must not claim it can execute it yet.

## 4. Data mode management

Iris can manage two browser data modes.

### Connected

Normal service-backed operation. Successful supported GET responses are stored in browser Cache Storage for later reuse.

### Stored

Supported GETs resolve from stored snapshots without contacting their underlying data services. This currently includes:

```text
/api/wcl/report
/api/wcl/status
/api/wcl/telemetry
/api/wcl/history
/api/wcl/intelligence
/api/wcl/corpus
/api/wcl/reports
/api/knowledge
/api/iris/capabilities
```

POST/write actions never become fake offline actions. If a write requires a service, stored mode cannot pretend it succeeded.

Iris must clearly identify stored evidence as stored rather than fresh.

## 5. AvoiD log catalogue

Iris can inspect and manage the current-raid report catalogue through:

```text
GET /api/wcl/reports
```

Important invariant: the selected report does **not** define what the current raid is.

The current raid scope comes from the configured current WCL raid zone (`WCL_CURRENT_RAID_ZONE_ID`) or the deployment's canonical current report fallback. Selecting another report can never redefine that boundary.

Only reports from the exact current raid `zone.id` are eligible. Therefore:

- Mythic+ is excluded;
- unrelated raids are excluded;
- old raids are excluded;
- report-title heuristics are forbidden.

Operational actions available to Iris:

```text
logs.catalog.inspect
logs.sync-latest      -> bounded recent catalogue
logs.load-history     -> wider bounded catalogue
logs.select-report    -> changes report-scoped view
```

Selecting a report changes report-scoped screens. It does not erase encounter-wide History or the relationship between the selected report and the wider progression history.

## 6. Live report management

Iris can manage the live watcher:

```text
live.start
live.pause
live.stop
```

Current polling interval: **30 seconds**.

The watcher checks compact status. It does not load full telemetry/history/intelligence every 30 seconds.

A heavy refresh is requested only when the compact fingerprint changes after a closed pull. The report catalogue refreshes more slowly.

Iris must preserve this rate-aware behavior. A future refactor must not silently turn live mode into unconditional full-data polling.

## 7. Activity and error awareness

Recent operational transitions are available through:

```js
window.__AVOID_ACTIVITY__
```

The activity ring is intentionally short. Iris may use it to answer questions such as:

- whether the app is currently loading;
- which service failed;
- whether stored fallback was used;
- whether live polling is running;
- whether a knowledge candidate was staged/activated.

It is not a verbose telemetry log and should not become one.

## 8. Game Knowledge management

Canonical model:

```text
game-knowledge-v1
```

Entities are designed for:

```text
encounter
phase
boss-ability
player-ability
aura
talent
state
npc
```

Each snapshot has an immutable revision:

```text
retail:<season>:<patch>:<build>:<content-hash>
```

Iris can inspect active/candidate state:

```text
GET /api/knowledge
```

Iris can stage a candidate:

```text
POST /api/knowledge
{ "action": "refresh", ... }
```

Iris can activate a candidate after explicit operator approval:

```text
POST /api/knowledge
{ "action": "activate" }
```

Activation means:

```text
rawEvidencePolicy     = immutable
derivedDataPolicy     = invalidate-and-rederive
reindexStatus         = required
```

The active revision becomes the interpretation context for new Iris outputs. Existing derived products are stale until re-derived against that revision.

## 9. Knowledge provider truth hierarchy

### Warcraft Logs

Canonical observed combat IDs/evidence.

### AvoiD rule packs / internal semantic packs

Curated semantic seed. They may describe meaning and expected execution, but must remain versioned and auditable.

### Wowhead

Reference/enrichment only around known IDs: links, tooltips and useful human-facing context. Iris must not silently promote opaque scraped HTML into canonical combat truth.

### Blizzard Game Data

Planned authoritative versioned metadata provider where supported.

Iris must state when the knowledge database is only partially populated. The existence of the schema and refresh endpoint does not mean the complete current Retail spell/talent/encounter universe has already been ingested.

## 10. Reindex behavior

### Available now

Browser-derived caches for report/status/telemetry/history/intelligence can be invalidated after knowledge activation and the current screen refreshed against the new active revision.

### Planned durable worker

A future durable local reindex worker must traverse persisted derived report/history/intelligence products and regenerate them against the active revision.

Until that worker exists, Iris must not claim that activation has already recomputed every historical derived artifact. It has marked them stale/required and refreshed supported browser-derived state.

## 11. Corpus management

Iris may inspect stored corpus state and participate in corpus management under existing corpus contracts.

Hard invariants remain:

```text
GLOBAL BOSS scope = encounter + difficulty + partition
HOME RAID data     = evaluation/application data, never global boss training data
```

Normal inspection/recompile should prefer compact persisted aggregates/models and cost 0 WCL where possible.

Expensive acquisition, enrichment or full rebuild is resource-gated. A full raw corpus rebuild/replay is a special maintenance operation, not the normal meaning of `RECOMPILE`.

If storage is blocked, Iris must not claim the corpus was deleted. It must surface the storage condition and stop pointless retries.

## 12. UI/page ownership

Iris must respect view ownership.

`Encounter Corpus` belongs to **Mechanics**. A DOM node surviving a tab switch does not grant it permission to appear elsewhere.

Runtime-created top-level cards use the shared card spacing contract. New Iris-managed panels must not introduce arbitrary outer margins or nested duplicate margins.

## 13. Tests and release gate

The v3.9 critical suite is a release-blocking contract. It covers, among other things:

- Mechanics-only Encounter Corpus ownership;
- shared card spacing;
- stored-mode boundaries;
- live polling budget behavior;
- current-raid report scope/noise exclusion;
- versioned knowledge/raw-evidence immutability;
- reindex behavior;
- machine-readable Iris capabilities and browser operations bridge;
- runtime wiring.

Critical tests run on branch pushes, normal build/version flow and release tags.

Iris should treat a failing critical gate as a product-safety signal, not something to bypass casually.

## 14. Current implementation status

Available now:

- activity/error inspection;
- connected/stored mode control;
- current-raid log catalogue;
- bounded latest/history catalogue refresh;
- report selection;
- live start/pause/stop;
- knowledge active/candidate inspection;
- knowledge candidate staging foundation;
- knowledge activation;
- browser-derived reindex/invalidation;
- stored corpus inspection;
- existing corpus research actions under their current storage/WCL constraints.

Partial/foundation:

- full current-Retail knowledge population across every spell/talent/aura/NPC/encounter;
- automated provider ingestion/update detection.

Planned/not yet executable:

- durable historical reindex worker across all persisted derived products;
- authoritative Blizzard provider ingestion where applicable.

Iris must use the machine-readable status field and never describe a `planned` capability as already available.
