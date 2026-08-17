# Warcraft Logs Query Playbook for Iris

This file is a standing engineering rule for AvoiD Raid Ops. **Read it before changing corpus acquisition, Iris enrichment, player evidence, Reliability, Live, or any feature that asks Warcraft Logs for more data.**

The important mental model is:

> WCL is not only a source of whole reports. It is a queryable evidence store. Prefer the smallest trustworthy query that answers the question.

This prevents us from repeatedly rediscovering that WCL can return exact fights, actors, abilities, phases, event windows and query-language filters.

## Official API capabilities to keep in mind

Warcraft Logs API v2 exposes GraphQL report `events` and `table` queries with filters including:

- `fightIDs`: exact pull/fight IDs.
- `encounterID`: exact boss.
- `difficulty`: exact difficulty.
- `abilityID`: one exact ability/game ID.
- `filterExpression`: WCL query-language expression for compound filters or multiple abilities/conditions.
- `startTime` / `endTime`: exact event-time window inside a report.
- `killType`: kills, wipes, encounters or trash where supported.
- `hostilityType`: friendlies/enemies view.
- `sourceID` / `sourceInstanceID` / `sourceClass`.
- `targetID` / `targetInstanceID` / `targetClass`.
- source/target aura-present and aura-absent filters.
- `death` and `wipeCutoff` where supported.
- `viewBy`, `viewOptions`, `translate`, `useAbilityIDs`, `useActorIDs` and event `limit`.
- `includeResources` only when resource detail is genuinely required; WCL documents it as materially increasing bandwidth.

The report `fights` field can itself be scoped by `encounterID`, `difficulty`, `fightIDs` and `killType` before an expensive event/table query is made.

WCL also documents `ReportComponentFilter`, whose fields are ANDed together, with capabilities such as:

- exact `fightIDs`,
- `actorID` including pets,
- `timestampRange`,
- `encounterID`,
- `phase`,
- `deathCutoff` (including the special called-wipe cutoff where supported),
- `killType`,
- `difficulty`.

Official schema references:

- https://www.warcraftlogs.com/v2-api-docs/warcraft/report.doc.html
- https://www.warcraftlogs.com/v2-api-docs/warcraft/reportcomponentfilter.doc.html
- https://www.warcraftlogs.com/v2-api-docs/warcraft/

Check the live schema before relying on a field that is not already covered by tests; WCL describes event/table data as non-frozen and subject to change.

## Query hierarchy: cheapest trustworthy evidence first

When Iris needs more evidence, choose the smallest layer that can answer the question:

1. **Persisted local evidence, 0 WCL.** Recompile or inspect cached Wide/Deep profiles before querying WCL again.
2. **Header/fights metadata.** Resolve exact encounter + difficulty + partition context and exact `fightIDs`.
3. **Wide tables.** Use aggregated tables when counts/presence/outcome contrast are enough.
4. **Query-guided Deep.** Pull complete event streams only for selected exact `fightIDs` that close a known evidence deficit.
5. **Surgical probe.** Use `abilityID`, `filterExpression`, actor/target filters and/or a timestamp/phase/death window to answer one concrete provenance or relationship question.
6. **Broad report/event scan only when the question genuinely requires it.** Do not default to downloading a whole report because it is easier to code.

## Canonical Deep vs surgical evidence

These are deliberately different evidence classes.

### Canonical Deep

Canonical Deep is allowed to increase Deep report/pull coverage and train/holdout model depth only when all required streams for the selected fights are complete. Current Iris Deep streams are:

- enemy casts,
- damage taken by friendlies,
- friendly interrupts,
- friendly debuffs,
- friendly buffs,
- enemy buffs,
- enemy debuffs,
- deaths.

If WCL indicates pagination/incompleteness for any required stream, the result may be cached for diagnostics but **must not count as a canonical Deep report or Deep pull**.

### Surgical probes

A surgical probe is evidence for a narrow hypothesis, for example:

- is ability `1263412` encounter-origin or friendly-player-origin?
- what cast/event occurs in the 0–5 s window before a specific aura?
- does a cast→aura relation reproduce across independent reports?
- does a signal occur only in one phase or one progress band?
- does a mechanic differ between kills and wipes?
- was a defensive available/cast inside a lethal window for one player?

Typical filters may look conceptually like:

```text
fightIDs: [specific pulls]
abilityID: 1263412
startTime/endTime: narrow window
sourceID/targetID: exact actor where relevant
filterExpression: ability.id IN (1243852, 1243854, ...)
```

A surgical probe can raise provenance/relationship confidence only under the relevant evidence contract. **It never masquerades as a complete Deep sample and therefore contributes 0 Deep reports / 0 Deep pulls by itself.**

## Iris acquisition rules

These are non-negotiable unless a future version explicitly changes and documents the contract:

- Lock GLOBAL BOSS knowledge to `encounter + difficulty + partition`.
- Never mix partitions silently.
- AvoiD/home-guild and known home-uploader data are evaluation/application evidence, not GLOBAL BOSS train/holdout evidence.
- Prefer independent-source breadth over repeatedly sampling one prolific uploader/guild.
- Preserve source provenance and deduplicate report/fight evidence.
- Holdout remains source-isolated from training.
- Unverified relation hypotheses are diagnostic only.
- Unknown provenance is not proof of encounter origin.
- Unknown defensive availability is not a missed defensive.
- A query result that cannot support its denominator must not fabricate a success/opportunity.
- Post-wipe/death-cutoff evidence must be excluded when the metric contract requires pre-wipe execution only.
- Protect the hourly WCL rate budget and checkpoint before waiting for reset.
- Cache compact derived evidence so recompilation and future analysis can run at 0 WCL whenever possible.

## Choosing fights and windows

Do not select Deep evidence randomly when the model tells us what is missing. Prefer fights that close one or more explicit deficits:

- missing Deep reports,
- missing Deep pulls,
- missing train/validation breadth,
- missing independent Deep sources,
- kill/deep-wipe/mid-wipe/early-wipe imbalance,
- missing ability provenance,
- missing state/phase coverage,
- unresolved temporal relations,
- player opportunity/defensive/lethal-window evidence required by Reliability.

For event-level questions, narrow the query further with `startTime/endTime`, phase or actor filters when that preserves the evidence needed to answer the question.

## Current query-guided Deep policy

`query-guided-deep-v1` upgrades already-cached Wide reports before buying more Wide evidence when the canonical Wide pool is trustworthy but Deep evidence is missing.

The planner:

- selects exact reports from trusted independent sources,
- selects exact `fightIDs` inside those reports,
- balances progression outcomes,
- uses unresolved/focus ability IDs as a prioritization signal,
- fetches full required streams only for selected fights,
- keeps ability/time-window probes separate as non-counting diagnostics,
- refuses to manufacture Deep coverage from incomplete streams.

This means a model with strong Wide diversity but zero/weak Deep should normally ask for **query-guided targeted Deep**, not another broad Wide crawl merely because `deepOutcomeCoverage` is currently false. Deep coverage is repaired by acquiring Deep evidence.

## Before writing a new WCL query

Answer these questions in code review or implementation notes:

1. What exact evidence question are we answering?
2. Can persisted data answer it at 0 WCL?
3. Can a table answer it instead of raw events?
4. Which exact fights/actors/abilities/time window are needed?
5. Does this query create canonical coverage, or only diagnostic evidence?
6. How is completeness detected?
7. How is source/provenance retained?
8. What prevents duplicate evidence?
9. What happens when WCL paginates, rate-limits or changes a contract?
10. Can the result be stored compactly so we never need to buy the same evidence again?

If those questions are not clear, do not broaden the query by default.
