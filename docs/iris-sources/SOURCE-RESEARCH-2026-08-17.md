# External Source Research Record — 2026-08-17

This file records what was checked when creating `iris-source-registry-v1`. It prevents future Iris work from confusing “not found during research” with “does not exist forever”.

## Warcraft Logs / RPGLogs

Reviewed official OAuth/API docs, GraphQL schema, Report/GameData/WorldData/Character/Guild/RateLimit surfaces, scripting/Report Components help and RPGLogs API Terms.

Conclusion: official programmable primary source. API terms impose material caching/storage/scraping/privacy/commercial-use constraints that must stay visible in AvoiD architecture.

## Wipefest

Reviewed official Wipefest FAQ hosted in the Archon help centre and live Wipefest site.

Conclusion: FAQ explicitly states no developer API for extracting Wipefest data and recommends the Warcraft Logs API. Treat Wipefest as derived mechanical-analysis reference.

## Archon.gg

Reviewed Archon WoW help pages, API/help index, WCL scripting and Report Components docs, plus the WCL schema's `ArchonViewModels` exposure.

Conclusion: use official WCL API/help/scripting surfaces. No separate documented public Archon meta/build API was identified. `ArchonViewModels` is largely undocumented JSON and is not a supported AvoiD dependency.

## Lorrgs

Reviewed live/open-source FastAPI route definitions in `gitarrg/lorrgs`: app/OpenAPI config, static world data, season, spec rankings, comp rankings, user reports, tasks and auth.

Conclusion: genuine public/open-source API exists and can be useful read-only secondary context. Queue/load/dirty/auth internals are not appropriate for Iris to operate. Direct AvoiD runtime client remains a future integration.

## WoWAnalyzer

Reviewed live site, open-source project README/package and maintained analyzer/event-listener/normalizer developer instructions.

Conclusion: very useful architecture/reference for player/spec analysis. No supported public data API was identified. Project source declares AGPL-3.0-or-later, so study concepts but do not copy code without an explicit licensing decision.

## Mythic Trap

Reviewed live resource pages and current encounter guide structure, including Belo'ren Mythic.

Conclusion: useful semantic/strategy/phase/role reference. No supported public developer API was identified. Do not scrape or treat guide prose as combat evidence.

## Upgrade rule

If a future developer discovers an API or changes a provider's status, they must provide:

1. official/public documentation URL or provider-owned source contract;
2. auth and rate-limit model;
3. terms/data-retention implications;
4. stable endpoint/schema inventory;
5. evidence/trust classification;
6. tests and a version bump to the source registry.

Until then, the registry posture in this review remains canonical for Iris.
