# Iris Semantic Candidate Specificity Verifier v3

**Verifier:** `semantic-candidate-specificity-verification-v3`  
**Purpose:** prevent one structurally frequent background pattern from blocking evaluation of better mechanic candidates.

## Problem found during live validation

Verifier v2 correctly rejected a structurally reproduced pattern when its null/control prevalence showed background noise. However, v2 only ran specificity against the single structurally top-ranked pattern. If that pattern was noise, lower-ranked candidates were never tested even when they reproduced across the same independent sources/windows.

That made this possible:

```text
structural rank #1 -> background-noise
structural rank #2 -> never evaluated
structural rank #3 -> never evaluated
...
```

The signal-level conclusion could therefore look like `background-noise` when only one candidate had actually been rejected.

## v3 contract

v3 preserves structural recurrence as a prerequisite, but evaluates each structurally eligible candidate independently against the same null/control baseline.

For every candidate it records:

- independent sources;
- anchor-window prevalence;
- background-window prevalence;
- smoothed lift;
- prevalence delta;
- temporal median/spread;
- report-local actor topology;
- provider-aware encounter relevance;
- candidate mechanical status.

A candidate is structurally eligible only if it independently meets the configured minimum source and window counts. A rare one-source coincidence cannot outrank a reproduced candidate simply because its background prevalence is zero.

## Selection policy

Candidate statuses are ordered by evidence strength:

```text
mechanically-supported
specificity-supported
specificity-partial
background-required
background-noise
unverified
```

Within the same status, v3 uses specificity lift/delta first and then provider support, topology, temporal consistency and structural strength as deterministic tie-breakers.

The structurally top-ranked candidate is preserved separately as `structuralBestPattern`. The selected semantic candidate is returned as `bestPattern`.

This makes a critical distinction visible:

```text
structuralBestPattern = frequent neighbor that reproduced
bestPattern           = strongest candidate after null-baseline evaluation
```

## Output additions

- `selectionPolicy = candidate-wise-specificity-first-v1`
- `structuralBestPattern`
- `candidateAssessments[]`
- `selectionDiagnostics.evaluatedCandidates`
- `selectionDiagnostics.structurallyEligibleCandidates`
- `selectionDiagnostics.backgroundNoiseCandidates`
- `selectionDiagnostics.specificitySupportedCandidates`
- `selectionDiagnostics.structuralTopRejectedAsNoise`

`topPatterns[]` remains the original structural ranking for auditability.

## Evidence invariants

- Existing persisted semantic evidence is sufficient for re-verification; no new WCL call is required.
- Provider network calls are not required for candidate-wise re-verification unless provider knowledge is explicitly supplied by the caller.
- WCL observed combat remains canonical.
- No candidate status contributes canonical Deep reports/pulls.
- No direct Boss Learned score delta.
- No automatic mechanic promotion.
- A separate versioned promotion contract is still required after `mechanically-supported`.

## Portability

Generic logic contains no current encounter/spell constants. Regression tests use arbitrary synthetic IDs and explicitly cover the case where structural rank #1 is background noise while another reproduced candidate is specific.
