# Iris Episode Structural Reconciliation v1

## Purpose

`mechanic-episode-structural-reconciliation-v1` combines an already-built empirical Episode with the current persisted build-pinned DB2 spell-structure snapshot.

It runs **after** Blizzard official hierarchy reconciliation and performs zero network calls.

Its job is not to prove mechanics. Its job is to decide whether structural client metadata creates a materially new hypothesis worth checking in WCL.

## Evidence order

```text
WCL Episode
  observed neighborhood + actor provenance
        ↓
Blizzard reconciliation
  official same/different branch context
        ↓
DB2 structural reconciliation
  direct/indirect spell wiring for exact build
        ↓
next empirical investigation decision
```

The evidence classes remain separate.

## Core rule

A Blizzard cross-branch result normally deprioritizes a native parent/child hypothesis.

```text
same-stage-different-official-branch
  -> deprioritize-as-native-child-unless-new-empirical-hypothesis
```

However, a **direct build-pinned DB2 edge between the Episode anchor and candidate** is materially new structural evidence.

In that case Iris changes only the investigation guidance:

```text
investigate-direct-db2-link-with-wcl
```

It does not change the official branch classification and does not create causal combat evidence.

Therefore:

```text
Blizzard says: different published branches
DB2 says:      direct implementation link exists
Iris says:     interesting; verify the observed relationship in WCL
```

This avoids both extremes:

- discarding a real implementation relationship merely because the Journal is human-facing and grouped differently;
- treating a DB2 edge as proof that a specific combat event caused another.

## Structural statuses

For each non-anchor Episode node:

```text
direct-anchor-structural-link
structurally-related
no-known-structural-relation
```

The node retains:

- inbound normalized DB2 relations;
- outbound normalized DB2 relations;
- direct anchor relations;
- exact DB2 build;
- structural snapshot fingerprint;
- previous Blizzard official semantics;
- observed actor provenance unchanged.

## Semantic origin candidate

Actor provenance and semantic origin remain distinct.

If WCL observes a candidate as player-origin but build-pinned DB2 shows a suitable inbound relationship from the anchor or an officially encounter-associated spell, Iris may emit:

```text
encounter-applied-player-state-candidate
```

This is diagnostic only.

It means:

> Player-side event ownership may be an implementation artifact of an encounter-applied state, and the relationship deserves empirical verification.

It does **not** mean:

- actor provenance becomes encounter-origin;
- the DB2 source was observed in the pull;
- causality is established;
- exact-pattern provenance is satisfied;
- the mechanic can be promoted.

If actor provenance is already encounter-origin, the semantic-origin diagnostic remains `encounter-action-observed`; DB2 is supplementary.

## Non-direct structural context

A candidate can have DB2 relations that do not connect directly to the Episode anchor.

That information is retained as:

```text
structurally-related
```

but it does not by itself cancel Blizzard cross-branch deprioritization.

This distinction matters because large spell graphs contain many implementation relationships. Iris must not turn generic graph connectedness into a reason to investigate everything.

## Build safety

The Episode route reads structural knowledge by WCL encounter ID at zero network calls.

If current Blizzard official knowledge implies a different client build than the stored DB2 snapshot:

```text
stale-build-rejected
```

The structural snapshot is not applied.

The Episode build fingerprint includes the structural snapshot fingerprint when applied. A DB2/build revision therefore produces a new derived Episode interpretation without rewriting historical WCL evidence.

## Promotion boundary

Permanent invariants:

```text
structuralMetadataCanPromote = false
structuralMetadataCanSatisfyExactPatternProvenance = false
structuralMetadataCanOverrideActorProvenance = false
structuralDirectLinkIsCausalCombatEvidence = false
```

A direct DB2 edge can reprioritize a research question. It cannot answer the research question on its own.

## Belo'ren implication

Real build `12.1.0.68914` confirmed:

```text
1243560
  -- SpellEffect.EffectTriggerSpell -->
1241163 Void Feather
```

For the current Voidlight Rupture Episode, this does **not** directly connect `1243866 Voidlight Rupture` to `1241163 Void Feather`.

Therefore the existing Blizzard result remains meaningful:

```text
Void Feather
  -> Voidlight Convergence

Voidlight Rupture
  -> Radiant Echoes

same-stage-different-official-branch
```

The DB2 result explains that Void Feather has internal/helper wiring, but it does not rehabilitate Void Feather as a native child of Voidlight Rupture.

This is exactly the desired behavior: structural evidence enriches interpretation without undoing stronger evidence boundaries.
