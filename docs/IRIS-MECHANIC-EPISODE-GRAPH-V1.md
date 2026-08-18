# Iris Mechanic Episode Graph v1

## Purpose

`mechanic-episode-graph-v1` is the first implementation layer after exact-pattern semantic verification and actor provenance.

It does **not** promote mechanics.

Its job is to turn a verified anchor plus its semantically relevant surrounding patterns into a persistent, auditable episode representation.

## Contract position

```text
Semantic specificity verification
        ↓
Pattern-level actor provenance
        ↓
Hard provenance gate
        ↓
MECHANIC EPISODE GRAPH v1
        ↓
Matched null baseline        (later phase)
        ↓
Independent evidence groups  (later phase)
        ↓
Promotion Contract           (later phase)
```

## Invariants

- 0 WCL network calls.
- 0 provider network calls.
- 0 Canonical Deep contribution.
- 0 direct Boss Learned delta.
- 0 automatic promotion.
- no causal claims.
- player-origin patterns may be retained as context but cannot become native boss mechanics.
- ability-level actor provenance cannot create a mechanically-supported edge.
- only exact `pattern` provenance can support an encounter-origin mechanical edge.

## Inputs

The builder consumes only already-persisted or caller-supplied evidence:

- resolved encounter scope;
- semantic signal/anchor;
- current semantic verifier result;
- provider-aware ability identity metadata, if available;
- persisted semantic actor provenance v2.

No new combat evidence is fetched.

## Pattern → Episode → Mechanic

A Pattern remains an atomic structural observation:

```text
relation | stream | abilityId | eventType
```

An Episode groups multiple Patterns around one anchor.

A Mechanic is **not** created by this version. The Episode merely prepares evidence for later Promotion.

## Stable identity

`episodeId` is derived from the stable anchor seed:

```text
encounterId
difficulty
partition
signalId
stateDiscriminator
```

It does not depend on the current list of context patterns.

This allows an Episode to accumulate additional evidence without changing identity.

Each build also receives a `buildFingerprint` derived from the interpretation inputs. Different interpretations/evidence revisions therefore remain distinguishable.

## Anchor

The anchor is always represented as an explicit node.

The current v1 builder may summarize anchor origin from exact-pattern context rows for the same signal ability and from signal-origin evidence, but it explicitly marks that provenance as **not exact enough for Promotion** unless a dedicated canonical anchor-pattern contract exists later.

This prevents the anchor itself from becoming an accidental shortcut around the exact-pattern gate.

## Supporting nodes

v1 admits only patterns whose specificity status is:

```text
specificity-supported
```

Rows that are:

```text
background-noise
specificity-partial
background-required
```

are not admitted as Episode nodes.

Supporting node roles are structural only:

```text
before-*        → precursor
after-*         → aftermath
simultaneous-*  → simultaneous
```

No strategic interpretation is attached.

## Context-only nodes

A player-origin specific pattern is retained as:

```text
context-only
```

This can be valuable for detecting a state transition or delimiting an Episode, but it cannot promote the boss mechanic.

Example from the Belo'ren investigation:

```text
Rune of Lingering
player → encounter-boss
```

can remain a context marker around Voidlight Rupture without being called a native boss mechanic.

## Edge classes

v1 supports:

```text
temporal-association
actor-linked
mechanically-supported
```

There is deliberately no `causal-edge`.

### mechanically-supported edge

Requires the upstream verifier to report:

```text
mechanical.status = mechanically-supported
actorProvenance.granularity = pattern
actorProvenance.encounterOrigin = true
```

Anything weaker cannot receive this edge class.

## Promotion state

Every v1 Episode is:

```text
promotion-pending
```

Even if it contains one or more mechanically-supported edges.

The following later contract gates are intentionally not implemented here:

```text
matched-null-baseline
independent-evidence-groups
statistical-stability
untouched-holdout
```

If no exact-pattern encounter-origin edge exists, the Episode additionally reports:

```text
exact-encounter-origin-edge
```

as a blocker.

## Persistence

Endpoint:

```text
POST /api/wcl/mechanic-episode
```

Actions:

```text
preview
build
result
```

`preview` constructs the exact same Episode without writing it.

`build` persists the interpretation under:

```text
mechanic-episodes/{scope}/{signalId}/{buildFingerprint}.json
```

`result` reads a persisted build by fingerprint.

All three actions are zero-network with respect to WCL/providers.

## Belo'ren / Voidlight Rupture expected behavior

The currently validated evidence has:

- encounter-side Voidlight Rupture anchor evidence;
- multiple specificity-supported neighboring patterns;
- player-origin context markers;
- one provenance-required Void Feather pattern;
- zero exact-pattern encounter-origin supporting candidates;
- zero mechanically-supported candidates.

Therefore the expected v1 output is a useful Episode Graph with:

```text
lifecycle = promotion-pending
mechanicallySupportedEdges = 0
blocker = exact-encounter-origin-edge
```

This is a successful result, not an error: Iris is representing exactly what the evidence supports and nothing more.

## Regression requirements

Tests must preserve these cases:

1. player-origin context marker remains in the graph but cannot promote;
2. mixed/unknown provenance remains provenance-required;
3. ability-level `encounter-boss` fallback cannot become a mechanically-supported edge;
4. exact pattern encounter-origin can create a mechanically-supported edge, but v1 still cannot promote;
5. background-noise and specificity-partial patterns are excluded;
6. Episode identity remains stable as context patterns change.
