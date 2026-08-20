import { spawnSync } from 'node:child_process';
import { readdir,readFile,stat } from 'node:fs/promises';
import process from 'node:process';

const roots=['routes','server','scripts','public'];
const files=[];
async function walk(path){for(const name of await readdir(path)){if(['node_modules','dist','.git','coverage'].includes(name))continue;const full=`${path}/${name}`,s=await stat(full);if(s.isDirectory())await walk(full);else if(/\.(?:mjs|js)$/.test(name))files.push(full);}}
for(const root of roots)await walk(root);
let failures=0;
for(const file of files.sort()){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status===0){console.log(`[verify:vercel] OK      ${file}`);continue;}failures++;console.error(`[verify:vercel] SYNTAX  ${file}`);if(result.stdout)process.stderr.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);}
try{const vercel=JSON.parse(await readFile('vercel.json','utf8')),deployment=vercel?.git?.deploymentEnabled||{};if(deployment.main!==true||deployment['*']!==false)throw new Error('vercel.json must deploy main only and disable branch previews');console.log('[verify:vercel] OK      vercel.json main-only deployment contract');}catch(error){failures++;console.error(`[verify:vercel] CONTRACT vercel.json: ${error?.message||error}`);}
try{
  const pkg=JSON.parse(await readFile('package.json','utf8'));
  if(pkg?.engines?.node!=='22.x')throw new Error('package.json engines.node must remain 22.x');
  if(pkg?.dependencies?.workflow!=='5.0.0-beta.36')throw new Error('workflow dependency pin changed');
  if(pkg?.dependencies?.nitro!=='3.0.260610-beta')throw new Error('nitro dependency pin changed');
  if(pkg?.dependencies?.['@vercel/blob']!=='2.6.1')throw new Error('@vercel/blob dependency pin changed');
  if(pkg?.scripts?.['test:critical']!=='node --test tests/critical/*.test.mjs')throw new Error('critical test gate missing');
  if(!String(pkg?.scripts?.build||'').includes('test:critical'))throw new Error('build must run critical tests');
  for(const command of ['prepare:boss','prepare:raid','validate:operational-rehearsal'])if(!pkg?.scripts?.[command])throw new Error(`${command} command missing`);
  const index=await readFile('index.html','utf8');
  if(index.includes('/wcl-runtime.js'))throw new Error('index.html must not auto-load legacy WCL runtime');
  if(index.includes('/wcl-bootstrap-v389.js'))throw new Error('index.html must not wait on automatic WCL bootstrap');
  for(const asset of ['/avoid-execution-context-v3911.js','/avoid-operational-ui-v3912.js','/avoid-mechanics-state-v3912.js','/avoid-mechanics-global-context-v3912.js','/avoid-live-safe-fallback-v3912.js','/avoid-live-ui-stability-v3912.js'])if(!index.includes(asset))throw new Error(`runtime asset missing: ${asset}`);
  console.log('[verify:vercel] OK      package pins + offline/operational runtime contracts');
}catch(error){failures++;console.error(`[verify:vercel] CONTRACT package/index: ${error?.message||error}`);}
if(failures){console.error(`[verify:vercel] FAILED · ${failures} problem${failures===1?'':'s'}`);process.exit(1);}console.log(`[verify:vercel] PASS · ${files.length} recursive syntax checks + deployment contracts`);
