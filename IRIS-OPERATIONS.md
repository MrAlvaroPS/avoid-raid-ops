# Iris — Data & Operations Management Contract

**Status:** v3.9.1 production contract  
**Machine-readable contract:** `server/iris/capability-contract-v390.mjs`  
**Runtime API:** `GET /api/iris/capabilities`

This document tells Iris, maintainers and future agents what Iris is allowed to inspect, control and manage in the AvoiD Raid Operations data platform. These are platform capabilities, not merely UI buttons, and every operation remains bounded by its evidence, autonomy and resource contract.

## 1. Core rule

Iris may manage data-flow state, log selection, live polling, versioned game knowledge and bounded corpus research, but must never blur the difference between:

- observed WCL evidence;
- stored/cached evidence;
- derived interpretations;
- diagnostic research evidence;
- versioned game knowledge;
- pending/planned capability.

Raw Warcraft Logs evidence is immutable. A new knowledge revision may change how Iris interprets old evidence, but never rewrites what WCL originally reported.

## 2. Machine access

Canonical capability metadata is available from:

```text
GET /api/iris/capabilities
```

The returned contract includes capability IDs, implementation status, domain, autonomy level, endpoint/bridge, side effect, description and evidence limits.

Browser-side operational methods are exposed through:

```js
window.__AVOID_IRIS_OPERATIONS__
```

Iris/future assistant surfaces should use this bridge instead of reproducing button-click logic or reaching into private DOM internals. The Iris runtime advertises the contract and bridge through `window.__AVOID_IRIS__`.

## 3. Autonomy levels

### `automatic`

Read-only or safe housekeeping. Iris may perform it when needed.

### `bounded`

Iris may perform the action when it directly serves the active raid workflow and request/storage budgets permit it. It must reuse stored/compact evidence first and avoid unbounded WCL acquisition.

### `operatorRequested`

Iris can execute the action when Onie asks for it or confirms the change of active context/operational mode.

### `explicitApproval`

The action changes durable/derived interpretation or can incur meaningful research/storage cost. Iris must explain the consequence and receive explicit approval before execution.

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

POST/write actions never become fake offline actions. If a write requires a service, stored mode cannot pretend it succeeded. Iris must clearly identify stored evidence as stored rather than fresh.

## 5. AvoiD log catalogue

Iris can inspect and manage the current-raid report catalogue through:

```text
GET /api/wcl/reports
```

The selected report does **not** define what the current raid is. The current raid scope comes from the configured current WCL raid zone (`WCL_CURRENT_RAID_ZONE_ID`) or the deployment's canonical current report fallback. Only reports from that exact raid `zone.id` are eligible; Mythic+, unrelated raids, old raids and title heuristics are excluded structurally.

Operational actions:

```text
logs.catalog.inspect
logs.sync-latest
logs.load-history
logs.select-report
```

Selecting a report changes report-scoped screens. It does not erase encounter-wide History.

## 6. Live report management

Iris can manage:

```text
live.start
live.pause
live.stop
```

Current polling interval: **30 seconds**. The watcher checks compact status and requests a heavy refresh only when the compact fingerprint changes after a closed pull. Catalogue refresh remains slower than status polling. A future refactor must not silently turn live mode into unconditional full-data polling.

## 7. Activity and error awareness

Recent operational transitions are available through:

```js
window.__AVOID_ACTIVITY__
```

The activity ring is intentionally short. Iris may use it to explain loading, service failures, stored fallback, live state and knowledge transitions. It is not a verbose telemetry log.

## 8. Game Knowledge management

Canonical model:

```text
game-knowledge-v1
```

Entities are designed for encounters, phases, boss/player abilities, auras, talents, states and NPCs. Each snapshot has an immutable revision:

```text
retail:<season>:<patch>:<build>:<content-hash>
```

Iris can inspect active/candidate state with `GET /api/knowledge`, stage a candidate with `POST /api/knowledge {"action":"refresh"}`, and activate a candidate only after explicit operator approval with `POST /api/knowledge {"action":"activate"}`.

Activation means:

```text
rawEvidencePolicy = immutable
derivedDataPolicy = invalidate-and-rederive
reindexStatus     = required
```

## 9. Knowledge provider truth hierarchy

### Warcraft Logs

Canonical observed combat IDs/evidence.

### AvoiD rule packs / internal semantic packs

Curated semantic seed. Meaning and expected execution remain versioned and auditable.

### Wowhead

Reference/enrichment only around known IDs. Opaque scraped HTML is not canonical combat truth.

### Blizzard Game Data

Planned authoritative versioned metadata provider where supported.

Iris must state when the knowledge database is only partially populated. The existence of the schema and refresh endpoint does not mean the complete current Retail spell/talent/encounter universe has already been ingested.

## 10. Reindex behavior

Browser-derived caches for report/status/telemetry/history/intelligence can be invalidated after knowledge activation and the current screen refreshed against the new active revision.

A future durable local reindex worker must traverse persisted derived report/history/intelligence products and regenerate them against the active revision. Until that worker exists, Iris must not claim activation has recomputed every historical derived artifact.

## 11. Corpus management

Iris may inspect stored corpus state and participate in corpus management under existing corpus contracts.

Hard invariants:

```text
GLOBAL BOSS scope = encounter + difficulty + partition
HOME RAID data     = evaluation/application data, never global boss training data
```

Normal inspection/recompile should prefer compact persisted aggregates/models and cost 0 WCL where possible. Expensive acquisition, enrichment or full rebuild is resource-gated. A full raw corpus rebuild/replay is special maintenance, not the normal meaning of `RECOMPILE`.

Canonical Deep is governed by the canonical Wide sample after rebuild. Targeted acquisition success does not itself prove canonical Deep coverage, and incomplete event streams do not count as Deep.

### Semantic surgical research

When local mechanic synthesis leaves a boss signal in `external-evidence-needed`, Iris may build a boss-agnostic semantic probe plan from persisted canonical evidence.

Preview capability:

```text
corpus.semantic-probe.preview
GET/POST /api/wcl/semantic-probe  action=preview
```

Preview is read-only and executes **0 WCL calls**. It reports the exact fingerprint, selected independent-source anchors, complete/partial cache state and a conservative bounded call budget.

Execution capability:

```text
corpus.semantic-probe.execute
POST /api/wcl/semantic-probe
{
  "action": "execute",
  "confirmExecution": true,
  "previewFingerprint": "..."
}
```

Execution is `explicitApproval`. The server regenerates the preview immediately before spending and rejects a stale fingerprint. Queries remain exact-fight and bounded; there is no whole-report fallback. WCL hourly reserve and a per-invocation hard call cap are checked between requests/pages.

Semantic evidence is persisted separately and resumably under `semantic-probes/...`. It is `diagnostic-semantic-surgical` evidence only:

```text
canonical Deep reports contribution = 0
canonical Deep pulls contribution   = 0
direct Boss Learned score change    = 0
automatic mechanic promotion        = false
```

The verifier may return `reproduced`, `partially-reproduced`, `contradicted` or `insufficient`. Iris must not force a positive semantic conclusion. Promotion from verified diagnostic evidence into accepted/versioned mechanic knowledge remains a separate contract.

The production learning pipeline is state/evidence-driven and boss-agnostic. Encounter IDs, ability IDs and spell-name meanings must never be hard-coded into generic learning logic.

If storage is blocked, Iris must not claim the corpus was deleted. It must surface the storage condition and stop pointless retries.

## 12. UI/page ownership

Iris must respect view ownership. `Encounter Corpus` belongs to **Mechanics**. A DOM node surviving a tab switch does not grant it permission to appear elsewhere. Runtime-created top-level cards use the shared card spacing contract.

## 13. Tests and release gate

The v3.9 critical suite is release-blocking. It covers Mechanics-only Encounter Corpus ownership, shared card spacing, stored-mode boundaries, live polling budgets, current-raid report scope, versioned knowledge/raw-evidence immutability, reindex behavior, machine-readable Iris capabilities, semantic-probe approval/evidence boundaries and runtime wiring.

Critical tests run on branch pushes, normal build/version flow and release tags. Iris should treat a failing critical gate as a product-safety signal, not something to bypass casually.

## 14. Current implementation status

Available now:

- activity/error inspection;
- connected/stored mode control;
- current-raid log catalogue and bounded latest/history refresh;
- report selection;
- live start/pause/stop;
- knowledge active/candidate inspection, staging foundation and activation;
- browser-derived knowledge reindex/invalidation;
- stored corpus inspection;
- canonical Deep top-up and boss-agnostic signal/local-mechanic synthesis;
- semantic-probe planning/preview at 0 WCL;
- explicitly approved, budgeted/resumable semantic-probe execution.

Partial/foundation:

- full current-Retail knowledge population across every spell/talent/aura/NPC/encounter;
- automated provider ingestion/update detection.

Planned/not yet executable:

- promotion contract from verified diagnostic semantic evidence into accepted/versioned mechanic knowledge;
- durable historical reindex worker across all persisted derived products;
- authoritative Blizzard provider ingestion where applicable.

Iris must use the machine-readable status field and never describe a `planned` capability as already available.
