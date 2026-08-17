# AvoiD Raid Ops — agent/developer guardrails

Read these before making changes in this repository.

1. **Read `WCL-QUERY-PLAYBOOK.md` before any Warcraft Logs work.** WCL can be queried by exact fights, encounter, difficulty, ability, source/target, time windows, phases and `filterExpression`. Do not default to whole-report event downloads.
2. **Preserve evidence classes.** Surgical WCL probes are diagnostic and must not silently count as canonical Deep reports/pulls. Incomplete Deep streams never count as complete Deep evidence.
3. **GLOBAL BOSS scope is `encounter + difficulty + partition`.** Never mix partitions. AvoiD/home reports are application/evaluation data, not boss train/holdout data.
4. **Metric/evidence contracts are versioned.** Do not silently change formulas, populations, eligibility, null policy, or evidence denominators.
5. **Use persistent evidence first.** Recompile/inspect cached evidence at 0 WCL before buying new API evidence.
6. **Protect the WCL rate budget** and retain checkpoint/resume behavior.
7. **UX fidelity matters.** Do not replace the existing visual system or reintroduce mock/fake interactions while wiring real data.
8. **Git/deployment cadence:** `main` is the Vercel production branch. Normal work develops on a feature branch, validates, bumps the appropriate release when ready, then merges. The 4.0.0 repository refactor is the explicit long-lived exception: work stays on `refactor/reorganizacion-2026-08-17`, and the stable product/package version must not become `4.0.0` until the complete refactor passes its release gates. Non-main branches must not require Vercel preview deployment for validation.
9. **Quarantine is not source.** Active code must never import from `old/` or `old/quarantine/`. Do not hotfix quarantined implementations; fix the canonical owner.
10. **Netlify is retired.** Do not add new Netlify deployment/runtime dependencies. Historical Netlify material may exist only in archive/quarantine while 4.0.0 migration proof is collected.
11. **Release filenames are not version control.** Do not create new ordinary implementation files named after product releases. Retain version identifiers only for real contracts, persisted models or compatibility boundaries.
12. Never commit `.env*`, WCL credentials, local corpus data, `node_modules`, build output, or other local secrets/state.
