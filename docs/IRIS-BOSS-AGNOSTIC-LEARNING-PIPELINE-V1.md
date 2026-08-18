# Iris boss-agnostic learning pipeline v1

This contract defines how Iris refines encounter knowledge for **any** boss. The current Belo'ren corpus is validation data, not an implementation special case.

## Core invariant

GLOBAL BOSS learning is always scoped by:

`encounterId + difficulty + partition`

No learning stage may require a hard-coded boss name, encounter ID, ability ID, spell name, phase name, or encounter-specific rule in order to function.

Boss-specific facts may emerge from evidence or official provider metadata and be stored in the resulting model. They must not be prerequisites baked into the generic learning engine.

## Evidence authorities are complementary

```text
Warcraft Logs ReportData
  canonical empirical combat truth
  -> what actually happened in a pull

Blizzard Encounter Journal
  official published encounter semantics
  -> what Blizzard publishes the encounter/mechanic hierarchy and membership to be
```

Official metadata can resolve a static semantic question without spending WCL. It cannot prove occurrence, actor/target, timing, causality, player failure or promotion eligibility in a particular pull.

## Generic state machine

For every encounter, Iris follows the same evidence ladder when the relevant state exists:

1. **Canonical acquisition**
   - Build trustworthy Wide evidence with independent-source sampling.
   - Upgrade selected canonical Wide evidence to complete canonical Deep when required.
   - Treat the post-rebuild canonical population as authoritative for empirical GLOBAL BOSS evidence.

2. **Signal discovery**
   - Discover candidate abilities/signals from the encounter evidence itself.
   - Do not use spell names to decide whether an observed signal occurred or to manufacture its actor provenance.

3. **Origin triage**
   - Classify important unresolved signals from observed source provenance as `friendly-player`, `encounter`, `mixed`, or `unknown`.
   - Proven friendly-player signals leave the GLOBAL BOSS denominator where the current empirical contract requires it.
   - Mixed/unknown critical signals may advance to a narrow provenance probe.

4. **Local mechanic synthesis**
   - Encounter-origin critical signals are first analyzed from persisted Wide/Deep and source-isolated validation evidence.
   - Generic structural hypotheses include cast interruption, wipe association, damage exposure, raid pressure, phase-boundary concentration, state alignment, and verified temporal relations.
   - A local hypothesis never becomes an accepted mechanic merely because its confidence is high.

5. **Official encounter knowledge resolution**
   - Resolve the current Blizzard Encounter Journal when an encounter name/Journal ID is available and no suitable current persisted revision already answers the static question.
   - Compile the official hierarchy generically as `encounter -> section/stage -> mechanic/group -> submechanic -> spell`.
   - Preserve the exact Blizzard namespace/build and graph fingerprint.
   - Preserve every official membership path when the same spell appears in multiple Journal branches.
   - Use the official graph to answer published identity/hierarchy/membership questions before spending WCL to rediscover them statistically.
   - A Journal relationship is an official semantic relationship, not an observed event-to-event causal edge.

6. **Semantic evidence planning**
   - If persisted empirical evidence plus official semantics cannot settle the remaining combat/causal question, create a surgical plan for only the unresolved signal(s).
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

9. **Promotion**
   - Converting a verified structural/semantic claim into an accepted/scoreable mechanic requires the separately versioned promotion contract.
   - Promotion must define denominator, eligibility, null policy, player attribution rules, validation requirements, contradiction policy and score impact.

10. **Publication breadth**
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
- If no deterministic local structure exists, escalate only the explicit unresolved evidence question.
- If a future encounter produces a new structural pattern not covered by the generic hypothesis vocabulary, add a **generic evidence feature**, not a boss-name branch.

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
