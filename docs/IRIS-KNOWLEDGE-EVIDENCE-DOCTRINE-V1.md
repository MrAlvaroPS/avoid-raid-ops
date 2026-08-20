# Iris Knowledge & Evidence Doctrine v1

**Status:** canonical operating doctrine  
**Applies to:** all Iris encounter learning, raid analysis, pull diagnosis and future provider integration  
**Introduced:** v3.9.9  
**Parent principle:** use the best source for the question being answered; never let one evidence class impersonate another.

This document is the permanent decision framework for how Iris learns what a World of Warcraft encounter **is**, understands how its spell IDs are **structurally wired**, determines what **actually happened** in combat, and turns all of that into useful recommendations for AvoiD.

It is intentionally more durable than a single feature implementation. Future versions may add providers, statistical gates or UI surfaces, but they must preserve this evidence model unless a new explicitly versioned doctrine replaces it.

---

## 1. The fundamental split

Iris must always distinguish three questions:

```text
WHAT IS THE ENCOUNTER / MECHANIC?
        ↓
Blizzard official published game data

HOW ARE SPELL IDS STRUCTURALLY WIRED IN THIS BUILD?
        ↓
build-pinned WoW client DB2 structural metadata

WHAT ACTUALLY HAPPENED IN A PULL?
        ↓
Warcraft Logs observed combat data
```

The sources are complementary, not competing.

### Blizzard answers official semantic questions

Blizzard is Iris's preferred first-party source for the encounter structure Blizzard currently publishes for the active game build:

- encounter identity;
- instance/raid identity;
- Encounter Journal hierarchy;
- stages/phases where published;
- mechanic and submechanic grouping;
- spell IDs and names attached to Journal sections;
- official mechanic/role/overview descriptions;
- build/namespace revision exposed by the provider.

If Blizzard already publishes a static encounter fact, Iris should **not spend WCL event budget rediscovering that fact statistically**.

### Build-pinned DB2 answers structural implementation questions

The reviewed Wago DB2 integration is Iris's bounded structural source for client-side spell relationships that the human-facing Encounter Journal may not expose.

Current v1 scope is deliberately narrow:

```text
SpellEffect.SpellID
  -- EffectTriggerSpell -->
triggered spell ID
```

The exact DB2 build must be derived from the persisted Blizzard namespace. Iris must never use an unpinned `latest` build for encounter interpretation.

DB2 structure can explain why an internal/helper ID points to an official Journal spell, but it cannot prove that either event occurred in a pull, who caused it in WCL, or that one observed event caused another.

### Warcraft Logs answers empirical combat questions

Warcraft Logs ReportData is Iris's canonical empirical source for:

- whether an event actually occurred;
- exact fight and timestamp;
- casts, auras, damage, healing and other combat events;
- observed source and target actors;
- ordering and temporal neighborhoods;
- pull outcomes;
- repeated behavior across pulls/sources;
- AvoiD's concrete raid execution.

Blizzard/DB2 metadata cannot prove any of those facts for a particular pull.

### Permanent rule

```text
Blizzard defines the published semantic map.
DB2 explains build-specific spell wiring.
WCL records the observed combat journey through that map.
Iris combines all three without confusing their evidence classes.
```

---

## 2. Source-of-truth hierarchy by question

There is no single universal source of truth. The authoritative source depends on the claim.

| Question / claim | Primary authority | Secondary/context sources | Never substitute with |
|---|---|---|---|
| Official encounter hierarchy | Blizzard Encounter Journal | WCL WorldData identity | WCL temporal correlation |
| Official mechanic/spell membership | Blizzard Encounter Journal | build-pinned DB2 structural data, secondary references | co-occurrence alone |
| Official description/role guidance | Blizzard published metadata | Wowhead/reference material | inferred WCL behavior presented as official text |
| Spell implementation relationships | reviewed build-pinned WoW client DB2 structural data | Blizzard Journal, reference providers | guessed name relationships |
| Did ability X occur in pull Y? | WCL ReportData | none needed | Blizzard/DB2 membership or structure |
| Who cast/received X? | WCL ReportData | actor metadata | provider semantic classification |
| Did X precede/follow Y? | WCL ReportData | official semantics for interpretation | Journal/DB2 structure alone |
| Is X specific to mechanic Y? | WCL empirical specificity + matched controls | official hierarchy/DB2 for candidate pruning | provider membership/structure alone |
| Did an AvoiD player fail a mechanic? | AvoiD WCL event evidence + accepted evaluation contract | official mechanic semantics | public-corpus or DB2 relation alone |
| What should AvoiD change next pull? | accepted/official mechanic knowledge + AvoiD WCL execution | progression/history/context | generic public ranking without raid evidence |

### Supporting providers

Other providers have narrower roles:

```text
WCL GameData / WorldData
  identity and WCL scope metadata

AvoiD rule packs
  versioned product/evaluation semantics

Lorrgs
  secondary derived encounter/timeline context

Wowhead / Parse Wowhead
  reference, identity and corroboration
```

No secondary provider may silently outrank Blizzard for official published encounter semantics, build-pinned client DB2 for its reviewed structural claim, or WCL for observed combat truth.

---

## 3. The mandatory Iris decision tree

Before making a provider request or spending WCL budget, Iris must classify the unresolved question.

```text
START
  ↓
What kind of claim are we trying to answer?
  │
  ├─ STATIC / OFFICIAL SEMANTIC QUESTION
  │      ↓
  │   Check persisted Blizzard official encounter graph
  │      │
  │      ├─ current/sufficient → answer at 0 WCL
  │      │
  │      └─ missing/stale/build changed
  │             ↓
  │          preview Blizzard resolution
  │             ↓
  │          bounded resolve
  │             ↓
  │          persist new fingerprinted revision
  │             ↓
  │          compare with previous official revision
  │
  ├─ STRUCTURAL SPELL-WIRING QUESTION
  │      ↓
  │   Require persisted Blizzard graph/build namespace
  │      ↓
  │   Check accumulated structural snapshot for this exact build
  │      │
  │      ├─ covered/sufficient → answer at 0 provider calls
  │      │
  │      └─ uncovered seed/direction
  │             ↓
  │          preview bounded filtered DB2 lookup
  │             ↓
  │          resolve only requested SpellEffect rows
  │             ↓
  │          persist normalized relation revision
  │             ↓
  │          accumulate only within same client build
  │
  └─ OBSERVED / BEHAVIORAL / CAUSAL / PERFORMANCE QUESTION
         ↓
      Reuse persisted WCL evidence first
         │
         ├─ sufficient → analyze at 0 new WCL calls
         │
         └─ insufficient
                ↓
             acquire only the exact missing empirical evidence
                ↓
             exact fights + bounded windows + relevant streams
                ↓
             no whole-report fallback
```

After any branch, Iris must keep the resulting evidence classes separate in the derived object/output.

---

## 4. Canonical encounter-learning procedure

For GLOBAL BOSS knowledge, the generic sequence is:

```text
1. Resolve/reuse official Blizzard encounter knowledge
2. Resolve/reuse build-pinned spell structural knowledge when implementation wiring matters
3. Acquire/reuse canonical public WCL evidence
4. Discover observed signals
5. Triage empirical actor origin
6. Synthesize local mechanic hypotheses
7. Reconcile hypotheses with official encounter hierarchy + structural knowledge
8. Plan only unresolved empirical questions
9. Run surgical WCL probes when necessary
10. Verify candidate specificity
11. Verify exact-pattern actor provenance
12. Build Episode Graph
13. Evaluate Matched Null controls
14. Apply later independent evidence / stability / holdout gates
15. Promote only under the versioned Promotion Contract
```

The important change introduced by v3.9.9 is that **official encounter knowledge and reviewed structural knowledge are no longer afterthoughts**. They are early semantic/structural layers used to avoid wasting empirical budget and to prevent false semantic neighbors while preserving WCL as empirical truth.

### GLOBAL BOSS scope remains empirical and isolated

```text
GLOBAL BOSS key = encounterId + difficulty + partition
```

AvoiD/HOME reports are never GLOBAL BOSS training or holdout evidence. Public independent raid sources teach generic observed behavior; AvoiD data is where that knowledge is applied and evaluated.

---

## 5. Canonical AvoiD raid-analysis procedure

The product goal is not to build an encyclopedia. The goal is to use reliable encounter knowledge to improve **our raid**.

For an AvoiD pull/session, Iris should reason in this order:

```text
OFFICIAL MECHANIC MODEL
Blizzard: what mechanic/state/spell belongs where?
        +
STRUCTURAL IMPLEMENTATION MODEL
DB2: how are relevant IDs wired in this build?
        +
EMPIRICAL PULL DATA
WCL: what actually happened to AvoiD?
        +
ACCEPTED IRIS EVALUATION KNOWLEDGE
What observed execution counts as correct / risky / failed?
        ↓
AvoiD-specific diagnosis
        ↓
comparison with previous pulls / players / assignments
        ↓
1–3 highest-value next-pull actions
```

A useful Iris conclusion should therefore be able to answer:

1. **What is the mechanic?** — grounded in official/accepted knowledge.
2. **How are relevant IDs structurally related?** — grounded in exact-build DB2 when needed.
3. **What did AvoiD actually do?** — grounded in WCL.
4. **What went wrong or improved?** — grounded in a versioned evaluation contract.
5. **How confident are we?** — based on evidence completeness and applicable gates.
6. **What should change next pull?** — actionable and specific to the raid.

Iris should prefer a small number of high-value, traceable recommendations over a large dump of generic metrics.

---

## 6. Four labels every conclusion must conceptually preserve

Every non-trivial mechanic conclusion must remain classifiable as one or more of:

```text
OFFICIAL
published by Blizzard

OBSERVED
seen directly in WCL combat evidence

INFERRED
derived statistically or structurally from evidence

UNRESOLVED
insufficient, contradictory or unavailable evidence
```

Build-pinned DB2 relations are `INFERRED/STRUCTURAL` knowledge with explicit provider/build provenance; they are not automatically `OFFICIAL` merely because they describe game-client tables through a third-party export surface.

These labels need not always be shown verbatim in the UI, but the underlying data model and explanation must preserve the distinction.

Forbidden transformations:

```text
OFFICIAL → OBSERVED       without WCL evidence
STRUCTURAL → OBSERVED     without WCL evidence
OBSERVED → CAUSAL         from temporal proximity alone
INFERRED → ACCEPTED       without the promotion contract
UNRESOLVED → NEGATIVE     because a provider failed
```

---

## 7. Blizzard refresh and patch/build changes

Blizzard is the preferred upstream authority for published encounter semantics because Iris wants its semantic model tied to the current first-party game revision rather than frozen third-party interpretation.

Iris must persist:

```text
provider
region / locale
Journal encounter ID
Blizzard namespace/build when exposed
graph fingerprint
retrieval/compilation revision
previous fingerprint
changedFromPrevious
```

When a Blizzard refresh changes the namespace/build or compiled graph fingerprint:

```text
DO
- persist a new immutable official revision;
- retain the old revision for provenance;
- start a new DB2 structural accumulation if the client build changed;
- retain old structural request/aggregate revisions;
- diff/reconcile affected mechanic/spell paths;
- mark derived interpretations that depend on changed semantics/structure for re-evaluation;
- use the new revision for new analysis after validation.

DO NOT
- overwrite historical WCL events;
- merge DB2 structural relations across different client builds;
- mutate old raw evidence to fit the new mechanic model;
- assume an ID kept the same meaning merely because the number is unchanged;
- assume an ID changed meaning merely because a description changed;
- silently merge old/new build semantics into one timeless object.
```

Historical analysis must remain reproducible against the knowledge revision that was applicable to that interpretation.

---

## 8. Provider failure is not negative evidence

A provider being unable to answer is not evidence that the game fact is false.

Examples:

```text
Blizzard /spell 401/403/404/5xx
  != ability absent from encounter

missing Journal graph
  != encounter has no published mechanics

Wago DB2 failure / empty filtered response
  != spell or mechanic absent from encounter

Lorrgs missing ID
  != ID is not encounter-related

Wowhead/reference failure
  != spell does not exist

storage unavailable
  != stored evidence does not exist
```

Iris must preserve states such as:

```text
unknown
provider-unavailable
not-published-by-endpoint
not-cached-or-unavailable
not-listed-in-this-non-exhaustive-provider
structural-coverage-partial
```

rather than manufacturing a contradiction.

---

## 9. WCL budget doctrine

WCL combat-event budget is for empirical questions only.

Before every new WCL request Iris should ask:

```text
Can persisted evidence answer this?
Can Blizzard official metadata answer the static part?
Can build-pinned structural knowledge explain the ID wiring?
Can the candidate set be reduced using official hierarchy/structure?
What exact unresolved empirical claim remains?
What is the smallest fight/window/stream query that can answer it?
```

Preferred order:

```text
0-call persisted evidence
    ↓
0-WCL official/structural knowledge
    ↓
compact WCL metadata
    ↓
exact-fight bounded event window
    ↓
resumable pagination only when required
```

Forbidden default:

```text
"We are unsure" → download the whole report
```

If a candidate fails a hard gate such as matched specificity and no new independent hypothesis exists, Iris should stop spending WCL on that candidate rather than repeatedly probing it.

---

## 10. Actor provenance and semantic origin are different dimensions

An event can be emitted/carried by a player while the state itself originates from the encounter design.

Therefore Iris must preserve separately:

```text
actorProvenance
  encounter-origin
  player-origin
  mixed-or-unknown

semanticOrigin
  encounter-action
  encounter-applied-player-state
  player-action
  player-proc
  environment
  unresolved
```

Provider/structural data may help classify **semantic origin**, but it must never rewrite the empirically observed actor provenance from WCL.

Likewise, a DB2 trigger/apply relationship may explain why a player aura exists without satisfying:

```text
exact-pattern provenance
matched specificity
observed occurrence
causal combat proof
automatic mechanic promotion
```

---

## 11. Promotion remains empirical and explicit

Official Blizzard membership is strong semantic evidence, and build-pinned DB2 can be strong structural corroboration, but neither is the Promotion Contract.

For an empirical mechanic relationship to become accepted global knowledge, the applicable versioned gates may require:

- candidate-wise completeness;
- specificity;
- exact-pattern provenance;
- encounter-origin empirical support where required;
- stable Episode structure;
- matched-null support;
- independent evidence groups;
- source-stratified statistical stability;
- untouched holdout;
- no material contradiction;
- explicit promotion eligibility under the active contract.

`mechanically-supported`, `provider-supported`, `official-member`, `structural-link` or any similar diagnostic state is **not** synonymous with `accepted`.

No provider may automatically promote a mechanic.

---

## 12. Belo'ren discovery: validation of the doctrine, not a special case

The v3.9.9 research on Belo'ren demonstrated why this doctrine exists.

A WCL semantic neighborhood around `Voidlight Rupture` contained `Void Feather`, making it look locally related. The real Matched Null baseline showed the pattern was common outside the anchor neighborhood and therefore did not clear matched specificity.

The official Blizzard Journal then independently showed that the two spells belong to different published mechanic branches within the encounter stage.

A further structural question arose around an internal/helper ID (`1243560`) and official `Void Feather` (`1241163`). That is now explicitly a DB2 structural question, not something Iris should answer by name matching or by spending WCL event budget first.

This is the important lesson:

```text
WCL co-occurrence tells Iris which events were nearby.
Matched Null tells Iris whether the neighbor is specific.
Blizzard tells Iris the official semantic branch.
DB2 can tell Iris whether internal spell IDs are structurally wired.
```

No single source supplies the whole answer. Using them in their correct roles removes false semantic relationships while avoiding unnecessary WCL spend.

Belo'ren IDs/names may remain documentation/regression fixtures. They must never become production branching logic.

---

## 13. Stop conditions

Iris should explicitly stop/escalate rather than acquire indefinitely.

### Stop and reuse

- persisted official revision answers the static question;
- accumulated same-build structural knowledge answers the spell-wiring question;
- persisted WCL evidence answers the empirical question;
- a candidate failed the applicable hard specificity/provenance/null gate and no materially new hypothesis exists;
- provider failure would only cause identical retries;
- evidence is sufficient for the requested AvoiD decision.

### Escalate carefully

- Blizzard graph is missing/stale for a semantic question;
- exact-build structural coverage is missing for a relevant ID;
- official revision/build changed and affected interpretations need re-evaluation;
- empirical behavior remains unresolved after official/structural reconciliation;
- a new candidate survives prior gates and requires the next evidence layer;
- an AvoiD recommendation cannot be made safely from currently complete evidence.

### Remain unresolved

When the evidence is insufficient, contradictory or inaccessible, `unresolved` is a valid result. Iris must never create certainty merely to complete a pipeline.

---

## 14. Future-provider rule

Every future source must be registered with an explicit answer to:

```text
What question is this provider authoritative for?
Is the data first-party, observed, structural, derived, curated or reference-only?
Can absence be treated as negative evidence?
Can it prove occurrence?
Can it prove causality?
Can it affect promotion?
Can it affect player attribution?
What revision/build does it represent?
What may be persisted?
What is the fallback when it is unavailable?
```

If those questions are not answered, the provider must not be introduced into automatic learning or player evaluation.

---

## 15. Non-negotiable invariants

```text
1. Blizzard official published semantics, build-pinned DB2 structure and WCL observed combat remain separate evidence classes.
2. WCL ReportData remains canonical for what actually happened in combat.
3. Blizzard is preferred for official encounter hierarchy/membership before statistical rediscovery.
4. DB2 structural lookup is build-pinned from Blizzard and bounded to explicit seeds; no bulk/recursive discovery.
5. Provider/structural metadata never rewrites raw WCL evidence.
6. Provider/structural metadata never proves pull occurrence, observed actors or player failure.
7. Provider/structural metadata never bypasses empirical promotion gates.
8. HOME/AvoiD logs never train GLOBAL BOSS knowledge.
9. Generic learning remains boss-agnostic; no boss/spell constants in production logic.
10. Persisted evidence is reused before buying new WCL/provider evidence.
11. Same-build structural knowledge accumulates; different client builds never merge.
12. Raw DB2 CSV is not persisted; only normalized derived structural facts with provenance are retained.
13. WCL queries remain exact-fight/bounded whenever possible; no convenience whole-report fallback.
14. Provider failure/absence is not negative evidence unless the provider contract explicitly makes its catalogue exhaustive for that claim.
15. New Blizzard revisions invalidate/rederive interpretations, never historical raw evidence.
16. Iris outputs must preserve official / observed / inferred / unresolved distinctions.
17. Recommendations are AvoiD-specific and evidence-traceable.
18. No automatic mechanic promotion.
```

If a future implementation conflicts with these invariants, the implementation is wrong unless this doctrine has first been deliberately superseded by a new versioned contract.
