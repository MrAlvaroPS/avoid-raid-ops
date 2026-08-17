# Iris local mechanic synthesis v1

Status: local-only evidence analysis. This contract performs **0 WCL calls** and does not silently promote a signal into a scoreable mechanic.

## Purpose

After signal triage has established that a critical unresolved ability is encounter-origin, Iris should answer the next question from persisted canonical evidence before buying more Warcraft Logs data:

> What structural role does this signal appear to play, and what evidence is still missing before it can become an accepted mechanic?

This is deliberately different from provenance. `encounter` means the signal belongs to the encounter; it does not by itself prove that the signal is avoidable, interruptible, lethal, a phase transition, a state assignment, or a player failure.

## Evidence inputs

Synthesis v1 may use only already-persisted canonical evidence:

- Wide kill/wipe table presence and counts,
- Deep begins/casts/interrupts/damage/death-link/aura metrics,
- origin-verified temporal relations,
- state alignment and variant-family context,
- accepted mechanics,
- rejected mechanic candidates and their validation evidence,
- source-isolated validation split evidence.

No ability name is allowed to determine provenance or mechanic meaning.

## Structural hypotheses

The synthesizer can describe evidence shapes such as:

- `interrupt-candidate`,
- `wipe-associated-cast`,
- `damage-signal`,
- `raid-pressure`,
- `state-linked`,
- `relation-linked`,
- `phase-boundary-observation`,
- `insufficient-local-structure`.

These are **hypotheses**, not automatic semantic truth.

## Promotion states

Each critical encounter-origin signal receives one of three states:

1. `local-evidence-sufficient` — persisted train + validation evidence supports a narrow structural statement strongly enough for a separately versioned mechanic-promotion rule to consume later.
2. `local-evidence-partial` — useful structure exists, but the signal must remain unresolved/diagnostic.
3. `external-evidence-needed` — persisted evidence cannot answer the remaining question; only then may a surgical WCL plan be considered.

v1 never changes `pack.mechanics`, player Reliability, Deep coverage, or Boss Learned merely because a candidate is generated.

## Validation-first rule

A train-side pattern is not sufficient by itself. Where the hypothesis depends on kill/wipe separation, cast completion, damage prevalence or similar comparative evidence, synthesis exposes validation-split reproduction separately. Missing validation evidence is `unknown`, never success.

## Decision flow

For a critical encounter-origin signal:

```text
persisted canonical evidence
  -> summarize train structure
  -> check validation reproduction
  -> inspect accepted/rejected candidates + verified relations/state context
  -> produce deterministic candidate + confidence + missing evidence
  -> no WCL if local evidence is sufficient/partial
  -> surgical WCL only when a concrete unresolved question remains
```

## Current product consequence

`learningNext` may remain local mechanic synthesis while one or more critical encounter-origin signals still have useful local evidence work. Publication breadth remains a separate `publicationNext` recommendation.
