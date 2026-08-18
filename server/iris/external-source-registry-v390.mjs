export const IRIS_SOURCE_REGISTRY_VERSION='iris-source-registry-v4';

const endpoint=(method,path,purpose,config={})=>Object.freeze({method,path,purpose,...config});
const source=(id,config)=>Object.freeze({id,...config});

export const IRIS_EXTERNAL_SOURCE_REGISTRY=Object.freeze({
  version:IRIS_SOURCE_REGISTRY_VERSION,
  reviewedAt:'2026-08-18',
  documentationRoot:'docs/iris-sources/README.md',
  policy:Object.freeze({
    primaryCombatTruth:'warcraftlogs',
    officialPublishedGameMetadata:'blizzard-game-data',
    clientStructuralMetadata:'wago-db2',
    doNotInventEndpoints:true,
    undocumentedWebsiteRequests:'forbidden-as-production-contract; targeted human/reference lookup does not create a runtime scraping contract',
    thirdPartyDerived:'must retain provenance and cannot silently override WCL evidence',
    officialMetadataBoundary:'official published metadata may establish identity/Journal membership but does not prove observed occurrence, actor topology, timing or causality in a pull',
    structuralMetadataBoundary:'build-pinned client DB2 relations may explain spell wiring but do not prove observed combat, causality, failure or promotion eligibility',
    sourceUpgrade:'requires reviewed docs/auth/rate-limit/terms/schema/trust tests and registry versioning',
  }),
  sources:Object.freeze([
    source('warcraftlogs',{
      name:'Warcraft Logs',baseUrl:'https://www.warcraftlogs.com',status:'official-api',runtimeIntegration:'available',trust:'canonical-observed-combat',
      auth:'OAuth 2.0; client credentials for public /api/v2/client; authorization-code or PKCE for user/private /api/v2/user',
      docs:Object.freeze(['https://www.warcraftlogs.com/api/docs','https://www.warcraftlogs.com/v2-api-docs/warcraft/','docs/iris-sources/WARCRAFT-LOGS.md']),
      api:Object.freeze({
        publicGraphql:'https://www.warcraftlogs.com/api/v2/client',userGraphql:'https://www.warcraftlogs.com/api/v2/user',oauthAuthorize:'https://www.warcraftlogs.com/oauth/authorize',oauthToken:'https://www.warcraftlogs.com/oauth/token',
        roots:Object.freeze({reportData:'reports, fights, events, tables, graphs, master data, player details and rankings',characterData:'character identity, rankings, guild/report context',guildData:'guild identity, members, attendance and zone rankings',gameData:'patch-oriented abilities/classes/specs/items/NPCs/maps and other static game metadata',worldData:'expansions, zones, encounters, regions, subregions and servers',rateLimitData:'limitPerHour, pointsSpentThisHour, pointsResetIn',progressRaceData:'current progress-race data; upstream updates at 30s cadence',userData:'authorized user data',reportComponentData:'Report Component definitions/evaluation support'}),
      }),
      recommendedFor:Object.freeze(['combat-events','fight-identity','raid-history','player-presence','mechanic-evidence','death-analysis','rankings','guild-attendance','game-ids','world-scope','rate-budget']),
      prohibited:Object.freeze(['website-scraping-to-bypass-api','private-data-exposure-without-opt-in','credentials-in-client-or-repo']),
      notes:'ArchonViewModels exists in the schema but is largely undocumented JSON; prefer documented typed GraphQL roots.',
    }),
    source('blizzard-game-data',{
      name:'Blizzard Game Data',baseUrl:'https://develop.battle.net',apiBaseUrl:'https://{region}.api.blizzard.com',status:'official-api',runtimeIntegration:'available',trust:'official-published-game-metadata',publicApi:true,
      auth:'OAuth 2.0 client credentials via server-side BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET',
      docs:Object.freeze(['https://develop.battle.net/documentation/world-of-warcraft/game-data-apis','docs/iris-sources/BLIZZARD-GAME-DATA.md','docs/IRIS-OFFICIAL-ENCOUNTER-KNOWLEDGE-V1.md']),
      readEndpoints:Object.freeze([
        endpoint('GET','/data/wow/search/journal-encounter','official Encounter Journal discovery',{namespace:'static-{region}'}),
        endpoint('GET','/data/wow/journal-encounter/{journalEncounterId}','official Encounter Journal hierarchy, semantics and spell membership',{namespace:'prefer exact key.href/build namespace returned by Blizzard search'}),
        endpoint('GET','/data/wow/spell/{spellId}','official spell identity/description when the endpoint publishes the record',{coverage:'not assumed complete for encounter spells'}),
      ]),
      recommendedFor:Object.freeze(['official-encounter-identity','official-journal-hierarchy','official-spell-membership','phase-stage-semantics','role-guidance','mechanic-description','build-versioned-metadata']),
      prohibited:Object.freeze(['treating-journal-as-observed-pull-evidence','treating-spell-403-or-404-as-negative-encounter-evidence','client-side-client-secret','client-side-access-token','automatic-mechanic-promotion']),
      notes:'v3.9.9 compiles the official Encounter Journal into a versioned semantic graph. Journal metadata can establish published structure/membership but never substitutes for WCL observed combat. Spell-detail failure remains non-negative evidence.',
    }),
    source('wago-db2',{
      name:'Wago DB2',baseUrl:'https://wago.tools/db2',apiBaseUrl:'https://wago.tools/db2',status:'reviewed-build-pinned-db2-export',runtimeIntegration:'available-bounded',trust:'community-exported-client-structural-metadata',publicApi:false,
      auth:'none for reviewed filtered CSV surface',
      docs:Object.freeze(['https://github.com/RPGLogs/wow-dbc','docs/iris-sources/WAGO-DB2.md','docs/IRIS-SPELL-STRUCTURAL-KNOWLEDGE-V1.md']),
      readEndpoints:Object.freeze([
        endpoint('GET','/SpellEffect/csv','build-pinned SpellEffect lookup by source spell',{query:['build','filter[SpellID]'],bounded:true}),
        endpoint('GET','/SpellEffect/csv','build-pinned reverse SpellEffect lookup by triggered spell',{query:['build','filter[EffectTriggerSpell]'],bounded:true}),
      ]),
      recommendedFor:Object.freeze(['spell-trigger-structure','internal-helper-spell-discovery','official-spell-implementation-context','exact-build-db2-structure']),
      prohibited:Object.freeze(['bulk-db2-mirroring','unbounded-recursive-crawl','whole-table-fallback','raw-csv-persistence','treating-wago-as-official-blizzard-api','treating-db2-relation-as-observed-combat','treating-empty-or-failed-lookup-as-negative-encounter-evidence','satisfying-wcl-provenance-or-promotion-gates']),
      notes:'v3.9.9 uses only bounded filtered SpellEffect CSV lookups. The build is derived from persisted Blizzard namespace; normalized structural relations are versioned, while raw CSV is discarded. Wago relations have no direct score or Promotion effect.',
    }),
    source('wowanalyzer',{
      name:'WoWAnalyzer',baseUrl:'https://wowanalyzer.com',status:'open-source-reference',runtimeIntegration:'reference-only',trust:'derived-analysis-reference',publicApi:false,
      docs:Object.freeze(['https://github.com/WoWAnalyzer/WoWAnalyzer','docs/iris-sources/WOWANALYZER.md']),recommendedFor:Object.freeze(['spec-aware-analyzer-design','event-listener-patterns','conditional-talent-analysis','event-normalization','linked-event-reasoning','coaching-ux']),prohibited:Object.freeze(['undocumented-live-endpoints-as-api','wowanalyzer-score-as-reliability','copying-AGPL-code-without-license-decision']),notes:'Maintained source documents Analyzer, event-listener and normalizer patterns. Project declares AGPL-3.0-or-later. Obtain actual raid evidence from WCL.',
    }),
    source('wipefest',{
      name:'Wipefest',baseUrl:'https://www.wipefest.gg',status:'reference-only-no-public-api',runtimeIntegration:'reference-only',trust:'derived-mechanical-analysis',publicApi:false,
      docs:Object.freeze(['https://www.archon.gg/wow/articles/help/wipefest-frequently-asked-questions','https://www.wipefest.gg/','docs/iris-sources/WIPEFEST.md']),recommendedFor:Object.freeze(['mechanic-analysis-product-reference','timeline-ux','multi-pull-analysis-ideas','data-sufficiency-score-ux']),prohibited:Object.freeze(['scraping','reverse-engineered-site-api','player-score-import','live-polling']),fallback:'warcraftlogs',notes:'Official FAQ explicitly says there is no API for developers to extract Wipefest data and recommends Warcraft Logs API instead.',
    }),
    source('archon',{
      name:'Archon.gg WoW',baseUrl:'https://www.archon.gg/wow',status:'documentation-and-product-reference',runtimeIntegration:'reference-only',trust:'secondary-meta-and-rpglogs-documentation',publicApi:false,
      docs:Object.freeze(['https://www.archon.gg/wow/articles/help/help-and-faq-collection','https://www.archon.gg/wow/articles/help/what-are-report-components','docs/iris-sources/ARCHON.md']),programmableSurfaces:Object.freeze(['Warcraft Logs GraphQL v2','WCL Script Pins JavaScript API','WCL Report Components']),recommendedFor:Object.freeze(['wcl-help','wcl-scripting','report-components','meta-build-product-reference','rankings-product-reference']),prohibited:Object.freeze(['scraping-meta-pages','undocumented-ArchonViewModels-production-dependency']),fallback:'warcraftlogs',notes:'No separate supported public API for Archon meta/build pages was identified in this review. Use supported WCL surfaces for programmatic data.',
    }),
    source('lorrgs',{
      name:'Lorrgs',baseUrl:'https://lorrgs.io',apiBaseUrl:'https://api2.lorrgs.io/api',status:'public-open-source-api-secondary',runtimeIntegration:'available-readonly',trust:'secondary-derived-from-warcraftlogs',publicApi:true,
      docs:Object.freeze(['https://api2.lorrgs.io/api/docs','https://api2.lorrgs.io/api/openapi.json','https://github.com/gitarrg/lorrgs','docs/iris-sources/LORRGS.md']),
      readEndpoints:Object.freeze([
        endpoint('GET','/roles','roles'),endpoint('GET','/classes','classes'),endpoint('GET','/specs','spec list'),endpoint('GET','/specs/{spec_slug}','spec metadata'),endpoint('GET','/specs/{spec_slug}/spells','spec spells/buffs/debuffs/events'),endpoint('GET','/spells/{spell_id}','spell metadata'),endpoint('GET','/spells','all known spells',{bulk:true}),endpoint('GET','/trinkets','trinkets'),endpoint('GET','/zones','raid zones'),endpoint('GET','/zones/{zone_id}','zone metadata'),endpoint('GET','/zones/{zone_id}/bosses','zone bosses'),endpoint('GET','/bosses','boss list'),endpoint('GET','/bosses/{boss_slug}','boss metadata'),endpoint('GET','/bosses/{boss_slug}/spells','boss spell/event metadata'),endpoint('GET','/seasons/{season_slug}','season and raid IDs'),endpoint('GET','/spec_ranking/{spec_slug}/{boss_slug}','spec/boss ranking and top-parse timeline context',{query:['difficulty','metric']}),endpoint('GET','/spec_ranking/{spec_slug}/{boss_slug}/info','lighter ranking metadata',{query:['difficulty','metric']}),endpoint('GET','/comp_ranking/{boss_slug}','composition rankings',{query:['limit','role','spec','killtime_min','killtime_max']}),endpoint('GET','/user_reports/{report_id}','already-cached report overview'),endpoint('GET','/user_reports/{report_id}/fights','already-cached fight/player subsets',{query:['fight','player']}),
      ]),
      forbiddenEndpoints:Object.freeze([endpoint('GET','/spec_ranking/load','queues provider update'),endpoint('PATCH','/spec_ranking/dirty','mutates provider ranking state'),endpoint('GET','/comp_ranking/load/{boss_slug}','queues provider update'),endpoint('GET','/user_reports/{report_id}/load_overview','can acquire/refresh WCL data'),endpoint('GET','/user_reports/{report_id}/load','queues SQS processing'),endpoint('*','/auth/*','provider account/auth internals')]),
      recommendedFor:Object.freeze(['boss-spec-spell-discovery','boss-membership-enrichment','top-parse-cooldown-timeline-research','composition-samples','report-candidate-discovery']),prohibited:Object.freeze(['queueing-provider-jobs','dirty-state-mutation','treating-top-parse-timings-as-universal-strategy','treating-secondary-data-as-WCL-truth']),notes:'v3.9.3 includes a bounded server-side read-only client for boss/spell enrichment. Mutation/queue endpoints remain prohibited.',
    }),
    source('parse-wowhead',{
      name:'Parse Wowhead API',baseUrl:'https://parse.bot/marketplace/dcf24c30-539c-47c6-ad80-e754dfb7e99e/wowhead-com-api',apiBaseUrl:'https://api.parse.bot/scraper/93b56483-7fc6-48da-bd9f-1310e3bca1c3',status:'third-party-managed-wrapper',runtimeIntegration:'available-optional',trust:'reference-identity-enrichment',publicApi:true,
      auth:'X-API-Key via server-side PARSE_API_KEY',docs:Object.freeze(['https://parse.bot/marketplace/dcf24c30-539c-47c6-ad80-e754dfb7e99e/wowhead-com-api','docs/iris-sources/PARSE-WOWHEAD.md']),
      readEndpoints:Object.freeze([endpoint('GET','/search','full-text Wowhead database search',{credits:1}),endpoint('GET','/get_item','item detail lookup',{credits:1}),endpoint('GET','/get_npc','NPC identity/reference lookup'),endpoint('GET','/get_spell','spell identity/reference lookup',{credits:1}),endpoint('GET','/get_quest','quest identity/reference lookup'),endpoint('GET','/get_database_list','paginated database browsing',{credits:1}),endpoint('GET','/get_news','news feed',{credits:1}),endpoint('GET','/get_news_article','news article',{credits:1}),endpoint('GET','/get_today_in_wow','regional current events',{credits:1})]),
      recommendedFor:Object.freeze(['spell-id-to-name','npc-id-to-name','canonical-wowhead-reference','cross-provider-name-check','candidate-id-search']),
      prohibited:Object.freeze(['treating-wrapper-as-official-wowhead-api','treating-wowhead-wrapper-as-combat-truth','client-side-api-key','unpreviewed-credit-spend','automatic-mechanic-promotion']),
      notes:'Independent Parse-maintained wrapper, not an official Wowhead API. Current get_spell is basic identity metadata; it does not prove boss membership or mechanic causality.',
    }),
    source('mythictrap',{
      name:'Mythic Trap',baseUrl:'https://www.mythictrap.com/en',status:'human-reference-no-public-api-identified',runtimeIntegration:'reference-only',trust:'strategy-and-encounter-semantics-reference',publicApi:false,
      docs:Object.freeze(['https://www.mythictrap.com/en','https://www.mythictrap.com/en/resources/websites','docs/iris-sources/MYTHIC-TRAP.md']),recommendedFor:Object.freeze(['fight-overview','phase-semantics','difficulty-changes','role-specific-instructions','mechanic-naming','strategy-reference']),prohibited:Object.freeze(['scraping-into-canonical-db','embed-routes-as-api','guide-text-as-pull-evidence','silent-rule-overwrite']),fallback:'warcraftlogs',notes:'Use guide semantics to generate hypotheses, then resolve exact IDs/evidence via WCL/official metadata and version an AvoiD rule.',
    }),
  ]),
});

export function getIrisSourceRegistry(){return IRIS_EXTERNAL_SOURCE_REGISTRY;}
export function findIrisSource(id){return IRIS_EXTERNAL_SOURCE_REGISTRY.sources.find(item=>item.id===id)||null;}
