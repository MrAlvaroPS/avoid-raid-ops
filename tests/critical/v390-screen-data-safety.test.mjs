import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { buildBundledKnowledge } from '../../server/knowledge/game-knowledge-v1.mjs';
import { stageKnowledgeCandidate,activateKnowledgeCandidate } from '../../server/knowledge/knowledge-store-v1.mjs';
import { filterCurrentRaidReports } from '../../server/engines/report-catalog-engine.mjs';

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

test('CRITICAL RELEASE WIRING: v3.9 activity/data runtime and styles are active before report consumers',async()=>{
  const index=await read('index.html');
  const bootstrap=index.indexOf('/wcl-bootstrap-v389.js?v=3.8.9.1');
  const hub=index.indexOf('/data-hub-v390.js?v=3.9.0-refactor');
  const runtime=index.indexOf('/wcl-runtime.js?v=3.8.5');
  assert.ok(index.includes('/raidops-v390.css?v=3.9.0-refactor'));
  assert.ok(bootstrap>=0&&hub>bootstrap&&runtime>hub);
  assert.ok(index.includes('/corpus-ui-stability-v1.js?v=1.1.0'));
});
