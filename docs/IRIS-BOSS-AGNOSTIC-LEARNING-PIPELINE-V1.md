# Iris boss-agnostic learning pipeline v1

This contract defines how Iris refines encounter knowledge for **any** boss. The current Belo'ren corpus is validation data, not an implementation special case.

**Parent operating doctrine:** [`IRIS-KNOWLEDGE-EVIDENCE-DOCTRINE-V1.md`](./IRIS-KNOWLEDGE-EVIDENCE-DOCTRINE-V1.md). If a future pipeline change conflicts with that source/evidence doctrine, the pipeline change is invalid unless the doctrine is deliberately superseded by a new versioned contract.

## Core invariant

GLOBAL BOSS learning is always scoped by:

`encounterId + difficulty + partition`

No learning stage may require a hard-coded boss name, encounter ID, ability ID, spell name, phase name, or encounter-specific rule in order to function.

Boss-specific facts may emerge from evidence or official/provider metadata and be stored in the resulting model. They must not be prerequisites baked into the generic learning engine.

## Evidence authorities are complementary

```text
Blizzard Encounter Journal
  official published encounter semantics
  -> what Blizzard publishes the encounter/mechanic hierarchy and membership to be

Build-pinned WoW client DB2 (reviewed Wago export)
  structural implementation metadata
  -> how requested spell IDs are wired in the exact client build

Warcraft Logs ReportData
  canonical empirical combat truth
  -> what actually happened in a pull
```

Official/structural metadata can resolve static questions without spending WCL. Neither can prove occurrence, actor/target, timing, causality, player failure or promotion eligibility in a particular pull.

The default order is therefore **official semantics first, structural lookup when relevant second, empirical acquisition third**. This is an efficiency/order-of-operations rule, not an upgrade of provider metadata into combat evidence.

## Generic state machine

For every encounter, Iris follows the same evidence ladder when the relevant state exists:

1. **Official encounter knowledge resolution / reuse**
   - Check for a persisted current Blizzard Encounter Journal graph before spending WCL to rediscover static hierarchy or membership.
   - Resolve the current official Journal when an encounter name/Journal ID is available and no suitable current persisted revision already answers the static question.
   - Compile the official hierarchy generically as `encounter -> section/stage -> mechanic/group -> submechanic -> spell`.
   - Preserve the exact Blizzard namespace/build and graph fingerprint.
   - Preserve every official membership path when the same spell appears in multiple Journal branches.
   - Use the official graph to seed/prune semantic candidates and answer published identity/hierarchy/membership questions.
   - A Journal relationship is an official semantic relationship, not an observed event-to-event causal edge.

2. **Build-pinned spell structural knowledge resolution / reuse**
   - Use only when an unresolved question concerns internal/helper spell wiring rather than observed combat behavior.
   - Require a persisted official Blizzard graph and derive the exact client build from its namespace.
   - Check the accumulated structural snapshot for that exact build before making any Wago request.
   - Query only explicit seed IDs through bounded filtered `SpellEffect` lookups by `SpellID` and/or `EffectTriggerSpell`.
   - Persist immutable request revisions and normalized relations only; never raw CSV.
   - Accumulate relations/coverage only within the same exact client build; start a new structural snapshot when the Blizzard-derived build changes.
   - Treat DB2 relationships as structural metadata only: no occurrence, actor, causality, player-failure or Promotion claim.

3. **Canonical empirical acquisition / reuse**
   - Reuse persisted WCL evidence at 0 calls whenever it already answers the empirical question.
   - Build trustworthy Wide evidence with independent-source sampling only when canonical evidence is needed or incomplete.
   - Upgrade selected canonical Wide evidence to complete canonical Deep when required.
   - Treat the post-rebuild canonical population as authoritative for empirical GLOBAL BOSS evidence.
   - Do not acquire combat-event evidence merely to reproduce a static fact already published by Blizzard or a structural relation already covered by exact-build DB2.

4. **Signal discovery**
   - Discover candidate abilities/signals from the encounter evidence itself.
   - Official membership/structural relations may label/reconcile an observed ID, but they must not manufacture an occurrence that is absent from WCL.
   - Do not use spell names to decide whether an observed signal occurred or to manufacture its actor provenance.

5. **Origin triage**
   - Classify important unresolved signals from observed source provenance as `friendly-player`, `encounter`, `mixed`, or `unknown`.
   - Proven friendly-player signals leave the GLOBAL BOSS denominator where the current empirical contract requires it.
   - Mixed/unknown critical signals may advance to a narrow provenance probe.
   - Keep empirical `actorProvenance` separate from provider-derived `semanticOrigin`.

6. **Local mechanic synthesis + official/structural reconciliation**
   - Encounter-origin critical signals are first analyzed from persisted Wide/Deep and source-isolated validation evidence.
   - Generic structural hypotheses include cast interruption, wipe association, damage exposure, raid pressure, phase-boundary concentration, state alignment, and verified temporal relations.
   - Reconcile hypotheses against the official Blizzard hierarchy to reject or downgrade semantic neighbors that belong to different published branches.
   - Use exact-build DB2 relations to explain internal/helper ID wiring when present, without converting structure into combat causality.
   - A direct anchor↔candidate DB2 relation may reprioritize the empirical question, but does not itself answer it.
   - A local hypothesis never becomes an accepted mechanic merely because its confidence is high, Blizzard publishes the spell, or DB2 links the IDs.

7. **Semantic evidence planning**
   - If persisted empirical evidence plus official/structural semantics cannot settle the remaining combat/causal question, create a surgical plan for only the unresolved signal(s).
   - State the exact empirical claim that still requires WCL before buying any event evidence.
   - Select independent canonical sources and exact fights.
   - Query anchor occurrences first, then only the narrow temporal/actor/target context needed around those anchors.
   - Do not fall back to whole-report scanning for convenience.

8. **Candidate-wise specificity + exact provenance**
   - Verify each structurally eligible candidate independently against the same background/control contract.
   - Require exact semantic-pattern actor provenance where the mechanical claim needs encounter origin.
   - Provider hierarchy/structure may classify or reprioritize a candidate, but cannot satisfy these empirical gates.
   - Failed specificity/provenance remains a stop condition unless materially new evidence creates a new hypothesis.

9. **Episode Graph + Matched Null**
   - Build the Episode from eligible exact patterns while preserving context-only player-origin/mixed nodes.
   - Apply official Blizzard and exact-build structural reconciliation as versioned interpretation layers.
   - Evaluate paired same-fight Matched Null controls under the complete Episode exclusion guard.
   - Matched controls are empirical evidence and are addressed by the original empirical Episode fingerprint; provider-only reinterpretation must not force identical WCL reacquisition.
   - Only `matched-specificity-supported` patterns may advance beyond Matched Null.

10. **Independent Evidence Groups** `[implemented]`
   - Group only Matched Null-supported patterns by canonical independent source identity (`guild`, else uploader/owner, else report fallback).
   - Multiple reports/pulls from one guild/uploader remain one independent evidence group.
   - Use only persisted paired anchor/null evidence; this stage performs zero WCL/provider calls.
   - Record source-level supportive/contradictory/neutral direction descriptively.
   - Require independent group coverage before advancing, but do **not** claim statistical stability here.
   - HOME/AvoiD reports never contribute to this GLOBAL BOSS gate.

11. **Source-Stratified Statistical Stability** `[implemented]`
   - Evaluate only `independent-groups-evidence-available` patterns.
   - Give each independent source one unit of weight regardless of report/pull volume.
   - Evaluate supportive/contradictory source shares, median source-level prevalence delta and robust MAD dispersion under a versioned contract.
   - Contradiction remains an explicit gate and cannot be hidden by one high-volume source.
   - v1 claims directional/dispersion stability only; it does **not** claim formal hypothesis significance or a confidence interval.
   - Only `source-stratified-stability-supported` patterns become eligible for a later untouched holdout plan.
   - This stage performs zero WCL/provider calls and cannot promote a mechanic.

12. **Untouched Holdout** `[implemented: precommit + automatic source discovery + evaluation]`
   - Test only Stability-supported claims against source-isolated evidence that was not used to discover, tune, group or stabilize the mechanic.
   - Historical corpus `validation` is not silently relabeled as untouched evidence.
   - Build a versioned GLOBAL BOSS learning-source lineage from canonical corpus evidence plus previously discovered/used source identities. Unknown lineage is not treated as clean.
   - Automatic source discovery starts with a zero-network fingerprinted preview. If no Stability-supported pattern exists, its WCL budget collapses to zero.
   - When discovery is eligible and explicitly confirmed, use only WCL `fightRankings` seed report codes plus lightweight report identity metadata to resolve guild/uploader identities. Discard ranking metrics and never inspect candidate combat outcomes before reservation.
   - Reorder seed report codes deterministically from the already-frozen Stability fingerprint rather than ranking order.
   - Exclude HOME guild, HOME uploaders, any preexisting corpus source and any source already present in the learning/source lineage.
   - Persist the compatible unseen-source pool, then freeze/fingerprint candidate patterns + reserved source set + thresholds before any Holdout combat evidence.
   - Reservation and evaluation execute zero network calls.
   - Holdout failure blocks Promotion; holdout data never feeds backward silently into discovery/training or threshold tuning.
   - The remaining acquisition subcomponent is a bounded WCL combat-evidence executor that may operate only after `reservation-ready` and only on the frozen candidates/sources. Until implemented, Iris reports it as unavailable rather than using manual boss-specific logic.

13. **Promotion** `[later]`
   - Converting a verified claim into an accepted/scoreable mechanic requires the separately versioned Promotion Contract.
   - Promotion must define denominator, eligibility, null policy, player attribution rules, contradiction policy, holdout requirements and score impact.
   - `official-member`, `structural-link`, `provider-supported`, `mechanically-supported`, `matched-specificity-supported`, `independent-groups-evidence-available`, `source-stratified-stability-supported` and `untouched-holdout-supported` are not synonyms for `accepted`.

14. **AvoiD application/evaluation**
   - HOME/AvoiD reports are not GLOBAL BOSS training or holdout evidence.
   - Apply official/accepted encounter knowledge to AvoiD's WCL evidence to diagnose actual execution.
   - Compare pulls, players, assignments and progression only from AvoiD-observed data under versioned evaluation contracts.
   - Prefer 1–3 high-value next-pull actions over generic analytics volume.

15. **Publication breadth**
   - Publication/sample-size work remains separate from `learningNext`.
   - A boss may need more reports for publication even when the best next learning action is official/structural reconciliation, local synthesis or a surgical semantic probe.

## Escalation is conditional, not mandatory

Not every boss must execute every stage:

- If a current persisted Blizzard graph already answers a static hierarchy/membership question, reuse it at 0 WCL.
- If accumulated exact-build structural knowledge already answers an implementation-wiring question, reuse it at 0 provider calls.
- If the Blizzard namespace/fingerprint changes, persist a new official revision; if the client build changed, start a new structural accumulation. Never rewrite WCL facts.
- If no critical unresolved signals remain, there is no reason to run signal probes.
- If provenance is already decisive, skip provenance acquisition.
- If local structural evidence is sufficient for the empirical question, do not spend WCL on semantic probing yet.
- If official/structural metadata resolves only meaning/implementation but not observed behavior, continue with WCL evidence rather than treating metadata as occurrence.
- If Matched Null has zero supported patterns, Independent Evidence Groups must report no eligible candidates instead of resurrecting earlier diagnostic neighbors.
- If independent group coverage is insufficient, stop before Stability or acquire only genuinely new independent public sources if learning/publication requires it.
- If Statistical Stability is insufficient, do not spend a Holdout source-discovery or combat-evidence budget on that candidate unless a new versioned hypothesis/evidence basis justifies reopening it.
- If no pattern is Stability-supported, Holdout planning and automatic source discovery both return no eligible candidates with zero WCL calls.
- If Stability supports a candidate but the complete learning-source lineage cannot be proven, stop before source discovery rather than assuming an apparently new source is untouched.
- If automatic source discovery cannot produce enough genuinely unseen sources, return `holdout-unavailable-insufficient-unseen-sources`; do not relax the isolation definition.
- If a candidate failed the applicable hard gate and no new hypothesis exists, stop spending WCL on it.
- If no deterministic local structure exists, escalate only the explicit unresolved evidence question.
- If a future encounter produces a new structural pattern not covered by the generic hypothesis vocabulary, add a **generic evidence feature**, not a boss-name branch.

## Provider/build refresh procedure

When a new patch/build or provider revision may have changed official encounter knowledge:

```text
check persisted official revision
        ↓
preview bounded Blizzard refresh
        ↓
resolve current Journal
        ↓
compare namespace + graph fingerprint
        ↓
unchanged -> keep current official revision and same-build structural accumulation
changed   -> persist new official revision
             ↓
             if client build changed -> start a new DB2 structural accumulation
             else                    -> preserve same-build accumulated structure
             ↓
             rederive interpretation fingerprints
             ↓
             reuse Matched Null empirical controls when the empirical Episode fingerprint is unchanged
             ↓
             rederive Evidence Groups / Stability at zero network from compatible empirical evidence
```

Never rewrite historical WCL evidence. Historical raw events remain immutable even if Blizzard later changes IDs, hierarchy, wording or mechanic behavior. Never merge structural relations across different client builds.

## Forbidden implementation patterns

Production learning code must not contain logic such as:

```text
if encounterId == <current boss> ...
if abilityId == <known current spell> ...
if spellName contains "Rebirth" then ...
```

It must also not contain shortcuts such as:

```text
Journal membership == observed occurrence
Journal parent/child == combat causality
DB2 trigger relation == observed combat causality
DB2/Wago absence == spell absent from encounter
Blizzard spell 403/404 == not an encounter spell
provider semanticOrigin == WCL actorProvenance
many reports from one guild == many independent evidence groups
one high-volume guild == stronger source-level stability
provider reinterpretation == reacquire identical Matched Null WCL controls
stability-supported == holdout-passed
historical validation source == untouched holdout
unknown source lineage == unseen source
ranking position == holdout source selection priority
```

The following are allowed outside the generic learner when clearly separated:

- regression fixtures using a known encounter to confirm behavior,
- UI labels resolved from learned/provider data,
- explicitly versioned boss-specific evaluation/application rules that do not teach the GLOBAL BOSS model,
- test data that proves generic code reproduces a known observation without using that observation as an input rule.

Curated encounter rule packs are application/evaluation fallbacks only. The GLOBAL BOSS learner may not import them; report analysis must prefer a published generated model whenever one exists.

## Required portability test

Every new generic learning stage must have at least one synthetic test using arbitrary encounter/ability IDs and names. The test must prove that the stage derives its targets and structure from model/evidence/provider state rather than current-boss constants.

For Official Encounter Knowledge, the portability test must additionally prove:

- arbitrary nested Journal sections compile without boss-specific code;
- a spell can retain multiple membership paths;
- preview is zero-network;
- provider resolution spends zero WCL;
- official semantics do not set observed occurrence, causality or automatic promotion.

For Spell Structural Knowledge, the portability test must additionally prove:

- Blizzard namespace deterministically pins the DB2 build;
- filtered source/reverse `SpellEffect` queries derive relations from arbitrary IDs;
- preview is zero-network;
- structural resolution spends zero Blizzard and zero WCL calls;
- provider failures remain non-negative;
- same-build accumulation preserves prior relations while a new build starts a clean snapshot;
- DB2 structure does not set observed occurrence, causality, provenance success or automatic promotion.

For Independent Evidence Groups, the portability test must additionally prove:

- only `matched-specificity-supported` patterns enter the layer;
- reports from the same canonical source collapse into one group;
- supporting/contradictory/neutral direction is source-level and descriptive only;
- HOME/AvoiD data is absent;
- zero WCL/provider calls;
- no statistical-stability, holdout or Promotion claim is produced.

For Statistical Stability, the portability test must additionally prove:

- only `independent-groups-evidence-available` patterns enter;
- source weighting is equal regardless of matched-pair/report volume;
- contradictory source share can block a candidate even when a high-volume source is supportive;
- robust source-level median/MAD metrics are deterministic;
- no formal-significance/confidence-interval claim is invented;
- HOME/AvoiD data is absent;
- zero WCL/provider calls;
- Stability support creates Holdout eligibility only, never Holdout success or Promotion.

For Untouched Holdout, the portability test must additionally prove:

- only `source-stratified-stability-supported` + `holdoutEligible` patterns can be frozen;
- arbitrary GLOBAL BOSS scopes and arbitrary pattern IDs work without current-boss constants;
- historical train/validation and any source already present in corpus/learning lineage cannot masquerade as untouched;
- incomplete/unknown lineage blocks discovery rather than assuming cleanliness;
- HOME guild and configured HOME uploader identities are excluded even when the report belongs to an external guild;
- source discovery preview is zero-network and collapses to zero WCL budget when no Stability candidate exists;
- confirmed source discovery uses metadata only, discards ranking metrics/order, and executes zero event/table calls;
- source reservation is deterministic and frozen before holdout combat evidence;
- reservation/evaluation reject new candidates, unreserved sources and post-hoc threshold retuning;
- Holdout support never automatically promotes.

In addition to per-stage synthetic tests, a critical runtime guard scans the GLOBAL BOSS learning boundary for the current validation-boss constants and fails if they leak into generic production code. It also forbids GLOBAL BOSS modules from importing curated encounter fallback packs.

The generic learning modules must remain free of literal current-validation-boss names/IDs. This guardrail exists to prevent a successful one-boss experiment from quietly becoming hard-coded product behavior.
