import { loadLatestRaidCatalogV1 } from '../server/knowledge/raid-catalog-store-v1.mjs';
import { buildRaidLearningPlanPreviewV1,resolveRaidLearningAvailabilityV1 } from '../server/knowledge/raid-learning-plan-v1.mjs';
import { persistRaidLearningPlanV1 } from '../server/knowledge/raid-learning-plan-store-v1.mjs';

const catalog=await loadLatestRaidCatalogV1();
if(!catalog?.currentRaid)throw new Error('No persisted raid catalog. Run npm run validate:raid-catalog first.');
console.log('\n[1/3] Preview current raid public-evidence availability (0 network)');
const preview=buildRaidLearningPlanPreviewV1(catalog);
console.log(JSON.stringify({raid:catalog.currentRaid.name,catalogFingerprint:catalog.fingerprint,previewFingerprint:preview.fingerprint,scopes:preview.scopes.map(row=>({boss:row.bossName,journalEncounterId:row.journalEncounterId,wclEncounterId:row.wclEncounterId,difficulty:row.difficulty,partition:row.partition,queryEligible:row.queryEligible})),networkUpperBound:preview.networkUpperBound,safety:preview.safety},null,2));
if(Number(preview.networkUpperBound.wclCombatEventCalls)!==0)throw new Error('Raid learning availability preview may not budget combat-event calls');

console.log('\n[2/3] Check one ranking metadata page per published boss+difficulty (no combat events)');
const result=await resolveRaidLearningAvailabilityV1(catalog);
console.log(JSON.stringify({fingerprint:result.fingerprint,summary:result.summary,usage:result.usage,scopes:result.scopes.map(row=>({boss:row.bossName,wclEncounterId:row.wclEncounterId,journalEncounterId:row.journalEncounterId,difficulty:row.difficulty,status:row.status,publicSources:row.publicSources,partition:row.partition,rankingOutcomeDiscarded:row.rankingOutcomeDiscarded,error:row.error||null}))},null,2));
if(Number(result.usage.wclCombatEventCalls)!==0)throw new Error('Raid learning availability must never request combat events');

console.log('\n[3/3] Persist difficulty-isolated availability for 0-network Mechanics reads');
const stored=await persistRaidLearningPlanV1(result);
console.log(JSON.stringify({latestKey:stored.storage.latestKey,revisionKey:stored.storage.revisionKey,changedFromPrevious:stored.storage.changedFromPrevious,summary:stored.summary},null,2));
console.log('\nOK: public evidence availability classified independently for each boss+difficulty; no combat events were requested.');
