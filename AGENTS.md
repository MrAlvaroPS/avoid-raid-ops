# AvoiD Raid Ops — agent/developer guardrails

Read these before making changes in this repository.

1. **Read `WCL-QUERY-PLAYBOOK.md` before any Warcraft Logs work.** WCL can be queried by exact fights, encounter, difficulty, ability, source/target, time windows, phases and `filterExpression`. Do not default to whole-report event downloads.
2. **Read `IRIS-ARCHITECTURE.md` and `IRIS-OPERATIONS.md` before changing Iris, data/log controls, live polling, game knowledge or corpus-management behavior.** `server/iris/capability-contract-v390.mjs` is the machine-readable source of truth for what Iris can inspect/manage, what is partial/planned, and which autonomy/approval level applies. Do not duplicate or silently broaden those permissions in UI/runtime code.
3. **Preserve evidence classes.** Surgical WCL probes are diagnostic and must not silently count as canonical Deep reports/pulls. Incomplete Deep streams never count as complete Deep evidence.
4. **GLOBAL BOSS scope is `encounter + difficulty + partition`.** Never mix partitions. AvoiD/home reports are application/evaluation data, not boss train/holdout data.
5. **Metric/evidence contracts are versioned.** Do not silently change formulas, populations, eligibility, null policy, or evidence denominators.
6. **Use persistent evidence first.** Recompile/inspect cached evidence at 0 WCL before buying new API evidence.
7. **Protect the WCL rate budget** and retain checkpoint/resume behavior. Live polling must remain compact/change-driven rather than fetching rich telemetry on every tick.
8. **UX fidelity matters.** Do not replace the existing visual system or reintroduce mock/fake interactions while wiring real data. Runtime cards must obey page ownership and the shared spacing contract.
9. **Knowledge updates never rewrite raw WCL evidence.** Activating a new Iris knowledge revision invalidates/re-derives derived products. Planned providers/workers must not be described as already implemented.
10. **Git cadence:** develop on a feature branch, validate, bump the appropriate version, PR/merge to `main`, then branch again for the next unit of work. Feature branches must not enable Vercel preview deployments; `main` is the production branch.
11. Never commit `.env*`, WCL credentials, local corpus data, `node_modules`, build output, or other local secrets/state.
