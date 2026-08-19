import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRaidCatalogV1 } from '../../server/knowledge/raid-catalog-v1.mjs';

const zones=[
  {id:601,name:'Synthetic Raid',frozen:false,expansion:{id:99,name:'Synthetic Expansion'},difficulties:[{id:3,name:'Normal',sizes:[10,20]},{id:4,name:'Heroic',sizes:[10,20]},{id:5,name:'Mythic',sizes:[20]}],partitions:[{id:7,name:'Current',default:true}],encounters:[{id:7101,name:'Boss Alpha',journalID:8101}]},
  {id:602,name:'Synthetic Dungeon',frozen:false,expansion:{id:99,name:'Synthetic Expansion'},difficulties:[{id:5,name:'Mythic',sizes:[5]}],partitions:[],encounters:[{id:7201,name:'Dungeon Boss',journalID:8201}]},
];
const officialRaids=[{id:9001,name:'Synthetic Raid'}];
const officialInstances=[{id:9001,name:'Synthetic Raid',modes:[{name:'Normal'},{name:'Heroic'},{name:'Mythic'}],encounters:[{id:8101,name:'Boss Alpha'},{id:8102,name:'Boss Beta'}]}];

test('Blizzard official raid classification wins and does not mistake dungeon zones for raids',()=>{
  const catalog=compileRaidCatalogV1(zones,{officialRaids,officialInstances});
  assert.equal(catalog.zones.length,1);
  assert.equal(catalog.currentRaid.zoneId,601);
  assert.equal(catalog.currentRaid.name,'Synthetic Raid');
  assert.equal(catalog.currentRaid.classification.source,'blizzard-journal-expansion');
  assert.equal(catalog.selection.hardcodedZoneId,false);
});

test('bosses come from official Journal instance and each carries independent difficulty scopes even before WCL publishes every encounter id',()=>{
  const raid=compileRaidCatalogV1(zones,{officialRaids,officialInstances}).currentRaid;
  assert.equal(raid.encounters.length,2);
  assert.equal(raid.encounters[0].wclEncounterId,7101);
  assert.equal(raid.encounters[1].wclEncounterId,null);
  assert.equal(raid.encounters[1].journalEncounterId,8102);
  assert.deepEqual(raid.encounters[0].difficulties.map(x=>x.id),[3,4,5]);
  assert.deepEqual(raid.encounters[1].difficulties.map(x=>x.id),[3,4,5]);
  assert.equal(raid.encounters[0].knowledgeScope.difficultyRequired,true);
  assert.equal(catalogContract(raid),true);
});

function catalogContract(raid){return raid.encounters.every(boss=>boss.difficulties.every(d=>d.learningScope==='strictly-difficulty-isolated'));}
