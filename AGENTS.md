# AvoiD Raid Ops — agent/developer guardrails

Read these before making changes in this repository.

1. **Read `WCL-QUERY-PLAYBOOK.md` before any Warcraft Logs work.** WCL can be queried by exact fights, encounter, difficulty, ability, source/target, time windows, phases and `filterExpression`. Do not default to whole-report event downloads.
2. **Preserve evidence classes.** Surgical WCL probes are diagnostic and must not silently count as canonical Deep reports/pulls. Incomplete Deep streams never count as complete Deep evidence. For Deep acquisition/rebuild work also read `docs/IRIS-CANONICAL-DEEP-TOPUP-V1.md`: post-rebuild canonical coverage is authoritative and canonical Deep must come from the canonical Wide sample.
3. **GLOBAL BOSS scope is `encounter + difficulty + partition`.** Never mix partitions. AvoiD/home reports are application/evaluation data, not boss train/holdout data.
4. **Metric/evidence contracts are versioned.** Do not silently change formulas, populations, eligibility, null policy, or evidence denominators.
5. **Use persistent evidence first.** Recompile/inspect cached evidence at 0 WCL before buying new API evidence.
6. **Protect the WCL rate budget** and retain checkpoint/resume behavior.
7. **UX fidelity matters.** Do not replace the existing visual system or reintroduce mock/fake interactions while wiring real data.
8. **Git cadence:** develop on a feature/fix branch, validate, bump the appropriate version, and prepare a PR against `main`. **Do not merge to `main` unless the user explicitly asks for that merge in the current conversation.** After an approved merge, branch again for the next unit of work. Feature branches must not enable Vercel preview deployments; `main` is the production branch.
9. Never commit `.env*`, WCL credentials, local corpus data, `node_modules`, build output, or other local secrets/state.
