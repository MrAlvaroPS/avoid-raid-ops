import { getIrisCapabilityContractV3911 } from './capability-contract-v3911.mjs';

export const IRIS_CAPABILITY_CONTRACT_V3912_VERSION='iris-capabilities-v3.9.12';
const extension=Object.freeze([
  Object.freeze({id:'corpus.operational-reference',status:'available',domain:'corpus',autonomy:'bounded',endpoint:'npm run prepare:boss -- --encounter <id> --difficulty <name> --execute',effect:'bounded-public-wcl-acquisition+canonical-recompile',description:'Prepare the minimum same-difficulty public reference needed for operational AvoiD classification. The floor is source-isolated and HOME-excluded, but remains explicitly unpublished/non-promotable until the full scientific knowledge gates pass.'}),
  Object.freeze({id:'boss.prepare.operational',status:'available',domain:'knowledge',autonomy:'bounded',endpoint:'prepare:boss',effect:'idempotent-readiness-plan+checkpointed-acquisition',description:'Resolve a boss+difficulty from the persisted raid catalog and learning availability, acquire only the missing bounded operational corpus, canonicalize source isolation, and report LIVE readiness. The flow is boss-agnostic and can be rerun after build/season changes.'}),
  Object.freeze({id:'execution.operational',status:'available',domain:'home-execution',autonomy:'bounded',endpoint:'GET /api/wcl/operational-execution?report=<code>&encounter=<id>&difficulty=<id>',effect:'explicit-wcl-observation+mechanic-classification',description:'For a completed Active Report scope, combine observed WCL telemetry/events with the exact safe operational/published boss reference, classify mechanics, build blocker/next-pull calls, and persist only HOME execution. External reports never enter HOME execution history.'}),
  Object.freeze({id:'home.raid-execution.read',status:'available',domain:'home-execution',autonomy:'automatic',endpoint:'GET /api/wcl/raid-execution?encounter=<id>&difficulty=<id>',effect:'persisted-private-read',description:'Read the longitudinal AvoiD mechanical state for an exact boss+difficulty from persisted execution snapshots at zero WCL. Every persisted pull contributes; the recent window determines current trend and no single pull replaces the historical aggregate.'}),
  Object.freeze({id:'execution.live.operational-ui',status:'available',domain:'product',autonomy:'client-only',endpoint:'Live + Pull Lab + Raid Execution',effect:'evidence-grounded-render',description:'Render real Active Report telemetry/mechanics in Live and Pull Lab and the longitudinal HOME mechanic state in Raid Execution. Empty/in-progress live pulls remain healthy waiting states and mock fallback is forbidden.'}),
]);

export function getIrisCapabilityContractV3912(){
  const base=getIrisCapabilityContractV3911(),ids=new Set(base.capabilities.map(row=>row.id));
  return{
    ...base,version:IRIS_CAPABILITY_CONTRACT_V3912_VERSION,release:'3.9.12',
    purpose:'Machine-readable Iris contract with boss-agnostic operational readiness, real Live/Pull Lab execution and longitudinal HOME mechanic state.',
    documentation:[...base.documentation,'docs/IRIS-OPERATIONAL-BOSS-READINESS-V1.md'],
    invariants:{
      ...base.invariants,
      operationalReference:'Operational Reference is a same-difficulty, canonical-source-isolated minimum public corpus for classification during progression. It may be consumed operationally but is not accepted/promoted GLOBAL knowledge unless normal publication/promotion gates independently pass.',
      longitudinalRaidExecution:'Raid Execution is an exact boss+difficulty HOME aggregate over all persisted observed pulls. Its mechanic score is aggregate clean mechanic occurrences divided by observed mechanic opportunities; recent-vs-previous pull windows describe current trend. A single pull can never replace the aggregate.',
      mechanicalVsKillable:'A mechanics PASS means observed mechanics are currently stable under the available denominator. It does not alone claim the boss is killable: throughput, healing, phase coverage and unobserved mechanics remain separate evidence dimensions.',
      liveOperationalSafety:'An empty or in-progress live pull produces no negative mechanic evidence. Rich mechanic classification waits for completed-pull evidence and never guesses when the exact boss+difficulty Operational Reference is missing.',
      bossPreparationPortability:'Boss preparation is driven by current raid catalog + exact difficulty availability + persisted corpus state. Production preparation contains no current-boss constants and is safely resumable/checkpointed.',
    },
    capabilities:[...base.capabilities,...extension.filter(row=>!ids.has(row.id))],
  };
}
export function findIrisCapabilityV3912(id){return getIrisCapabilityContractV3912().capabilities.find(row=>row.id===id)||null;}
