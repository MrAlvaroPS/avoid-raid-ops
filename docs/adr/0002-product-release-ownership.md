# ADR 0002 — Product release ownership

Status: accepted during the pre-4.0 repository reorganization.

## Decision

`@avoid/release` is the only owner of the AvoiD Raid Operations **product release**. The canonical semantic version and visible label live in `packages/release/src/index.js`.

The browser shell source imports `PRODUCT_RELEASE_LABEL` from that package. The active compatibility bootstrap cannot import ESM directly, so it reads the same contract through the thin `GET /api/release` route and never embeds a product-version fallback.

`@avoid/web` and `@avoid/release` use the neutral private package version `0.0.0-private.0`. The root Vercel package retains its historical `0.3.9-2-vercel.0` transport/compatibility identifier because the v3.9.2 critical wiring contract depends on it. None of these npm package versions may drive the visible product release.

## Version taxonomy

Product release is distinct from:

- the root Vercel package transport/compatibility version;
- runtime/component versions such as Iris, Players, bootstrap, or historical `public/*-vNNN` assets;
- asset cache-busting query versions in `index.html`;
- metric, schema, engine, capability and storage contract versions;
- historical release numbers preserved in regression tests, changelogs and checkpoint documentation.

Those versions remain with their owning component/contract and must not mutate the global visible product release.

## Release gate

`npm run verify:release` validates the ownership contract on every full verification/build. On a GitHub tag run, `vX.Y.Z` must exactly equal `PRODUCT_RELEASE_LABEL`; a mismatched tag fails before deployment tests.

## Migration invariant

Do not bump the product to `4.0.0` merely because repository reorganization work is happening. The 4.0.0 release is reserved for the completed architecture migration and its validated product checkpoint.
