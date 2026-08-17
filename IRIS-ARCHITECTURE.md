# Iris — Multi-Encounter Raid Intelligence Contract

**Status:** canonical product/architecture direction  
**Product:** AvoiD Raid Operations  
**Intelligence system:** **Iris**  
**Raid Leader / primary live operator:** **Onie**  
**Introduced as explicit product contract:** v3.7.6

## Purpose

Iris is the intelligence layer of AvoiD Raid Operations. Its end goal is not to analyse one Warcraft Logs report or one boss. Iris exists to help organise a raid as effectively as possible and to improve decisions **before, during and after raid time**, with the highest-value loop being decisions made live between progression pulls.

The target operational loop is:

```text
BEFORE RAID
roster · composition · assignments · historical blockers · encounter readiness
      ↓
DURING RAID
WCL live evidence → pull closes → Iris evaluates → 1–3 next-pull decisions
      ↓
AFTER RAID
progression review · player/mechanic trends · model enrichment · preparation for next session
```

## Multi-encounter is a hard architectural invariant

Belo'ren is the current research/validation encounter. It is **not** a special-case architecture.

Generic corpus, discovery, validation, compiler and live-intelligence code must never depend on:

```js
if (encounterId === 3182) { ... }
```

Encounter-specific curated knowledge belongs only in encounter rule packs / fixtures.

Every learned corpus/model is scoped independently by:

```text
encounterId + difficulty + WCL partition
```

Canonical corpus key:

```text
{encounterId}/d{difficulty}/p{partition}
```

This permits every boss in a raid tier to accumulate its own persistent evidence and maturity while sharing the same generic research engine.

## Required hierarchy

```text
Raid tier / zone
  ├─ Encounter A
  │    ├─ Wide corpus
  │    ├─ Deep corpus
  │    ├─ generated encounter model
  │    ├─ validation state
  │    └─ model history
  ├─ Encounter B
  │    └─ ...
  └─ Encounter N
       └─ ...
```

A raid-night layer sits above encounter models and combines them with the guild's own report/session data.

## Research plane vs production plane

### Research plane

Expensive and persistent:

- public WCL corpus discovery;
- Wide profiling;
- Deep profiling;
- source provenance;
- encounter discovery;
- relationship inference;
- source-isolated train/holdout validation;
- candidate model compilation.

### Production plane

Fast and raid-facing:

- current report ingestion;
- per-pull mechanic evaluation;
- blocker ranking;
- death/root-cause evidence;
- player/role context;
- raid-night progression;
- next-pull recommendations.

Only compact validated encounter knowledge should ultimately need to be hot in production. Raw research profiles are archival/research evidence and should not become the normal hot-path dependency.

## Iris product principles

1. Warcraft Logs is combat truth.
2. Observed, derived and unknown/pending values remain distinguishable.
3. Correlation is not presented as causation without sufficient evidence.
4. Player blame has stricter evidence requirements than raid-level observations.
5. Train/holdout remains isolated by raid-group source.
6. Encounter models remain difficulty- and partition-specific.
7. New compiler versions should reuse persisted evidence whenever possible.
8. Corpus growth should follow the current evidence bottleneck, not arbitrary pull counts.
9. Iris should prefer a small number of actionable next-pull decisions over a large analytics dump.
10. The UI may simplify research diagnostics, but must never simplify the underlying evidence model into false certainty.

## Live raid north star

For Onie, the ideal between-pull experience is:

```text
PULL 37 ENDS
  ↓
Iris ingests the closed fight
  ↓
CURRENT BLOCKER
Guardian's Edict
HIGH CONFIDENCE

What changed:
• Light/Void interrupts improved
• 2 Edict failures remain
• first meaningful death follows the same failure window

NEXT PULL
1. fix matching-state Edict assignment
2. preserve current interrupt plan
3. no healing-plan change yet
```

The recommendation must be traceable to WCL evidence and must expose uncertainty when evidence is incomplete.

## Storage scalability

The corpus is currently persisted in Private Vercel Blob. This is acceptable for the current hosted research phase, but multi-boss scale requires treating raw profiles as **cold research evidence**, not repeatedly downloading every profile on common UI/API operations.

Direction:

```text
raw Wide/Deep profiles (cold/archive)
        ↓ incremental merge
compact encounter aggregate (warm research state)
        ↓ compiler
versioned generated encounter model (hot production state)
```

Routine model reads and ordinary recompilation should increasingly operate on compact aggregates/models. Full profile replay should become an explicit research/migration operation because repeatedly downloading every raw profile does not scale economically across an entire raid tier.

## v3.9 operational management plane

Iris is not limited to interpreting analytics. The v3.9 data-platform refactor makes selected operational controls first-class Iris capabilities as well.

Canonical human-readable contract:

```text
IRIS-OPERATIONS.md
```

Canonical machine-readable contract:

```text
server/iris/capability-contract-v390.mjs
GET /api/iris/capabilities
```

Browser execution bridge:

```js
window.__AVOID_IRIS_OPERATIONS__
```

The Iris runtime advertises these through:

```js
window.__AVOID_IRIS__
```

Iris can therefore discover what is genuinely available, what is only partial/planned, what endpoint or bridge performs it, and what autonomy level applies.

Current management domains are:

```text
activity / errors
connected vs stored data mode
AvoiD current-raid report catalogue
report selection
live polling start / pause / stop
versioned game-knowledge status / staging / activation
browser-derived knowledge reindex
Encounter Corpus inspection / guarded research actions
```

This is a capability contract, not permission to bypass product safeguards. Iris must obey the action's declared autonomy:

- safe reads/housekeeping may be automatic;
- bounded network refresh may be budget-aware;
- changing the operator's report/data/live context is operator-requested;
- activating a knowledge revision or expensive corpus mutation requires explicit approval;
- planned capabilities must never be presented as already implemented.

### Selected report vs historical context

A selected report controls report-scoped views. It does **not** redefine the current raid and does not erase longitudinal History.

The current raid is bounded by the configured canonical WCL raid zone. Mythic+ and unrelated/old raid zones are structurally ineligible for that catalogue.

### Knowledge revision behavior

Iris may inspect and stage versioned knowledge. Activating a candidate changes the interpretation context for derived outputs, never the raw WCL facts.

```text
raw evidence      = immutable
derived products  = invalidate and rederive
active knowledge  = versioned revision
```

Browser-derived invalidation is available now. A durable historical reindex worker is still planned and must not be claimed as complete until implemented.

### Source hierarchy for game knowledge

```text
WCL                    -> canonical observed combat evidence
AvoiD semantic packs   -> versioned curated meaning
Wowhead                -> reference/enrichment around known IDs
Blizzard Game Data     -> planned supported authoritative metadata provider
```

The existence of a versioned schema does not mean the complete live Retail spell/talent/aura/NPC universe has already been populated. Iris must disclose partial provider coverage honestly.

## Naming

- **AvoiD Raid Operations** — product.
- **Iris** — intelligence/reasoning/research, operations-management and decision-support layer.
- **Onie** — Raid Leader and primary live raid operator/persona.

Iris is not a separate chatbot bolted onto the UI. It is the name of the evidence pipeline, operational intelligence and decision-support system that connects corpus research, data management and live raid operations.
