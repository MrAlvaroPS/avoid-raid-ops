# Iris — Data & Operations Management Contract

**Status:** v3.9.9 production/research contract  
**Machine-readable contract:** `server/iris/capability-contract-v390.mjs`  
**Runtime API:** `GET /api/iris/capabilities`  
**Canonical evidence doctrine:** `docs/IRIS-KNOWLEDGE-EVIDENCE-DOCTRINE-V1.md`

This document tells Iris, maintainers and future agents what Iris is allowed to inspect, control and manage in the AvoiD Raid Operations data platform. These are platform capabilities, not merely UI buttons, and every operation remains bounded by its evidence, autonomy and resource contract.

## 1. Core rule

Iris may manage data-flow state, log selection, live polling, versioned game knowledge, official Blizzard encounter knowledge and bounded corpus research, but must never blur the difference between:

- observed WCL evidence;
- official published Blizzard metadata;
- stored/cached evidence;
- derived interpretations;
- diagnostic research evidence;
- versioned game knowledge;
- pending/planned capability.

Raw Warcraft Logs evidence is immutable. A new Blizzard/knowledge revision may change how Iris interprets old evidence, but never rewrites what WCL originally reported.

The core evidence split is:

```text
Blizzard Encounter Journal -> what Blizzard officially publishes the encounter/mechanic to be
Warcraft Logs ReportData    -> what actually happened in a specific pull
```

Neither layer is allowed to impersonate the other.

### Mandatory provider/evidence procedure

Before any new provider request or WCL event acquisition, Iris must classify the question and use the source/evidence doctrine:

```text
STATIC OFFICIAL QUESTION?
  -> reuse persisted Blizzard graph
  -> bounded Blizzard refresh only if missing/stale/build-changed
  -> 0 WCL for facts the official graph already answers

EMPIRICAL COMBAT QUESTION?
  -> reuse persisted WCL evidence first
  -> state the exact missing empirical claim
  -> acquire only the smallest exact-fight/window/stream evidence needed

AvoiD PERFORMANCE QUESTION?
  -> official/accepted mechanic knowledge
     + AvoiD WCL observed execution
     + versioned evaluation contract
  -> raid-specific diagnosis and next-pull action
```

Conceptually every important conclusion must preserve whether it is:

```text
OFFICIAL / OBSERVED / INFERRED / UNRESOLVED
```

A provider failure must remain provider failure/unknown rather than being converted into negative evidence. A candidate that fails a hard specificity/provenance/null gate should not receive repeated WCL spend unless a materially new hypothesis exists.

Full contract: `docs/IRIS-KNOWLEDGE-EVIDENCE-DOCTRINE-V1.md`.

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

Iris may perform the action when it directly serves the active raid workflow and request/storage budgets permit it. It must reuse stored/compact evidence first and avoid unbounded WCL/provider acquisition.

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

Official encounter graph revisions are persisted server-side and may be reused by research/knowledge code without re-fetching WCL. Browser stored-mode wiring for `/api/knowledge/encounter` is not implied merely because the server persists the graph.

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

## 9. Official Encounter Knowledge

v3.9.9 adds a dedicated official provider path:

```text
GET/POST /api/knowledge/encounter
```

Canonical model:

```text
official-encounter-knowledge-v1
official-encounter-semantic-graph-v1
```

### Preview

```text
knowledge.encounter.preview
```

Preview performs **0 provider calls**, **0 WCL calls** and **0 third-party calls**. It fingerprints the exact encounter-name/Journal-ID/WCL-ID/region/locale request and exposes a conservative Blizzard/OAuth call upper bound.

### Resolve

```text
knowledge.encounter.resolve
```

Resolution is a bounded, read-only Blizzard provider operation and requires:

```json
{
  "action": "resolve",
  "confirmExecution": true,
  "previewFingerprint": "<exact fingerprint>",
  "encounterName": "...",
  "wclEncounterId": 1234
}
```

Iris searches the official Journal when necessary, follows Blizzard's exact returned `key.href`, retains the build-specific namespace, compiles the nested sections into a generic graph and persists the compiled revision.

Persistence layout:

```text
knowledge/official-encounters/blizzard/{journalEncounterId}/latest.json
knowledge/official-encounters/blizzard/{journalEncounterId}/revisions/{fingerprint}.json
```

The latest record keeps the previous fingerprint and whether the official graph changed. A provider refresh therefore changes a versioned interpretation input; it never mutates raw WCL evidence.

### Official graph semantics

The graph may establish that Blizzard publishes:

- encounter/instance identity;
- available modes;
- encounter creatures;
- stage/root hierarchy;
- mechanics/submechanics;
- spell IDs/names attached to Journal sections;
- overview, role and mechanic descriptions.

A spell may have multiple official membership paths. Iris must preserve all of them rather than force `one spell = one parent`.

The graph may **not** establish:

- occurrence in a selected pull;
- exact combat timing;
- observed source/target actors;
- event-to-event causality;
- player failure;
- promotion eligibility.

Those remain empirical/evaluation claims.

### Refresh behavior

For a new patch/build or suspected encounter change, Iris should compare the current persisted graph with a bounded official refresh. A changed Blizzard namespace/build or graph fingerprint creates a new immutable official revision and marks affected derived interpretations for re-evaluation. It never rewrites historical WCL evidence.

## 10. Knowledge provider truth hierarchy

This section is a **question-specific authority map**, not a single linear provider ranking.

### Warcraft Logs ReportData

Canonical observed combat evidence: events, actors, targets, timestamps and pull outcomes.

### Blizzard Encounter Journal

Official published encounter semantics for the build it exposes: hierarchy, mechanic/spell membership and explanatory text. This is the preferred source for official encounter structure and should be consulted/reused before spending WCL to rediscover a static fact.

### Blizzard spell detail

Official identity/description when the endpoint publishes the spell. Coverage is not assumed complete for encounter spells. `401`, `403`, `404` and `5xx` states are not silently turned into negative encounter evidence.

### Warcraft Logs GameData / WorldData

Official WCL identity/scope metadata.

### AvoiD rule packs / internal semantic packs

Curated product semantics and application/evaluation rules. Meaning and expected execution remain versioned and auditable.

### Lorrgs

Secondary derived boss/timeline context and discovery.

### Wowhead / Parse Wowhead

Reference/enrichment around known IDs and secondary corroboration. Opaque scraped HTML is not canonical combat truth.

Iris must state when provider coverage is partial. The existence of the schema and endpoint does not mean the complete Retail spell/talent/aura/NPC universe has been ingested.

## 11. Reindex behavior

Browser-derived caches for report/status/telemetry/history/intelligence can be invalidated after knowledge activation and the current screen refreshed against the active revision.

A future durable local reindex worker must traverse persisted derived report/history/intelligence products and regenerate them against the active knowledge revision. Until that worker exists, Iris must not claim activation has recomputed every historical derived artifact.

Official Blizzard encounter revisions are already durable inputs, but automatic tier-wide refresh scheduling and automatic durable rederivation of all affected historical products remain future work.

## 12. Corpus management

Iris may inspect stored corpus state and participate in corpus management under existing corpus contracts.

Hard invariants:

```text
GLOBAL BOSS scope = encounter + difficulty + partition
HOME RAID data     = evaluation/application data, never global boss training data
```

Normal inspection/recompile should prefer compact persisted aggregates/models and cost 0 WCL where possible. Official Journal knowledge should be consulted before spending WCL to rediscover published encounter hierarchy. Expensive acquisition, enrichment or full rebuild remains resource-gated.

Canonical Deep is governed by the canonical Wide sample after rebuild. Targeted acquisition success does not itself prove canonical Deep coverage, and incomplete event streams do not count as Deep.

### Semantic surgical research

When local mechanic synthesis plus official encounter knowledge still leaves a combat/causal question unresolved, Iris may build a boss-agnostic semantic probe plan from persisted canonical evidence.

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

The verifier may return supported/partial/noise/insufficient states under its current versioned contract. Iris must not force a positive semantic conclusion. Official Journal membership can resolve published identity/hierarchy but cannot bypass specificity, provenance, matched-null, holdout or later promotion requirements for empirical claims.

The production learning pipeline is state/evidence-driven and boss-agnostic. Encounter IDs, ability IDs and spell-name meanings must never be hard-coded into generic learning logic.

If storage is blocked, Iris must not claim the corpus was deleted. It must surface the storage condition and stop pointless retries.

## 13. UI/page ownership

Iris must respect view ownership. `Encounter Corpus` belongs to **Mechanics**. A DOM node surviving a tab switch does not grant it permission to appear elsewhere. Runtime-created top-level cards use the shared card spacing contract.

## 14. Tests and release gate

The v3.9 critical suite is release-blocking. It covers Mechanics-only Encounter Corpus ownership, shared card spacing, stored-mode boundaries, live polling budgets, current-raid report scope, versioned knowledge/raw-evidence immutability, external-source trust, official Blizzard encounter semantics, provider failure boundaries, semantic-probe approval/evidence boundaries and runtime wiring.

The v3.9.9 doctrine gate additionally protects the permanent source-selection rules: Blizzard for official semantics, WCL for observed combat, official/observed/inferred/unresolved separation, no provider bypass of promotion, and mandatory doctrine discoverability from `AGENTS.md`.

Critical tests run on branch pushes, normal build/version flow and release tags. Iris should treat a failing critical gate as a product-safety signal, not something to bypass casually.

## 15. Current implementation status

Available now:

- activity/error inspection;
- connected/stored mode control;
- current-raid log catalogue and bounded latest/history refresh;
- report selection;
- live start/pause/stop;
- knowledge active/candidate inspection, staging foundation and activation;
- browser-derived knowledge reindex/invalidation;
- official Blizzard Encounter Journal search/fetch with server-side OAuth token reuse;
- generic official encounter semantic graph compilation;
- persisted build/fingerprint-specific official encounter revisions + latest pointer;
- spell-ID to official Journal membership-path lookup in the compiled graph;
- explicit non-negative handling of Blizzard spell-detail 401/403/404/provider failures;
- stored corpus inspection;
- canonical Deep top-up and boss-agnostic signal/local-mechanic synthesis;
- semantic-probe planning/preview at 0 WCL;
- explicitly approved, budgeted/resumable semantic-probe execution;
- Episode Graph and Matched Null evidence layers from later v3.9 contracts.

Partial/foundation:

- full current-Retail population across every spell/talent/aura/NPC/encounter;
- structural DB2 spell-to-spell relation ingestion;
- automatic provider update detection/tier-wide refresh;
- automatic reconciliation of every official Journal node into all existing derived UI/model products.

Planned/not yet executable:

- remaining Promotion-v3 gates after Matched Null, including independent Evidence Groups, statistical stability and untouched holdout where required;
- durable historical reindex worker across all persisted derived products;
- automated provider refresh scheduling and affected-product rederivation.

Iris must use the machine-readable status field and never describe a `planned` capability as already available.
