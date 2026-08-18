# Iris Official Encounter Knowledge v1

**Release:** v3.9.9  
**Model:** `official-encounter-knowledge-v1`  
**Graph schema:** `official-encounter-semantic-graph-v1`

## Purpose

Iris should not spend Warcraft Logs combat-event budget rediscovering encounter structure that Blizzard already publishes as official game metadata.

Official Encounter Knowledge v1 resolves the current Blizzard Encounter Journal into a versioned semantic graph:

```text
encounter
  -> journal section / stage
      -> mechanic / mechanic group
          -> submechanic
              -> spell
```

This graph is a semantic prior for raid analysis. It does **not** replace Warcraft Logs as the empirical record of what actually happened in a pull.

## Source roles

```text
Blizzard Encounter Journal
  what the published encounter IS
  official hierarchy, names, role guidance, descriptions and spell membership

Warcraft Logs ReportData
  what actually HAPPENED
  casts, auras, damage, healing, actors, targets, timing and outcomes

WoW client DB2 / future structural provider
  how spell records are structurally wired
  trigger/apply/cancel/target relationships when available

Lorrgs / Wowhead
  secondary corroboration and reference context
```

The layers answer different questions and must remain separate in persisted evidence.

## Network contract

Endpoint:

```text
GET  /api/knowledge/encounter
POST /api/knowledge/encounter
```

`GET` and `POST action=preview` execute zero network calls and return a fingerprint for the exact request.

`POST action=resolve` requires:

```json
{
  "action": "resolve",
  "confirmExecution": true,
  "previewFingerprint": "<exact preview fingerprint>",
  "encounterName": "...",
  "wclEncounterId": 1234
}
```

The resolver uses Blizzard OAuth client credentials server-side. Credentials must never be sent to the browser or persisted in product evidence.

Configuration:

```text
BLIZZARD_CLIENT_ID
BLIZZARD_CLIENT_SECRET
BLIZZARD_REGION=eu
BLIZZARD_LOCALE=en_US
```

The provider caches an access token in process memory and reuses it until near expiry rather than requesting one token per lookup.

## Encounter lookup

When only an encounter name is known, Iris calls the official Journal Encounter search endpoint and requires either an exact name match or a single unambiguous candidate.

The subsequent encounter fetch follows the `key.href` returned by Blizzard. This is important because Blizzard search results can expose a build-specific namespace such as:

```text
static-12.1.0_68914-eu
```

The graph preserves that namespace as source revision/provenance.

## Graph model

The canonical node types are deliberately generic:

```text
encounter
journal-section
spell
```

Every journal section also carries a structural role derived from its position and official fields:

```text
stage
mechanic
a submechanic
mechanic-group
overview-or-root-section
```

The generic engine never hard-codes encounter IDs, spell IDs, boss names or current-boss meaning.

Edges:

```text
contains-section
official-spell-membership
```

A spell node is unique by spell ID, but a spell may have multiple official membership edges and multiple paths. This is required because the same spell can legitimately appear in more than one branch of the Encounter Journal.

## Ability index

For fast reconciliation with WCL signals, the compiled graph exposes an ability index:

```text
abilityId
name
officialEncounterAssociation = true
memberships[]
  sectionId
  title
  structuralRole
  path[]
  sectionPath[]
```

This allows Iris to take an observed WCL ability ID and ask:

> Where does Blizzard place this spell in the official encounter hierarchy?

without buying another combat-event query.

## Semantics and descriptions

Official Journal `body_text` is retained as provider semantic metadata. This can include encounter overview, role guidance and mechanic behavior.

It is valid to use this text to explain what Blizzard publishes about the encounter. It is not valid to treat it as evidence that a described event occurred in a particular raid pull.

## Evidence contract

Hard invariants:

```text
WCL observed combat remains canonical empirical truth.
Blizzard Journal metadata is official published encounter semantics.
Journal hierarchy does not prove event-to-event causality.
Journal spell membership does not prove occurrence in a pull.
Canonical Deep reports contribution = 0.
Canonical Deep pulls contribution   = 0.
Direct Boss Learned score delta     = 0.
Automatic mechanic promotion        = false.
```

Official metadata may resolve identity and encounter membership earlier in the learning pipeline, but promotion still requires the empirical contracts appropriate to the claim being made.

## Error semantics

Blizzard Game Data failures must not be converted into false negative evidence.

For spell-detail lookups:

```text
200 -> resolved
401 -> authentication-failed
403 -> provider-forbidden-or-unavailable
404 -> not-published-by-endpoint
5xx -> provider-unavailable
```

In every failure case above:

```text
negativeEvidence = false
```

A 403/404 from `/data/wow/spell/{id}` never means that an ability is not part of the encounter. Encounter membership is evaluated from the official Journal graph when available.

## Relationship to WCL learning

The updated learning direction is:

```text
Acquisition
  -> Signal discovery
  -> Origin triage
  -> Local mechanic synthesis
  -> Official encounter knowledge resolution
  -> Semantic evidence planning
  -> Surgical semantic probe
  -> Specificity verification
  -> Actor provenance
  -> Exact-pattern provenance
  -> Episode Graph
  -> Matched Null
  -> later promotion gates
```

Official knowledge should reduce unnecessary WCL spend and reduce false semantic neighbors. It does not weaken empirical gates.

## Belo'ren validation fixture

Belo'ren is a validation encounter, not a code special case.

A real Blizzard Journal query for the current build produced a multi-level encounter tree with dozens of spell-bearing sections. It independently places `Void Feather` and `Voidlight Rupture` under different first-stage mechanic branches. That is exactly the kind of official semantic separation that can explain why two abilities may co-occur in WCL while failing a matched-specificity gate.

Boss-specific IDs may appear in documentation/tests as fixtures, but never in generic learning logic.
