export const IRIS_CAPABILITY_CONTRACT_VERSION='iris-capabilities-v1';

const capability=(id,config)=>Object.freeze({id,...config});

export const IRIS_CAPABILITY_CONTRACT=Object.freeze({
  version:IRIS_CAPABILITY_CONTRACT_VERSION,
  release:'3.9.0',
  product:'AvoiD Raid Operations',
  intelligence:'Iris',
  purpose:'Machine-readable contract describing what Iris may inspect, control or manage in the v3.9 data platform.',
  documentation:Object.freeze([
    'IRIS-ARCHITECTURE.md',
    'IRIS-OPERATIONS.md',
    'V3.9-REFACTOR-PLAN.md',
    'DATA-TRUTH-MATRIX.md',
    'WCL-QUERY-PLAYBOOK.md',
    'docs/iris-sources/README.md',
  ]),
  invariants:Object.freeze({
    combatTruth:'Warcraft Logs observed evidence remains canonical combat truth.',
    rawEvidence:'immutable',
    derivedKnowledge:'versioned-and-rederivable',
    currentRaidScope:'configured current WCL raid zone; selecting a report cannot redefine it',
    externalNoise:'Mythic+ and unrelated/old raid zones are ineligible for the current-raid catalogue',
    corpusScope:'encounter+difficulty+partition',
    playerKnowledge:'home-raid-only',
    budget:'Prefer stored/compact evidence and bounded requests before new expensive WCL acquisition.',
    wowhead:'reference/enrichment only; never silently canonical combat truth',
    externalSources:'Use iris-source-registry-v1; documented official APIs first, no invented/undocumented production endpoints, and retain provenance for third-party derived data.',
  }),
  autonomy:Object.freeze({
    automatic:'Iris may perform this read/housekeeping operation when needed and budget-safe.',
    bounded:'Iris may perform it when it serves the active raid workflow and respects configured request/storage budgets.',
    operatorRequested:'Iris may execute it when Onie explicitly asks or confirms the action.',
    explicitApproval:'Iris must present the consequence and obtain explicit operator approval before execution.',
    unavailable:'Contract exists, but the durable implementation is not complete yet.',
  }),
  capabilities:Object.freeze([
    capability('activity.inspect',{status:'available',domain:'operations',autonomy:'automatic',surface:'window.__AVOID_ACTIVITY__',effect:'read-only',description:'Inspect the compact recent activity/error ring to explain what the application is doing or why a service failed.'}),
    capability('sources.inspect',{status:'available',domain:'research',autonomy:'automatic',endpoint:'GET /api/iris/sources',effect:'read-only',description:'Inspect the reviewed external-source directory: API posture, trust class, documentation, safe endpoints, prohibited surfaces and runtime-integration status for Warcraft Logs, WoWAnalyzer, Wipefest, Archon, Lorrgs and Mythic Trap.'}),
    capability('data.use-stored',{status:'available',domain:'data',autonomy:'operatorRequested',bridge:'data.setMode',effect:'reload-context',description:'Switch report/history/intelligence/corpus reads to browser-stored snapshots without contacting those data services.'}),
    capability('data.use-connected',{status:'available',domain:'data',autonomy:'operatorRequested',bridge:'data.setMode',effect:'reload-context',description:'Return to connected data mode so current services may be queried and successful GET snapshots refreshed.'}),
    capability('logs.catalog.inspect',{status:'available',domain:'logs',autonomy:'automatic',endpoint:'GET /api/wcl/reports',bridge:'logs.catalog',effect:'read-only',description:'Inspect the bounded catalogue of AvoiD reports for the configured current raid zone.'}),
    capability('logs.sync-latest',{status:'available',domain:'logs',autonomy:'bounded',endpoint:'GET /api/wcl/reports?days=21&force=1',bridge:'logs.syncLatest',effect:'network-read',description:'Refresh recent current-raid reports while excluding Mythic+ and unrelated raid zones structurally.'}),
    capability('logs.load-history',{status:'available',domain:'logs',autonomy:'bounded',endpoint:'GET /api/wcl/reports?days=180&force=1',bridge:'logs.loadHistory',effect:'network-read',description:'Load a wider current-raid report catalogue for longitudinal context without making the selected report the historical boundary.'}),
    capability('logs.select-report',{status:'available',domain:'logs',autonomy:'operatorRequested',bridge:'logs.selectReport',effect:'navigate-report-context',description:'Switch report-scoped screens to a chosen valid report while encounter History remains longitudinal.'}),
    capability('live.start',{status:'available',domain:'live',autonomy:'operatorRequested',bridge:'live.start',effect:'poll-30s',description:'Start compact selected-report status polling. Heavy refresh occurs only after a closed-pull fingerprint change.'}),
    capability('live.pause',{status:'available',domain:'live',autonomy:'operatorRequested',bridge:'live.pause',effect:'pause-polling',description:'Pause live polling without discarding the selected report context.'}),
    capability('live.stop',{status:'available',domain:'live',autonomy:'operatorRequested',bridge:'live.stop',effect:'stop-polling',description:'Stop live polling and reset its local change fingerprint.'}),
    capability('knowledge.inspect',{status:'available',domain:'knowledge',autonomy:'automatic',endpoint:'GET /api/knowledge',bridge:'knowledge.status',effect:'read-only',description:'Inspect active/candidate game-knowledge revisions, persistence and reindex state.'}),
    capability('knowledge.stage-refresh',{status:'foundation',domain:'knowledge',autonomy:'bounded',endpoint:'POST /api/knowledge {action:refresh}',bridge:'knowledge.stage',effect:'stage-candidate',description:'Stage a versioned knowledge candidate. Current provider population is partial; Iris must not describe it as a complete retail database until provider ingestion is complete.'}),
    capability('knowledge.activate',{status:'available',domain:'knowledge',autonomy:'explicitApproval',endpoint:'POST /api/knowledge {action:activate}',bridge:'knowledge.activate',effect:'invalidate-derived',description:'Activate the staged revision for Iris. Raw WCL evidence stays immutable; derived interpretations become stale and must be re-derived.'}),
    capability('knowledge.reindex-browser',{status:'available',domain:'knowledge',autonomy:'automatic',surface:'knowledge-reindex-v390',effect:'invalidate-browser-derived-cache',description:'After activation, invalidate derived browser snapshots and refresh the current screen against the active revision.'}),
    capability('knowledge.reindex-durable',{status:'planned',domain:'knowledge',autonomy:'unavailable',effect:'durable-rederive',description:'Future durable worker will rederive all persisted report/history/intelligence snapshots against the active knowledge revision.'}),
    capability('knowledge.provider-wowhead',{status:'reference-only',domain:'knowledge',autonomy:'automatic',effect:'enrichment',description:'Use exact Wowhead references/tooltips around already-known IDs. Do not treat scraped/opaque Wowhead content as canonical combat evidence.'}),
    capability('knowledge.provider-blizzard',{status:'planned',domain:'knowledge',autonomy:'unavailable',effect:'authoritative-versioned-metadata',description:'Future Blizzard Game Data provider for supported patch/build/season and game metadata.'}),
    capability('corpus.inspect-stored',{status:'available',domain:'corpus',autonomy:'automatic',endpoint:'GET /api/wcl/corpus',effect:'read-only',description:'Inspect stored Encounter Corpus state when available, including browser-stored fallback.'}),
    capability('corpus.mutate',{status:'resource-gated',domain:'corpus',autonomy:'explicitApproval',endpoint:'POST /api/wcl/corpus',effect:'research-write',description:'Build/enrich/recompile corpus only under existing evidence, storage and WCL-budget contracts. Full raw replay/rebuild remains an explicit maintenance action.'}),
  ]),
});

export function getIrisCapabilityContract(){return IRIS_CAPABILITY_CONTRACT;}
export function findIrisCapability(id){return IRIS_CAPABILITY_CONTRACT.capabilities.find(item=>item.id===id)||null;}
