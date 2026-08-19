# Iris GLOBAL Raid Reference v1

## Purpose

AvoiD must be able to receive useful same-difficulty comparison from its first pull of a new raid. GLOBAL public WCL evidence may therefore be collected before AvoiD has any report.

The identity is always:

```text
raid -> boss -> difficulty -> partition
```

Normal, Heroic and Mythic are independent populations.

## Two different products

A **foundation reference corpus** is not accepted GLOBAL BOSS knowledge.

It exists to answer early comparative questions such as:

- Is this mechanic occurring more often in AvoiD than in public same-difficulty pulls?
- Is AvoiD dying earlier/later around a known mechanic?
- Which observed timings or failure signatures look unusual from pull one?

Accepted mechanic knowledge still requires the normal Iris evidence pipeline (specificity, exact provenance, Matched Null, independent evidence groups, Stability, untouched Holdout and Promotion contract).

## Fresh-tier flow

```text
Raid Catalog
  -> Raid Learning Availability (metadata only)
  -> boss+difficulty scopes with public evidence
  -> Raid Corpus Bootstrap preview (0 network)
  -> fingerprinted bounded initialization
  -> checkpointed GLOBAL corpus acquisition
  -> early same-difficulty reference
  -> later enrichment / scientific mechanic learning
```

The default progression reference considers Normal, Heroic and Mythic. LFR is not automatically included in the progression baseline, although it may be requested explicitly.

During RWF a valid state is:

```text
Normal  -> public reference building/ready
Heroic  -> public reference building/ready
Mythic  -> waiting-for-public-evidence
```

Heroic/Normal never fill Mythic denominators or gates.

## Foundation profile

The default `foundation` profile is deliberately bounded:

- target pulls: 300
- deep target pulls: 60
- max ranking pages: 8
- max source pages: 4
- max candidate reports: 1200

These bounds are for an early operational benchmark. They are intentionally below the canonical publication requirements and cannot auto-promote a mechanic.

## Consumer contract

Mechanics, Live, Progress, Damage/Healing and Players may consume a foundation reference as **preliminary GLOBAL comparison evidence** when their selected boss+difficulty matches exactly.

They must surface its maturity (`building`, `foundation ready`, `canonical/accepted`) rather than presenting early reference data as settled mechanic truth.

AvoiD reports remain application/evaluation data and are excluded from GLOBAL training/holdout according to the existing source policy.

## Safety rules

1. No boss, raid or difficulty numeric hardcodes in production selection.
2. Difficulty is mandatory; no silent Mythic default.
3. Availability must be established before a scope is started.
4. Preview is zero-network and fingerprinted.
5. Initialization is explicit and bounded.
6. Foundation reference cannot satisfy Promotion.
7. HOME/AvoiD cannot enter GLOBAL training/holdout.
8. Cross-difficulty comparison/evidence reuse is forbidden.
9. WCL API rate reserves and persistent checkpoints remain active.
