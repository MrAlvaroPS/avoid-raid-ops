import { loadLatestRaidCatalogV1 } from '../server/knowledge/raid-catalog-store-v1.mjs';
import { loadLatestRaidLearningPlanV1 } from '../server/knowledge/raid-learning-plan-store-v1.mjs';
import { getCorpusStatus,startCorpus,stepCorpus } from '../server/corpus/service.mjs';
import { recompileCorpusModelV2,loadOperationalEncounterModelV2,OPERATIONAL_REFERENCE_THRESHOLDS } from '../server/corpus/service-v2.mjs';
import { loadOperationalReadinessV1 } from '../server/corpus/operational-readiness-v1.mjs';

const argv=process.argv.slice(2),value=flag=>{const i=argv.indexOf(flag);return i>=0?argv[i+1]:null;},has=flag=>argv.includes(flag);
const requestedBoss=String(value('--boss')||'').trim(),requestedEncounter=Number(value('--encounter')||0),requestedDifficulty=String(value('--difficulty')||'Normal').trim(),maxSteps=Math.max(1,Math.min(1000,Number(value('--steps'))||180)),execute=has('--execute')||has('--start');
const norm=v=>String(v||'').normalize('NFKD').replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase();
const diffId=value=>{const n=Number(value);if(Number.isInteger(n)&&n>0)return n;return({lfr:1,normal:3,heroic:4,hc:4,mythic:5})[norm(value)]||null;};

const catalog=await loadLatestRaidCatalogV1();if(!catalog?.currentRaid)throw new Error('No persisted current raid catalog. Run validate:raid-catalog first.');
const plan=await loadLatestRaidLearningPlanV1(catalog.fingerprint);if(!plan)throw new Error('No persisted raid learning availability. Run validate:raid-learning first.');
const bosses=catalog.currentRaid.encounters||[],boss=bosses.find(row=>requestedEncounter&&Number(row.wclEncounterId)===requestedEncounter)||bosses.find(row=>requestedBoss&&norm(row.name)===norm(requestedBoss))||(!requestedBoss&&!requestedEncounter?bosses[0]:null);if(!boss)throw new Error(`Boss not found in persisted current raid catalog: ${requestedBoss||requestedEncounter}`);
const difficulty=diffId(requestedDifficulty);if(!difficulty)throw new Error(`Unsupported difficulty: ${requestedDifficulty}`);
const availability=(plan.scopes||[]).find(row=>Number(row.wclEncounterId)===Number(boss.wclEncounterId)&&Number(row.difficulty?.id)===difficulty),partition=Number(availability?.partition||catalog.currentRaid?.defaultPartition?.id||0);if(!availability)throw new Error('No learning-availability record for this boss+difficulty');
const scope={encounterId:Number(boss.wclEncounterId),difficulty,partition};

console.log('\nIRIS PREPARE BOSS · operational data readiness v2');
console.log(JSON.stringify({raid:catalog.currentRaid.name,boss:{name:boss.name,wclEncounterId:boss.wclEncounterId,journalEncounterId:boss.journalEncounterId},difficulty:availability.difficulty,partition,availability:availability.status,publicSources:Number(availability.publicSources||0),execute,operationalThresholds:OPERATIONAL_REFERENCE_THRESHOLDS},null,2));
if(availability.status!=='public-evidence-available')throw new Error(`Public ${availability.difficulty?.name||difficulty} evidence is not available yet (${availability.status}). Iris will not borrow another difficulty.`);

let status=await getCorpusStatus(scope).catch(()=>null),steps=0;
if(!execute){
  const operational=await loadOperationalEncounterModelV2(scope).catch(()=>null),readiness=operational?await loadOperationalReadinessV1(scope).catch(()=>null):null;
  console.log(JSON.stringify({mode:'preview',networkExecuted:false,currentCorpus:status?{status:status.status,phase:status.phase,pulls:status.pullCount,deepPulls:status.deepPullCount,sources:status.sourceStats?.total}:null,dataReadiness:operational?'READY':'NOT READY',liveReadiness:readiness?.liveReady?'READY':operational?'REHEARSAL REQUIRED':'NOT READY',operationalReference:operational?.operationalReference||null,rehearsal:readiness?{status:readiness.status,coverage:readiness.coverage,checks:readiness.checks}:null,nextCommand:operational&&!readiness?.liveReady?`npm run validate:operational-rehearsal -- --encounter ${boss.wclEncounterId} --difficulty ${availability.difficulty?.name||difficulty} --execute`:`npm run prepare:boss -- --encounter ${boss.wclEncounterId} --difficulty ${availability.difficulty?.name||difficulty} --execute`},null,2));
  process.exit(0);
}

if(!status){status=await startCorpus({...scope,corpusProfile:'operational',targetPulls:100,deepTargetPulls:20,maxCandidateReports:500,maxRankingPages:4,maxSourcePages:2});console.log(`START · ${boss.name} · ${availability.difficulty?.name} · ${status.status}/${status.phase}`);}
while(steps<maxSteps&&status&&(status.status==='running'||status.status==='rate-limited')){
  if(status.status==='rate-limited'&&Number(status.resumeAt)>Date.now()){console.log(`RATE LIMIT RESERVE · checkpoint preserved until ${new Date(Number(status.resumeAt)).toISOString()}`);break;}
  status=await stepCorpus({...scope,corpusProfile:'operational',targetPulls:100,deepTargetPulls:20,maxCandidateReports:500,maxRankingPages:4,maxSourcePages:2});steps++;
  if(steps===1||steps%10===0||status.status!=='running')console.log(`[${steps}/${maxSteps}] ${status.status}/${status.phase} · ${Number(status.pullCount||0)} wide · ${Number(status.deepPullCount||0)} deep · ${Number(status.sourceStats?.total||0)} sources`);
}
if(status?.status==='ready'){console.log('CANONICALIZE · zero-WCL HOME/source isolation rebuild');status=await recompileCorpusModelV2({...scope,corpusProfile:'operational'});}
const operational=await loadOperationalEncounterModelV2(scope).catch(()=>null),readiness=operational?await loadOperationalReadinessV1(scope).catch(()=>null):null,dataReadiness=operational?'READY':status?.status==='rate-limited'?'RATE LIMITED':status?.status==='paused'?'PAUSED':status?.status==='running'?'BUILDING':'NOT READY',liveReadiness=readiness?.liveReady?'READY':operational?'REHEARSAL REQUIRED':dataReadiness;
console.log(JSON.stringify({steps,corpus:status?{status:status.status,phase:status.phase,pulls:status.pullCount,deepPulls:status.deepPullCount,sources:status.sourceStats?.total,resumeAt:status.resumeAt||null,pauseReason:status.pauseReason||null,message:status.message}:null,dataReadiness,liveReadiness,operationalReference:operational?.operationalReference||null,rehearsal:readiness?{status:readiness.status,coverage:readiness.coverage,checks:readiness.checks}:null,evidenceContract:{sameDifficultyOnly:true,homeExcludedBeforeOperationalUse:true,operationalDoesNotMeanPublished:true,dataReadyDoesNotImplyLiveReady:true,automaticPromotion:false}},null,2));
if(!operational&&status?.status==='ready')throw new Error('Corpus completed but did not satisfy the fail-closed Operational Reference floor. Inspect canonical sampling diagnostics instead of weakening the gate.');
const stop=readiness?.liveReady?'OK: boss is LIVE READY.':operational?`DATA READY: run npm run validate:operational-rehearsal -- --encounter ${boss.wclEncounterId} --difficulty ${availability.difficulty?.name||difficulty} --execute`:status?.status==='paused'?'STOP: systemic/operator pause preserved. Inspect pauseReason/last failure before explicitly resuming; Iris will not blindly repeat a broken WCL contract.':status?.status==='rate-limited'?'STOP: rate-limit checkpoint preserved. Rerun the same command after resumeAt; stepCorpus resumes safely.':'STOP: persistent checkpoint preserved; rerun the same command to continue.';
console.log(`\n${stop}`);
