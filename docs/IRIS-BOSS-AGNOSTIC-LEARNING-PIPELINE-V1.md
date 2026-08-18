# Iris boss-agnostic learning pipeline v1

This contract defines how Iris refines encounter knowledge for **any** boss. The current Belo'ren corpus is validation data, not an implementation special case.

**Parent operating doctrine:** [`IRIS-KNOWLEDGE-EVIDENCE-DOCTRINE-V1.md`](./IRIS-KNOWLEDGE-EVIDENCE-DOCTRINE-V1.md). If a future pipeline change conflicts with that source/evidence doctrine, the pipeline change is invalid unless the doctrine is deliberately superseded by a new versioned contract.

## Core invariant

GLOBAL BOSS learning is always scoped by:

`encounterId + difficulty + partition`

No learning stage may require a hard-coded boss name, encounter ID, ability ID, spell name, phase name, or encounter-specific rule in order to function.

Boss-specific facts may emerge from evidence or official provider metadata and be stored in the resulting model. They must not be prerequisites baked into the generic learning engine.

## Evidence authorities are complementary

```text
Blizzard Encounter Journal
  official published encounter semantics
  -> what Blizzard publishes the encounter/mechanic hierarchy and membership to be

Warcraft Logs ReportData
  canonical empirical combat truth
  -> what actually happened in a pull
```

Official metadata can resolve a static semantic question without spending WCL. It cannot prove occurrence, actor/target, timing, causality, player failure or promotion eligibility in a particular pull.

The default order is therefore **official semantics first, empirical acquisition second** whenever the unresolved question has a static semantic component. This is an efficiency/order-of-operations rule, not an upgrade of provider metadata into combat evidence.

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

2. **Canonical empirical acquisition / reuse**
   - Reuse persisted WCL evidence at 0 calls whenever it already answers the empirical question.
   - Build trustworthy Wide evidence with independent-source sampling only when canonical evidence is needed or incomplete.
   - Upgrade selected canonical Wide evidence to complete canonical Deep when required.
   - Treat the post-rebuild canonical population as authoritative for empirical GLOBAL BOSS evidence.
   - Do not acquire combat-event evidence merely to reproduce a static fact already published by Blizzard.

3. **Signal discovery**
   - Discover candidate abilities/signals from the encounter evidence itself.
   - Official membership may label/reconcile an observed ID, but it must not manufacture an occurrence that is absent from WCL.
   - Do not use spell names to decide whether an observed signal occurred or to manufacture its actor provenance.

4. **Origin triage**
   - Classify important unresolved signals from observed source provenance as `friendly-player`, `encounter`, `mixed`, or `unknown`.
   - Proven friendly-player signals leave the GLOBAL BOSS denominator where the current empirical contract requires it.
   - Mixed/unknown critical signals may advance to a narrow provenance probe.
   - Keep empirical `actorProvenance` separate from provider-derived `semanticOrigin`.

5. **Local mechanic synthesis + official reconciliation**
   - Encounter-origin critical signals are first analyzed from persisted Wide/Deep and source-isolated validation evidence.
   - Generic structural hypotheses include cast interruption, wipe association, damage exposure, raid pressure, phase-boundary concentration, state alignment, and verified temporal relations.
   - Reconcile hypotheses against the official Blizzard hierarchy to reject or downgrade semantic neighbors that belong to different published branches.
   - A local hypothesis never becomes an accepted mechanic merely because its confidence is high or because Blizzard publishes the spell under the encounter.

6. **Semantic evidence planning**
   - If persisted empirical evidence plus official semantics cannot settle the remaining combat/causal question, create a surgical plan for only the unresolved signal(s).
   - State the exact empirical claim that still requires WCL before buying any event evidence.
   - Select independent canonical sources and exact fights.
   - Query anchor occurrences first, then only the narrow temporal/actor/target context needed around those anchors.
   - Do not fall back to whole-report scanning for convenience.

7. **Independent-source verification**
   - Empirical semantic/provenance claims require reproduction across independent sources under a versioned evidence contract.
   - Missing or contradictory evidence remains unresolved; it is never converted into success.
   - Official Journal membership may corroborate/resolve published encounter meaning but cannot substitute for the empirical denominator required by the claim.

8. **Post-verifier evidence layers**
   - Exact-pattern actor provenance, Episode Graph, Matched Null and later Promotion-v3 gates remain versioned evidence products.
   - Provider metadata can explain or classify a candidate but cannot bypass a failed specificity/provenance/null/holdout gate.
   - A failed hard matched-specificity/provenance/null gate is a stop condition for repeated acquisition unless a materially new independent hypothesis exists.

9. **Promotion**
   - Converting a verified structural/semantic claim into an accepted/scoreable mechanic requires the separately versioned promotion contract.
   - Promotion must define denominator, eligibility, null policy, player attribution rules, validation requirements, contradiction policy and score impact.
   - `official-member`, `provider-supported` or `mechanically-supported` are not synonyms for `accepted`.

10. **AvoiD application/evaluation**
   - HOME/AvoiD reports are not GLOBAL BOSS training or holdout evidence.
   - Apply official/accepted encounter knowledge to AvoiD's WCL evidence to diagnose actual execution.
   - Compare pulls, players, assignments and progression only from AvoiD-observed data under versioned evaluation contracts.
   - Prefer 1–3 high-value next-pull actions over generic analytics volume.

11. **Publication breadth**
   - Publication/sample-size work remains separate from `learningNext`.
   - A boss may need more reports for publication even when the best next learning action is official-knowledge reconciliation, local synthesis or a surgical semantic probe.

## Escalation is conditional, not mandatory

Not every boss must execute every stage:

- If a current persisted Blizzard graph already answers a static hierarchy/membership question, reuse it at 0 WCL.
- If the Blizzard namespace/fingerprint changes, persist a new official revision and mark affected derived interpretations for re-evaluation; never rewrite WCL facts.
- If no critical unresolved signals remain, there is no reason to run signal probes.
- If provenance is already decisive, skip provenance acquisition.
- If local structural evidence is sufficient for the empirical question, do not spend WCL on semantic probing yet.
- If official metadata resolves only meaning but not observed behavior, continue with WCL evidence rather than treating the metadata as occurrence.
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
unchanged -> continue using current derived interpretation
changed   -> persist new revision + mark affected interpretations for re-evaluation
```

Never rewrite historical WCL evidence. Historical raw events remain immutable even if Blizzard later changes IDs, hierarchy, wording or mechanic behavior.

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
Blizzard spell 403/404 == not an encounter spell
provider semanticOrigin == WCL actorProvenance
```

The following are allowed outside the generic learner when clearly separated:

- regression fixtures using a known encounter to confirm behavior,
- UI labels resolved from learned/provider data,
- explicitly versioned boss-specific evaluation/application rules that do not teach the GLOBAL BOSS model,
- test data that proves generic code reproduces a known observation without using that observation as an input rule.

## Required portability test

Every new generic learning stage must have at least one synthetic test using arbitrary encounter/ability IDs and names. The test must prove that the stage derives its targets and structure from model/evidence/provider state rather than current-boss constants.

For Official Encounter Knowledge, the portability test must additionally prove:

- arbitrary nested Journal sections compile without boss-specific code;
- a spell can retain multiple membership paths;
- preview is zero-network;
- provider resolution spends zero WCL;
- official semantics do not set observed occurrence, causality or automatic promotion.

The generic learning modules must remain free of literal current-validation-boss names/IDs. This guardrail exists to prevent a successful one-boss experiment from quietly becoming hard-coded product behavior.
