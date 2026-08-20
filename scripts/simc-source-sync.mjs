import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { syncSimcSourceBuildV1, simcSourceFreshnessV1 } from '../server/loot/simc-source-manager-v1.mjs';
import { simcWorkerStatusV1 } from '../server/loot/simc-runner-v1.mjs';

const args=new Set(process.argv.slice(2));
const statusOnly=args.has('--status'),force=args.has('--force');
const envPath=resolve('.env.local');

async function persistSimcPath(path){
  if(!path)return;
  let text='';try{text=await readFile(envPath,'utf8');}catch{}
  const line=`SIMC_PATH="${String(path).replaceAll('"','')}"`;
  if(/^SIMC_PATH=.*$/m.test(text))text=text.replace(/^SIMC_PATH=.*$/m,line);else text=`${text.trimEnd()}${text.trim()?"\n":""}${line}\n`;
  await writeFile(envPath,text,'utf8');
}

console.log('\nSimulationCraft verified source-build manager');
console.log('Policy: resolve the official nightly commit, fetch that exact source from simulationcraft/simc, and build CLI-only locally. Downloaded Windows nightly executables are not used.');

if(statusOnly){
  const source=await simcSourceFreshnessV1();
  if(source.current?.path)process.env.SIMC_PATH=source.current.path;
  const worker=await simcWorkerStatusV1();
  console.log(JSON.stringify({source,worker},null,2));
  process.exit(worker.available?0:2);
}

const result=await syncSimcSourceBuildV1({force});
console.log(JSON.stringify(result,null,2));
if(result.current?.path){
  await persistSimcPath(result.current.path);
  process.env.SIMC_PATH=result.current.path;
  console.log(`\nSIMC_PATH persisted to .env.local -> ${result.current.path}`);
}
const worker=await simcWorkerStatusV1();
console.log('\nResolved worker');
console.log(JSON.stringify(worker,null,2));

if(result.status==='toolchain-missing'){
  console.error('\nSOURCE BUILD TOOLCHAIN MISSING.');
  console.error(result.toolchain?.requirements||'Git, CMake and a C++ compiler are required.');
  console.error('On Windows, the official SimC instructions use Visual Studio 2022/Build Tools with the Desktop development with C++ workload. Qt is NOT required for our CLI-only build.');
  process.exitCode=3;
}else if(result.status==='build-failed-no-current'){
  console.error(`\nSOURCE BUILD FAILED: ${result.error?.message||'unknown error'}`);
  console.error('No downloaded/quarantined nightly executable was executed.');
  process.exitCode=4;
}else if(!worker.available){
  console.error('\nSource build exists but Raid Ops could not resolve the worker.');
  process.exitCode=5;
}else{
  console.log(`\nREADY: SimulationCraft source build ${result.current?.commit||worker.path}`);
}
