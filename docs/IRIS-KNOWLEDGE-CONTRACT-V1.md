# Iris Knowledge Contract v1

Status: **required architectural contract**

Contract id: `iris-knowledge-contract-v1`
Sampling policy: `boss-corpus-sampling-v3`

## Purpose

Iris owns two different kinds of knowledge and they MUST NOT be trained from the same population.

1. **GLOBAL BOSS KNOWLEDGE** answers: _What does this encounter do and what patterns reproduce across independent raids?_
2. **HOME RAID / PLAYER KNOWLEDGE** answers: _How is AvoiD executing that encounter, and how reliably is each AvoiD raider executing it?_

Mixing these populations creates circular reasoning. AvoiD cannot teach Iris what the boss is and then be scored against the same AvoiD evidence as if it were an external truth set.

---

## 1. GLOBAL BOSS KNOWLEDGE

Canonical identity:

`encounterId + difficulty + partition`

These dimensions are hard boundaries, not filters applied after training.

- Mythic, Heroic and Normal models are independent.
- Different WCL partitions are independent even for the same difficulty.
- A model from one difficulty/partition MUST NOT contribute mechanics, timings, thresholds or validation evidence to another.

Global boss knowledge may contain:

- encounter abilities and variants;
- phase/stage timing and transitions;
- casts, interrupts and completion patterns;
- buffs/debuffs and inferred state dimensions;
- damage windows and target-count distributions;
- origin-verified temporal relationships;
- kill/deep-wipe/mid-wipe/early-wipe evidence;
- source-level provenance required for train/holdout isolation.

Global boss knowledge MUST NOT contain persistent home-raider identity. WCL report-local `friendlyPlayers` actor ids may exist in the transient report header only long enough to classify event origin. They are stripped before a Wide or Deep global-boss profile is persisted.

### Home-source exclusion

AvoiD is the home raid source. The current default guild id is `788166`. The resolver is:

`AVOID_HOME_GUILD_ID -> WCL_GUILD_ID -> default AvoiD guild id`

A home source means either:

- a report whose WCL guild id is the configured AvoiD guild; or
- a personal/un-guilded report owned by a known AvoiD WCL uploader.

Known personal uploader ids can be configured through `AVOID_HOME_WCL_OWNER_IDS`. Iris also learns uploader ids from cached/discovered AvoiD guild reports when WCL exposes the owner.

Any home-source report:

- MUST NOT enter global boss train;
- MUST NOT enter global boss holdout;
- MUST NOT be persisted as a new global Wide/Deep profile when its home identity is known at ingestion time;
- MUST be excluded and purged from legacy global profile caches during canonical 0-WCL rebuild;
- MAY be used by the separate HOME RAID / PLAYER KNOWLEDGE path.

This owner-level rule closes the case where an AvoiD raider uploads a personal log with no WCL guild association.

---

## 2. BALANCED INDEPENDENT-SOURCE SAMPLING

The raw WCL cache and the canonical training sample are intentionally different concepts.

- **Cache**: every useful public report Iris has already paid WCL to inspect and persist.
- **Canonical sample**: the subset allowed to influence boss knowledge.

The canonical sample is rebuilt locally from persisted profiles and therefore can be rebalanced with **0 additional WCL requests**.

### Source round-robin

Canonical report selection is independent-source round-robin.

A source is:

1. `guild:<guildId>` when WCL exposes a guild;
2. otherwise `user:<ownerId>` for personal logs.

Reports with neither source identity are not allowed into the canonical boss sample because treating each unknown report as its own source would manufacture fake diversity.

Round-robin invariant:

> An active source cannot receive its second canonical report while another active source has fewer canonical reports available for selection.

Within the current source round, the report that best fills missing progression-outcome coverage is selected first. Ties are deterministic.

Source-history discovery also rotates source pages instead of draining one source first, and Wide acquisition prefers sources with fewer already-processed reports when provenance is known. Canonical compile-time balancing remains the final authority.

### Hard source-concentration caps

Round-robin alone is insufficient when many small sources exhaust after one report while one prolific source still has dozens available. Therefore `boss-corpus-sampling-v3` applies a deterministic concentration trim after round-robin selection.

When the available independent-source count is large enough for the cap to be mathematically achievable, raw pull targets MUST NOT override these limits:

- max one-source share of canonical Wide reports: `10%`;
- max one-source share of canonical Wide pulls: `12%`;
- max one-source share of canonical Deep reports: `20%`;
- max one-source share of canonical Deep pulls: `25%`.

If satisfying a cap requires selecting fewer total pulls than the requested raw pull target, the balanced smaller sample wins. Cached reports are retained; they are not deleted merely because they are excluded from the canonical sample.

If too few independent sources exist to make a cap possible, the sampler MUST NOT delete honest evidence merely to manufacture a compliant percentage. In that case the manifest records that the cap was not applicable and the publication gates remain responsible for blocking maturity/publication.

The concentration trim is outcome-aware: among removable reports from an overrepresented source, it prefers removals that least damage the missing kill/deep/mid/early target coverage. Ties are deterministic.

### Source concentration publication gates

The hard canonical caps and the publication checks intentionally use the same default thresholds. Publication additionally verifies the persisted manifest rather than trusting the sampling path implicitly.

These gates complement the existing minimum independent-source and isolated-holdout requirements.

A source can therefore have many cached reports while only a balanced subset is permitted to affect the model.

---

## 3. PULL-LEVEL OUTCOME STRATIFICATION

Stratification is evaluated on **actual fights**, not just on a report label.

Canonical strata:

- `kill`;
- `deepWipe`: non-kill with WCL `fightPercentage < 50`;
- `midWipe`: non-kill with WCL `50 <= fightPercentage < 90`;
- `earlyWipe`: remaining non-kills or missing measurable depth.

Target pull weights are currently:

- kill: `20%`;
- deep wipe: `30%`;
- mid wipe: `30%`;
- early wipe: `20%`.

These are sampling targets, not fabricated counts and not a claim that the natural population has those frequencies.

A mixed report is handled correctly. Example: a report containing one kill, twenty deep wipes and ten early wipes contributes `1 / 20 / 0 / 10` to the strata. It is not treated as a pure kill report merely because it contains a kill.

The sampler first preserves source round-robin fairness, then selects the report in that source that best reduces the current pull-level stratum deficits. The source-concentration trim may then remove overrepresented-source reports while minimizing additional outcome deficit.

### Outcome publication gates

The canonical Wide sample requires all four outcome strata to be represented by at least 8 independent sources by default.

The canonical Deep sample requires all four outcome strata to be represented by at least 3 independent sources by default.

This prevents a model trained mostly from kills, mostly from early progression, or mostly from one depth band from being declared mature.

---

## 4. TRAIN / HOLDOUT ISOLATION

Train/holdout assignment remains deterministic by independent source.

All reports from one guild/uploader go to exactly one side. Reports from the same source MUST NOT be split between train and validation.

This means validation asks a meaningful question:

> Does the pattern reproduce in raid groups Iris did not train on?

A large number of reports from the same guild is not equivalent to independent validation.

---

## 5. HOME RAID / PLAYER KNOWLEDGE

Home raid knowledge is a separate namespace and population.

Canonical identity begins with:

`homeGuildId + encounterId + difficulty + partition`

Only a trusted home source is allowed to write this scope: the configured AvoiD guild or a known AvoiD WCL uploader. External guilds/uploaders are rejected.

This scope is where Iris may learn and retain AvoiD-specific facts such as:

- roster identity;
- stable WCL character identity;
- Reliability evidence;
- repeated mechanic mistakes;
- adaptation speed and clean streaks;
- defensive availability and lethal-window evidence;
- role/spec contribution;
- composition and assignment execution;
- current-form and historical AvoiD progression.

External players MUST NOT enter this ledger, Reliability, AvoiD player matrices or player-focus recommendations.

Global boss evidence may be applied to home-raid evidence, but the dependency is one-way:

`GLOBAL BOSS KNOWLEDGE -> evaluate HOME RAID`

Never:

`HOME RAID -> teach GLOBAL BOSS -> evaluate the same HOME RAID as independent truth`

---

## 6. MODEL MATURITY AND PUBLICATION

`Boss Learned` is not allowed to mean only "a lot of data was downloaded".

The sampling policy adds a `samplingBalancePct` learning component and publication checks for:

- sampling manifest present;
- zero selected home-source evidence, including known AvoiD personal uploaders;
- exact encounter+difficulty+partition scope isolation;
- complete trusted source identity;
- Wide report concentration;
- Wide pull concentration;
- Deep report concentration;
- Deep pull concentration;
- all four Wide outcome strata;
- all four Deep outcome strata.

Safety caps:

- missing canonical sampling manifest caps maturity below mature use;
- missing source identity caps maturity;
- source concentration caps maturity;
- missing pull-outcome coverage caps maturity;
- Deep imbalance caps maturity;
- any selected home-source contamination forces maturity to zero.

The existing relation provenance, semantic, signal, data-depth and isolated-holdout gates still apply. Sampling does not replace them.

The sampling policy MUST be applied before the model is persisted. A legacy compiler-level `published` result cannot bypass these gates through another runtime consumer.

---

## 7. ZERO-WCL REBALANCE

`RECOMPILE · 0 WCL` now means more than rerunning the compiler.

It must:

1. read persisted Wide/Deep report profiles for one exact `encounter+difficulty+partition`;
2. stamp legacy profiles missing an internal partition only from their already partition-scoped storage path;
3. strip legacy persisted `friendlyPlayers` lists;
4. recover known AvoiD uploader ids from cached AvoiD guild profiles plus configuration/job provenance;
5. reject/purge every known home-source profile;
6. reject wrong-scope profiles;
7. reject reports without trustworthy source identity;
8. source-round-robin the Wide sample;
9. fill pull-outcome deficits using actual fights;
10. hard-trim overrepresented Wide sources when the configured caps are achievable;
11. restrict Deep selection to reports present in the canonical Wide sample;
12. source-round-robin and outcome-balance Deep;
13. hard-trim Deep report and pull concentration when achievable;
14. rebuild train/holdout aggregate from the selected profiles;
15. compile and apply sampling publication policy;
16. persist a sampling manifest including hard-cap applicability, trims and resulting concentration.

No WCL query is required for those steps.

Cached external reports that are not selected are intentionally retained so later policy changes can rebalance the corpus without paying WCL again.

---

## 8. REQUIRED INVARIANTS

The following are testable product invariants:

1. Same encounter + different difficulty => different boss model.
2. Same encounter + same difficulty + different partition => different boss model.
3. AvoiD guild report => zero contribution to boss train and holdout.
4. Known AvoiD personal uploader report => zero contribution to boss train and holdout.
5. Missing source identity => zero contribution to canonical boss train and holdout.
6. Same source cannot be represented as multiple fake independent sources.
7. Train/holdout never split reports from the same source.
8. Source round-robin keeps selected report counts per active source within one round of each other until sources exhaust.
9. When enough sources exist for configured concentration caps to be achievable, an exhausted-source pattern cannot allow one prolific source to exceed the canonical cap merely to hit the raw pull target.
10. If caps are mathematically impossible because there are too few independent sources, the sampler does not delete evidence to fake compliance.
11. Outcome statistics are pull-level, not report-label-level.
12. Mixed kill/progression reports contribute to every actual fight stratum they contain.
13. Persisted global profiles contain no `friendlyPlayers` list.
14. External source/player evidence cannot be written through the home-raid scope guard.
15. Recompile/rebalance uses persisted evidence and makes zero WCL requests.
16. Unverified corpus evidence still cannot raise player Reliability directly.
17. Global boss knowledge never stores or derives a Reliability score for an external player.
18. Runtime cannot consume a legacy published boss model that lacks the current knowledge/sampling contract.
19. Sampling contamination counters are derived from selected evidence, not trusted as caller-supplied flags.

---

## 9. Operational architecture

```text
PUBLIC WARCRAFT LOGS
        |
        | many independent external guilds/uploaders
        v
RAW PUBLIC REPORT CACHE
        |
        | 0-WCL canonical rebalance
        v
GLOBAL BOSS KNOWLEDGE
encounter + difficulty + partition
        |
        | boss mechanics / timing / states / relations
        v
      IRIS
        ^
        | trusted AvoiD guild/uploader reports only
        |
HOME RAID / PLAYER KNOWLEDGE
home guild + encounter + difficulty + partition
```

The report selected in the AvoiD UI is therefore an **application/evaluation source**, not the definition of the boss.
