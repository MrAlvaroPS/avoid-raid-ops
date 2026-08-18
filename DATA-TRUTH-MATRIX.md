# Data Truth Matrix — v3.9.9

| Screen / domain | Surface | Status |
|---|---|---|
| Command Center | Progress / best pull / phases | REAL / DERIVED from WCL |
| Command Center | Current Blocker | DERIVED from WCL + versioned encounter semantics/rules |
| Command Center | Kill Readiness | PENDING |
| LIVE | Latest pull + pull delta | REAL / DERIVED |
| LIVE | Current blocker / classified player evidence | DERIVED from WCL evidence |
| LIVE | Next-pull calls | DERIVED only when evidence exists |
| LIVE | Roster Intelligence | NOT PRESENT by design |
| Progress | Pull curve / raid sessions | REAL / DERIVED |
| Pull Lab | Pull comparisons | REAL / DERIVED |
| Damage & Healing | WCL throughput/graphs | REAL |
| Mechanics | Observed casts/auras/damage/healing/timing | REAL from WCL |
| Mechanics | Blizzard Journal hierarchy / mechanic names / spell membership / descriptions | OFFICIAL PUBLISHED METADATA; not pull occurrence |
| Mechanics | Rule/learned opportunities/failures | DERIVED from WCL + versioned semantics |
| Mechanics | Death links | PROBABLE temporal association unless stronger evidence exists |
| Defensive Audit | Death evidence | REAL + DERIVED chain |
| Defensive Audit | Personal ready / preventable | PENDING unless contract evidence is satisfied |
| Players | Output / deaths / interrupts | REAL |
| Players | Reliability | PENDING / versioned metric contracts only |
| Composition | Roster / roles / ilvl / gear | REAL |
| Composition | Gear links/tooltips | REAL IDs + reference enrichment |
| Composition | Talent names | REAL only when resolvable |
| Composition | Opaque node IDs | HIDDEN |
| Composition | Reliability | PENDING, shared with Players |
| Knowledge | Blizzard Encounter Journal graph | OFFICIAL PUBLISHED METADATA, versioned by namespace + fingerprint |
| Knowledge | WCL ReportData | CANONICAL EMPIRICAL COMBAT TRUTH |
| Knowledge | Blizzard `/spell/{id}` failure | PROVIDER STATE; never negative encounter evidence by itself |
| Knowledge | Lorrgs / Wowhead / Parse | SECONDARY / REFERENCE ENRICHMENT |

## Truth boundary

```text
Blizzard Encounter Journal
  -> what Blizzard officially publishes the encounter/mechanic to be

Warcraft Logs ReportData
  -> what actually happened in a particular raid pull
```

Official Journal hierarchy may establish published encounter membership and semantics. It does not establish occurrence, actor/target, timing, causality, player failure or promotion eligibility in a specific WCL pull.

Release invariant: visible Golden mock-backed metrics = 0.
