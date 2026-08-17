# Iris Source Contract — Wipefest

**Site:** `https://www.wipefest.gg/?gameVersion=warcraft-live`  
**Status for Iris:** mechanical-analysis/product reference only  
**Reviewed:** 2026-08-17

## Public API status — explicit answer from Wipefest

Wipefest's official FAQ asks whether an API is available for developers to extract Wipefest data and answers **no**. It states that Wipefest builds its data using the Warcraft Logs API and directs developers to use Warcraft Logs instead.

This is a hard integration boundary:

```text
Wipefest output wanted programmatically
        ↓
Do not scrape/internal-call Wipefest
        ↓
Reproduce the required evidence from the official WCL API
```

An endpoint visible in browser network traffic, an old CLI/package or an undocumented hostname is not sufficient to override this policy.

## What Wipefest provides conceptually

Wipefest analyses WCL reports to produce raid-focused **insights and timelines**. It is especially useful as a product/reference source for:

- mechanic failure analysis;
- concise per-pull questions/answers;
- death and mistake presentation;
- timeline UX;
- multi-pull comparison ideas;
- dynamic player scoring that waits for enough real data;
- encounter-specific spell/mechanic tracking.

Wipefest itself notes that player scores require enough real data and may be unavailable during the first days of a tier. This validates Iris's decision to publish `PENDING` instead of a falsely precise Reliability score when denominators/coverage are insufficient.

The live Wipefest site states that its data comes from Warcraft Logs and tooltips from Wowhead.

## Iris evidence posture

Wipefest is **derived interpretation**. It can inspire what to measure, but it cannot be the source of a score-affecting AvoiD fact.

Example:

```text
Wipefest highlights matching-color interrupt failures
    -> useful research clue
    -> Iris identifies spell IDs / event logic
    -> WCL events establish opportunities/failures
    -> AvoiD rule contract versions the metric
```

## Do not

- scrape Wipefest pages;
- reverse engineer site-internal APIs for production use;
- copy Wipefest player scores into Reliability;
- infer a WCL event from a Wipefest label;
- treat a subscriber-only aggregate as globally available data;
- poll Wipefest in LIVE mode.

## Use instead

For programmatic data: `docs/iris-sources/WARCRAFT-LOGS.md`.

For mechanic-analysis product inspiration: Wipefest pages/FAQ may be consulted manually during research, with any adopted logic rewritten as an AvoiD evidence contract and validated against WCL.
