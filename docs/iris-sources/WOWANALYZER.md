# Iris Source Contract — WoWAnalyzer

**Site:** `https://wowanalyzer.com`  
**Source:** `https://github.com/WoWAnalyzer/WoWAnalyzer`  
**Status for Iris:** open-source analysis/reference source, **not a canonical data provider**  
**Reviewed:** 2026-08-17

## Public API status

No supported public WoWAnalyzer developer/data API was identified in the public documentation reviewed for this contract. The live site is a client-side application that analyses Warcraft Logs data. Iris must not discover private/internal requests in the browser and then promote them to a supported API contract.

If WoWAnalyzer later publishes a documented API, add it to the registry in a versioned review before calling it from production code.

## What WoWAnalyzer is useful for

WoWAnalyzer is explicitly designed to analyse raid performance and provide player metrics/gameplay suggestions from Warcraft Logs. Its open repository is especially valuable as an **algorithm/design reference** for player/spec analysis.

Important patterns visible in its maintained source documentation:

### Event-driven analyzers

Analyzers register listeners for specific combat-log events and derive metrics/suggestions from them rather than scanning arbitrary payloads repeatedly.

Supported conceptual event families include casts/begincasts, damage, healing, buff/debuff apply/remove/refresh, resource changes, summons and fight end.

### Narrow filters

Listeners can be restricted by source, spell and target. WoWAnalyzer explicitly warns against broad `any` processing where a narrower event filter exists. This aligns with AvoiD's WCL-budget and evidence-selection model.

### Conditional activation

An analyzer can activate only when the selected player has a relevant talent/item/spec. This is a strong reference pattern for Iris defensives, duties and spec-specific reliability opportunities: do not evaluate a capability that the player cannot possess.

### Explicit dependencies

Analyzers declare dependencies on reusable modules such as abilities, enemies, cooldown usability and resource trackers. Iris should similarly avoid duplicating formulas/availability logic between score components.

### Normalization before analysis

WoWAnalyzer documents normalizers that run before analyzers:

- event-order normalization;
- linking related events;
- custom event transforms.

The linking model supports small forward/backward time buffers, source/target constraints, maximum link counts and talent-dependent activation. This is directly relevant to Iris causal-evidence design: normalize and link conservatively, then score; do not make each UI panel reinvent event association.

### Linked-event reasoning

Analyzers can consume explicitly linked related events instead of repeatedly searching raw streams. Iris can adopt the **pattern** for cast→damage, buff→consume, proc chains and defensives, while keeping AvoiD's own deterministic contracts and provenance.

## What Iris must NOT do

- Do not treat WoWAnalyzer suggestions as WCL-observed facts.
- Do not copy a player's WoWAnalyzer grade into Reliability.
- Do not call undocumented live-site endpoints as if they were a public API.
- Do not silently copy source code into AvoiD. The project declares **AGPL-3.0-or-later**; code reuse requires an explicit licensing/architecture decision.
- Do not use a WoWAnalyzer heuristic without documenting the AvoiD version, input evidence and test cases.

## Recommended Iris use

```text
Question: How should a spec-aware analyzer be structured?
    -> consult WoWAnalyzer source patterns

Question: Which WCL events prove the actual outcome for AvoiD?
    -> query Warcraft Logs directly

Question: Can a WoWAnalyzer suggestion alter Reliability?
    -> no; only AvoiD's versioned Reliability evidence contract can do so
```

WoWAnalyzer is therefore a high-value **engineering and coaching-analysis reference**, not an upstream truth service.
