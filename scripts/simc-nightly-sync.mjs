import { syncSimcNightlyV1, simcFreshnessV1 } from '../server/loot/simc-manager-v1.mjs';
import { simcWorkerStatusV1 } from '../server/loot/simc-runner-v1.mjs';

const args=new Set(process.argv.slice(2));
const force=args.has('--force'),ensure=args.has('--ensure'),statusOnly=args.has('--status');
const manual=String(process.env.SIMC_PATH||'').trim();

console.log('\nSimulationCraft nightly manager');
if(manual){
  const status=await simcWorkerStatusV1();
  console.log(JSON.stringify({mode:'manual-override',SIMC_PATH:manual,worker:status},null,2));
  if(!status.available){console.error('\nSIMC_PATH is configured but invalid.');if(!ensure)process.exitCode=2;}
  else console.log('\nOK: manual SIMC_PATH override is active; automatic nightly promotion is intentionally bypassed.');
  process.exit();
}

if(statusOnly){const [freshness,worker]=await Promise.all([simcFreshnessV1(),simcWorkerStatusV1()]);console.log(JSON.stringify({freshness,worker},null,2));process.exit(worker.available?0:2);}

const result=await syncSimcNightlyV1({force});
console.log(JSON.stringify(result,null,2));
const worker=await simcWorkerStatusV1();
console.log('\nResolved worker');
console.log(JSON.stringify(worker,null,2));

if(result.status==='updated')console.log(`\nUPDATED: ${result.current?.filename||''} · commit ${result.current?.commit||'unknown'}`);
else if(result.status==='already-current'||result.status==='fresh-check-not-due')console.log(`\nCURRENT: ${worker.nightly?.filename||worker.path||'SimulationCraft'}${worker.nightly?.commit?` · ${worker.nightly.commit}`:''}`);
else if(result.status==='update-failed-using-current')console.warn(`\nWARNING: nightly update failed; continuing with previously verified commit ${worker.nightly?.commit||'unknown'}.`);
else console.warn(`\nWARNING: no managed SimulationCraft worker is currently available. ${result.error?.message||worker.reason||''}`);

if(!worker.available&&!ensure)process.exitCode=2;
