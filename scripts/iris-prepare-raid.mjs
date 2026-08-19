import { loadLatestRaidCatalogV1 } from '../server/knowledge/raid-catalog-store-v1.mjs';
import { loadLatestRaidLearningPlanV1 } from '../server/knowledge/raid-learning-plan-store-v1.mjs';
import { getCorpusStatus,startCorpus,stepCorpus } from '../server/corpus/service.mjs';
import { recompileCorpusModelV2,loadOperationalEncounterModelV2 } from '../server/corpus/service-v2.mjs';
import { previewOperationalRehearsalV1,executeOperationalRehearsalV1 } from '../server/corpus/operational-readiness-v1.mjs';

const argv=process.argv.slice(2),value=flag=>{const i=argv.indexOf(flag);return i>=0?argv[i+1]:null;},has=flag=>argv.includes(flag);
const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),diffId=v=>{const n=Number(v);if(Number.isInteger(n)&&n>0)return n;return({lfr:1,normal:3,heroic:4,hc:4,mythic:5})[norm(v)]||null;};
const requestedDifficulty=String(value('--difficulty')||'Normal'),difficulty=diffId(requestedDifficulty),watch=has('--watch'),execute=watch||has('--execute')||has('--start'),rehearse=!has('--no-rehearsal'),forceRehearsal=has('--force-rehearsal'),reports=Math.max(1,Math.min(8,Number(value('--rehearsal-reports'))||3)),maxPerBoss=Math.max(1,Math.min(1500,Number(value('--steps-per-boss'))||500)),maxTotal=Math.max(1,Math.min(10000,Number(value('--max-total-steps'))||3500));
if(!difficulty)throw new Error(`Unsupported difficulty: ${requestedDifficulty}`);
const catalog=await loadLatestRaidCatalogV1();if(!catalog?.currentRaid)throw new Error('No persisted current raid catalog. Run validate:raid-catalog first.');
const plan=await loadLatestRaidLearningPlanV1(catalog.fingerprint);if(!plan)throw new Error('No persisted raid learning plan. Run validate:raid-learning first.');
const byEncounter=new Map((plan.scopes||[]).filter(row=>Number(row.difficulty?.id)===difficulty).map(row=>[Number(row.wclEncounterId),row])),rows=(catalog.currentRaid.encounters||[]).map(boss=>({boss,availability:byEncounter.get(Number(boss.wclEncounterId))||null})).filter(row=>row.boss?.wclEncounterId);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,Math.max(0,Math.min(Number(ms)||0,2_147_000_000))));
let raw429Streak=0;
const isRawWcl429=error=>/WCL GraphQL 429|"status"\s*:\s*429|Too many requests from this IP address/i.test(String(error?.message||error||''));
const raw429Delay=()=>Math.min(15*60_000,60_000*Math.pow(2,Math.min(4,Math.max(0,raw429Streak-1))));
const noteRaw429=({error,boss,stage})=>{raw429Streak++;const resumeAt=Date.now()+raw429Delay();console.log(`WCL 429 · ${boss} · ${stage} · transient IP throttle · checkpoint preserved · retry ${new Date(resumeAt).toISOString()} · attempt ${raw429Streak}`);return resumeAt;};
const clearRaw429=()=>{raw429Streak=0;};
const compactError=value=>String(value||'').replace(/\s+/g,' ').trim().slice(0,220);

async function inspect(row){
  const scope={encounterId:Number(row.boss.wclEncounterId),difficulty,partition:Number(row.availability?.partition||catalog.currentRaid.defaultPartition?.id||0)},corpus=await getCorpusStatus(scope).catch(()=>null),operational=await loadOperationalEncounterModelV2(scope).catch(()=>null);
  const rehearsal=operational?await previewOperationalRehearsalV1({...scope,reports}).catch(()=>null):null;
  return{scope,corpus,operational,rehearsal};
}
function compact(row,state){
  return{boss:row.boss.name,encounterId:row.boss.wclEncounterId,difficulty:row.availability?.difficulty?.name||requestedDifficulty,availability:row.availability?.status||'unknown',publicSources:Number(row.availability?.publicSources||0),corpus:state.corpus?{status:state.corpus.status,phase:state.corpus.phase,pulls:Number(state.corpus.pullCount||0),deepPulls:Number(state.corpus.deepPullCount||0),sources:Number(state.corpus.sourceStats?.total||0),resumeAt:Number(state.corpus.resumeAt||0)||null,...(state.corpus.status==='paused'?{pauseReason:compactError(state.corpus.message||state.corpus.lastError||state.corpus.error)||null}:{})}:null,dataReady:Boolean(state.operational),coverageStatus:state.rehearsal?.status||null,liveReady:state.rehearsal?.liveReady===true};
}
function summarize(final){
  return{liveReady:final.filter(x=>x.liveReady).length,dataReady:final.filter(x=>x.dataReady).length,coverageReview:final.filter(x=>x.coverageStatus==='coverage-review').length,rehearsalRequired:final.filter(x=>x.dataReady&&x.coverageStatus==='rehearsal-required').length,building:final.filter(x=>x.corpus&&['running','rate-limited'].includes(x.corpus.status)).length,paused:final.filter(x=>x.corpus?.status==='paused').length,notStarted:final.filter(x=>x.availability==='public-evidence-available'&&!x.corpus&&!x.dataReady).length,waiting:final.filter(x=>x.status==='waiting-for-public-evidence'||x.availability!=='public-evidence-available').length,total:final.length};
}

console.log(`\nIRIS RAID PREP · ${catalog.currentRaid.name} · ${rows[0]?.availability?.difficulty?.name||requestedDifficulty}${watch?' · WATCH':''}`);
const initial=[];for(const row of rows)initial.push(compact(row,await inspect(row)));
console.log(JSON.stringify({mode:watch?'watch':execute?'execute':'preview',raid:{name:catalog.currentRaid.name,zoneId:catalog.currentRaid.zoneId,bosses:rows.length},difficulty:{id:difficulty,name:rows[0]?.availability?.difficulty?.name||requestedDifficulty},networkExecuted:false,scopes:initial},null,2));
if(!execute){console.log('\nOK: raid preparation preview completed at zero network. Add --execute for one bounded pass or --watch for unattended checkpoint/resume.');process.exit(0);}

async function runPass(passNumber=1){
  let totalSteps=0,rateLimited=false,earliestResumeAt=null,progressed=false;const final=[];
  const throttle=(error,name,stage)=>{const resumeAt=noteRaw429({error,boss:name,stage});earliestResumeAt=earliestResumeAt==null?resumeAt:Math.min(earliestResumeAt,resumeAt);rateLimited=true;};
  console.log(`\nPASS ${passNumber}${watch?' · unattended':''}`);
  for(const row of rows){
    const name=row.boss.name,availability=row.availability;if(!availability||availability.status!=='public-evidence-available'){final.push({boss:name,status:'waiting-for-public-evidence',availability:availability?.status||'unknown',publicSources:Number(availability?.publicSources||0),liveReady:false,dataReady:false,coverageStatus:null,corpus:null});continue;}
    let state=await inspect(row),status=state.corpus,bossSteps=0;
    if(!state.operational){
      if(status?.status==='paused'){const why=compactError(status.message||status.lastError||status.error);console.log(`PAUSED · ${name} · ${status.phase||'unknown'} · manual inspection required${why?` · ${why}`:''}; continuing other automatically safe scopes.`);final.push(compact(row,state));continue;}
      if(!status){
        try{status=await startCorpus({...state.scope,corpusProfile:'operational',targetPulls:100,deepTargetPulls:20,maxCandidateReports:500,maxRankingPages:4,maxSourcePages:2});clearRaw429();progressed=true;console.log(`START · ${name} · ${availability.difficulty?.name} · ${status.status}/${status.phase}`);}
        catch(error){if(isRawWcl429(error)){throttle(error,name,'start-corpus');final.push(compact(row,await inspect(row)));break;}throw error;}
      }
      while(totalSteps<maxTotal&&bossSteps<maxPerBoss&&status&&(status.status==='running'||status.status==='rate-limited')){
        if(status.status==='rate-limited'&&Number(status.resumeAt)>Date.now()){
          const resumeAt=Number(status.resumeAt);earliestResumeAt=earliestResumeAt==null?resumeAt:Math.min(earliestResumeAt,resumeAt);console.log(`RATE LIMIT · ${name} checkpoint until ${new Date(resumeAt).toISOString()}`);rateLimited=true;break;
        }
        try{status=await stepCorpus({...state.scope,corpusProfile:'operational',targetPulls:100,deepTargetPulls:20,maxCandidateReports:500,maxRankingPages:4,maxSourcePages:2});clearRaw429();}
        catch(error){if(isRawWcl429(error)){throttle(error,name,'step-corpus');break;}throw error;}
        bossSteps++;totalSteps++;progressed=true;
        if(bossSteps===1||bossSteps%25===0||status.status!=='running')console.log(`[${totalSteps}/${maxTotal}] ${name} · ${status.status}/${status.phase} · ${Number(status.pullCount||0)} wide · ${Number(status.deepPullCount||0)} deep · ${Number(status.sourceStats?.total||0)} sources`);
      }
      if(rateLimited){state=await inspect(row);if(!final.some(x=>x.boss===name))final.push(compact(row,state));console.log('CHECKPOINT · transient WCL throttle; persisted corpus state is safe.');break;}
      if(status?.status==='ready'){console.log(`CANONICALIZE · ${name} · zero-WCL HOME/source isolation rebuild`);await recompileCorpusModelV2({...state.scope,corpusProfile:'operational'});progressed=true;}
      state=await inspect(row);
    }
    if(state.operational&&rehearse&&state.rehearsal?.liveReady!==true){
      const preview=state.rehearsal||await previewOperationalRehearsalV1({...state.scope,reports});
      const currentReview=preview.status==='coverage-review'&&preview.stored&&String(preview.stored.rehearsalFingerprint||'')===String(preview.fingerprint||'');
      if(currentReview&&!forceRehearsal){
        const saved=preview.stored;console.log(`REHEARSAL SKIP · ${name} · current-contract coverage-review ${saved?.coverage?.observedMechanics||0}/${saved?.coverage?.packMechanics||0} mechanics · no WCL repeated. Use --force-rehearsal only after intentional model change.`);
      }else if(preview.selectedReports?.length){
        const legacy=preview.storedPrevious?.status==='coverage-review';console.log(`REHEARSAL · ${name} · ${preview.selectedReports.length} deterministic canonical reports${legacy?' · legacy review invalidated by execution-contract change':''}`);
        try{const result=await executeOperationalRehearsalV1({...state.scope,reports,confirmExecution:true,previewFingerprint:preview.fingerprint});clearRaw429();progressed=true;console.log(`REHEARSAL RESULT · ${name} · ${result.status} · ${result.coverage.observedMechanics}/${result.coverage.packMechanics} mechanics · ${result.coverage.coveragePct}% coverage`);}
        catch(error){if(isRawWcl429(error)){throttle(error,name,'rehearsal');final.push(compact(row,await inspect(row)));console.log('CHECKPOINT · rehearsal throttled by WCL; persisted readiness/corpus state is safe.');break;}throw error;}
      }
    }
    state=await inspect(row);final.push(compact(row,state));
    if(rateLimited||totalSteps>=maxTotal){if(rateLimited)console.log('CHECKPOINT · WCL throttle reached; persisted state is safe.');else console.log('CHECKPOINT · pass step budget reached; persisted state is safe.');break;}
  }
  for(const row of rows){if(final.some(x=>x.boss===row.boss.name))continue;final.push(compact(row,await inspect(row)));}
  const summary=summarize(final);
  console.log(JSON.stringify({mode:watch?'watch':'execute',pass:passNumber,raid:{name:catalog.currentRaid.name,zoneId:catalog.currentRaid.zoneId},difficulty:{id:difficulty,name:rows[0]?.availability?.difficulty?.name||requestedDifficulty},steps:totalSteps,summary,scopes:final,evidenceContract:{sameDifficultyOnly:true,homeExcludedFailClosed:true,dataReadyDoesNotImplyLiveReady:true,rehearsalDoesNotTrain:true,rehearsalDoesNotPromote:true,unchangedCoverageReviewIsNotRepeated:true,legacyCoverageReviewRehearsedOnceAfterContractChange:true,rawWcl429IsTransientCheckpoint:true,automaticPromotion:false}},null,2));
  return{final,summary,totalSteps,rateLimited,earliestResumeAt,progressed};
}

let pass=0;
while(true){
  const result=await runPass(++pass),s=result.summary;
  const automaticTerminal=s.liveReady+s.coverageReview+s.waiting+s.paused===s.total;
  if(!watch){console.log(s.liveReady===s.total?'\nOK: every public scope in this raid+difficulty is LIVE READY.':'\nCHECKPOINT: rerun with --execute for another bounded pass, or use --watch to resume automatically. Current-contract COVERAGE REVIEW is persisted and will not be repeated unless explicitly forced.');break;}
  if(automaticTerminal){console.log(`\nWATCH COMPLETE · ${s.liveReady} LIVE READY · ${s.coverageReview} COVERAGE REVIEW · ${s.paused} PAUSED · ${s.waiting} WAITING. No automatically safe work remains.`);break;}
  if(result.rateLimited){
    const resumeAt=Number(result.earliestResumeAt||0),waitMs=Math.max(5000,resumeAt-Date.now()+1500);console.log(`\nWATCH SLEEP · WCL checkpoint/throttle · resume ${resumeAt?new Date(resumeAt).toISOString():'after safety delay'} · ${(waitMs/60000).toFixed(1)} min. Leave this process running; Ctrl+C stops safely.`);await sleep(waitMs);continue;
  }
  if(result.totalSteps>=maxTotal||s.notStarted>0||s.building>0||s.rehearsalRequired>0){console.log('\nWATCH CONTINUE · starting another bounded pass from persisted checkpoints.');await sleep(1000);continue;}
  if(!result.progressed){console.log('\nWATCH STOP · no progress was possible and no timed checkpoint can be resumed automatically. Inspect PAUSED/COVERAGE REVIEW scopes.');break;}
}
