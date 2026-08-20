import { loadLatestRaidCatalogV1 } from '../knowledge/raid-catalog-store-v1.mjs';
import { loadLatestRaidLearningPlanV1 } from '../knowledge/raid-learning-plan-store-v1.mjs';
import { buildRaidCorpusBootstrapPreviewV1,startRaidCorpusFoundationV1 } from '../corpus/raid-corpus-bootstrap-v1.mjs';

async function context(){
  const catalog=await loadLatestRaidCatalogV1();if(!catalog?.currentRaid)throw new Error('No persisted current raid catalog. Run raid catalog bootstrap first.');
  const learningPlan=await loadLatestRaidLearningPlanV1(catalog.fingerprint).catch(()=>null);if(!learningPlan)throw new Error('No persisted raid learning availability for the current catalog. Refresh raid learning availability first.');
  return{catalog,learningPlan};
}
export async function previewRaidCorpusBootstrapV1(input={}){const {catalog,learningPlan}=await context();return buildRaidCorpusBootstrapPreviewV1({catalog,learningPlan,difficultyNames:input.difficultyNames});}
export async function startRaidCorpusBootstrapV1(input={}){const preview=await previewRaidCorpusBootstrapV1(input);return startRaidCorpusFoundationV1({preview,confirmExecution:input.confirmExecution,previewFingerprint:input.previewFingerprint,maxNewScopes:input.maxNewScopes});}
