# Iris signal triage v1

This contract separates three questions that were previously easy to conflate:

1. **Is this important signal actually part of the GLOBAL BOSS evidence population?**
2. **What should Iris do next to learn the encounter better?**
3. **What additional breadth is still required to satisfy publication gates?**

The contract is implemented by engine policy `3.7.9`, signal policy `signal-triage-v1`, decision policy `iris-decision-separation-v1`, and dry-run planner `surgical-probe-plan-v1`.

## 1. Signal-origin triage

Iris classifies important signals from persisted Deep provenance before buying more WCL evidence.

Current classes:

- `friendly-player`: source-resolved evidence is strongly dominated by friendly actor IDs across multiple reports.
- `encounter`: source-resolved evidence is strongly dominated by non-friendly actor IDs, source-less evidence is bounded, and the pattern reproduces across multiple reports. Under the current provenance schema this means encounter/environment-facing, not a claim about one exact NPC actor.
- `mixed`: enough source-resolved evidence exists, but friendly and non-friendly sources are both materially present.
- `unknown`: evidence is still too thin to classify safely.

Names are never used as provenance. A spell named `Rebirth`, `Fel Armor`, or anything else is classified only from event/source evidence.

### Denominator rule

A signal that is sufficiently established as `friendly-player` is excluded from the GLOBAL BOSS signal-coverage denominator. It must not remain a critical unresolved boss signal merely because its name or activity made it look important.

`mixed` and `unknown` signals remain in the denominator until resolved. `encounter` signals remain in the denominator and should first be handled by local mechanic synthesis because their provenance is already strong enough.

## 2. Action order

Iris prioritizes signal work in this order:

1. critical unresolved signals with `mixed` / `unknown` provenance,
2. critical unresolved signals already classified `encounter`,
3. genuinely unresolved relation-provenance rows,
4. other useful unresolved signals.

Friendly-player signals are removed from this focus queue.

For the first category the next external-evidence step is a surgical probe plan. For the second category the next step is **0-WCL local analysis** over persisted mechanics, Deep relations and state evidence.

## 3. Relation provenance is three-way, not binary

Relation rows are now distinguished as:

- `verified`: origin-verified encounter relationship,
- `friendly/noisy closed`: rejected because source or target is demonstrably friendly/noisy,
- `awaiting origin evidence`: still mixed/unknown and genuinely eligible for more provenance work.

A row already classified friendly/noisy is not described as "needs provenance" and must not trigger more WCL spending.

## 4. Metric names are no longer aliases

Three metrics have separate meanings:

- `signalCoverage`: weighted coverage of important eligible GLOBAL BOSS signals by accepted mechanics.
- `relationUnderstanding`: maturity of origin-verified temporal/structural encounter relationships.
- `semanticCoverageTechnical`: technical semantic-needs coverage produced by the semantic discovery subsystem.

The old component alias `semanticResolutionPct = relationUnderstandingPct` is removed from the active v3.7.9 component contract. `semanticCoverageTechnicalPct` is exposed explicitly instead.

`publishChecks.semanticCoverage` now follows the technical semantic-coverage score for compatibility, and `publishChecks.semanticCoverageTechnical` exposes the same gate with the unambiguous name.

## 5. Learning next vs publication next

Iris now exposes two separate recommendations:

- `learning.recommendations.learningNext`: the action with the best expected information gain for understanding the encounter.
- `learning.recommendations.publicationNext`: the evidence breadth still needed to satisfy publication gates.

`learning.actionBottleneck` follows the actual learning bottleneck. `learning.publicationActionBottleneck` tracks publication breadth separately.

The legacy `learning.enrichmentRecommendation` remains an alias of **publicationNext** only so the existing explicit `Improve` workflow keeps its meaning. The API route reads `publicationRecommendation` deliberately; a signal-discovery bottleneck cannot silently launch a broad crawl.

## 6. Surgical probe planner v1 is dry-run only

`GET /api/wcl/corpus?action=probe-plan&encounter=...&difficulty=...&partition=...` builds a plan from persisted local evidence and performs **0 WCL calls**.

The planner:

- targets only critical `mixed` / `unknown` signals,
- restricts candidates to current canonical Wide report codes when a sampling manifest exists,
- prefers independent sources,
- emits exact report codes and exact `fightIDs`,
- proposes `abilityID` plus `filterExpression`,
- leaves actor/time/phase narrowing empty until the provenance result provides an anchor,
- proposes a narrow ±5 s temporal follow-up template instead of a whole-report scan,
- never counts a surgical probe toward canonical Deep reports or pulls.

Report-level Wide presence does not prove that every selected exact fight contains the event. An empty surgical result is a valid diagnostic and must not be treated as a successful evidence observation.

### Deliberate v1 limitation

There is **no surgical probe executor in v1**. The planner reports `executesWcl=false`, `wclCallsExecuted=0`, and `executorImplemented=false`.

No probe may alter a score directly. Future execution/promotion must be a separate versioned contract that requires independent-source reproduction before diagnostic evidence can affect provenance or relationship knowledge.

## 7. Authority order

For this stage of Iris development:

1. persisted canonical evidence,
2. local triage and mechanic/relation analysis,
3. zero-WCL probe plan,
4. explicit user-reviewed surgical execution in a future contract,
5. broad report acquisition only when a publication or evidence-breadth gate genuinely requires it.

This prevents `reports-first` publication work from being mistaken for the best learning action and prevents already-rejected friendly/noisy hypotheses from consuming more WCL budget.
