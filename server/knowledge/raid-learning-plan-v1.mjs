import { createHash } from 'node:crypto';
import { fetchRankingPage } from '../corpus/ranking-source.mjs';

export const RAID_LEARNING_PLAN_VERSION='raid-learning-plan-v1';
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=value=>createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');
const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};

function scopes(catalog){
  const raid=catalog?.currentRaid;if(!raid)return[];
  return(raid.encounters||[]).flatMap(boss=>(boss.difficulties||raid.difficulties||[]).map(difficulty=>({
    zoneId:positive(raid.zoneId),raidName:raid.name||null,
    journalEncounterId:positive(boss.journalEncounterId),wclEncounterId:positive(boss.wclEncounterId),bossName:boss.name||null,
    difficulty:{id:positive(difficulty.id),name:difficulty.name||null},partition:positive(raid.defaultPartition?.id),
  }))).filter(row=>row.journalEncounterId&&row.difficulty.id);
}

export function buildRaidLearningPlanPreviewV1(catalog){
  const rows=scopes(catalog).map(row=>({...row,queryEligible:Boolean(row.wclEncounterId)}));
  const request={catalogFingerprint:catalog?.fingerprint||null,zoneId:catalog?.currentRaid?.zoneId||null,scopes:rows.map(row=>({journalEncounterId:row.journalEncounterId,wclEncounterId:row.wclEncounterId,difficultyId:row.difficulty.id,partition:row.partition,queryEligible:row.queryEligible}))};
  return{
    version:'raid-learning-plan-preview-v1',fingerprint:digest({version:RAID_LEARNING_PLAN_VERSION,request}),request,scopes:rows,
    networkUpperBound:{wclMetadataCalls:rows.filter(row=>row.queryEligible).length,wclCombatEventCalls:0,providerCalls:0},
    safety:{metadataAvailabilityOnly:true,rankingOutcomeDiscarded:true,combatEventsForbidden:true,crossDifficultyComparisonForbidden:true,automaticCorpusStart:false,automaticPromotion:false},
  };
}

export async function resolveRaidLearningAvailabilityV1(catalog,{rankingPage=fetchRankingPage}={}){
  const preview=buildRaidLearningPlanPreviewV1(catalog),results=[];let calls=0;
  for(const scope of preview.scopes){
    if(!scope.wclEncounterId){results.push({...scope,status:'wcl-encounter-not-published',publicSources:0,reportCodes:[],wclMetadataCalls:0});continue;}
    try{
      const page=await rankingPage({encounterId:scope.wclEncounterId,difficulty:scope.difficulty.id,partition:scope.partition||0,page:1});calls++;
      const reportCodes=[...new Set((page.rows||[]).map(row=>String(row.reportCode||'')).filter(Boolean))];
      results.push({...scope,partition:page.resolvedPartition||scope.partition||null,status:reportCodes.length?'public-evidence-available':'no-public-evidence-yet',publicSources:reportCodes.length,reportCodes,wclMetadataCalls:1,rankingRowsObserved:Number(page.rows?.length||0),rankingOutcomeDiscarded:true});
    }catch(error){calls++;results.push({...scope,status:'wcl-metadata-unavailable',publicSources:0,reportCodes:[],wclMetadataCalls:1,error:error instanceof Error?error.message:String(error),negativeEvidence:false});}
  }
  const payload={
    version:RAID_LEARNING_PLAN_VERSION,catalogFingerprint:catalog?.fingerprint||null,zoneId:catalog?.currentRaid?.zoneId||null,raidName:catalog?.currentRaid?.name||null,generatedAt:Date.now(),scopes:results,
    summary:{totalScopes:results.length,publicEvidenceAvailable:results.filter(row=>row.status==='public-evidence-available').length,noPublicEvidenceYet:results.filter(row=>row.status==='no-public-evidence-yet').length,wclEncounterNotPublished:results.filter(row=>row.status==='wcl-encounter-not-published').length,metadataUnavailable:results.filter(row=>row.status==='wcl-metadata-unavailable').length},
    usage:{wclMetadataCalls:calls,wclCombatEventCalls:0},
    evidenceContract:{availabilityOnly:true,rankingOutcomeDiscarded:true,normalHeroicCannotCountAsMythicEvidence:true,difficultyScoped:true,crossDifficultyComparisonForbidden:true,noCombatEvidenceClaim:true,automaticCorpusStart:false,automaticPromotion:false},
  };
  return{...payload,fingerprint:digest({...payload,generatedAt:undefined,scopes:results.map(row=>({...row,reportCodes:row.reportCodes.slice().sort()}))}),previewFingerprint:preview.fingerprint};
}
