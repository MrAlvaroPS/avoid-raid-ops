# Iris Semantic Surgical Probe Execution V1

## Purpose

This contract defines how Iris may spend Warcraft Logs API budget to resolve a narrow semantic question that survived canonical acquisition, origin triage, and local mechanic synthesis.

It is deliberately boss-agnostic. A signal enters this stage because its runtime state is `external-evidence-needed`, never because of a boss name, encounter ID, spell ID, or spell-name meaning encoded in the engine.

## Pipeline boundary

```text
canonical evidence
  -> signal discovery
  -> origin triage
  -> local mechanic synthesis
  -> external-evidence-needed
  -> semantic probe preview (0 WCL)
  -> explicit manual execution
  -> persisted diagnostic evidence
  -> independent-source verifier
  -> reproduced / partially-reproduced / contradicted / insufficient
  -> separately versioned promotion contract (not implemented here)
```

Semantic probes are not canonical Deep. They contribute **0 Deep reports and 0 Deep pulls**, cannot directly change Boss Learned, and cannot automatically promote a mechanic.

## Mandatory preview

`GET /api/wcl/semantic-probe?action=preview` is a 0-WCL operation. It regenerates the current semantic plan from persisted canonical state and exposes:

- target signal count;
- exact anchor requests;
- cached anchor hits;
- potential context windows;
- a hard WCL network-call cap;
- pagination upper bounds;
- adaptive context windows;
- the protected hourly reserve policy;
- a deterministic preview fingerprint.

Iris does **not** invent a WCL point estimate. The authoritative point cost is returned by WCL `rateLimitData`, so preview reports call bounds and `wclPointCostEstimate: null` rather than presenting fabricated precision.

## Explicit execution gate

Execution is POST-only and requires both:

```json
{
  "action": "execute",
  "confirmExecution": true,
  "previewFingerprint": "<exact current preview fingerprint>"
}
```

The server regenerates the preview immediately before spending. A missing or stale fingerprint is rejected at 0 WCL.

Starting the web app, running the Iris worker, polling corpus status, compiling, or pressing Improve must never start semantic probe execution.

## Query scope

Every evidence query is bounded to exact report + exact fightIDs. There is no whole-report fallback.

### Anchor stage

For each selected independent source, Iris queries only the target signal inside the exact canonical fights selected by the semantic planner. The query covers the same structural event families used by Deep (casts, friendly damage, interrupts, friendly/enemy buffs and debuffs, deaths) but is a diagnostic evidence class.

Pagination is independent per aliased event stream. Cursor stall or page-cap exhaustion leaves the evidence incomplete; incompleteness is never converted into success.

### Temporal context stage

Only actual anchor occurrences may create context queries. Each context query uses:

- one exact report;
- one exact fightID;
- one anchor timestamp;
- a bounded before/after window;
- no resources unless a future version explicitly requires them.

V1 begins at ±2.5 s. If independent-source verification remains unresolved, Iris may widen conservatively to ±5 s. Expansion is bounded by the context-query cap and overall WCL-call cap. It never broadens to the whole report.

## Default execution budget

V1 defaults:

- maximum 30 WCL calls per manual invocation;
- maximum 2 anchor occurrences per source;
- maximum 12 context queries;
- anchor continuation cap: 2 rounds;
- context continuation cap: 1 round;
- event page limit: 1000;
- adaptive radii: ±2.5 s then ±5 s;
- hourly reserve: max(18% of WCL hourly limit, 600 points).

The live hourly budget is checked before the first evidence query. Every WCL response updates the budget state. Before every subsequent request/page, Iris checks the current reserve and the hard call cap. If either limit is reached, execution checkpoints and stops honestly.

## Persistence and idempotency

Evidence is stored separately from canonical profiles under:

```text
semantic-probes/<encounter+difficulty+partition>/
  evidence/<signal>/anchor/<query-fingerprint>.json
  evidence/<signal>/context/<query-fingerprint>.json
  verification/<signal>/<preview-fingerprint>.json
  runs/<preview-fingerprint>.json
```

Cached complete evidence is reused at 0 WCL. Re-running a completed identical fingerprint returns the persisted result without another WCL request.

Persisted evidence retains the exact report, source, fightID(s), anchor timestamp/window, pagination state, query fingerprint and evidence class. Compact event records retain only the structural fields required for verification: timestamp, event type, ability ID, source ID, target ID and fight ID.

## Verification

The V1 verifier compares structural patterns across independent sources. Persistent player/NPC actor IDs are not used as the cross-source signature. Instead it compares:

- relative timing bucket around the anchor;
- event stream/family;
- neighboring ability ID;
- event type;
- whether source and target identity are present.

Possible outcomes:

- `reproduced`: the same structural neighbor reaches the independent-source and anchor-window minima;
- `partially-reproduced`: recurrence exists but is below the full contract;
- `contradicted`: expected persisted target presence fails to reproduce across the required queried sources;
- `insufficient`: no structural pattern reaches a useful threshold.

The verifier is diagnostic. Even `reproduced` does not create an accepted mechanic.

## Promotion boundary

V1 intentionally stops before promotion. A future promotion contract must define, version and test:

- what a reproduced structural pattern is allowed to assert;
- required holdout or source reproduction;
- how contradictions are handled;
- how semantic coverage and Boss Learned may change;
- how any boss-specific golden knowledge may validate, but never train, the generic engine.

Until that contract exists, semantic evidence can explain what Iris observed but cannot silently become truth.

## Portability requirement

The executor, WCL fetcher, verifier and API surface must pass synthetic tests using arbitrary encounter and ability IDs. Current validation-boss names/IDs are forbidden from generic modules.
