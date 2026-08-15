# Progress product scope

`Progress` is the historical / strategic progression view for a selected encounter. It is deliberately different from `Live`.

## Product boundary

### Progress

Answers raid-leader questions that need a longer horizon:

- Are we actually moving forward on this boss?
- Is our best pull becoming our normal pull, or is it still an outlier?
- Are more pulls reaching the real progression zone?
- Are we converting the deepest observed stage more consistently?
- When did the last meaningful breakthrough happen?
- Are we retaining the previous raid night's level when we come back?
- How efficiently are we converting scheduled raid time into useful pulls?
- How does one raid night compare with another?

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

## Interaction contract

Progress is a strategic dashboard, not a drill-down workspace.

**Indicators are not interactive.** Stat cards, banner values, Night-over-night rows, matrix cells, legends and Progression-health cards must never mutate another table, chart or page state when clicked.

The only currently supported Progress interaction is an **explicit chart control**:

- `ALL`
- `LAST 100`
- `LAST 50`
- `LAST 25`

The chart range affects **only All-pull progression**. It must not change:

- headline metrics
- Night-over-night
- Stage consistency matrix
- Progression health

Changing chart range issues **zero additional WCL requests**.

## Strategic headline metrics

The top row is intentionally limited to five raid-leader metrics.

### 1. TOTAL PROG PULLS

Deduplicated analytical pulls in the loaded encounter-history window, with the number of clustered raid nights.

### 2. BEST PULL

Deepest observed WCL `fightPercentage` for the encounter. A kill is represented as 0% remaining.

### 3. DEEP PULL RATE

Percentage of the latest 20 scored pulls that finish within **10 percentage points of the current personal best**.

This is deliberately separate from PB. It answers whether the raid is repeatedly getting back to the area where new learning can happen.

The 10pp threshold is a product heuristic, not a mechanic claim. In a later Iris version an encounter model may replace it with validated encounter milestones.

### 4. CONSISTENCY GAP

`latest 20-pull median boss HP − personal-best boss HP`

Lower is better. A small gap means the raid's normal pull is converging toward its ceiling. A large gap means the best pull remains an outlier.

### 5. LAST BREAKTHROUGH

Age of the last **meaningful** progression event, expressed in pulls and raid nights.

A breakthrough is currently one of:

- a kill;
- first reach of a new absolute stage;
- at least 2 percentage points of meaningful depth beyond the prior breakthrough baseline.

Tiny PB changes do not reset the plateau clock.

## Progression state

The large banner is categorical rather than a misleading single percentage-point trend. Examples:

- `BREAKTHROUGH`
- `STABILIZING S3`
- `CONVERTING S3`
- `LEARNING S3`
- `PLATEAU`
- `CLEARED`

It is derived only from observable progression history: deep-pull rate, deepest-stage conversion and breakthrough age. It does not assert a cause for progression or regression.

## Stage consistency

The matrix groups the full loaded progression history into 20-pull windows and shows the percentage of pulls in each window that reached each absolute stage.

It is **independent of chart range**. This exposes the distinction between reaching a stage once and making it repeatable.

## Progression health

A dedicated strategic panel contains three metrics that are useful across raid nights and do not belong in Live.

### PHASE CONVERSION

Percentage of the latest 20 pulls reaching the deepest stage observed anywhere in loaded encounter history, compared with the previous 20 where available.

### NIGHT RETENTION / WARM-UP TAX

Measures how many pulls the latest raid night needed to re-establish the previous night's closing level.

Definition:

1. Previous closing level = median boss HP of the previous night's last five scored pulls.
2. Recovery = first point in the current night where a three-pull rolling median is within 2pp of, or deeper than, that previous closing level.
3. Surface both pulls-to-recover and elapsed active time when timestamps are available.

This is observational only. It does not infer why the raid did or did not retain execution.

### RAID THROUGHPUT

Useful pulls per active hour for the latest timestamped raid night, plus median downtime between consecutive pulls and comparison with the previous night when available.

The active interval is measured from the first analytical pull start to the final analytical pull end in the clustered raid session. Pull-to-pull gaps >=30 minutes are excluded from the downtime median.

This is not DPS. It is raid-time efficiency for the raid leader.

## Night-over-night

Night-over-night is read-only. It summarizes recent clustered raid sessions using:

- pull count;
- best depth;
- median depth;
- deep-pull repeatability using the same current deep threshold;
- median-depth change versus the preceding loaded night.

It must never act as a hidden filter.

## Data contract

`Progress` consumes only data already loaded by the application:

- `window.__AVOID_WCL__`
- `window.__AVOID_WCL_HISTORY__`

The History endpoint exposes a compact `progressionPulls` series derived from the reports it already fetches. No extra browser WCL request is introduced by Progress interactions.

The series is encounter-scoped and remains reusable for every current and future raid boss.

## Data-truth boundary

Progress may state observed historical facts and deterministic transformations of those facts. It may not use correlation to assign blame or explain a wipe.

Examples allowed:

- deep-pull rate improved by 18pp;
- median depth was 6pp deeper than the previous night;
- the latest night needed 7 pulls to recover the previous closing level;
- Stage 3 conversion rose from 35% to 70%.

Examples not allowed without separate validated evidence:

- the raid improved because of a composition change;
- a player caused the plateau;
- a specific mechanic is responsible for the regression.
