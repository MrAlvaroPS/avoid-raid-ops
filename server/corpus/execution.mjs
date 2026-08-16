import { activateCorpusExecution, attachWorkflowRun } from './service.mjs';
import { isVercelRuntime, corpusGet, corpusSet } from './storage.mjs';
import { corpusAliasKey, jobKey } from './keys.mjs';

async function resolveExecutionArgs(input={}){
  const args={encounterId:Number(input.encounterId),difficulty:Number(input.difficulty||5),partition:Number(input.partition||0)};
  if(args.partition>0)return args;
  const alias=await corpusGet(corpusAliasKey(args));
  if(!(Number(alias?.partition)>0))return null;
  return {...args,partition:Number(alias.partition)};
}

async function reusePersistedLocalDiscovery(input={}){
  if(String(input.mode||'')!=='enrich')return false;
  const args=await resolveExecutionArgs(input);if(!args)return false;
  const key=jobKey(args),job=await corpusGet(key);if(!job||job.mode!=='enrich')return false;
  const processed=new Set(job.processedWide||[]),candidates=job.candidates||[];
  const candidateRemaining=candidates.some(code=>!processed.has(code));
  const hasDiscoverySnapshot=(job.seedReports||[]).length>0&&(job.sourceQueue||[]).length>0;
  if(!candidateRemaining||!hasDiscoverySnapshot)return false;
  job.phase='wide';
  job.rankingExhausted=true;
  job.seedCursor=(job.seedReports||[]).length;
  job.updatedAt=Date.now();
  job.message=`LOCAL ENRICH · reusing persisted discovery snapshot (${candidates.length.toLocaleString()} candidates, ${(job.sourceQueue||[]).length.toLocaleString()} sources) instead of re-querying known report identities.`;
  await corpusSet(key,job);
  return true;
}

export function corpusExecutionDescriptor(){
  if(isVercelRuntime()){
    return {
      runtime:'vercel',
      corpusBuilder:'vercel-workflow',
      workflow:{enabled:true,durable:true},
      worker:{enabled:false,required:false},
    };
  }
  return {
    runtime:'local',
    corpusBuilder:'local-worker',
    workflow:{enabled:false,durable:false},
    worker:{enabled:true,required:true,command:'npm run iris',persistentCheckpoints:true},
  };
}

export async function launchCorpusExecution(input={}){
  const executionToken=crypto.randomUUID();
  const hosted=isVercelRuntime();
  const executionMode=hosted?'vercel-workflow':'local-worker';
  const executionInput={...input,executionToken,executionMode};

  if(!hosted)await reusePersistedLocalDiscovery(executionInput);
  let status=await activateCorpusExecution(executionInput,executionToken);

  if(!hosted){
    return {status,workflowRunId:null,executionToken,executionMode};
  }

  const [{start},{corpusBuildWorkflow}]=await Promise.all([
    import('workflow/api'),
    import('../../workflows/corpus-build.js'),
  ]);
  const run=await start(corpusBuildWorkflow,[executionInput]);
  status=await attachWorkflowRun(executionInput,executionToken,run.runId);
  return {status,workflowRunId:run.runId,executionToken,executionMode};
}
