import { getCorpusStatus } from '../corpus/service.mjs';

export const GLOBAL_RAID_REFERENCE_VERSION='global-raid-reference-v1';
export async function getGlobalRaidReferenceV1({encounterId,difficulty,partition=0}={}, {getStatus=getCorpusStatus}={}){
  const encounter=Number(encounterId),diff=Number(difficulty),part=Number(partition||0);
  if(!(encounter>0))throw new Error('encounterId is required');if(!(diff>0))throw new Error('difficulty is required; GLOBAL reference never substitutes another difficulty');
  const corpus=await getStatus({encounterId:encounter,difficulty:diff,partition:part}).catch(()=>null);
  if(!corpus)return{version:GLOBAL_RAID_REFERENCE_VERSION,scope:{encounterId:encounter,difficulty:diff,partition:part||null},status:'not-started',maturity:'none',reference:null,networkExecuted:false,evidenceContract:{sameDifficultyOnly:true,crossDifficultyComparisonForbidden:true,foundationIsAcceptedKnowledge:false,automaticPromotion:false}};
  const ready=['ready','completed'].includes(String(corpus.status)),building=['running','rate-limited','paused'].includes(String(corpus.status)),maturity=ready?'foundation-ready':building?'foundation-building':'foundation-incomplete';
  return{version:GLOBAL_RAID_REFERENCE_VERSION,scope:{encounterId:encounter,difficulty:diff,partition:Number(corpus.partition||part)||null},status:ready?'ready':building?'building':'incomplete',maturity,reference:{corpusId:corpus.corpusId,status:corpus.status,phase:corpus.phase,pulls:Number(corpus.pullCount||0),deepPulls:Number(corpus.deepPullCount||0),sources:Number(corpus.sourceStats?.total||0),guildSources:Number(corpus.sourceStats?.guilds||0),uploaderSources:Number(corpus.sourceStats?.personalUploaders||0),progress:corpus.progress||null,aggregate:corpus.aggregate||null,model:corpus.model||null,updatedAt:corpus.updatedAt||null},networkExecuted:false,evidenceContract:{sameDifficultyOnly:true,crossDifficultyComparisonForbidden:true,globalPublicReference:true,homeAvoidIsNotReferenceTrainingData:true,foundationIsAcceptedKnowledge:false,foundationCanSupportOperationalComparison:true,automaticPromotion:false}};
}
