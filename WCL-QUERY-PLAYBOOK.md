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

### Event pagination is part of completeness, not an error condition

WCL `events` is paginated. The official API permits `limit` values from 100 to 10,000 events and returns a `nextPageTimestamp` when more matching events remain. A non-null cursor therefore means **continue the same evidence query**, not "this report is bad".

Standing rules:

- A first page of 10,000 events is never considered a complete stream merely because the HTTP/GraphQL request succeeded.
- Continue a paginated stream using `startTime = nextPageTimestamp` while preserving the exact same report, `fightIDs`, event type, hostility and other filters.
- When one GraphQL request aliases multiple streams, treat every alias as an **independent paginator**. DamageTaken, Buffs, Debuffs, Casts, etc. can expose different cursors at the same time.
- Continuation requests should include only aliases that are still paginated; never redownload an already-complete stream merely because another stream needs another page.
- A cursor must advance. If WCL returns the same/older cursor, stop that stream, mark it incomplete and expose the condition instead of looping.
- Use a bounded continuation safety limit. Reaching it leaves the stream incomplete; it does not manufacture coverage.
- Merge all pages before normalization/provenance analysis so counts and temporal relations are computed over the complete selected fight set.
- Preserve pagination diagnostics (`pages`, event counts, final cursor, query count, stalled/max-round reason) in the derived Deep profile.
- Canonical Deep still requires all eight streams complete after pagination. Pagination support lowers false incompleteness; it does not weaken the evidence gate.

This is especially important for normal progression reports: several selected pulls can easily push DamageTaken, Buffs or Debuffs beyond 10,000 events even though the underlying report is perfectly valid.

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

## Raid-night density is context, not an anomaly filter

AvoiD's observed progression cadence is an important domain constraint for corpus logic: **a roughly two-hour progression session can legitimately contain around 20–25 pulls of the same boss**, especially while wiping and iterating quickly. A clear/farm night can move through bosses much faster and therefore show far fewer attempts on each boss.

Engineering consequences:

- Do **not** reject, down-rank or mark a report suspicious merely because it contains 20+ valid pulls of one progression boss.
- Pull count per report is not a quality score and is not evidence of duplication by itself.
- Deduplication must use actual report/fight/source evidence, not an arbitrary "too many pulls" threshold.
- A per-report Deep sampling cap exists to control statistical correlation and WCL cost, **not** because pulls beyond that cap are considered invalid.
- If a report contains 25 valid progression pulls and the current policy samples 6, the other 19 remain valid cached evidence that can be used by a later query or policy version.
- Deep report and Deep pull targets are simultaneous **minimum** evidence gates. If 50 independent reports provide only 265 selected fights under the per-report cap, Iris should add more independent reports/sources until the pull minimum is met, rather than lowering the pull target or assuming the sparse sample is complete.
- If the available cache cannot satisfy both minima, expose the exact shortfall and stop honestly; never fabricate coverage.

This density guidance is a product/domain assumption supplied from real raid practice. It should be revisited only if observed WCL data shows a materially different distribution, and any resulting sampling-policy change must be versioned.

## Current query-guided Deep policy

`query-guided-deep-v3` upgrades already-cached Wide reports before buying more Wide evidence when the canonical Wide pool is trustworthy but Deep evidence is missing.

The planner/executor:

- selects exact reports from trusted independent sources,
- selects exact `fightIDs` inside those reports,
- balances progression outcomes,
- treats requested Deep report and pull counts as simultaneous minimum gates,
- may select additional independent reports beyond the report minimum to satisfy the pull minimum,
- keeps a conservative per-report fight cap to limit correlated evidence without declaring dense reports invalid,
- uses unresolved/focus ability IDs as a prioritization signal,
- fetches full required streams only for selected fights,
- independently paginates any Deep stream whose WCL `nextPageTimestamp` is non-null,
- keeps ability/time-window probes separate as non-counting diagnostics,
- refuses to manufacture Deep coverage from incomplete or stalled streams.

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
