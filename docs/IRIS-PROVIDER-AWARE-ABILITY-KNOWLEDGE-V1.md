# Iris Provider-aware Ability & Encounter Knowledge v1

**Introduced:** v3.9.3  
**Updated integration:** v3.9.9  
**Model:** `provider-aware-ability-knowledge-v1`

## Purpose

Iris must not try to rediscover static identity or obvious encounter membership exclusively from combat-event correlation. Provider-aware ability knowledge resolves numeric IDs through sources suited to different questions, while keeping Warcraft Logs observed combat as the empirical truth.

v3.9.9 adds a higher-trust, zero-network enrichment path: when a persisted official Blizzard Encounter Journal graph exists for the supplied WCL `encounterId`, Ability Knowledge reads it first and reconciles every requested ability against its official membership paths.

## Evidence roles

| Provider | Role | Can prove an event happened? | Can auto-promote a mechanic? |
|---|---|---:|---:|
| WCL ReportData | canonical observed combat truth | yes | no |
| Blizzard Encounter Journal | official published hierarchy, spell membership and descriptions | no | no |
| Blizzard spell detail | official static identity/description when published | no | no |
| WCL GameData | official WCL static ability identity | no | no |
| WCL WorldData | official WCL encounter identity/scope | no | no |
| AvoiD rule packs | versioned internal semantics | no new event fact | no |
| Lorrgs boss/spell API | secondary boss membership + spell discovery | no | no |
| Parse Wowhead wrapper | identity/reference/search fallback | no | no |

## Normalized ability object

The resolver returns one object per requested ability ID:

```text
abilityId
identity
  name
  icon
  wowheadUrl
semanticClass
encounterAssociation
  status = supported | not-listed-by-lorrgs | unknown
  support[]
providerSignals
  blizzardJournal
    status = resolved | not-listed-in-journal | not-cached-or-unavailable
    journalEncounterId
    namespace
    graphFingerprint
    memberships[]
    negativeEvidence = false
  wcl
  lorrgs
  parseWowhead
  internal
disagreements[]
confidence
interpretation
  canonicalCombatEvidence = false
  officialEncounterMembership = true | false
  promotionEligible = false
  automaticPromotion = false
```

When Blizzard Journal membership is present, `semanticClass` may be `official-encounter-ability`. That means Blizzard publishes the ID under the encounter hierarchy for that build; it does **not** mean WCL observed the ability in a particular pull.

`not-listed-in-journal` is deliberately non-negative because the Journal is a published encounter guide/structure, not a complete dump of every internal combat spell implementation.

`not-listed-by-lorrgs` remains deliberately **not** equivalent to contradicted. A third-party catalogue can be incomplete or lag a patch.

## Zero-network official reconciliation

With an `encounterId`, resolve attempts:

```text
knowledge/official-encounters/blizzard/by-wcl/{encounterId}.json
        -> latest persisted official graph
        -> abilityId membership lookup
```

This adds:

```text
0 Blizzard network calls
0 WCL calls
0 Parse credits
```

The official graph itself is refreshed separately through `/api/knowledge/encounter`, which has its own preview/fingerprint/confirmation contract.

## Network safety

Endpoint: `/api/knowledge/ability`.

`GET` and `POST action=preview` perform no provider network request. They return an exact fingerprint and conservative upper bounds. Preview additionally reports that stored official-Journal reconciliation will be attempted at resolve when `encounterId` is present.

`POST action=resolve` requires:

```json
{
  "confirmExecution": true,
  "previewFingerprint": "<exact preview fingerprint>"
}
```

Additional gates:

- WCL selected -> `confirmWcl:true` because it consumes WCL API budget.
- Parse Wowhead selected -> `confirmParseCredits:true` because it consumes Parse credits.
- Lorrgs integration uses documented read-only endpoints only.
- Stored Blizzard Journal lookup requires no network confirmation because it reads already-persisted provider-derived knowledge.

The legacy external provider selection remains Lorrgs by default; WCL and Parse remain opt-in. Blizzard Journal membership is not another per-call network provider in this endpoint: it is consumed from the official persisted graph.

## WCL request efficiency

When WCL static metadata is explicitly requested, up to 20 ability IDs are aliased into one GraphQL request together with optional `WorldData.encounter` and `rateLimitData`. Iris does not spend one WCL call per ability.

## Lorrgs request efficiency

When a `bossSlug` is supplied, Iris first requests the boss spell catalogue once. IDs found there get both metadata and explicit secondary boss-membership support. Only IDs not present in that response fall back to individual `/spells/{id}` lookups.

## Semantic-probe relationship

This layer complements, rather than replaces, empirical semantic verification:

```text
WCL observed anchor/context
        +
stored Blizzard official hierarchy/membership
        +
secondary provider metadata when useful
        ->
provider-aware semantic interpretation
        ->
background specificity / actor topology / matched null
        ->
later promotion contract
```

The official Journal can immediately show that two WCL IDs belong to the same or different published mechanic branches. That is highly useful for semantic planning, but it still does not establish that one event caused another in combat.

A structurally reproduced neighbor becomes more interesting when official/secondary provider evidence gives it encounter meaning, and less persuasive when provider evidence points elsewhere. Provider layers themselves do not establish empirical causality.

## Immutable guardrails

- WCL observed event/fight/source/target/timestamp facts remain canonical empirical truth.
- Blizzard Journal is authoritative for the published hierarchy/membership it exposes for its build, not for pull occurrence.
- 0 canonical Deep reports/pulls are added by provider metadata.
- 0 direct score delta.
- no automatic mechanic promotion.
- no external guild player identity is persisted into the home player model.
- provider disagreement is recorded, never silently erased.
- Blizzard `/spell` 401/403/404 failure is never silently converted into negative encounter evidence.
