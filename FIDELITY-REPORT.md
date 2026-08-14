# Fidelity report — v3 base

- Golden immutable files: 6
- Golden SHA-256 hashes recorded: 6
- Source screen modules: 9/9
- Shared reconstructed visual components: 7
- Golden mock datasets preserved: 7/7
- Static className literals in Golden app: 147
- Static className literals in source split: 147
- Golden screen/App string literals: 824
- Source split string literals (includes imports): 944
- Visual deploy assets (`main.js`, `main.css`, favicon, OG): byte-identical to Golden
- Production publish target in v3: still `deploy-preview/public` (Golden bundle), not source-built React yet

## Gates passed now

1. Golden hash verification.
2. Byte equality of visual assets.
3. 9-screen/navigation/mock coverage.
4. Every Golden screen/App string literal preserved in reconstructed source.
5. Static className literal preservation.
6. Relative import resolution.
7. JavaScript syntax checks.
8. Thin Netlify transport + service facade concentration guard.

## Gate deliberately not claimed yet

Browser pixel screenshot diff of the source-built React application. The current execution environment blocks local browser navigation, so v3 deliberately keeps the Golden compiled bundle as the Netlify publish target until that visual test can be run in a normal local/CI browser environment. This avoids pretending visual equivalence has been proven when it has not.
