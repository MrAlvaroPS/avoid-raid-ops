import { spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import process from 'node:process';

const files = [
  'workflows/corpus-build.js','scripts/iris-local-worker.mjs',
  'routes/api/wcl/report.js','routes/api/wcl/telemetry.js','routes/api/wcl/history.js','routes/api/wcl/intelligence.js','routes/api/wcl/status.js','routes/api/wcl/corpus.js',
  'server/corpus/storage.mjs','server/corpus/execution.mjs','server/corpus/model-policy-v373.mjs','server/corpus/model-policy-v374.mjs','server/corpus/model-policy-v375.mjs','server/corpus/model-policy-v376.mjs','server/corpus/model-policy-v377.mjs','server/corpus/model-policy-v378.mjs','server/corpus/model-policy-v379.mjs','server/corpus/model-policy-v380.mjs','server/corpus/query-guided-deep-v1.mjs','server/corpus/targeted-deep-v373.mjs','server/corpus/surgical-probe-planner-v1.mjs','server/corpus/local-mechanic-synthesis-v1.mjs','server/corpus/deep-profile-v373.mjs','server/corpus/corpus-step-v373.mjs','server/corpus/corpus-step-v375.mjs','server/corpus/corpus-step-v376.mjs','server/corpus/sampling-v2.mjs','server/corpus/canonical-rebuild-v2.mjs','server/corpus/service-v2.mjs',
  'server/knowledge/scopes.mjs','server/knowledge/keys.mjs','server/knowledge/raid-ledger.mjs',
  'server/analysis/progression/raid-sessions.mjs','server/analysis/progression/progress-metrics-v1.mjs','server/analysis/progression/progress-metric-registry-v1.mjs','server/analysis/progression/progress-metrics-v2.mjs','server/analysis/progression/progress-metric-registry-v2.mjs',
  'server/analysis/reliability/reliability-policy-v1.mjs','server/analysis/reliability/reliability-metric-registry-v1.mjs','server/analysis/reliability/evidence-contracts-v1.mjs','server/analysis/reliability/evidence-ledger-v1.mjs','server/analysis/reliability/peer-baseline-v1.mjs','server/analysis/reliability/reliability-engine-v1.mjs','server/analysis/reliability/attendance-history-v1.mjs',
  'server/engines/history-engine.mjs','server/engines/intelligence-engine.mjs','server/wcl/queries/telemetry.mjs','server/corpus/wide-profile.mjs','server/corpus/source-expansion.mjs',
  'public/iris-runtime-v3713.js','public/progress-runtime-v3713.js','public/encounter-intelligence-v375.js','public/corpus-ui-stability-v1.js','public/player-intelligence-v386.js'
];

let failures = 0;
for (const file of files) {
  try { await access(file); }
  catch { console.error(`[verify:vercel] MISSING ${file}`); failures++; continue; }
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(result.status===0){console.log(`[verify:vercel] OK      ${file}`);continue;}
  failures++;console.error(`[verify:vercel] SYNTAX  ${file}`);if(result.stdout)process.stderr.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
}

try{
  const vercel=JSON.parse(await readFile('vercel.json','utf8'));const deployment=vercel?.git?.deploymentEnabled||{};
  if(deployment.main!==true||deployment['*']!==false)throw new Error('vercel.json must deploy main only and disable branch previews');
  console.log('[verify:vercel] OK      vercel.json main-only deployment contract');
}catch(error){failures++;console.error(`[verify:vercel] CONTRACT vercel.json: ${error?.message||error}`);}

try{
  const pkg=JSON.parse(await readFile('package.json','utf8'));
  if(pkg?.engines?.node!=='22.x')throw new Error('package.json engines.node must remain 22.x');
  if(pkg?.dependencies?.workflow!=='5.0.0-beta.36')throw new Error('workflow dependency pin changed');
  if(pkg?.dependencies?.nitro!=='3.0.260610-beta')throw new Error('nitro dependency pin changed');
  if(pkg?.dependencies?.['@vercel/blob']!=='2.6.1')throw new Error('@vercel/blob dependency pin changed');
  console.log('[verify:vercel] OK      package runtime pins');
}catch(error){failures++;console.error(`[verify:vercel] CONTRACT package.json: ${error?.message||error}`);}

if(failures){console.error(`[verify:vercel] FAILED · ${failures} problem${failures===1?'':'s'}`);process.exit(1);}
console.log(`[verify:vercel] PASS · ${files.length} syntax checks + deployment contracts`);
