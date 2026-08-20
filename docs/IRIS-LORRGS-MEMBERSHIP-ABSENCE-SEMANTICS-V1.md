# Iris Lorrgs Boss Tracking-Catalog Semantics v1

**Status:** diagnostic provider contract  
**Provider:** Lorrgs read-only API  
**Applies to:** provider-aware ability knowledge and semantic verification

## Why this contract exists

Lorrgs is useful as secondary semantic/discovery evidence, but `GET /api/bosses/{boss_slug}/spells` should not be treated as an exhaustive spellbook for the encounter.

Live validation shows the endpoint returns the same small set of boss-specific abilities represented by Lorrgs in the encounter analysis UI. The returned records include display/timeline-oriented fields such as duration, cooldown, color, show and tooltip metadata. Operationally Iris therefore treats this endpoint as a **curated boss timeline/analysis marker catalogue**.

That distinction is important:

- presence is meaningful positive evidence that Lorrgs intentionally tracks the ability as relevant to the boss analysis/timeline;
- absence only means Lorrgs does not track that ID in this curated set;
- absence does not mean the ability is not emitted by the boss or encounter.

## Observed response shape

`GET /api/bosses/{boss_slug}/spells` returns a JSON object keyed by spell ID. Each value normally includes fields such as `spell_id`, name, icon, duration, cooldown, `spell_type`, color, `show`, tags and tooltip information.

The AvoiD Lorrgs client normalizes this keyed object to a `Map<number, spell>` before provider-aware aggregation.

## Three-state tracking semantics

### 1. `supported`

Requirements:

- boss tracking catalogue request succeeded; and
- requested ability ID is present in that catalogue.

Meaning:

- Lorrgs explicitly tracks the ID as a boss timeline/analysis marker;
- this strongly supports encounter relevance;
- it may strengthen a semantic candidate;
- it does not prove the event occurred in a specific pull and does not prove causality.

### 2. `not-listed-by-lorrgs`

This machine status is retained for compatibility with provider-aware knowledge v1 and semantic verifier v2.

Requirements:

- boss tracking catalogue request succeeded; and
- requested ability ID is absent from that curated catalogue.

Human meaning:

**not tracked by Lorrgs as one of its curated boss timeline/analysis markers.**

It is therefore:

- weak negative evidence only;
- never a hard contradiction;
- never evidence that the ability is a player spell;
- never sufficient to reject WCL observed encounter evidence;
- not evidence that the boss lacks the ability.

A direct `GET /api/spells/{id}` returning 404 additionally means Lorrgs has no global spell record for that ID at the time of the request. It still does not strengthen absence into contradiction.

### 3. `unknown`

Use when the boss catalogue itself could not be resolved, no boss slug was supplied, or provider execution was not requested.

Iris must not convert provider failure into negative evidence.

## Semantic verifier interaction

`semantic-specificity-verification-v2` interprets:

- `supported` as positive encounter-relevance evidence;
- `not-listed-by-lorrgs` as weak negative evidence without contradiction;
- `unknown` as no provider conclusion.

Specificity, topology and observed WCL evidence remain independent evidence layers. A Lorrgs tracking-catalog result cannot auto-promote a mechanic.

## Why the tracked set is still valuable

A curated marker set can be more semantically useful than a giant raw spell list for some tasks. It tells Iris which abilities Lorrgs considers important enough to align, render or compare across encounter timelines.

This can help with:

- identifying major/cyclic encounter landmarks;
- phase/timeline alignment candidates;
- choosing useful comparison anchors across pulls;
- interpreting cooldown planning relative to major boss events;
- validating whether an opaque WCL ID corresponds to a known high-level encounter marker.

Iris must still use WCL observed events to determine actual timing, repetition, source/target and causal relationships.

## Invariants

- WCL observed combat remains canonical for event occurrence, source, target and timing.
- Lorrgs contributes 0 canonical Deep reports/pulls.
- Lorrgs contributes 0 direct Boss Learned score delta.
- Provider absence never becomes automatic mechanic rejection.
- Provider presence never becomes automatic mechanic acceptance.
- Generic learning code must not contain boss-specific IDs or names.

## Regression requirement

Tests must include synthetic keyed boss-catalogue responses and verify presence, successful absence and provider-failure cases without network access.
