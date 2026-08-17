# Iris boss-agnostic learning pipeline v1

This contract defines how Iris refines encounter knowledge for **any** boss. The current Belo'ren corpus is validation data, not an implementation special case.

## Core invariant

GLOBAL BOSS learning is always scoped by:

`encounterId + difficulty + partition`

No learning stage may require a hard-coded boss name, encounter ID, ability ID, spell name, phase name, or encounter-specific rule in order to function.

Boss-specific facts may emerge from evidence and be stored in the resulting model. They must not be prerequisites baked into the generic learning engine.

## Generic state machine

For every encounter, Iris follows the same evidence ladder when the relevant state exists:

1. **Canonical acquisition**
   - Build trustworthy Wide evidence with independent-source sampling.
   - Upgrade selected canonical Wide evidence to complete canonical Deep when required.
   - Treat the post-rebuild canonical population as authoritative.

2. **Signal discovery**
   - Discover candidate abilities/signals from the encounter evidence itself.
   - Do not use spell names to decide whether a signal belongs to the boss or what it means.

3. **Origin triage**
   - Classify important unresolved signals from observed source provenance as `friendly-player`, `encounter`, `mixed`, or `unknown`.
   - Proven friendly-player signals leave the GLOBAL BOSS denominator.
   - Mixed/unknown critical signals may advance to a narrow provenance probe.

4. **Local mechanic synthesis**
   - Encounter-origin critical signals are first analyzed from persisted Wide/Deep and source-isolated validation evidence.
   - Generic structural hypotheses include cast interruption, wipe association, damage exposure, raid pressure, phase-boundary concentration, state alignment, and verified temporal relations.
   - A local hypothesis never becomes an accepted mechanic merely because its confidence is high.

5. **Semantic evidence planning**
   - If persisted evidence cannot settle the remaining semantic question, create a surgical plan for only the unresolved signal(s).
   - Select independent canonical sources and exact fights.
   - Query anchor occurrences first, then only the narrow temporal/actor/target context needed around those anchors.
   - Do not fall back to whole-report scanning for convenience.

6. **Independent-source verification**
   - Semantic/provenance claims require reproduction across independent sources under a versioned evidence contract.
   - Missing or contradictory evidence remains unresolved; it is never converted into success.

7. **Promotion**
   - Converting a verified structural/semantic claim into an accepted/scoreable mechanic requires a separately versioned promotion contract.
   - Promotion must define denominator, eligibility, null policy, player attribution rules, validation requirements, and score impact.

8. **Publication breadth**
   - Publication/sample-size work remains separate from `learningNext`.
   - A boss may need more reports for publication even when the best next learning action is local synthesis or a surgical semantic probe.

## Escalation is conditional, not mandatory

Not every boss must execute every stage. The pipeline is state-driven:

- If no critical unresolved signals remain, there is no reason to run signal probes.
- If provenance is already decisive, skip provenance acquisition.
- If local structural evidence is sufficient, do not spend WCL on semantic probing yet.
- If no deterministic local structure exists, escalate only the explicit unresolved evidence question.
- If a future encounter produces a new structural pattern not covered by the generic hypothesis vocabulary, add a **generic evidence feature**, not a boss-name branch.

## Forbidden implementation patterns

Production learning code must not contain logic such as:

```text
if encounterId == <current boss> ...
if abilityId == <known current spell> ...
if spellName contains "Rebirth" then ...
```

The following are allowed outside the generic learner when clearly separated:

- regression fixtures using a known encounter to confirm behavior,
- UI labels resolved from learned data,
- explicitly versioned boss-specific evaluation/application rules that do not teach the GLOBAL BOSS model,
- test data that proves generic code reproduces a known observation without using that observation as an input rule.

## Required portability test

Every new generic learning stage must have at least one synthetic test using arbitrary encounter/ability IDs and names. The test must prove that the stage derives its targets and query shape from model/evidence state rather than current-boss constants.

The generic learning modules must also remain free of literal current-validation-boss names/IDs. This guardrail exists to prevent a successful one-boss experiment from quietly becoming hard-coded product behavior.
