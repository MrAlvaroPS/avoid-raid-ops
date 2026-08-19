import { getIrisCapabilityContractV3910 } from './capability-contract-v3910.mjs';

export const IRIS_CAPABILITY_CONTRACT_V3911_VERSION='iris-capabilities-v3.9.11';
const extension=Object.freeze([
  Object.freeze({id:'home.history.read',status:'available',domain:'home-execution',autonomy:'automatic',endpoint:'GET /api/wcl/home-history[?encounter=<id>&difficulty=<id>]',effect:'persisted-private-read',description:'Read AvoiD HOME report/fight history and derived boss+difficulty progression from persistent storage only. The read module has no WCL client import and executes zero WCL calls.'}),
  Object.freeze({id:'home.history.refresh',status:'available',domain:'home-execution',autonomy:'bounded',endpoint:'POST /api/wcl/home-history {action:refresh,confirmExecution:true}',effect:'bounded-wcl-metadata-read+persist',description:'Explicitly synchronize current-raid HOME report/fight manifests. Only new/recent/changed reports are reopened, difficulty is stored per fight, and no combat-event query is used.'}),
  Object.freeze({id:'execution.active-report.manifest',status:'available',domain:'home-execution',autonomy:'bounded',endpoint:'GET /api/wcl/active-report-manifest?report=<url-or-code>&live=<bool>',effect:'wcl-metadata-read',description:'Classify an explicitly supplied WCL report before heavy analysis. Each fight resolves its own encounter+difficulty. A live report with zero fights is WAITING FOR FIRST COMBAT, never failed execution.'}),
  Object.freeze({id:'execution.active-report.rich-data',status:'available',domain:'home-execution',autonomy:'bounded',endpoint:'GET /api/wcl/report + GET /api/wcl/telemetry after manifest scope resolution',effect:'explicit-report-analysis',description:'Hydrate only the exact Active Report boss+difficulty. Static loads hydrate once. Live polling uses the lightweight manifest and rehydrates report/telemetry only when the execution scope or completed-pull set materially changes. It never fetches HOME history.'}),
  Object.freeze({id:'execution.pull-selection',status:'available',domain:'home-execution',autonomy:'client-only',endpoint:'browser execution context',effect:'consumer-opt-in-selection',description:'Default is all pulls (no override). A single selected HOME pull is published separately and only pull-aware consumers may react; GLOBAL Iris and historical aggregate views are not globally filtered.'}),
]);

export function getIrisCapabilityContractV3911(){
  const base=getIrisCapabilityContractV3910(),ids=new Set(base.capabilities.map(row=>row.id));
  return{
    ...base,version:IRIS_CAPABILITY_CONTRACT_V3911_VERSION,release:'3.9.11',
    purpose:'Machine-readable Iris contract with GLOBAL/HOME/Active-Report evidence isolation and offline-first HOME history.',
    documentation:[...base.documentation,'docs/AVOID-EXECUTION-CONTEXT-V1.md'],
    invariants:{
      ...base.invariants,
      firstPageWclNetwork:'Normal application boot reads persisted HOME history and persisted Iris products only. Automatic legacy WCL report/history bootstrap is forbidden; WCL begins only after an explicit refresh/load/live action or a separately managed GLOBAL worker.',
      executionContextIsolation:'GLOBAL Iris Boss Knowledge, persisted AvoiD History and Active Report are independent planes. An Active Report never silently mutates HOME history and a pull selector is not a global application filter.',
      activeReportDifficulty:'A report has no single trusted difficulty. Difficulty is classified per encounter fight before rich execution data is loaded; cross-difficulty aggregation is forbidden.',
      liveEmptySemantics:'An explicitly started live report with zero encounter fights is connected/waiting, not an execution failure, missing mechanic observation or zero-score pull.',
      homeHistoryPersistence:'HOME history uses exact guild+zone+report+fight identity and stores encounter+difficulty per fight. Reads are zero-WCL; refresh is explicit, incremental and metadata/fight-index only.',
      globalHomeSourceIsolation:'GLOBAL BOSS source admission is fail-closed: only a concrete verified non-HOME guild source is eligible. HOME, known HOME uploaders, anonymous and owner-only/unverified origins are rejected before Wide/Deep evidence acquisition.',
    },
    capabilities:[...base.capabilities,...extension.filter(row=>!ids.has(row.id))],
  };
}
export function findIrisCapabilityV3911(id){return getIrisCapabilityContractV3911().capabilities.find(row=>row.id===id)||null;}
