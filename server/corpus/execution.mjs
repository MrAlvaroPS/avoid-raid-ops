import { activateCorpusExecution, attachWorkflowRun } from './service.mjs';
import { isVercelRuntime } from './storage.mjs';

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
