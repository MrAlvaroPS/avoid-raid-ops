import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { buildBundledKnowledge } from '../../server/knowledge/game-knowledge-v1.mjs';
import { stageKnowledgeCandidate,activateKnowledgeCandidate } from '../../server/knowledge/knowledge-store-v1.mjs';
import { filterCurrentRaidReports } from '../../server/engines/report-catalog-engine.mjs';
import { getIrisCapabilityContract,findIrisCapability } from '../../server/iris/capability-contract-v390.mjs';

const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL SCREEN ISOLATION: Encounter Corpus is page-owned by Mechanics and cannot be forced visible elsewhere',async()=>{
  const guard=await read('public/corpus-ui-stability-v1.js');
  assert.match(guard,/const PAGE_OWNER = 'Mechanics'/);
  assert.match(guard,/if \(!onMechanics\)/);
  assert.match(guard,/current\.style\.display = 'none'/);
  assert.match(guard,/dataset\.avoidPageOwner/);
  assert.doesNotMatch(guard,/if \(panel\?\.querySelector\('\.encounter-intelligence-v375'\)\) \{\s*panel\.style\.display = '';\s*return;/s,'the old cross-tab visibility bug must not return');
});

test('CRITICAL SCREEN LOAD CONTRACT: every navigation destination has an explicit source component',async()=>{
  const shell=await read('apps/web/src/app/AppShell.js');
  const expected=['Command Center','LIVE','Progress','Pull Lab','Damage & Healing','Mechanics','Defensive Audit','Players','Composition'];
  for(const page of expected)assert.ok(shell.includes(`l===\"${page}\"`)||page==='Composition',`${page} must remain explicitly routable`);
  for(const component of ['CommandCenter','Live','Progress','PullLab','DamageHealing','Mechanics','DefensiveAudit','Players','Composition'])assert.match(shell,new RegExp(`import \\{ ${component} \\}`));
});

test('CRITICAL UI RHYTHM: runtime cards use the same 12px spacing contract and nested corpus content adds no second margin',async()=>{
  const css=await read('public/raidops-v390.css');
  assert.match(css,/--raidops-card-gap:12px/);
  assert.match(css,/\.canvas>\.corpus-workbench[^\{]*\{[^}]*var\(--raidops-card-gap\)/s);
  assert.match(css,/\.corpus-workbench \.encounter-intelligence-v375\{margin:0\}/);
});

test('CRITICAL PLAYERS UX: roster is not trapped in the legacy short internal scroller before using its column height',async()=>{
  const [css,index]=await Promise.all([read('public/raidops-v390.css'),read('index.html')]);
  assert.match(css,/\.layout-player>\.player-list\{[^}]*max-height:none!important[^}]*overflow:visible!important[^}]*\}/s);
  assert.ok(index.indexOf('/raidops-v390.css?v=3.9.0')>index.indexOf('/raidops-v386.css?v=3.8.6'),'v3.9 Players override must load after the legacy 570px roster cap');
});

test('CRITICAL LOAD UX: Data Hub supports stored fallback, visible activity and controllable live polling',async()=>{
  const source=await read('public/data-hub-v390.js');
  new vm.Script(source,{filename:'data-hub-v390.js'});
  assert.match(source,/CACHE_NAME='avoid-raidops-v390'/);
  assert.match(source,/dataMode==='stored'/);
  assert.match(source,/cacheMatch\(/);
  assert.match(source,/Network unavailable · using stored/);
  assert.match(source,/window\.__AVOID_ACTIVITY__/);
  assert.match(source,/function startLive\(/);
  assert.match(source,/function pauseLive\(/);
  assert.match(source,/function stopLive\(/);
  assert.match(source,/LIVE_POLL_MS=30000/);
  assert.match(source,/data-report/);
  assert.match(source,/location\.assign\(u\.href\)/);
});

test('CRITICAL STORED MODE: report/history/intelligence, Encounter Corpus and Iris capability GETs are cache-backed without making POST actions offline',async()=>{
  const source=await read('public/data-hub-v390.js');
  for(const endpoint of ['/api/wcl/report','/api/wcl/history','/api/wcl/intelligence','/api/wcl/corpus','/api/iris/capabilities'])assert.ok(source.includes(`'${endpoint}'`),`${endpoint} must be available to stored mode`);
  assert.match(source,/method==='GET'&&CACHEABLE\.has\(url\.pathname\)/,'only GET requests may use the offline cache');
  assert.match(source,/No stored snapshot for/);
});

test('CRITICAL LIVE BUDGET: rich refresh is change-driven after a closed pull, never unconditional on every 30s status tick',async()=>{
  const source=await read('public/data-hub-v390.js');
  assert.match(source,/changed=lastLiveFingerprint!==null&&fingerprint!==lastLiveFingerprint/);
  assert.match(source,/if\(changed&&!inProgress\)document\.querySelector\('\.wcl button'\)\?\.click\(\)/);
  assert.doesNotMatch(source,/if\(!status\?\.encounter\?\.latestFight\?\.inProgress\)document\.querySelector\('\.wcl button'\)\?\.click\(\)/,'closed status alone must not trigger a rich refresh every tick');
  assert.match(source,/liveTickCount%4===0/,'catalogue refresh should stay slower than live status polling');
});

test('CRITICAL REPORT SCOPE: only exact current-raid zone survives; dungeon/old-raid noise cannot leak in',()=>{
  const reports=filterCurrentRaidReports([
    {code:'CURRENT',title:'Raid night',startTime:300,zone:{id:44,name:'Current Raid'}},
    {code:'MPLUS',title:'+15 dungeon',startTime:400,zone:{id:39,name:'Mythic+ Dungeon'}},
    {code:'OLD',title:'Old raid',startTime:500,zone:{id:12,name:'Legacy Raid'}},
    {code:'CURRENT2',title:'Current raid alt logger',startTime:200,zone:{id:44,name:'Current Raid'}},
  ],{zoneId:44,selectedCode:'CURRENT'});
  assert.deepEqual(reports.map(report=>report.code),['CURRENT','CURRENT2']);
  assert.equal(reports[0].selected,true);
});

test('CRITICAL REPORT SCOPE: catalogue query uses exact zone and forbids title heuristics',async()=>{
  const engine=await read('server/engines/report-catalog-engine.mjs');
  const query=await read('server/wcl/queries/report-catalog.mjs');
  assert.match(query,/zoneID:\$zoneId/);
  assert.match(engine,/selectedReportCannotChangeScope:true/);
  assert.match(engine,/mythicPlus:'excluded by exact raid zone scope'/);
  assert.match(engine,/unrelatedRaids:'excluded by exact raid zone scope'/);
  assert.match(engine,/titleHeuristics:false/);
  assert.doesNotMatch(engine,/title\.includes|title\.match|RegExp\(.*title/i);
});

test('CRITICAL KNOWLEDGE: revision contains versioned encounter/ability/aura entities and Wowhead remains reference-only',()=>{
  const snapshot=buildBundledKnowledge({patch:'test-patch',season:'test-season',build:'test-build'});
  assert.equal(snapshot.modelVersion,'game-knowledge-v1');
  assert.match(snapshot.revision,/^retail:test-season:test-patch:test-build:/);
  assert.ok(snapshot.entities.some(entity=>entity.type==='encounter'));
  assert.ok(snapshot.entities.some(entity=>entity.type==='boss-ability'));
  assert.ok(snapshot.entities.some(entity=>entity.type==='aura'));
  assert.ok(snapshot.entities.some(entity=>entity.references?.some(ref=>ref.provider==='wowhead-reference')));
  assert.match(snapshot.evidenceContract.wowhead,/reference\/enrichment only/i);
  assert.match(snapshot.evidenceContract.activation,/never immutable raw WCL facts/i);
});

test('CRITICAL KNOWLEDGE ACTIVATION: activating a candidate persists revision and marks derived data for reindex without rewriting raw evidence',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'avoid-knowledge-'));
  const previous=process.env.IRIS_DATA_DIR;process.env.IRIS_DATA_DIR=dir;
  try{
    const candidate=buildBundledKnowledge({patch:'critical',season:'season',build:'build'});
    await stageKnowledgeCandidate(candidate);
    const state=await activateKnowledgeCandidate();
    assert.equal(state.active.revision,candidate.revision);
    assert.equal(state.candidate,null);
    assert.equal(state.activation.derivedDataPolicy,'invalidate-and-rederive');
    assert.equal(state.activation.rawEvidencePolicy,'immutable');
    assert.equal(state.activation.reindexStatus,'required');
    assert.equal(state.persistence,'local-fs');
  }finally{
    if(previous===undefined)delete process.env.IRIS_DATA_DIR;else process.env.IRIS_DATA_DIR=previous;
    await rm(dir,{recursive:true,force:true});
  }
});

test('CRITICAL KNOWLEDGE REINDEX: activation invalidates derived browser snapshots and refreshes the current screen',async()=>{
  const source=await read('public/knowledge-reindex-v390.js');
  new vm.Script(source,{filename:'knowledge-reindex-v390.js'});
  for(const endpoint of ['/api/wcl/report','/api/wcl/status','/api/wcl/telemetry','/api/wcl/history','/api/wcl/intelligence'])assert.ok(source.includes(`'${endpoint}'`));
  assert.match(source,/cache\.delete\(request\)/);
  assert.match(source,/document\.querySelector\('\.wcl button'\)\?\.click\(\)/);
  assert.match(source,/rawEvidence:'immutable'/);
});

test('CRITICAL KNOWLEDGE SCHEMA: revisioned entities and derived snapshot staleness have durable DB contracts',async()=>{
  const schema=await read('server/storage/schema/001_game_knowledge.sql');
  assert.match(schema,/create table if not exists knowledge_revision/i);
  assert.match(schema,/create table if not exists game_entity/i);
  assert.match(schema,/create table if not exists game_entity_reference/i);
  assert.match(schema,/create table if not exists derived_snapshot_revision/i);
  assert.match(schema,/knowledge_revision text references knowledge_revision\(revision\)/i);
  assert.match(schema,/stale integer not null default 0/i);
});

test('CRITICAL IRIS CAPABILITIES: management permissions are machine-readable, versioned and do not overclaim unfinished work',()=>{
  const contract=getIrisCapabilityContract();
  assert.equal(contract.version,'iris-capabilities-v1');
  assert.ok(contract.documentation.includes('IRIS-OPERATIONS.md'));
  for(const id of ['activity.inspect','data.use-stored','logs.sync-latest','logs.load-history','logs.select-report','live.start','live.pause','live.stop','knowledge.inspect','knowledge.stage-refresh','knowledge.activate','knowledge.reindex-browser','knowledge.reindex-durable','corpus.inspect-stored','corpus.semantic-probe.preview','corpus.semantic-probe.execute','corpus.mutate'])assert.ok(findIrisCapability(id),`${id} must remain discoverable by Iris`);
  assert.equal(findIrisCapability('logs.sync-latest').autonomy,'bounded');
  assert.equal(findIrisCapability('logs.select-report').autonomy,'operatorRequested');
  assert.equal(findIrisCapability('knowledge.activate').autonomy,'explicitApproval');
  assert.equal(findIrisCapability('knowledge.activate').effect,'invalidate-derived');
  assert.equal(findIrisCapability('knowledge.reindex-durable').status,'planned');
  assert.equal(findIrisCapability('knowledge.reindex-durable').autonomy,'unavailable');
  assert.equal(findIrisCapability('knowledge.provider-wowhead').status,'reference-only');
  assert.equal(findIrisCapability('corpus.semantic-probe.preview').autonomy,'automatic');
  assert.match(findIrisCapability('corpus.semantic-probe.preview').description,/0 WCL/i);
  assert.equal(findIrisCapability('corpus.semantic-probe.execute').autonomy,'explicitApproval');
  assert.equal(findIrisCapability('corpus.semantic-probe.execute').effect,'diagnostic-network-read');
  assert.match(findIrisCapability('corpus.semantic-probe.execute').description,/0 Deep reports/);
  assert.match(findIrisCapability('corpus.semantic-probe.execute').description,/no automatic mechanic promotion/i);
  assert.equal(contract.invariants.rawEvidence,'immutable');
  assert.match(contract.invariants.semanticProbeEvidence,/diagnostic-only/i);
});

test('CRITICAL SEMANTIC PROBE GATE: execution remains fingerprinted/manual while preview remains a 0-WCL surface',async()=>{
  const route=await read('routes/api/wcl/semantic-probe.js');
  assert.match(route,/GET supports only preview or result/);
  assert.match(route,/confirmExecution!==true/);
  assert.match(route,/Preview fingerprint is missing or stale/);
  assert.match(route,/wclCallsExecuted:0/);
  assert.doesNotMatch(route,/startCorpus|launchCorpusExecution|improveModel/);
});

test('CRITICAL IRIS OPERATIONS: browser bridge exposes the same log/live/knowledge controls without duplicating private DOM button behavior',async()=>{
  const hub=await read('public/data-hub-v390.js');
  const iris=await read('public/iris-runtime-v3713.js');
  assert.match(hub,/window\.__AVOID_IRIS_OPERATIONS__=Object\.freeze/);
  assert.match(hub,/capabilityEndpoint:'\/api\/iris\/capabilities'/);
  for(const token of ['syncLatest:()=>syncCatalog(21,true)','loadHistory:()=>syncCatalog(180,true)','selectReport','start:startLive','pause:pauseLive','stop:stopLive','status:loadKnowledge','stage:refreshKnowledge','activate:activateKnowledge'])assert.ok(hub.includes(token),`${token} must remain on the Iris operations bridge`);
  assert.match(iris,/capabilityContract:'iris-capabilities-v1'/);
  assert.match(iris,/capabilityEndpoint:'\/api\/iris\/capabilities'/);
  assert.match(iris,/operationsBridge:'window\.__AVOID_IRIS_OPERATIONS__'/);
  assert.match(iris,/managedDomains:Object\.freeze\(\['activity','data-mode','logs','live','knowledge','corpus'\]\)/);
});

test('CRITICAL IRIS DOCUMENTATION: architecture and operations docs explicitly bind Iris to management capabilities and truth limits',async()=>{
  const [architecture,operations,plan,agents]=await Promise.all([read('IRIS-ARCHITECTURE.md'),read('IRIS-OPERATIONS.md'),read('V3.9-REFACTOR-PLAN.md'),read('AGENTS.md')]);
  assert.match(architecture,/v3\.9 operational management plane/i);
  assert.match(architecture,/GET \/api\/iris\/capabilities/);
  assert.match(operations,/window\.__AVOID_IRIS_OPERATIONS__/);
  assert.match(operations,/Raw Warcraft Logs evidence is immutable/);
  assert.match(operations,/planned`? capability as already available/i);
  assert.match(plan,/Iris operations-management contract/);
  assert.match(agents,/Read `IRIS-ARCHITECTURE\.md` and `IRIS-OPERATIONS\.md`/);
  assert.match(agents,/Semantic probe execution is explicit and diagnostic/);
});

test('CRITICAL RELEASE WIRING: v3.9.3 provider knowledge overlays v3.9.2 Players without changing screen ownership',async()=>{
  const [index,pkgText,hub,reindex]=await Promise.all([read('index.html'),read('package.json'),read('public/data-hub-v390.js'),read('public/knowledge-reindex-v390.js')]);
  const pkg=JSON.parse(pkgText);
  const bootstrap=index.indexOf('/wcl-bootstrap-v389.js?v=3.8.9.1');
  const dataHub=index.indexOf('/data-hub-v390.js?v=3.9.0');
  const knowledgeReindex=index.indexOf('/knowledge-reindex-v390.js?v=3.9.0');
  const runtime=index.indexOf('/wcl-runtime.js?v=3.8.5');
  const players=index.indexOf('/player-intelligence-v392.js?v=3.9.2');
  assert.equal(pkg.version,'0.3.9-3-vercel.0');
  assert.equal(getIrisCapabilityContract().release,'3.9.3');
  assert.match(hub,/const RELEASE='3\.9\.0'/);
  assert.match(reindex,/const RELEASE='3\.9\.0'/);
  assert.ok(index.includes('/raidops-v390.css?v=3.9.0'));
  assert.ok(index.includes('/raidops-v392.css?v=3.9.2'));
  assert.ok(bootstrap>=0&&dataHub>bootstrap&&knowledgeReindex>dataHub&&runtime>knowledgeReindex&&players>runtime);
  assert.ok(index.includes('/corpus-ui-stability-v1.js?v=1.1.0'));
});