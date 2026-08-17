# ADR 0003 — Active compatibility asset ownership

Status: accepted during the pre-4.0 repository reorganization.

## Problem

The production entrypoint intentionally preserves the immutable Golden shell and then layers years of additive CSS and browser runtimes on top of it. A filename that looks historical is not necessarily inactive: several current visual and data contracts still depend on exact cascade/load order. Conversely, `public/` also contains superseded runtime generations that must remain available as regression history without being accidentally reactivated.

Deleting or concatenating those files before documenting ownership would trade visible technical debt for untraceable behavior changes.

## Decision

`config/active-assets.mjs` is the canonical compatibility manifest for the root production entrypoint. Every active local stylesheet/runtime and every active external runtime must declare:

- exact source URL, including cache identity;
- owner and product domain;
- current role;
- authority (`base`, `primary`, `compatibility`, `guard`, `overlay`, or `reference-only`);
- retirement policy.

`scripts/verify-active-assets.mjs` compares `index.html` against that manifest byte-for-byte at the URL/order level. Adding, deleting or reordering an active stylesheet/script therefore requires an explicit ownership change in the same commit.

## Runtime ownership

The current primary browser owners are:

- bootstrap → `wcl-bootstrap-v389.js`;
- data platform → `data-hub-v390.js`;
- knowledge → `knowledge-reindex-v390.js`;
- Mechanics/Encounter Corpus → `encounter-intelligence-v375.js`;
- Progress → `progress-runtime-v3713.js`;
- Iris → `iris-runtime-v3713.js`;
- Players → `player-intelligence-v392.js`.

`wcl-runtime.js` remains active only as a **compatibility** runtime. It may contain legacy writers required by the current product, but it cannot regain primary ownership. Its migration path is decomposition by domain with regression coverage, not another monolithic replacement.

`main.js` and `main.css` remain immutable Golden base assets.

## Historical generations

Known superseded files are explicitly inventoried as `HISTORICAL_ONLY_ASSETS`. CI requires them to remain unreferenced by the production entrypoint. The versioned runtime families additionally require exactly one loaded generation per family.

This lets us retain forensic/regression history while preventing a future edit from silently loading `progress-runtime-v3712.js`, `iris-runtime-v3712.js`, `player-intelligence-v386.js`, or another superseded generation beside its active owner.

## CSS consolidation rule

The 17 active additive CSS overlays are **not** assumed redundant. Their retirement policy is `visual-equivalence-required`. Before replacing any subset with a canonical transport, we compile them by exact ordered concatenation through `scripts/lib/active-css-bundle.mjs`.

The compiler performs no minification, selector rewrite, declaration merge or source reordering. It rejects `@charset`, `@import` and `@namespace` in a source layer because those directives could change semantics when files are concatenated. The generated `public/raidops-active.css` is intentionally ignored by Git and rebuilt before development, verification and production build.

Stage 1 generates and byte-verifies the candidate bundle while the 17 original links remain active. Only after that proof is green may the production entrypoint switch from the individual overlays to the generated transport. Original overlay files remain audit/regression sources after the switch.
