# AvoiD Execution Context v1

Status: architecture contract for the Golden UI and server read models.

## Problem

AvoiD Raid Operations has three different data planes that must not be collapsed into one global filter:

1. **GLOBAL Iris Boss Knowledge** — official + structural + public WCL evidence by exact `boss + difficulty`. HOME/AvoiD is excluded from GLOBAL training/holdout.
2. **AvoiD History** — persisted HOME pulls already synchronized from WCL. This is the default source for progression, player history and other HOME aggregate views.
3. **Active Report** — an explicitly supplied WCL report, either static or live. It is an ephemeral execution context until the operator explicitly refreshes/commits HOME history.

A page may consume one, two or all three planes, but it must declare which. A report/pull selector is not a global application filter.

## Header model

The desktop header should expose two grouped controls instead of the old prototype boss/difficulty/reset selectors:

```text
AvoiD HISTORY
[ All pulls (default) ▾ ] [ Refresh history ]

ACTIVE WCL REPORT
[ paste WCL URL ................................ ] [ Live ☐ ] [ Load / Start ] [ Stop ]
```

`All pulls` is the default `pullSelection`. Selecting an individual pull publishes a pull-selection context, but only pull-aware consumers react to it. Aggregate or GLOBAL pages do not silently collapse to one pull.

The historical selector is populated only from persisted AvoiD history. Opening the application does not call WCL.

## Network contract

Normal page load:

```text
browser -> persisted local/private read models only
WCL calls = 0
```

WCL network is allowed only after an explicit operation or an already-running server-side job:

- `Refresh history`
- `Load` a static WCL URL
- `Start` a live WCL URL
- live polling while that explicit live session remains active
- separately managed GLOBAL corpus/learning workers

A browser refresh must not implicitly resynchronize WCL.

## AvoiD History

History is a durable HOME dataset, not a request assembled from WCL every time a page renders.

Identity is at minimum:

```text
guildId + encounterId + difficulty + reportCode + fightId
```

The history updater is incremental. It keeps a synchronization high-water mark, asks WCL only for new/changed reports, normalizes pulls and writes immutable/revisioned HOME evidence plus derived read models.

A live Active Report does **not** automatically mutate historical aggregates. Closed live pulls may be shown immediately in Live through the active context. They become part of canonical AvoiD History when the history refresh/import operation confirms and persists them.

## Active Report

The input accepts a WCL report URL or report code.

The first request is a **lightweight report manifest**, not full telemetry. Its job is to classify:

- report identity
- raid zone
- report guild
- fights
- `encounterId`
- difficulty **per fight**
- in-progress/completed state

A WCL report is never assigned one difficulty globally because one report may contain multiple encounters or difficulties.

The active scope is selected from the explicit fight in the URL when present; otherwise the newest in-progress fight; otherwise the newest raid fight.

## Live semantics

A newly created live report can legitimately have zero fights. This state is first-class:

```text
LIVE · CONNECTED · WAITING FOR FIRST COMBAT
```

It is not an error, a failed pull, zero-percent execution or missing mechanic evidence. Boss+difficulty remains unresolved until WCL exposes the first encounter fight.

Polling should be two-tiered:

1. Poll a cheap report manifest at a conservative interval.
2. Fetch heavier report/telemetry/event products only when the manifest fingerprint changes in a way relevant to analysis (new fight, fight state/progress change, fight closes, report revision changes).

`Stop` stops future polling but leaves the last loaded Active Report available for static inspection.

## Pull selection

Canonical state:

```text
all
```

or

```text
single fightId
```

`all` means no pull override. It is not equivalent to "merge every dataset in the product".

Examples:

- Pull Lab: pull-aware; a selected pull may become one side of comparison.
- Damage & Healing / Defensive Audit: may opt into the selected pull when in execution mode.
- Progress: historical aggregate; ignores a single active pull selector unless an explicit detail subview asks for it.
- Players: historical HOME model; does not become a one-pull player ranking because the header changed.
- Mechanics → Iris Boss Knowledge: GLOBAL/report-independent; ignores Active Report and pull selection.
- Mechanics → Raid Execution: consumes the exact HOME/Active report scope only when `encounterId + difficulty` matches.
- Live: consumes Active Report and may compare each new HOME pull with GLOBAL Public Reference and persisted AvoiD History.

## Isolation rules

1. `GLOBAL Iris` never trains on HOME/AvoiD.
2. `Active Report` never silently mutates `AvoiD History`.
3. A report manifest classifies difficulty per fight; cross-difficulty aggregation is forbidden.
4. Empty live report is waiting, not failure.
5. Pull selection is opt-in per consumer.
6. Persisted history is the default HOME source on first page load.
7. First page load performs zero WCL network calls.
8. GLOBAL/public corpus jobs are operationally separate from browser Active Report polling.

## Product outcome

On the first raid night AvoiD can paste the live-log URL before the first pull. Iris waits without producing false negatives. When a fight appears, its exact boss+difficulty is resolved, the relevant GLOBAL boss model/reference is loaded, and Live can compare that first AvoiD pull against public evidence even though AvoiD has no prior pull for the boss.

At the same time, Progress/Players keep using the persisted HOME historical line, and report-independent Mechanics knowledge remains unchanged.
