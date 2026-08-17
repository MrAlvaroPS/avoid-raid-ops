# Iris Semantic Surgical Probe v2 — evidence selection contract

Version: `semantic-surgical-probe-plan-v2`
Evidence selection: `semantic-probe-evidence-selection-v1`

This contract is boss-agnostic. It applies to every GLOBAL BOSS scope (`encounter + difficulty + partition`) whenever local mechanic synthesis leaves one or more signals in `external-evidence-needed`.

## Why v2 exists

The v1 semantic planner correctly selected targets by learning state and emitted exact-fight, zero-WCL dry-run plans, but its API route loaded only persisted Wide profiles. That meant the planner could claim to prefer persisted Deep evidence while being unable to inspect the `deep/...` corpus at all.

v2 makes the evidence hierarchy real rather than declarative.

## Selection hierarchy

For each target signal, candidate reports are derived from the current canonical sampling manifest and ordered as:

1. **Canonical Deep + persisted target origin events** (`canonical-deep-target-events`).
2. **Canonical Deep + report-level target presence** (`canonical-deep-report-presence`).
3. **Canonical Wide + report-level target presence** (`canonical-wide-report-presence`).

A lower tier is a fallback only when higher-tier evidence cannot provide enough independent sources.

The planner must load both storage populations:

- `profiles/<encounter/difficulty/partition>/...` for Wide,
- `deep/<encounter/difficulty/partition>/...` for Deep.

Deep candidates must satisfy all required Deep stream-completeness gates and, when the manifest exposes `selectedDeepCodes`, must belong to that exact canonical Deep selection. Deep candidates must also remain inside `selectedWideCodes` because canonical Deep is a subset of canonical Wide.

## Why persisted target events matter

A Wide table can show that an ability appears somewhere in a report, but not which exact fight contains the event. A complete Deep profile with `originEvidence[targetId].events > 0` proves that the target was observed inside the Deep-profiled exact fight set.

That does not eliminate the need for an anchor query when timestamps/source/target context were not persisted. It makes the anchor query materially less wasteful by choosing reports/fights already known to contain the target signal.

## Independent-source rule

After evidence-tier ranking, source diversity still wins over repeated reports from the same guild/uploader. A source can provide at most one initial anchor request until the requested independent-source target is satisfied or the pool is exhausted.

## Evidence output

Every anchor request must expose auditable `selectionEvidence`:

- policy version,
- selection tier,
- target-presence kind,
- persisted target event count,
- whether the profile is complete Deep,
- whether it belongs to the canonical Deep manifest.

The plan also exposes counts of available Deep target reports and Wide fallbacks so an executor/reviewer can see whether Wide fallback was actually necessary.

## Safety remains unchanged

v2 is still dry-run only:

- 0 WCL calls,
- no executor,
- no whole-report fallback,
- no Deep report/pull contribution,
- no direct score change,
- no mechanic promotion,
- no semantics inferred from spell names.

The verification contract still requires independent-source reproduction. A future executor is a separate versioned stage and must not weaken these rules.

## Portability requirement

No logic in this contract may depend on a concrete boss name, encounter ID, ability ID, or ability-name meaning. Synthetic tests with arbitrary IDs must demonstrate that the same evidence hierarchy works for any encounter.