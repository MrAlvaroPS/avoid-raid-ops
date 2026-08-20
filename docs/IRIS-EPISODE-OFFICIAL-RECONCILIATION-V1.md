# Iris Episode Official Reconciliation v1

## Purpose

This layer reconciles an already-built empirical Mechanic Episode with the persisted Blizzard Encounter Journal graph for the same WCL encounter.

It exists to answer a narrow question before Iris spends more empirical effort:

> Is this candidate officially placed in the same mechanic branch as the anchor, elsewhere in the same stage, in another stage, or not published in the Journal graph?

It does not replace WCL and does not create causal claims.

## Evidence roles

```text
Blizzard Journal
  -> official published hierarchy / membership

WCL
  -> observed occurrence / actors / targets / timing / outcomes

Episode official reconciliation
  -> hypothesis priority only
```

Official semantics never become negative combat evidence merely because two abilities are in different Journal branches.

## Reconciliation states

```text
same-official-section
same-official-mechanic-branch
same-stage-different-official-branch
different-official-stage
official-membership-unresolved
```

The first two are semantically aligned with a native parent/child hypothesis.

The latter two normally reduce the priority of investigating the candidate as a native child of the anchor, but they do not prove that the abilities cannot interact in combat.

`official-membership-unresolved` is neutral.

## Investigation guidance

For candidates without exact empirical mechanical support:

```text
same section / same mechanic
  -> officially-aligned-hypothesis

same stage, different mechanic branch
  -> deprioritize-as-native-child-unless-new-empirical-hypothesis

different stage
  -> deprioritize-across-stage-unless-new-empirical-hypothesis

unresolved
  -> official-semantics-unresolved
```

If exact WCL evidence already produced a `mechanically-supported` edge, official branch differences do not erase or demote it:

```text
retain-empirical-support
```

That preserves the evidence doctrine: Blizzard defines published semantics; WCL remains combat truth.

## Fingerprinting

The base Mechanic Episode keeps its original empirical build fingerprint as:

```text
empiricalBuildFingerprint
```

The reconciled Episode receives a new `buildFingerprint` derived from:

- the empirical build fingerprint;
- Blizzard graph fingerprint;
- reconciliation version;
- candidate relationship states and investigation guidance.

A Blizzard build change can therefore produce a new interpretation revision without rewriting old empirical evidence.

## Runtime behavior

`POST /api/wcl/mechanic-episode` now attempts a zero-network stored lookup using:

```text
WCL encounterId -> persisted Blizzard Journal alias
```

No Blizzard request is made while building the Episode. No WCL request is made by the reconciliation layer.

If official knowledge is unavailable, the empirical Episode remains valid and receives:

```text
officialReconciliation.status = not-available
```

## Hard invariants

- 0 WCL calls.
- 0 Blizzard/provider network calls.
- `promotionEffect = none`.
- cross-branch placement is not negative evidence.
- official semantics cannot satisfy exact-pattern provenance.
- official semantics cannot create or remove a mechanically-supported WCL edge.
- official semantics cannot automatically promote a mechanic.

## Belo'ren validation

The persisted official graph currently places:

```text
1241163 Void Feather
  Stage One: Phoenix Reborn
  -> Voidlight Convergence
  -> Void Feather

1243866 Voidlight Rupture
  Stage One: Phoenix Reborn
  -> Radiant Echoes
  -> Voidlight Rupture
```

Therefore their official relationship is:

```text
same-stage-different-official-branch
```

For the current Voidlight Rupture investigation, this means Void Feather should be deprioritized as a native child of Voidlight Rupture unless materially new empirical evidence justifies a different interaction hypothesis. It does not mean the two can never co-occur or interact.
