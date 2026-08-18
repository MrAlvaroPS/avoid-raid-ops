# Changelog

All meaningful product changes are recorded here. Git history remains the detailed implementation history; release-specific `V*-CHANGES.*` files are legacy documentation and will be consolidated during the 4.0.0 repository refactor.

## [Unreleased] — target 4.0.0

### Repository refactor

- Started the 4.0.0 repository reorganization on `refactor/reorganizacion-2026-08-17`.
- `4.0.0` is the release target, not an in-progress version claim. The product/package version must not be changed to `4.0.0` until the refactor is complete and all required stability gates are green.
- `main` remains the production branch and is not modified by migration work until the refactor is ready to merge.
- Netlify is no longer part of the deployment architecture; Netlify-only files are migration candidates for quarantine/removal after reference checks.
- The Golden Master remains immutable and continues to define visual fidelity during the migration.
- Added canonical documentation and ADR boundaries for the 4.0.0 migration, plus `old/` quarantine rules that forbid active-code imports.
- Quarantined the obsolete `deploy-preview/` Netlify tree byte-for-byte and removed it from the active repository layout.
- Archived the obsolete root Netlify deployment guide and quarantined the unused Netlify storage adapter.
- Detached Golden, Data Truth and unit/regression verification from `deploy-preview/`; active verification now targets the Vercel/runtime asset tree.
- Promoted Golden, architecture, reconstruction and browser Data Truth checks into the normal CI gate and pinned the browser verifier dependency for reproducibility.
- Fixed a Linux case-sensitive Golden reconstruction check by falling back to the immutable Golden bundle when a historical extracted symbol collides by case.
- Reconciled the legacy WCL runtime ownership audit into the canonical refactor branch. Every legacy writer/helper now has an explicit domain, owner and retirement state.
- Established one active-asset manifest and one generated compatibility CSS transport while retaining the reviewed historical CSS source layers for visual-equivalence verification.
- Began physical legacy-runtime decomposition with one passive Command Center bridge. It consumes the already-loaded report and History payloads, owns only Command Center `What changed?` plus the Command Center progression curve, and adds no network request/timer/observer/animation loop. After two green shadow checkpoints and explicit approval, the legacy `applyProgressCurve` and mixed `applyHistoryData` declarations were physically retired; `wcl-runtime.js` now delegates those two responsibilities through optional bridge bindings.
- The physical-retirement implementation is anchored at commit `daadb4b700001845b44082157dab9e0eb8547579`; the following documentation-only push exists to exercise the normal full CI gate on that same functional tree.
- Completed the final Progress compatibility shadow checkpoint. Canonical `progress-runtime-v3713.js` owns the missing-History Data Truth presentation, consumes the already-loaded History state and adds zero direct network requests. The shadow implementation is anchored at `2a1ea8055366de9ecc686066303986b7d754cc27`; repository `AvoiD Validation` was green at follow-up checkpoint `8202dca10abe420b4288f27797851a6def3bba8c` while Vercel was quota-limited rather than failing a repository assertion.
- Physically retired the legacy `neutralizeMissingHistory` declaration and its `applySupplemental()` call after that validation and explicit continuation approval. Missing-History presentation is now exclusively owned by canonical Progress. The historical interception name remains as a defensive v4 migration guard, with no active compatibility writer behind it.
- Began the Players/Reliability presentation shadow checkpoint. Canonical `player-intelligence-v392.js` now publishes explicit single-writer ownership and shadows the historical `applyPlayers` and `applyTelemetryPlayers` globals only while the active Player Intelligence screen is mounted, delegating legacy behavior elsewhere. The checkpoint adds zero direct requests, zero observers and zero polling beyond the existing 750 ms canonical repaint; shared data/helper bridges remain untouched pending validated physical retirement.
- Completed the Players/Reliability presentation retirement after the shadow checkpoint passed repository `AvoiD Validation` at `ad749c3672a61b9c16898cf34b7f2211f3b1627f` and explicit continuation approval. The legacy `applyPlayers` and `applyTelemetryPlayers` declarations and their orchestration calls are physically absent from `wcl-runtime.js`; `player-intelligence-v392.js` is the sole Players presentation owner, while the shared player data/helper bridge remains active for later extraction.
- Began the Corpus presentation shadow checkpoint. Canonical `encounter-intelligence-v375.js` can now create and place `.corpus-workbench` itself immediately before the mechanic catalogue, owns its visible presentation on Mechanics, hides it off-page, and shadows the historical `applyCorpusWorkbench` only on that screen while delegating elsewhere. The legacy renderer and workflow helpers remain physically present, `corpus-ui-stability-v1.js` remains active for this validation round, and the checkpoint adds no new request call sites, observers or polling beyond Encounter's existing 1500 ms loop.
- Physically retired the eight legacy Corpus runtime functions (`corpusCountdown`, `corpusContext`, `corpusRequest`, `refreshCorpusStatus`, `pollCorpus`, `corpusCell`, `corpusButton`, `applyCorpusWorkbench`) and removed the `applyAll()` presentation call after the green shadow checkpoint and explicit approval. Encounter Intelligence remains the sole Corpus presentation/data-polling owner; its existing 1500 ms loop and two request call sites are unchanged. The Corpus stability guard remains for one additional post-retirement validation round.
- Closed the Corpus migration after the additional post-retirement validation round passed at `1683baf037d50baeadb682d14e68a71eb6ecacb6`: removed the eight dead legacy Corpus state/formatting residues, physically deleted `corpus-ui-stability-v1.js`, and removed the temporary `window.applyCorpusWorkbench` shadow/binding from Encounter Intelligence. `encounter-intelligence-v375.js` now owns Corpus card creation, Mechanics-only visibility, navigation/popstate reconciliation and the single existing 1500 ms polling loop with no extra request sites, observers or animation loops.
- Split Mechanics and Defensive Audit into independent ownership domains. After a green five-writer screen-scoped shadow checkpoint, physically retired only the shared `applyMechanicsAndDefensives` fallback from `wcl-runtime.js`; the passive migration bridge now owns that fallback and continues to shadow the four screen-specific writers without adding requests, timers, observers or animation loops. The final source owners remain `Mechanics.js` and `DefensiveAudit.js`.
- Validated the feature-owned Mechanics parity shadow at `330526c31a5fd979012f587fe2dca18d5f4da3db`, then physically retired `applyTelemetryMechanics` and `applyIntelligenceMechanics` from `wcl-runtime.js`. The stable `public/mechanics-runtime.js` transport is byte-identical to `apps/web/src/features/mechanics/runtime.js`, owns both Mechanics presentation bindings, adds zero requests/timers/observers, and leaves Defensive Audit on its independent legacy-shadow path.
- Restored the canonical read-only validator after the Mechanics source-owner migration. The follow-up documentation push exists solely to execute the full CI gate against the final tree without any one-shot migration step.

### Mainline integration — v3.9.0 to v3.9.2

The 4.0.0 refactor baseline was updated to preserve the developments merged to `main` after the Phase 3 branch was created. Their stable release identity at that checkpoint was `3.9.2`; this integration did not claim 4.0.0.

Preserved developments include:

- Data Hub and its real-data/runtime ownership work;
- Players/Reliability evidence and dossier improvements, including the v3.9.2 dossier-header hotfix;
- Iris capability, operations and external-source registries;
- Knowledge Store/revision boundaries and report-catalog functionality;
- live-log controls and release-critical UI/ownership/spacing guards;
- canonical Deep top-up, signal triage and local mechanic synthesis;
- boss-agnostic learning and semantic/surgical probe planning/execution paths;
- the new release-critical regression suite and associated documentation/contracts.

Integration rules deliberately keep the Phase 3 architecture stronger than the pre-refactor layout: Netlify remains quarantined, tests continue to target active Vercel assets, browser Data Truth remains a CI gate, and the new critical test suite is additive rather than replacing existing verification.

### Mainline integration — v3.9.3 to v3.9.4

The refactor baseline was resynchronized after `main` advanced again. The functional baseline is now **v3.9.4** while 4.0.0 remains only the migration target.

Preserved developments include:

- `provider-aware-ability-knowledge-v1` with fingerprinted, bounded provider preview/resolve semantics;
- read-only Lorrgs boss/spell enrichment, optional server-keyed Parse/Wowhead reference enrichment and opt-in WCL GameData/WorldData static metadata;
- `/api/knowledge/ability` with explicit confirmation for provider execution, WCL budget and Parse credit use;
- `semantic-specificity-verification-v2`, including null/control specificity, actor topology, temporal consistency and provider-aware provenance;
- zero-WCL stored semantic re-verification using persisted diagnostic evidence and cached outer-flank controls;
- Iris source registry v2 and v3.9.4 capability contract;
- explicit invariants that provider metadata adds zero canonical Deep coverage, zero direct score delta and no automatic mechanic promotion.

The integration keeps the v4 route/service boundary: the Nitro semantic-probe route remains transport-only and the v3.9.4 `reverify` policy lives in `server/services/semantic-probe-service.mjs`.

Release-specific `V3.9.3-CHANGES.md` was intentionally not duplicated into the refactor root; its durable release information is consolidated here while the technical Iris contracts remain separately versioned.

### Verified checkpoint — Phase 3 / batch 1

At commit `21963c9b5c92f5745b4943f9aa190e99911dfbb6` the refactor branch passes:

- immutable Golden verification;
- architecture/quarantine verification;
- source reconstruction verification;
- browser Data Truth validation across all nine protected screens;
- all 244 unit/regression tests;
- the production Vercel/Nitro build contract.
