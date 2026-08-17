# Iris Lorrgs Boss-Membership Absence Semantics v1

**Status:** diagnostic provider contract  
**Provider:** Lorrgs read-only API  
**Applies to:** provider-aware ability knowledge and semantic verification

## Why this contract exists

Lorrgs is useful as secondary semantic/discovery evidence, but its boss spell catalogue is curated and incomplete by design. Iris must therefore distinguish a successful catalogue lookup that does not contain an ID from a failed provider lookup.

## Observed response shape

`GET /api/bosses/{boss_slug}/spells` returns a JSON object keyed by spell ID. Each value is spell metadata and normally includes `spell_id`, name, icon, duration, cooldown, spell type, tags and tooltip metadata.

The AvoiD Lorrgs client normalizes this keyed object to a `Map<number, spell>` before provider-aware aggregation.

## Three-state membership semantics

### 1. `supported`

Requirements:

- boss catalogue request succeeded; and
- requested ability ID is present in that boss catalogue.

Meaning:

- Lorrgs supplies secondary evidence that the ID belongs to the encounter/boss catalogue.
- This may strengthen a semantic candidate.
- It does not prove the event occurred in a specific pull and does not prove causality.

### 2. `not-listed-by-lorrgs`

Requirements:

- boss catalogue request succeeded; and
- requested ability ID is absent from that catalogue.

Meaning:

- weak negative evidence only;
- never a hard contradiction;
- never evidence that the ability is a player spell;
- never sufficient to reject WCL observed encounter evidence.

A direct `GET /api/spells/{id}` returning 404 may additionally show that Lorrgs has no global metadata for the ID, but it does not strengthen absence into contradiction.

### 3. `unknown`

Use when the boss catalogue itself could not be resolved, no boss slug was supplied, or provider execution was not requested.

Iris must not convert provider failure into negative evidence.

## Semantic verifier interaction

`semantic-specificity-verification-v2` interprets:

- `supported` as positive encounter-membership evidence;
- `not-listed-by-lorrgs` as weak negative evidence without contradiction;
- `unknown` as no provider conclusion.

Specificity, topology and observed WCL evidence remain independent evidence layers. A Lorrgs catalogue result cannot auto-promote a mechanic.

## Invariants

- WCL observed combat remains canonical for event occurrence, source, target and timing.
- Lorrgs contributes 0 canonical Deep reports/pulls.
- Lorrgs contributes 0 direct Boss Learned score delta.
- Provider absence never becomes automatic mechanic rejection.
- Provider presence never becomes automatic mechanic acceptance.
- Generic learning code must not contain boss-specific IDs or names.

## Regression requirement

Tests must include synthetic keyed boss-catalogue responses and verify both successful absence and provider-failure cases without network access.
