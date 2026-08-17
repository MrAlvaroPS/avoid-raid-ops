# Iris Source Contract — Archon.gg

**Site:** `https://www.archon.gg/wow`  
**Status for Iris:** WCL/RPGLogs documentation + product/meta reference; no separate supported Archon meta API identified  
**Reviewed:** 2026-08-17

## Relationship to Warcraft Logs

Archon is part of the RPGLogs ecosystem and hosts the current Warcraft Logs help documentation, including API/OAuth, API Terms, expressions, scripts and Report Components. For programmatic combat/report access, Iris should use the documented **Warcraft Logs GraphQL API**, not scrape Archon pages.

The Archon WoW product itself exposes useful human-facing views such as builds/meta, class/spec balance, raid rankings, guild progression and related tools. In the official material reviewed for this contract, no separate stable public developer API for those Archon meta pages was identified.

## Supported programmable surfaces Iris may rely on

### Warcraft Logs GraphQL v2

See `WARCRAFT-LOGS.md`. This is the supported API surface for reports, characters, guilds, world/game data, rankings and events.

### WCL Script Pins

RPGLogs documents a JavaScript scripting API for complex report filters. Important globals/concepts include:

- `apiVersion`;
- `reportGroup`;
- report-group actors, abilities, fights and reports;
- per-event predicates such as `pinMatchesFightEvent`;
- fight filters and translated language context.

Useful for prototyping an event predicate close to the report before implementing the equivalent deterministic WCL query/AvoiD rule.

### WCL Report Components

Report Components allow JavaScript-driven custom dashboards using report data, with components such as:

- JsonTree;
- EnhancedMarkdown;
- Table;
- Chart.

The help centre documents an embedded browser IDE/sandbox and dashboard sharing. GraphQL also exposes report-component data/mutation/evaluation types.

Iris can consult this capability to understand how RPGLogs models report-local analytics, but AvoiD should not make production correctness depend on a user's saved WCL components.

## `ArchonViewModels` warning

The WCL GraphQL schema exposes an `ArchonViewModels` object containing JSON view-model fields for site pages (including report/character/build-oriented pages). Many fields/arguments are explicitly `[Not documented]`.

Iris policy:

```text
Documented typed GraphQL root available? -> use it
Only ArchonViewModels/internal JSON exposes it? -> reference/research only
```

Do not build a production dependency on undocumented view-model JSON without a new reviewed provider contract.

## Product/reference uses

Archon pages may help Iris developers research:

- how meta/build distributions are presented;
- class/spec balance and ranking context;
- guild progression/ranking UX;
- cross-linking between WCL, Wipefest, WoWAnalyzer and Mythic Trap.

These are reference uses. A displayed Archon meta result is not automatically an AvoiD metric input.

## Data/API terms

Archon hosts RPGLogs API Terms. Those terms govern authorized API use and explicitly prohibit scraping/crawling RPGLogs services outside authorized API use, impose limits on storage/cache/use of returned content, protect non-public user content and require approval for commercial API use.

The WCL terms/compliance section in `WARCRAFT-LOGS.md` is therefore mandatory reading before new Archon/RPGLogs data integrations.
