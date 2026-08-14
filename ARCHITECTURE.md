# Architecture

```text
Warcraft Logs
  ↓
server/wcl (auth / client / queries)
  ↓
normalization
  ↓
server/enrichment (optional Wowhead refs/tooltips; never combat truth)
  ↓
server/ingestion
  ↓
server/analysis
  ├─ observed facts
  ├─ derived metrics
  └─ intelligence + confidence/evidence
  ↓
server/storage (repository abstraction)
  ↓
server/services / API contracts
  ↓
apps/web React feature modules
  ↓
Golden-Master-compatible DOM + exact main.css
```

### Rule
No React feature is allowed to parse flexible WCL JSON. No Netlify Function contains domain logic. No boss-specific rule leaks outside `server/rule-packs/`. No intelligence claim omits source/confidence/evidence.

### External data rule
Warcraft Logs remains the combat source of truth. External providers such as Wowhead may enrich entity identity, links, icons/tooltips or curated rule-pack knowledge, but an external lookup must never silently change an observed WCL metric.
