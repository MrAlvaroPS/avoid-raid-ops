import { createHash } from 'node:crypto';
import { fetchRankingPage } from './ranking-source.mjs';
import { fetchReportIdentity,sourceFromIdentity } from './source-expansion.mjs';
import { buildUntouchedHoldoutSourcePoolV1 } from './untouched-holdout-source-pool-v1.mjs';

export const UNTOUCHED_HOLDOUT_SOURCE_DISCOVERY_V1_VERSION='untouched-holdout-source-discovery-v1';
export const UNTOUCHED_HOLDOUT_SOURCE_DISCOVERY_DEFAULTS=Object.freeze({
  targetEligibleSources:5,
  maxRankingPages:3,
  maxIdentityLookups:30,
  minimumRateLimitReservePoints:250,
});

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=(value,length=40)=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0,length);
const supportedPatterns=stability=>(stability?.patterns||[]).filter(row=>row?.status==='source-stratified-stability-supported'&&row?.holdoutEligible===true);
const finite=value=>Number.isFinite(Number(value))?Number(value):null;

function settings(input={}){
  return{
    targetEligibleSources:Math.max(3,Math.min(12,Number(input.targetEligibleSources)||UNTOUCHED_HOLDOUT_SOURCE_DISCOVERY_DEFAULTS.targetEligibleSources)),
    maxRankingPages:Math.max(1,Math.min(8,Number(input.maxRankingPages)||UNTOUCHED_HOLDOUT_SOURCE_DISCOVERY_DEFAULTS.maxRankingPages)),
    maxIdentityLookups:Math.max(5,Math.min(80,Number(input.maxIdentityLookups)||UNTOUCHED_HOLDOUT_SOURCE_DISCOVERY_DEFAULTS.maxIdentityLookups)),
    minimumRateLimitReservePoints:Math.max(0,Math.min(5000,Number(input.minimumRateLimitReservePoints)||UNTOUCHED_HOLDOUT_SOURCE_DISCOVERY_DEFAULTS.minimumRateLimitReservePoints)),
    startRankingPage:Math.max(1,Number(input.startRankingPage)||1),
  };
}

function remainingRatePoints(rate){const limit=finite(rate?.limitPerHour),spent=finite(rate?.pointsSpentThisHour);return limit==null||spent==null?null:Math.max(0,limit-spent);}
function budgetBlocked(rate,config){const remaining=remainingRatePoints(rate);return remaining!=null&&remaining<=config.minimumRateLimitReservePoints;}
function hashOrder(stabilityFingerprint,code){return digest(`${UNTOUCHED_HOLDOUT_SOURCE_DISCOVERY_V1_VERSION}|${stabilityFingerprint}|${String(code)}`,20);}

export function buildUntouchedHoldoutSourceDiscoveryPreviewV1({scope,stability,lineage,config={}}={}){
  if(!scope?.encounterId||!scope?.difficulty||!scope?.partition)throw new Error('Resolved GLOBAL BOSS scope is required');
  if(!stability?.fingerprint)throw new Error('Statistical Stability fingerprint is required');
  if(!lineage?.fingerprint)throw new Error('Learning source lineage is required');
  const frozen=supportedPatterns(stability),cfg=settings(config);
  const executable=frozen.length>0&&lineage.complete===true;
  const status=!frozen.length?'not-eligible-no-stability-supported-pattern':lineage.complete!==true?'holdout-source-lineage-incomplete':'source-discovery-ready';
  const payload={version:UNTOUCHED_HOLDOUT_SOURCE_DISCOVERY_V1_VERSION,scope,stabilityFingerprint:stability.fingerprint,lineageFingerprint:lineage.fingerprint,config:cfg,frozenPatternKeys:frozen.map(row=>row.patternKey).sort()};
  return{
    version:UNTOUCHED_HOLDOUT_SOURCE_DISCOVERY_V1_VERSION,
    fingerprint:digest(payload),scope,stabilityFingerprint:stability.fingerprint,lineageFingerprint:lineage.fingerprint,config:cfg,status,executable,
    frozenCandidatePatterns:frozen.map(row=>({patternKey:row.patternKey,abilityId:Number(row.abilityId)||null})),
    networkUpperBound:{wclRankingCalls:executable?cfg.maxRankingPages:0,wclIdentityCalls:executable?cfg.maxIdentityLookups:0,wclCalls:executable?cfg.maxRankingPages+cfg.maxIdentityLookups:0,wclCombatEventCalls:0,blizzardCalls:0,wagoCalls:0},
    evidenceContract:{metadataOnly:true,candidateCombatOutcomesInspected:false,rankingMetricsPersisted:false,rankingOrderUsedForSelection:false,sourceIdentityOnly:true,combatEventsForbidden:true,automaticPromotion:false},
  };
}

export async function executeUntouchedHoldoutSourceDiscoveryV1({scope,stability,lineage,preview,fetchRanking=fetchRankingPage,fetchIdentity=fetchReportIdentity}={}){
  const expected=buildUntouchedHoldoutSourceDiscoveryPreviewV1({scope,stability,lineage,config:preview?.config||{}});
  if(preview?.fingerprint&&String(preview.fingerprint)!==String(expected.fingerprint))throw new Error('Untouched Holdout source-discovery preview fingerprint is stale');
  if(!expected.executable){
    const pool=buildUntouchedHoldoutSourcePoolV1({scope,stability,lineage,discoveredSources:[]});
    return{...expected,executed:false,sourcePool:pool,usage:{wclRankingCalls:0,wclIdentityCalls:0,wclCalls:0,wclCombatEventCalls:0,blizzardCalls:0,wagoCalls:0},rateLimit:null};
  }
  const cfg=expected.config,codes=new Set();let rankingCalls=0,identityCalls=0,lastRate=null,rankingExhausted=false;
  for(let offset=0;offset<cfg.maxRankingPages;offset++){
    const pageNumber=cfg.startRankingPage+offset;
    const page=await fetchRanking({...scope,page:pageNumber});rankingCalls++;lastRate=page?.rateLimit||lastRate;
    if(Number(page?.resolvedPartition)>0&&Number(page.resolvedPartition)!==Number(scope.partition))throw new Error(`WCL partition changed during holdout source discovery: expected p${scope.partition}, got p${page.resolvedPartition}`);
    for(const row of page?.rows||[])if(row?.reportCode)codes.add(String(row.reportCode));
    if(budgetBlocked(lastRate,cfg))break;
    if(page?.hasMore===false){rankingExhausted=true;break;}
  }

  // Ranking order/percentile is deliberately discarded. Stable hash ordering is derived
  // only from the already-frozen Stability fingerprint + report code.
  const ordered=[...codes].sort((a,b)=>hashOrder(stability.fingerprint,a).localeCompare(hashOrder(stability.fingerprint,b))||a.localeCompare(b));
  const sources=[],seen=new Set();let currentPool=buildUntouchedHoldoutSourcePoolV1({scope,stability,lineage,discoveredSources:[]});
  for(const code of ordered){
    if(identityCalls>=cfg.maxIdentityLookups||currentPool.summary.eligibleUnseenSources>=cfg.targetEligibleSources||budgetBlocked(lastRate,cfg))break;
    const response=await fetchIdentity(code);identityCalls++;lastRate=response?.rateLimit||lastRate;
    const identity=response?.identity;if(!identity)continue;
    const source=sourceFromIdentity(identity);if(!source)continue;
    const key=`${source.type}:${source.id}`;if(seen.has(key))continue;seen.add(key);
    sources.push({...source,reportCode:String(identity.code||code),metadataOnlyDiscovery:true});
    currentPool=buildUntouchedHoldoutSourcePoolV1({scope,stability,lineage,discoveredSources:sources});
  }
  const status=currentPool.summary.eligibleUnseenSources>=Math.min(cfg.targetEligibleSources,3)?'source-pool-ready':'holdout-unavailable-insufficient-unseen-sources';
  return{
    ...expected,status,executed:true,sourcePool:currentPool,
    discovery:{rankingPagesAttempted:rankingCalls,rankingExhausted,seedReportCodes:codes.size,identityLookups:identityCalls,uniqueSourcesResolved:sources.length,eligibleUnseenSources:currentPool.summary.eligibleUnseenSources},
    usage:{wclRankingCalls:rankingCalls,wclIdentityCalls:identityCalls,wclCalls:rankingCalls+identityCalls,wclCombatEventCalls:0,blizzardCalls:0,wagoCalls:0},
    rateLimit:lastRate||null,
  };
}
