import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CORPUS_DEFAULTS, clampCorpusConfig } from '../../server/corpus/config.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('v3.6 hosted research defaults to a cautious 1K validation run',()=>{
  assert.equal(CORPUS_DEFAULTS.targetPulls,1000);
  assert.equal(CORPUS_DEFAULTS.deepTargetPulls,200);
  assert.equal(CORPUS_DEFAULTS.maxTargetPulls,25000);
  assert.ok(CORPUS_DEFAULTS.minimumRateLimitReservePct>=0.15);
  assert.ok(CORPUS_DEFAULTS.minimumRateLimitReservePoints>=500);
  assert.equal(clampCorpusConfig({targetPulls:5000,deepTargetPulls:600}).targetPulls,5000);
});

test('boss publication adds independent-source and pull-outcome balance gates',()=>{
  assert.equal(CORPUS_DEFAULTS.maxSourceReportShareToPublish,.10);
  assert.equal(CORPUS_DEFAULTS.maxSourcePullShareToPublish,.12);
  assert.equal(CORPUS_DEFAULTS.maxDeepSourceReportShareToPublish,.20);
  assert.ok(CORPUS_DEFAULTS.minSourcesPerOutcomeToPublish>=4);
  assert.ok(CORPUS_DEFAULTS.minDeepSourcesPerOutcomeToPublish>=2);
});

test('Vercel corpus storage is private, persistent and uses consistent reads',async()=>{
  const src=await read('../../server/corpus/storage.mjs');
  assert.match(src,/@vercel\/blob/);
  assert.match(src,/access:'private'/);
  assert.match(src,/allowOverwrite:true/);
  assert.match(src,/useCache:false/);
  assert.doesNotMatch(src,/assertHostedToken/);
  assert.doesNotMatch(src,/local-fallback/);
});

test('corpus workflow is durable and keeps side effects inside a step',async()=>{
  const src=await read('../../workflows/corpus-build.js');
  assert.match(src,/"use workflow"/);
  assert.match(src,/"use step"/);
  assert.match(src,/from 'workflow'/);
  assert.doesNotMatch(src,/workflow\/sleep/);
  assert.match(src,/stepCorpusV376/);
  assert.doesNotMatch(src,/candidates:/);
});

test('corpus execution provider keeps Vercel Workflow hosted and local worker explicit',async()=>{
  const api=await read('../../routes/api/wcl/corpus.js');
  const execution=await read('../../server/corpus/execution.mjs');
  const worker=await read('../../scripts/iris-local-worker.mjs');
  assert.match(api,/launchCorpusExecution/);
  assert.match(api,/corpusExecutionDescriptor/);
  assert.match(api,/workflowRunId/);
  assert.match(execution,/import\('workflow\/api'\)/);
  assert.match(execution,/corpusBuildWorkflow/);
  assert.match(execution,/activateCorpusExecution/);
  assert.match(execution,/vercel-workflow/);
  assert.match(execution,/local-worker/);
  assert.match(worker,/stepCorpusV376/);
  assert.match(worker,/local-filesystem/);
});

test('canonical compile and recompile rebalance persisted profiles without WCL calls',async()=>{
  const step=await read('../../server/corpus/corpus-step-v376.mjs');
  const rebuild=await read('../../server/corpus/canonical-rebuild-v2.mjs');
  const serviceV2=await read('../../server/corpus/service-v2.mjs');
  assert.match(step,/rebuildCanonicalBossCorpus/);
  assert.match(rebuild,/buildBalancedBossSample/);
  assert.match(rebuild,/globalBossSamplingKey/);
  assert.doesNotMatch(rebuild,/wclGraphql|fetchRankingPage|fetchWideProfile|fetchDeepProfile/);
  assert.match(serviceV2,/RECOMPILE · 0 WCL/);
});

test('global boss ingestion excludes AvoiD guild and configured home uploaders before expensive wide/deep persistence',async()=>{
  const wide=await read('../../server/corpus/wide-profile.mjs');
  const deep=await read('../../server/corpus/deep-profile-v373.mjs');
  assert.match(wide,/isHomeSourceProfile\(header\)/);
  assert.match(wide,/sanitizeGlobalBossProfile/);
  assert.match(deep,/isHomeSourceProfile\(header\)/);
  assert.match(deep,/attachOriginEvidenceV373[\s\S]*sanitizeGlobalBossProfile/);
});

test('local enrich reuses persisted discovery before spending WCL points on known identities',async()=>{
  const execution=await read('../../server/corpus/execution.mjs');
  assert.match(execution,/reusePersistedLocalDiscovery/);
  assert.match(execution,/candidateRemaining/);
  assert.match(execution,/hasDiscoverySnapshot/);
  assert.match(execution,/job\.phase='wide'/);
  assert.match(execution,/reusing persisted discovery snapshot/);
  assert.match(execution,/if\(!hosted\)await reusePersistedLocalDiscovery/);
});

test('duplicate local improve requests reuse the active job instead of extending targets again',async()=>{
  const api=await read('../../routes/api/wcl/corpus.js');
  assert.match(api,/execution\.runtime === 'local'/);
  assert.match(api,/active\.status === 'running'/);
  assert.match(api,/active\.status === 'rate-limited'/);
  assert.match(api,/reusedExistingJob: true/);
  assert.match(api,/reusedExistingJob:Boolean\(launched\.reusedExistingJob\)/);
});

test('v375 owns the visible corpus card so compatibility polling cannot tear it down',async()=>{
  const html=await read('../../index.html');
  const guard=await read('../../public/corpus-ui-stability-v1.js');
  assert.match(html,/encounter-intelligence-v375\.js[\s\S]*corpus-ui-stability-v1\.js/);
  assert.match(guard,/nativeCorpusRenderer/);
  assert.match(guard,/encounter-intelligence-v375/);
  assert.match(guard,/window\.applyCorpusWorkbench = function stableCorpusWorkbench/);
  assert.match(guard,/legacyPollingRendererSuppressed: true/);
});

test('compatibility runtime polls hosted workflow and keeps corpus panel above mechanic catalogue',async()=>{
  const runtime=await read('../../deploy-preview/public/wcl-runtime.js');
  assert.match(runtime,/pollCorpus/);
  assert.doesNotMatch(runtime,/corpusRequest\("step"\)/);
  assert.match(runtime,/insertAdjacentElement\("beforebegin", panel\)/);
  assert.match(runtime,/\[1000, 5000, 10000\]/);
  assert.match(runtime,/Math\.min\(1500, Math\.max\(200/);
});


test('hosted status payload stays compact instead of returning candidate/report arrays',async()=>{
  const src=await read('../../server/corpus/service.mjs');
  const start=src.indexOf('async function publicJob');
  const end=src.indexOf('export async function getCorpusHealth',start);
  const block=src.slice(start,end);
  assert.doesNotMatch(block,/return\{\.\.\.job/);
  assert.match(block,/candidateCount:/);
  assert.match(block,/processedWideCount:/);
  assert.match(block,/lastFailure:/);
});

test('Vite/Nitro Workflow integration is pinned for Vercel deployment',async()=>{
  const pkg=JSON.parse(await read('../../package.json'));
  const vite=await read('../../vite.config.js');
  assert.equal(pkg.dependencies['@vercel/blob'],'2.6.1');
  assert.equal(pkg.dependencies.workflow,'5.0.0-beta.36');
  assert.equal(pkg.dependencies.nitro,'3.0.260610-beta');
  assert.equal(pkg.engines.node,'22.x');
  assert.match(vite,/nitro\(\)/);
  assert.doesNotMatch(vite,/workflow\(\)/);
  const nitroConfig=await read('../../nitro.config.js');
  assert.match(nitroConfig,/workflow\/nitro/);
  assert.match(nitroConfig,/serverDir: '\.\/'/);
});

test('workflow uses Nitro native integration and does not emit a second Vercel build output',async()=>{
  const vite=await read('../../vite.config.js');
  const nitroConfig=await read('../../nitro.config.js');
  assert.doesNotMatch(vite,/workflow\/vite/);
  assert.doesNotMatch(vite,/workflow\(\)/);
  assert.match(vite,/nitro\(\)/);
  assert.match(nitroConfig,/modules:\s*\['workflow\/nitro'\]/);
});


test('Nitro routes avoid Vercel top-level api double compilation', async()=>{
  const { access } = await import('node:fs/promises');
  const root = new URL('../../', import.meta.url);
  await access(new URL('routes/api/wcl/corpus.js', root));
  await assert.rejects(() => access(new URL('api', root)));
  const nitroConfig=await read('../../nitro.config.js');
  assert.match(nitroConfig,/serverDir: '\.\/'/);
});
