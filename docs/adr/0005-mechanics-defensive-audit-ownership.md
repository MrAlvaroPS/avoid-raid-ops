# ADR 0005 — Separate Mechanics and Defensive Audit ownership

- Status: Accepted for the 4.0.0 migration
- Date: 2026-08-18

## Context

`public/wcl-runtime.js` still contains five presentation writers that were historically grouped as one `mechanics-defensives` responsibility:

- `applyMechanicsAndDefensives`
- `applyTelemetryMechanics`
- `applyTelemetryDefensives`
- `applyIntelligenceMechanics`
- `applyIntelligenceDefensives`

That grouping hides two different product screens and creates a dangerous migration shortcut: because `encounter-intelligence-v375.js` owns Encounter/Corpus presentation, it could accidentally become the owner of Defensive Audit as well.

The maintained React source already exposes the correct boundaries:

- `apps/web/src/features/mechanics/Mechanics.js`
- `apps/web/src/features/defensive-audit/DefensiveAudit.js`

## Decision

Mechanics and Defensive Audit are separate presentation domains with separate canonical source owners.

The remaining legacy functions are classified as:

1. Shared fallback writer
   - `applyMechanicsAndDefensives`
   - Transitional owner: `split-source-owners`
   - Must be split by active feature before retirement.

2. Mechanics writers
   - `applyTelemetryMechanics`
   - `applyIntelligenceMechanics`
   - Canonical source owner: `apps/web/src/features/mechanics/Mechanics.js`

3. Defensive Audit writers
   - `applyTelemetryDefensives`
   - `applyIntelligenceDefensives`
   - Canonical source owner: `apps/web/src/features/defensive-audit/DefensiveAudit.js`

`encounter-intelligence-v375.js` remains the current Encounter/Corpus runtime owner. It is not the canonical owner of Defensive Audit.

## Consequences

- No writer is deleted by this ADR.
- No DOM, request, timer, observer, scoring or Data Truth behavior changes.
- Mechanics and Defensive Audit require independent shadow checkpoints and independent physical-retirement decisions.
- The shared fallback must be split before either screen can be considered fully migrated.
- Tests must prevent the old combined ownership bucket from returning.
