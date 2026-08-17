# Quarantine / legacy area

`old/` is a temporary migration boundary used during the 4.0.0 repository refactor. It is not a second source tree.

## Rules

- Active application, server, package, route, workflow and test code must not import from `old/`.
- Files are placed here only when they are confirmed legacy or when removal is plausible but still needs dependency/regression proof.
- Moving a file here does not by itself authorize deletion.
- Quarantined code must not become the easiest place to add a hotfix; fixes belong in the canonical owner.
- Historical material that remains useful as documentation should move to `docs/archive/`, not remain indefinitely in `old/`.
- Before final 4.0.0 release, every remaining quarantine item must be classified as delete, archive, compatibility-required, or restored.

Expected migration subareas include Netlify-only deployment remnants, superseded browser runtimes/styles, and server implementations proven obsolete after reference analysis.
