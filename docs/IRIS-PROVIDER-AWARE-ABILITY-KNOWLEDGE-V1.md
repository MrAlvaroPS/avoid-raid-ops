# Iris Provider-aware Ability & Encounter Knowledge v1

**Release:** v3.9.3  
**Model:** `provider-aware-ability-knowledge-v1`

## Purpose

Iris must not try to rediscover static identity or obvious encounter membership exclusively from combat-event correlation. Provider-aware ability knowledge resolves numeric IDs through sources suited to different questions, while keeping Warcraft Logs observed combat as the empirical truth.

## Evidence roles

| Provider | Role | Can prove an event happened? | Can auto-promote a mechanic? |
|---|---|---:|---:|
| WCL ReportData | observed combat truth | yes | no |
| WCL GameData | official static ability identity | no | no |
| WCL WorldData | official encounter identity/scope | no | no |
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
  wcl
  lorrgs
  parseWowhead
  internal
disagreements[]
confidence
interpretation
  canonicalCombatEvidence = false
  promotionEligible = false
  automaticPromotion = false
```

`not-listed-by-lorrgs` is deliberately **not** equivalent to contradicted. A third-party catalogue can be incomplete or lag a patch.

## Network safety

Endpoint: `/api/knowledge/ability`.

`GET` and `POST action=preview` perform no provider network request. They return an exact fingerprint and conservative upper bounds.

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

Default provider selection is Lorrgs only. WCL and Parse are opt-in.

## WCL request efficiency

When WCL static metadata is explicitly requested, up to 20 ability IDs are aliased into one GraphQL request together with optional `WorldData.encounter` and `rateLimitData`. Iris does not spend one WCL call per ability.

## Lorrgs request efficiency

When a `bossSlug` is supplied, Iris first requests the boss spell catalogue once. IDs found there get both metadata and explicit secondary boss-membership support. Only IDs not present in that response fall back to individual `/spells/{id}` lookups.

Boss slugs are discovered from Lorrgs' own boss catalogue and passed into the resolver at runtime; they are never hard-coded into generic learning logic. The first real operational validation confirmed that this lookup can reconcile a Lorrgs boss entry with the same numeric encounter ID used by AvoiD/WCL, which is the intended discovery path for future tiers as well.

## Semantic-probe relationship

This layer complements, rather than replaces, the semantic probe:

```text
WCL observed anchor/context
        +
provider-aware ID/encounter metadata
        ->
provider-aware semantic verification
        ->
background specificity / actor topology
        ->
promotion contract
```

A structurally reproduced neighbor becomes more interesting when Lorrgs independently lists it under the same boss, and less persuasive when provider evidence points to a generic/player identity. The provider layer itself does not establish causality.

## Immutable guardrails

- 0 canonical Deep reports/pulls are added by provider metadata.
- 0 direct score delta.
- no automatic mechanic promotion.
- no external guild player identity is persisted into the home player model.
- provider disagreement is recorded, never silently erased.
- WCL observed event/fight/source/target/timestamp facts remain canonical.
