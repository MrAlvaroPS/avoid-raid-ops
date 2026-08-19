import { getCorpusStatus } from '../corpus/service.mjs';
import { getBossSamplingManifest,loadOperationalEncounterModelV2 } from '../corpus/service-v2.mjs';

export const GLOBAL_RAID_REFERENCE_VERSION='global-raid-reference-v2';
export async function getGlobalRaidReferenceV1({encounterId,difficulty,partition=0}={}, {getStatus=getCorpusStatus,getSampling=getBossSamplingManifest,getOperational=loadOperationalEncounterModelV2}={}){
  const encounter=Number(encounterId),diff=Number(difficulty),part=Number(partition||0);
  if(!(encounter>0))throw new Error('encounterId is required');if(!(diff>0))throw new Error('difficulty is required; GLOBAL reference never substitutes another difficulty');
  const corpus=await getStatus({encounterId:encounter,difficulty:diff,partition:part}).catch(()=>null);
  if(!corpus)return{version:GLOBAL_RAID_REFERENCE_VERSION,scope:{encounterId:encounter,difficulty:diff,partition:part||null},status:'not-started',maturity:'none',reference:null,networkExecuted:false,evidenceContract:{sameDifficultyOnly:true,crossDifficultyComparisonForbidden:true,foundationIsAcceptedKnowledge:false,automaticPromotion:false}};
  const ready=['ready','completed'].includes(String(corpus.status)),building=['running','rate-limited','paused'].includes(String(corpus.status)),maturity=ready?'foundation-ready':building?'foundation-building':'foundation-incomplete';
  const resolvedPartition=Number(corpus.partition||part)||0,[sampling,operational]=await Promise.all([
    ready?getSampling({encounterId:encounter,difficulty:diff,partition:resolvedPartition}).catch(()=>null):Promise.resolve(null),
    ready?getOperational({encounterId:encounter,difficulty:diff,partition:resolvedPartition}).catch(()=>null):Promise.resolve(null),
  ]);
  const canonical=operational?.operationalReference?.evidence||null;
  const reference={
    corpusId:corpus.corpusId,status:corpus.status,phase:corpus.phase,
    pulls:Number(canonical?.widePulls??corpus.pullCount??0),deepPulls:Number(canonical?.deepPulls??corpus.deepPullCount??0),
    sources:Number(canonical?.wideSources??corpus.sourceStats?.total??0),deepSources:Number(canonical?.deepSources??0),
    wideReports:Number(canonical?.wideReports??sampling?.wide?.reports??0),deepReports:Number(canonical?.deepReports??sampling?.deep?.reports??0),
    candidateSources:Number(corpus.sourceStats?.total||0),canonicalSampling:Boolean(canonical),
    progress:corpus.progress||null,aggregate:corpus.aggregate||null,model:corpus.model||null,updatedAt:corpus.updatedAt||null,
  };
  return{version:GLOBAL_RAID_REFERENCE_VERSION,scope:{encounterId:encounter,difficulty:diff,partition:resolvedPartition||null},status:ready?'ready':building?'building':'incomplete',maturity,reference,networkExecuted:false,evidenceContract:{sameDifficultyOnly:true,crossDifficultyComparisonForbidden:true,globalPublicReference:true,homeAvoidIsNotReferenceTrainingData:true,canonicalCountsPreferredWhenOperationalReady:true,foundationIsAcceptedKnowledge:false,foundationCanSupportOperationalComparison:true,automaticPromotion:false}};
}
