import { corpusGet, corpusList, corpusStorageStatus } from '../server/corpus/storage.mjs';
import { activateCorpusExecution } from '../server/corpus/service.mjs';
import { stepCorpusV376 } from '../server/corpus/corpus-step-v376.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const POLL_MS=Math.max(500,Number(process.env.IRIS_LOCAL_POLL_MS)||2000);
const BATCH_STEPS=Math.max(1,Math.min(8,Number(process.env.IRIS_LOCAL_BATCH_STEPS)||4));
let stopping=false;
const lastLine=new Map();

function argsFromJobKey(key){
  const match=String(key||'').match(/^jobs\/(\d+)\/d(\d+)\/p(\d+)\.json$/);
  if(!match)return null;
  return {encounterId:Number(match[1]),difficulty:Number(match[2]),partition:Number(match[3])};
}

function due(job){
  if(job?.status==='running')return true;
  if(job?.status==='rate-limited')return !Number(job.resumeAt)||Date.now()>=Number(job.resumeAt);
  return false;
}

function stateLine(args,state){
  const id=`${args.encounterId}/d${args.difficulty}/p${args.partition}`;
  const status=state?.status||'unknown';
  const phase=state?.phase||'—';
  const wide=Number(state?.pullCount||0);
  const deep=Number(state?.deepPullCount||0);
  const failed=Number(state?.failedCount||0);
  const message=String(state?.message||'').replace(/\s+/g,' ').slice(0,180);
  return `[Iris ${id}] ${status} · ${phase} · wide ${wide} · deep ${deep} · failed ${failed}${message?` · ${message}`:''}`;
}

function printChanged(args,state){
  const id=`${args.encounterId}/d${args.difficulty}/p${args.partition}`;
  const line=stateLine(args,state);
  if(lastLine.get(id)===line)return;
  lastLine.set(id,line);
  console.log(line);
}

async function ensureLocalExecution(args,job){
  if(job?.activeExecutionToken&&job?.executionMode==='local-worker')return String(job.activeExecutionToken);
  const token=crypto.randomUUID();
  await activateCorpusExecution({...args,executionMode:'local-worker'},token);
  return token;
}

async function processJob(key){
  const args=argsFromJobKey(key);
  if(!args)return false;
  const job=await corpusGet(key);
  if(!job||!due(job))return false;
  const executionToken=await ensureLocalExecution(args,job);
  const input={...args,executionToken,executionMode:'local-worker'};

  let state=null;
  for(let i=0;i<BATCH_STEPS&&!stopping;i++){
    state=await stepCorpusV376(input);
    printChanged(args,state);
    if(!state||state.executionSuperseded||state.status!=='running')break;
  }
  return true;
}

async function main(){
  const storage=await corpusStorageStatus();
  if(storage.kind!=='local-filesystem'){
    throw new Error(`Iris local worker refuses non-local corpus storage (${storage.kind}).`);
  }

  console.log('IRIS LOCAL WORKER');
  console.log(`Storage: ${storage.localDir}`);
  console.log(`Poll: ${POLL_MS}ms · batch: ${BATCH_STEPS} steps`);
  console.log('Knowledge: GLOBAL BOSS = encounter+difficulty+partition · HOME RAID kept separate');
  console.log('Waiting for local corpus jobs. Ctrl+C stops the worker safely; checkpoints stay on disk.');

  while(!stopping){
    const keys=(await corpusList('jobs/')).filter(key=>argsFromJobKey(key));
    let worked=false;
    for(const key of keys){
      if(stopping)break;
      try{worked=(await processJob(key))||worked;}
      catch(error){console.error(`[Iris worker] ${key}:`,error instanceof Error?error.stack||error.message:String(error));}
    }
    await sleep(worked?Math.min(POLL_MS,1000):POLL_MS);
  }
}

process.on('SIGINT',()=>{stopping=true;console.log('\n[Iris worker] stopping after current checkpoint...');});
process.on('SIGTERM',()=>{stopping=true;});

main().catch(error=>{
  console.error('[Iris worker] fatal:',error instanceof Error?error.stack||error.message:String(error));
  process.exitCode=1;
});
