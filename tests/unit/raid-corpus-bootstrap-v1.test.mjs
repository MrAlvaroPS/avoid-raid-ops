import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRaidCorpusBootstrapPreviewV1,startRaidCorpusFoundationV1 } from '../../server/corpus/raid-corpus-bootstrap-v1.mjs';

const catalog={fingerprint:'c'.repeat(40),currentRaid:{zoneId:900,name:'Synthetic Raid',defaultPartition:{id:7,name:'Patch'},encounters:[{journalEncounterId:7001,wclEncounterId:8001,name:'Synthetic Boss',difficulties:[{id:1,name:'LFR'},{id:3,name:'Normal'},{id:4,name:'Heroic'},{id:5,name:'Mythic'}]}]}};
const learning={fingerprint:'l'.repeat(40),catalogFingerprint:catalog.fingerprint,scopes:[
  {zoneId:900,raidName:'Synthetic Raid',journalEncounterId:7001,wclEncounterId:8001,bossName:'Synthetic Boss',difficulty:{id:1,name:'LFR'},partition:7,status:'public-evidence-available',publicSources:8},
  {zoneId:900,raidName:'Synthetic Raid',journalEncounterId:7001,wclEncounterId:8001,bossName:'Synthetic Boss',difficulty:{id:3,name:'Normal'},partition:7,status:'public-evidence-available',publicSources:9},
  {zoneId:900,raidName:'Synthetic Raid',journalEncounterId:7001,wclEncounterId:8001,bossName:'Synthetic Boss',difficulty:{id:4,name:'Heroic'},partition:7,status:'public-evidence-available',publicSources:7},
  {zoneId:900,raidName:'Synthetic Raid',journalEncounterId:7001,wclEncounterId:8001,bossName:'Synthetic Boss',difficulty:{id:5,name:'Mythic'},partition:7,status:'no-public-evidence-yet',publicSources:0},
]};

test('raid corpus preview is difficulty-scoped, excludes LFR by default and starts only public progression scopes',async()=>{
  const preview=await buildRaidCorpusBootstrapPreviewV1({catalog,learningPlan:learning,getStatus:async()=>null});
  assert.equal(preview.networkUpperBound.previewWclCalls,0);
  assert.deepEqual(preview.scopes.map(row=>row.difficulty.name),['Normal','Heroic','Mythic']);
  assert.deepEqual(preview.scopes.map(row=>row.bootstrapStatus),['startable-foundation','startable-foundation','waiting-for-public-evidence']);
  assert.equal(preview.summary.startableScopes,2);
  assert.equal(preview.profile.corpusProfile,'foundation');
  assert.equal(preview.evidenceContract.foundationIsAcceptedKnowledge,false);
  assert.equal(preview.evidenceContract.crossDifficultyComparisonForbidden,true);
});

test('existing same-difficulty corpus is reused instead of restarted',async()=>{
  const preview=await buildRaidCorpusBootstrapPreviewV1({catalog,learningPlan:learning,getStatus:async({difficulty})=>difficulty===3?{corpusId:'8001/d3/p7',status:'completed',phase:'complete',pullCount:321,deepPullCount:64,sourceStats:{total:22}}:null});
  assert.equal(preview.scopes.find(row=>row.difficulty.id===3).bootstrapStatus,'reference-ready');
  assert.equal(preview.scopes.find(row=>row.difficulty.id===4).bootstrapStatus,'startable-foundation');
});

test('foundation start is fingerprinted, bounded and never starts unavailable Mythic',async()=>{
  const preview=await buildRaidCorpusBootstrapPreviewV1({catalog,learningPlan:learning,getStatus:async()=>null});
  const calls=[];
  const result=await startRaidCorpusFoundationV1({preview,confirmExecution:true,previewFingerprint:preview.fingerprint,maxNewScopes:1,start:async input=>{calls.push(input);return{corpusId:`${input.encounterId}/d${input.difficulty}/p${input.partition}`,status:'running',phase:'discover-ranking'};}});
  assert.equal(calls.length,1);assert.equal(calls[0].difficulty,3);assert.equal(calls[0].corpusProfile,'foundation');
  assert.ok(calls.every(call=>call.difficulty!==5));
  assert.equal(result.usage.wclCombatEventCalls,0);assert.equal(result.evidenceContract.automaticPromotion,false);
  await assert.rejects(()=>startRaidCorpusFoundationV1({preview,confirmExecution:true,previewFingerprint:'wrong',start:async()=>({})}),/fingerprint mismatch/);
});

test('learning availability must belong to the same current raid catalog',async()=>{
  await assert.rejects(()=>buildRaidCorpusBootstrapPreviewV1({catalog,learningPlan:{...learning,catalogFingerprint:'other'},getStatus:async()=>null}),/does not belong/);
});
