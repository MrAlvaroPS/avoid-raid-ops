import { getIrisCapabilityContract } from './capability-contract-v390.mjs';

export const IRIS_CAPABILITY_CONTRACT_V3910_VERSION='iris-capabilities-v3.9.10';

const extension=Object.freeze([
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
    description:'Freeze Stability fingerprint, candidate patterns, compatible automatically-discovered unseen source set and fixed thresholds before holdout combat evidence. Reservation itself executes zero network calls.',
  }),
  Object.freeze({
    id:'corpus.untouched-holdout.evaluate',status:'available',domain:'corpus',autonomy:'bounded',
    endpoint:'POST /api/wcl/untouched-holdout {action:evaluate,reservationFingerprint,holdoutEvidence}',effect:'persist-holdout-evaluation',
    description:'Evaluate only evidence collected after a frozen reservation from its precommitted sources/patterns. Rejects unreserved sources, new candidate discovery and post-hoc threshold retuning; never automatically promotes.',
  }),
  Object.freeze({
    id:'corpus.untouched-holdout.acquire-combat-evidence',status:'planned',domain:'corpus',autonomy:'unavailable',
    effect:'bounded-wcl-empirical-read',
    description:'Future executor will collect only the narrow WCL combat evidence precommitted by a reservation-ready Holdout. Until implemented, Iris must not substitute manual boss-specific source/candidate logic.',
  }),
]);

export function getIrisCapabilityContractV3910(){
  const base=getIrisCapabilityContract();
  const ids=new Set(base.capabilities.map(row=>row.id));
  return{
    ...base,
    version:IRIS_CAPABILITY_CONTRACT_V3910_VERSION,
    release:'3.9.10',
    purpose:'Machine-readable Iris contract with boss-agnostic Untouched Holdout precommit and automatic metadata-only unseen-source discovery.',
    documentation:[...base.documentation,'docs/IRIS-UNTOUCHED-HOLDOUT-V1.md'],
    invariants:{
      ...base.invariants,
      bossAgnosticGlobalLearning:'GLOBAL BOSS production learning is driven by encounter+difficulty+partition and persisted evidence/provider state; validation-boss constants may not enter the generic learning runtime.',
      untouchedHoldout:'Holdout candidates and sources are frozen before combat evidence. Historical corpus validation is not silently relabeled untouched, unknown lineage is not assumed clean, and HOME/prior-learning sources are excluded.',
      holdoutSourceDiscovery:'Automatic Holdout source discovery may use bounded WCL ranking/report-identity metadata after a fingerprinted preview, but may not inspect candidate combat outcomes or execute event/table queries before reservation.',
    },
    capabilities:[...base.capabilities,...extension.filter(row=>!ids.has(row.id))],
  };
}

export function findIrisCapabilityV3910(id){return getIrisCapabilityContractV3910().capabilities.find(row=>row.id===id)||null;}
