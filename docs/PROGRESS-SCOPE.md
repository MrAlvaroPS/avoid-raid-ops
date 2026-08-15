# Progress product scope

`Progress` is the historical / strategic progression view for a selected encounter. It is deliberately different from `Live`.

## Product boundary

### Progress

Answers the raid-leader questions that need a longer horizon:

- Are we actually moving forward on this boss?
- How many progression pulls and raid nights have we invested?
- Is median depth improving, not just the single best pull?
- Are we reaching the deepest observed stage more consistently?
- When did the last real breakthrough happen?
- Is the current 20-pull block better or worse than the previous block?
- How did one raid night compare with another?

The primary unit is the **encounter progression history**, spanning reports and raid nights.

### Live

Owns the current raid night and the seconds between pulls:

- selected/current pull
- previous-pull comparison
- KEEP / FIX-WATCH / NEXT PULL
- current blocker
- player execution
- deaths / defensives / mechanic evidence
- immediate next-call recommendations

A between-pull brief must not live in `Progress`.

## Progress default views

The progression chart uses historical analytical pulls for the same encounter + difficulty, deduplicated across reports. Its range controls are:

- ALL
- LAST 100
- LAST 50
- LAST 25

These ranges change only the presentation window. They do not issue extra WCL requests.

## Progress headline metrics

The strategic headline metrics are:

1. **TOTAL PROG PULLS** — deduplicated analytical pulls in the history window.
2. **RAID NIGHTS** — clustered progression sessions containing the encounter.
3. **BEST PULL** — deepest WCL `fightPercentage` observed.
4. **LAST 20 MEDIAN** — median remaining boss HP over the latest 20 analytical pulls.
5. **DEEPEST STAGE REACH** — percentage of the latest 20 pulls reaching the deepest absolute stage observed in the encounter history.

The banner trend compares the latest 20-pull median with the previous 20-pull median when both windows exist, falling back to 10 vs 10 for smaller samples. Lower remaining boss HP means deeper progression.

## Stage consistency

The matrix is not a live pull inspector. It groups the progression history into 20-pull windows and shows the percentage of pulls in each window that reached each absolute stage. This exposes whether a newly reached stage is becoming repeatable.

## Data contract

`Progress` consumes only data already loaded by the application:

- `window.__AVOID_WCL__`
- `window.__AVOID_WCL_HISTORY__`

The History endpoint exposes a compact `progressionPulls` series derived from the reports it already fetches. No extra browser WCL request is introduced by changing a Progress range.

The series is encounter-scoped and remains reusable for every current and future raid boss.
