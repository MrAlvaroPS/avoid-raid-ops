import { createHash } from 'node:crypto';
import { homeGuildId,isHomeOwnerId } from '../knowledge/scopes.mjs';

export const UNTOUCHED_HOLDOUT_SOURCE_POOL_V1_VERSION='untouched-holdout-source-pool-v1';
export const UNTOUCHED_HOLDOUT_SOURCE_LINEAGE_V1_VERSION='global-boss-learning-source-lineage-v1';

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0,40);
const sourceKey=value=>{
  if(typeof value==='string'&&/^(?:guild|user|report):/.test(value))return value;
  if(value?.source&&typeof value.source==='string')return sourceKey(value.source);
  if(value?.type&&value?.id!=null)return `${String(value.type)}:${String(value.id)}`;
  if(Number(value?.guild?.id)>0)return `guild:${Number(value.guild.id)}`;
  if(Number(value?.owner?.id)>0)return `user:${Number(value.owner.id)}`;
  return null;
};
const addKeys=(set,values=[])=>{for(const value of values||[]){const key=sourceKey(value);if(key)set.add(key);}return set;};
const mapKeys=value=>Object.keys(value||{}).filter(key=>/^(?:guild|user|report):/.test(key));

function artifactSourceKeys(aggregate={}){
  const out=new Set();
  for(const map of [
    aggregate.sourceReports,aggregate.deepSourceReports,
    aggregate?.splits?.train?.sourceReports,aggregate?.splits?.train?.deepSourceReports,
    aggregate?.splits?.validation?.sourceReports,aggregate?.splits?.validation?.deepSourceReports,
  ])addKeys(out,mapKeys(map));
  return out;
}

function controlSourceKeys(records=[]){const out=new Set();for(const row of records||[])addKeys(out,[row?.source,row?.sourceKey,row?.control?.source]);return out;}
function groupSourceKeys(evidenceGroups={}){const out=new Set();for(const pattern of evidenceGroups?.patterns||[])for(const group of pattern?.independentGroups||[])addKeys(out,[group?.source]);return out;}
function stabilitySourceKeys(stability={}){const out=new Set();for(const pattern of stability?.patterns||[])for(const row of pattern?.sourceEffects||[])addKeys(out,[row?.source]);return out;}

export function buildGlobalBossLearningSourceLineageV1({
  aggregate=null,job=null,matchedNullControls=[],evidenceGroups=null,stability=null,additionalLearningSources=[],lineageComplete=true,
}={}){
  const observed=artifactSourceKeys(aggregate||{});
  addKeys(observed,controlSourceKeys(matchedNullControls));
  addKeys(observed,groupSourceKeys(evidenceGroups||{}));
  addKeys(observed,stabilitySourceKeys(stability||{}));

  const priorLearning=new Set(observed);
  const metadataPreviouslyDiscovered=new Set();
  for(const key of job?.sourceSeen||[])addKeys(metadataPreviouslyDiscovered,[key]);
  for(const row of job?.sourceQueue||[])addKeys(metadataPreviouslyDiscovered,[row]);
  for(const key of Object.values(job?.candidateSourceByCode||{}))addKeys(metadataPreviouslyDiscovered,[key]);
  addKeys(priorLearning,metadataPreviouslyDiscovered);
  addKeys(priorLearning,additionalLearningSources);

  const complete=Boolean(lineageComplete&&aggregate&&job);
  const payload={
    version:UNTOUCHED_HOLDOUT_SOURCE_LINEAGE_V1_VERSION,
    complete,
    observedCombatSourceKeys:[...observed].sort(),
    priorLearningSourceKeys:[...priorLearning].sort(),
    metadataPreviouslyDiscoveredSourceKeys:[...metadataPreviouslyDiscovered].sort(),
  };
  return{
    ...payload,
    fingerprint:digest(payload),
    reason:complete
      ?'Lineage combines canonical corpus evidence, prior corpus source discovery and supplied downstream evidence products. Sources present anywhere in this lineage cannot be called untouched.'
      :'Learning/source lineage is incomplete; absence from known sets must not be interpreted as proof that a source is untouched.',
  };
}

function normalizedDiscoverySource(row={}){
  const key=sourceKey(row);if(!key)return null;
  const [type,idText]=key.split(':'),id=Number(idText);
  const ownerId=Number(row?.ownerId??row?.owner?.id)||null;
  return{source:key,type,id:Number.isFinite(id)?id:idText,name:row?.name||row?.guild?.name||null,ownerId,reportCode:row?.reportCode||row?.code||null,metadataOnlyDiscovery:row?.metadataOnlyDiscovery!==false};
}

export function buildUntouchedHoldoutSourcePoolV1({scope,stability,lineage,discoveredSources=[],discoveredAt=Date.now()}={}){
  if(!scope?.encounterId||!scope?.difficulty||!scope?.partition)throw new Error('Resolved GLOBAL BOSS scope is required for Holdout source pool');
  if(!stability?.fingerprint)throw new Error('Statistical Stability fingerprint is required for Holdout source pool');
  if(!lineage?.fingerprint)throw new Error('Learning source lineage is required for Holdout source pool');
  const prior=new Set(lineage.priorLearningSourceKeys||[]),observed=new Set(lineage.observedCombatSourceKeys||[]),seen=new Set(),candidates=[];
  for(const raw of discoveredSources||[]){
    const row=normalizedDiscoverySource(raw);if(!row||seen.has(row.source))continue;seen.add(row.source);
    const homeSource=(row.type==='guild'&&Number(row.id)===Number(homeGuildId()))||(row.type==='user'&&isHomeOwnerId(row.id))||(row.ownerId!=null&&isHomeOwnerId(row.ownerId));
    const preexistingCorpusMember=observed.has(row.source);
    const priorLearningUse=lineage.complete===true?prior.has(row.source):null;
    const combatEvidenceObservedBeforeReservation=lineage.complete===true?observed.has(row.source):null;
    const eligible=lineage.complete===true&&row.metadataOnlyDiscovery===true&&homeSource===false&&preexistingCorpusMember===false&&priorLearningUse===false&&combatEvidenceObservedBeforeReservation===false;
    candidates.push({
      ...row,homeSource,preexistingCorpusMember,priorLearningUse,combatEvidenceObservedBeforeReservation,
      discoveredAt:Number(discoveredAt),eligible,
      ineligibilityReasons:[
        ...(lineage.complete===true?[]:['lineage-incomplete']),
        ...(row.metadataOnlyDiscovery===true?[]:['combat-inspected-during-source-discovery']),
        ...(homeSource===false?[]:['home-source']),
        ...(preexistingCorpusMember===false?[]:['preexisting-corpus-member']),
        ...(priorLearningUse===false?[]:['prior-learning-use-or-unknown']),
        ...(combatEvidenceObservedBeforeReservation===false?[]:['combat-evidence-observed-or-unknown']),
      ],
    });
  }
  const payload={version:UNTOUCHED_HOLDOUT_SOURCE_POOL_V1_VERSION,scope,stabilityFingerprint:stability.fingerprint,lineageFingerprint:lineage.fingerprint,discoveredAt:Number(discoveredAt),candidates:candidates.map(row=>({source:row.source,eligible:row.eligible,homeSource:row.homeSource,preexistingCorpusMember:row.preexistingCorpusMember,priorLearningUse:row.priorLearningUse,combatEvidenceObservedBeforeReservation:row.combatEvidenceObservedBeforeReservation,metadataOnlyDiscovery:row.metadataOnlyDiscovery}))};
  return{
    version:UNTOUCHED_HOLDOUT_SOURCE_POOL_V1_VERSION,
    fingerprint:digest(payload),scope,stabilityFingerprint:stability.fingerprint,lineageFingerprint:lineage.fingerprint,discoveredAt:Number(discoveredAt),candidates,
    summary:{discoveredSources:candidates.length,eligibleUnseenSources:candidates.filter(row=>row.eligible).length,homeSourcesRejected:candidates.filter(row=>row.homeSource).length,priorLearningSourcesRejected:candidates.filter(row=>row.priorLearningUse===true).length,lineageComplete:lineage.complete===true},
    evidenceContract:{metadataOnlyBeforeReservation:true,sourceSelectionUsesCandidateCombatOutcomes:false,unknownLineageCannotBecomeUntouched:true,homeAvoidDataUsed:false,wclCombatEventCallsExecuted:0,providerNetworkCallsExecuted:0,automaticPromotion:false},
  };
}

export function reservationCandidatesFromSourcePoolV1(sourcePool={}){
  return(sourcePool?.candidates||[]).filter(row=>row?.eligible===true).map(row=>({
    source:row.source,homeSource:false,preexistingCorpusMember:false,priorLearningUse:false,combatEvidenceObservedBeforeReservation:false,
  }));
}
