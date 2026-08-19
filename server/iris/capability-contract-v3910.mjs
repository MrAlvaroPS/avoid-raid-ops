import { getIrisCapabilityContract } from './capability-contract-v390.mjs';

export const IRIS_CAPABILITY_CONTRACT_V3910_VERSION='iris-capabilities-v3.9.10';

const extension=Object.freeze([
  Object.freeze({
    id:'knowledge.raid-catalog.current',status:'available',domain:'knowledge',autonomy:'automatic',
    endpoint:'GET /api/knowledge/raid-catalog',effect:'metadata-read+persist',
    description:'Discover the current official raid without any combat report. Blizzard JournalExpansion classifies raids and JournalInstance supplies boss identity; WCL WorldData supplies operational zone/encounter IDs, partitions and supported difficulty metadata when published. No combat event query is allowed.',
  }),
  Object.freeze({
    id:'knowledge.raid.official-boss-difficulty-bootstrap',status:'available',domain:'knowledge',autonomy:'automatic',
    endpoint:'GET /api/knowledge/raid-catalog?official=1',effect:'official+structural-read+persist',
    description:'Bootstrap every current-raid boss and each explicit difficulty from Blizzard Journal plus build-pinned DB2 Journal difficulty metadata. WCL difficulty IDs are mapped to encounter-scoped DB2 Difficulty IDs by name before filtering Journal sections. Missing applicability remains unresolved instead of borrowing another difficulty.',
  }),
  Object.freeze({
    id:'knowledge.mechanics.boss-difficulty-read',status:'available',domain:'knowledge',autonomy:'automatic',
    endpoint:'GET /api/wcl/mechanic-knowledge?journal=<id>&difficulty=<id>',effect:'read-only-persisted-view',
    description:'Render one boss+difficulty knowledge scope from persisted official, structural and same-difficulty empirical products. A report is optional; Normal, Heroic and Mythic evidence are never substituted for one another. Executes zero network calls.',
  }),
  Object.freeze({
    id:'corpus.untouched-holdout.source-discovery-preview',status:'available',domain:'corpus',autonomy:'automatic',
    endpoint:'POST /api/wcl/untouched-holdout {action:discover-sources-preview}',effect:'read-only-plan',
    description:'Derive the frozen Stability candidate set and GLOBAL BOSS source lineage, then preview bounded unseen-source discovery. Executes zero WCL/provider calls and collapses to zero budget when no Stability-supported candidate exists or lineage is incomplete.',
  }),
  Object.freeze({
    id:'corpus.untouched-holdout.source-discovery',status:'available',domain:'corpus',autonomy:'bounded',
    endpoint:'POST /api/wcl/untouched-holdout {action:discover-sources,confirmExecution:true,previewFingerprint}',effect:'metadata-network-read',
    description:'Discover independent unseen holdout sources generically from WCL ranking seed report codes plus lightweight report identity only. Ranking metrics are discarded, HOME/prior-learning lineage is excluded automatically, and combat event/table queries are forbidden.',
  }),
  Object.freeze({
    id:'corpus.untouched-holdout.reserve',status:'available',domain:'corpus',autonomy:'bounded',
    endpoint:'POST /api/wcl/untouched-holdout {action:reserve}',effect:'persist-holdout-precommit',
    description:'Freeze Stability fingerprint, candidate patterns, compatible automatically-discovered unseen source set, source seed-report metadata and fixed thresholds before holdout combat evidence. Reservation itself executes zero network calls.',
  }),
  Object.freeze({
    id:'corpus.untouched-holdout.acquire-combat-evidence-preview',status:'available',domain:'corpus',autonomy:'automatic',
    endpoint:'POST /api/wcl/untouched-holdout {action:acquire-evidence-preview,reservationFingerprint}',effect:'read-only-plan',
    description:'Preview the bounded WCL evidence plan for an already frozen Holdout. Executes zero network calls, reports exact hard call bounds, and cannot broaden candidates, sources or seed reports.',
  }),
  Object.freeze({
    id:'corpus.untouched-holdout.acquire-combat-evidence',status:'available',domain:'corpus',autonomy:'bounded',
    endpoint:'POST /api/wcl/untouched-holdout {action:acquire-evidence,reservationFingerprint,confirmExecution:true,previewFingerprint}',effect:'bounded-wcl-empirical-read',
    description:'Acquire only the narrow paired same-fight WCL evidence precommitted by a reservation-ready Holdout, starting from each frozen metadata seed report. Source expansion, new candidates/sources, outcome-based fight selection, raw actor persistence and automatic Promotion are forbidden.',
  }),
  Object.freeze({
    id:'corpus.untouched-holdout.evaluate',status:'available',domain:'corpus',autonomy:'bounded',
    endpoint:'POST /api/wcl/untouched-holdout {action:evaluate,reservationFingerprint}',effect:'persist-holdout-evaluation',
    description:'Evaluate the compatible persisted automatic Holdout acquisition only. Rejects unreserved sources, new candidate discovery and post-hoc threshold retuning; never accepts caller-fabricated holdout evidence and never automatically promotes.',
  }),
]);

export function getIrisCapabilityContractV3910(){
  const base=getIrisCapabilityContract();
  const ids=new Set(base.capabilities.map(row=>row.id));
  return{
    ...base,
    version:IRIS_CAPABILITY_CONTRACT_V3910_VERSION,
    release:'3.9.10',
    purpose:'Machine-readable Iris contract with raid-first boss+difficulty knowledge plus boss-agnostic Untouched Holdout precommit, automatic unseen-source discovery, bounded combat acquisition and evaluation.',
    documentation:[...base.documentation,'docs/IRIS-RAID-BOSS-DIFFICULTY-KNOWLEDGE-V1.md','docs/IRIS-UNTOUCHED-HOLDOUT-V1.md'],
    invariants:{
      ...base.invariants,
      raidBossDifficultyScope:'Mechanics knowledge is raid → boss → difficulty. Official boss knowledge may exist with zero reports; GLOBAL WCL and AvoiD execution are optional overlays from the exact same difficulty only.',
      difficultyIsolation:'GLOBAL BOSS empirical products remain encounter+difficulty+partition scoped. Normal/Heroic may generate a hypothesis to investigate later in Mythic but never count as Mythic observation, validation, stability, Holdout or Promotion evidence.',
      difficultyIdentityMapping:'WCL difficulty IDs and WoW client DB2 Difficulty IDs are distinct namespaces. DB2 applicability must map the requested WCL difficulty by name within JournalEncounterXDifficulty before applying JournalSectionXDifficulty.',
      bossAgnosticGlobalLearning:'GLOBAL BOSS production learning is driven by encounter+difficulty+partition and persisted evidence/provider state; validation-boss constants may not enter the generic learning runtime.',
      untouchedHoldout:'Holdout candidates, sources, source seed-report metadata and thresholds are frozen before combat evidence. Historical corpus validation is not silently relabeled untouched, unknown lineage is not assumed clean, and HOME/prior-learning sources are excluded.',
      holdoutSourceDiscovery:'Automatic Holdout source discovery may use bounded WCL ranking/report-identity metadata after a fingerprinted preview, but may not inspect candidate combat outcomes or execute event/table queries before reservation.',
      holdoutCombatAcquisition:'Automatic Holdout combat acquisition requires a frozen reservation plus a matching zero-network preview, queries only exact encounter fight IDs from each frozen seed report, pairs anchor windows with same-fight null controls, and cannot expand sources/candidates/reports or auto-promote.',
    },
    capabilities:[...base.capabilities,...extension.filter(row=>!ids.has(row.id))],
  };
}

export function findIrisCapabilityV3910(id){return getIrisCapabilityContractV3910().capabilities.find(row=>row.id===id)||null;}
