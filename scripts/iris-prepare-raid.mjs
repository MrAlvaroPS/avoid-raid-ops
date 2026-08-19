import { loadLatestRaidCatalogV1 } from '../server/knowledge/raid-catalog-store-v1.mjs';
import { loadLatestRaidLearningPlanV1 } from '../server/knowledge/raid-learning-plan-store-v1.mjs';
import { getCorpusStatus,startCorpus,stepCorpus } from '../server/corpus/service.mjs';
import { recompileCorpusModelV2,loadOperationalEncounterModelV2 } from '../server/corpus/service-v2.mjs';
import { previewOperationalRehearsalV1,executeOperationalRehearsalV1,loadOperationalReadinessV1 } from '../server/corpus/operational-readiness-v1.mjs';

const argv=process.argv.slice(2),value=flag=>{const i=argv.indexOf(flag);return i>=0?argv[i+1]:null;},has=flag=>argv.includes(flag);
const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),diffId=v=>{const n=Number(v);if(Number.isInteger(n)&&n>0)return n;return({lfr:1,normal:3,heroic:4,hc:4,mythic:5})[norm(v)]||null;};
const requestedDifficulty=String(value('--difficulty')||'Normal'),difficulty=diffId(requestedDifficulty),execute=has('--execute')||has('--start'),rehearse=!has('--no-rehearsal'),reports=Math.max(1,Math.min(8,Number(value('--rehearsal-reports'))||3)),maxPerBoss=Math.max(1,Math.min(1500,Number(value('--steps-per-boss'))||500)),maxTotal=Math.max(1,Math.min(10000,Number(value('--max-total-steps'))||3500));
if(!difficulty)throw new Error(`Unsupported difficulty: ${requestedDifficulty}`);
const catalog=await loadLatestRaidCatalogV1();if(!catalog?.currentRaid)throw new Error('No persisted current raid catalog. Run validate:raid-catalog first.');
const plan=await loadLatestRaidLearningPlanV1(catalog.fingerprint);if(!plan)throw new Error('No persisted raid learning plan. Run validate:raid-learning first.');
const byEncounter=new Map((plan.scopes||[]).filter(row=>Number(row.difficulty?.id)===difficulty).map(row=>[Number(row.wclEncounterId),row])),rows=(catalog.currentRaid.encounters||[]).map(boss=>({boss,availability:byEncounter.get(Number(boss.wclEncounterId))||null})).filter(row=>row.boss?.wclEncounterId);

async function inspect(row){const scope={encounterId:Number(row.boss.wclEncounterId),difficulty,partition:Number(row.availability?.partition||catalog.currentRaid.defaultPartition?.id||0)},corpus=await getCorpusStatus(scope).catch(()=>null),operational=await loadOperationalEncounterModelV2(scope).catch(()=>null),readiness=operational?await loadOperationalReadinessV1(scope).catch(()=>null):null;return{scope,corpus,operational,readiness};}
function compact(row,state){return{boss:row.boss.name,encounterId:row.boss.wclEncounterId,difficulty:row.availability?.difficulty?.name||requestedDifficulty,availability:row.availability?.status||'unknown',publicSources:Number(row.availability?.publicSources||0),corpus:state.corpus?{status:state.corpus.status,phase:state.corpus.phase,pulls:Number(state.corpus.pullCount||0),deepPulls:Number(state.corpus.deepPullCount||0),sources:Number(state.corpus.sourceStats?.total||0)}:null,dataReady:Boolean(state.operational),coverageStatus:state.readiness?.status||null,liveReady:state.readiness?.liveReady===true};}

console.log(`\nIRIS RAID PREP · ${catalog.currentRaid.name} · ${rows[0]?.availability?.difficulty?.name||requestedDifficulty}`);
const initial=[];for(const row of rows)initial.push(compact(row,await inspect(row)));
console.log(JSON.stringify({mode:execute?'execute':'preview',raid:{name:catalog.currentRaid.name,zoneId:catalog.currentRaid.zoneId,bosses:rows.length},difficulty:{id:difficulty,name:rows[0]?.availability?.difficulty?.name||requestedDifficulty},networkExecuted:false,scopes:initial},null,2));
if(!execute){console.log('\nOK: raid preparation preview completed at zero network. Add --execute to resume/build DATA READY and run deterministic operational rehearsals.');process.exit(0);}

let totalSteps=0,rateLimited=false;const final=[];
for(const row of rows){
  const name=row.boss.name,availability=row.availability;if(!availability||availability.status!=='public-evidence-available'){final.push({boss:name,status:'waiting-for-public-evidence',publicSources:Number(availability?.publicSources||0)});continue;}
  let state=await inspect(row),status=state.corpus,bossSteps=0;
  if(!state.operational){
    if(!status){status=await startCorpus({...state.scope,corpusProfile:'operational',targetPulls:100,deepTargetPulls:20,maxCandidateReports:500,maxRankingPages:4,maxSourcePages:2});console.log(`START · ${name} · ${availability.difficulty?.name} · ${status.status}/${status.phase}`);}
    while(totalSteps<maxTotal&&bossSteps<maxPerBoss&&status&&(status.status==='running'||status.status==='rate-limited')){
      if(status.status==='rate-limited'&&Number(status.resumeAt)>Date.now()){console.log(`RATE LIMIT · ${name} checkpoint until ${new Date(Number(status.resumeAt)).toISOString()}`);rateLimited=true;break;}
      status=await stepCorpus({...state.scope,corpusProfile:'operational',targetPulls:100,deepTargetPulls:20,maxCandidateReports:500,maxRankingPages:4,maxSourcePages:2});bossSteps++;totalSteps++;
      if(bossSteps===1||bossSteps%25===0||status.status!=='running')console.log(`[${totalSteps}/${maxTotal}] ${name} · ${status.status}/${status.phase} · ${Number(status.pullCount||0)} wide · ${Number(status.deepPullCount||0)} deep · ${Number(status.sourceStats?.total||0)} sources`);
    }
    if(status?.status==='ready'){console.log(`CANONICALIZE · ${name} · zero-WCL HOME/source isolation rebuild`);await recompileCorpusModelV2({...state.scope,corpusProfile:'operational'});}
    state=await inspect(row);
  }
  if(state.operational&&rehearse&&state.readiness?.liveReady!==true){
    const preview=await previewOperationalRehearsalV1({...state.scope,reports});
    if(preview.selectedReports?.length){console.log(`REHEARSAL · ${name} · ${preview.selectedReports.length} deterministic canonical reports`);const result=await executeOperationalRehearsalV1({...state.scope,reports,confirmExecution:true,previewFingerprint:preview.fingerprint});console.log(`REHEARSAL RESULT · ${name} · ${result.status} · ${result.coverage.observedMechanics}/${result.coverage.packMechanics} mechanics · ${result.coverage.coveragePct}% coverage`);}
  }
  state=await inspect(row);final.push(compact(row,state));
  if(rateLimited||totalSteps>=maxTotal){if(rateLimited)console.log('STOP · rate-limit reserve reached; all checkpoints are preserved.');else console.log('STOP · global step budget reached; all checkpoints are preserved.');break;}
}
for(const row of rows){if(final.some(x=>x.boss===row.boss.name))continue;final.push(compact(row,await inspect(row)));}
const summary={liveReady:final.filter(x=>x.liveReady).length,dataReady:final.filter(x=>x.dataReady).length,coverageReview:final.filter(x=>x.coverageStatus==='coverage-review').length,building:final.filter(x=>x.corpus&&['running','rate-limited'].includes(x.corpus.status)).length,waiting:final.filter(x=>x.status==='waiting-for-public-evidence'||x.availability!=='public-evidence-available').length,total:final.length};
console.log(JSON.stringify({mode:'execute',raid:{name:catalog.currentRaid.name,zoneId:catalog.currentRaid.zoneId},difficulty:{id:difficulty,name:rows[0]?.availability?.difficulty?.name||requestedDifficulty},steps:totalSteps,summary,scopes:final,evidenceContract:{sameDifficultyOnly:true,homeExcludedFailClosed:true,dataReadyDoesNotImplyLiveReady:true,rehearsalDoesNotTrain:true,rehearsalDoesNotPromote:true,automaticPromotion:false}},null,2));
console.log(summary.liveReady===summary.total?'\nOK: every public scope in this raid+difficulty is LIVE READY.':'\nCHECKPOINT: rerun the same command to continue unfinished scopes. COVERAGE REVIEW scopes need inspection, not weaker thresholds.');
