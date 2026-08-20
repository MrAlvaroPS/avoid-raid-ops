# Iris Official Encounter Smoke Validation v1

Use this after changing Blizzard Game Data, official encounter persistence, WCL aliasing, Ability Knowledge reconciliation, or provider/build refresh behavior.

## Command

From the repository root with `.env.local` configured:

```powershell
npm run validate:official-encounter -- --name "Belo'ren, Child of Al'ar" --wcl 3182 --abilities 1241163,1243866,1243560
```

The command is generic. Belo'ren is only the current real validation fixture.

Alternative when the Blizzard Journal encounter ID is already known:

```powershell
npm run validate:official-encounter -- --journal 2739 --wcl 3182 --abilities 1241163,1243866,1243560
```

Direct Journal-ID resolution may request the moving `static-<region>` namespace, but the provider must retain Blizzard's canonical build-specific namespace from the Journal `_links.self.href` when Blizzard publishes it. This keeps persisted graph provenance build-aware without requiring an extra provider request.

## What it validates

The script performs five sequential checks:

1. Build a deterministic zero-network preview for the exact official encounter request.
2. Resolve the Blizzard Encounter Journal and persist the compiled fingerprinted graph.
3. Reload the persisted graph through the deterministic `WCL encounterId -> Blizzard Journal` alias with zero Blizzard calls and zero WCL calls.
4. Resolve the supplied ability IDs through Ability Knowledge with Lorrgs, Parse Wowhead and WCL providers disabled; official membership must come only from the stored Blizzard graph.
5. Compare every supplied ability pair using the official hierarchy reconciler.

The smoke command never requests WCL combat events.

The graph summary deliberately reports both `uniqueSpellCount` and `spellMembershipCount`. A spell ID may occur under more than one Journal section, so these counts are not required to be equal. Do not confuse spell-bearing Journal memberships with unique spell IDs.

## Belo'ren expected semantic checks

For the current validation build, the important expected results are:

```text
1241163 Void Feather
  official member
  Stage One > Voidlight Convergence > Void Feather

1243866 Voidlight Rupture
  official member
  Stage One > Radiant Echoes > Voidlight Rupture

1243560
  not-listed-in-journal
  negativeEvidence = false
```

The pair `1241163 <-> 1243866` should reconcile as the same official stage but different official mechanic branches when the current Blizzard graph retains that hierarchy.

This official relationship is semantic metadata only. It does not prove that one event caused another, that either event occurred in a selected pull, or that either candidate clears Iris empirical promotion gates.

## Success criteria

A successful run should show:

```text
resolved graph fingerprint == stored graph fingerprint
build-specific namespace retained when Blizzard exposes one
providerCalls during stored reload = 0
WCL calls during stored reload = 0
Ability Knowledge officialJournalCacheHit = true
Lorrgs calls = 0
WCL calls = 0
official member IDs have membership paths
non-member IDs retain negativeEvidence=false
```

If the Blizzard namespace/build or graph fingerprint changes, the new official revision must be persisted rather than rewriting old evidence. Historical WCL evidence remains immutable.
