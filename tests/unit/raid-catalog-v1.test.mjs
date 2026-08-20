import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRaidCatalogV1 } from '../../server/knowledge/raid-catalog-v1.mjs';
import { ensureRaidOfficialKnowledgeV1 } from '../../server/knowledge/raid-official-bootstrap-v1.mjs';

const zones=[
  {id:70,name:'Old Raid',frozen:true,expansion:{id:9,name:'Expansion X'},difficulties:[{id:5,name:'Mythic'}],partitions:[{id:2,name:'Old',compactName:'O',default:true}],encounters:[{id:7001,name:'Old Boss',journalID:17001}]},
  {id:71,name:'Current Raid',frozen:false,expansion:{id:9,name:'Expansion X'},difficulties:[{id:5,name:'Mythic'}],partitions:[{id:3,name:'Season',compactName:'S',default:true}],encounters:[{id:7101,name:'Alpha',journalID:17101},{id:7102,name:'Beta',journalID:17102}]},
  {id:99,name:'Dungeon',frozen:false,expansion:{id:9,name:'Expansion X'},difficulties:[{id:10,name:'Mythic+'}],encounters:[{id:9901,name:'Dungeon Boss',journalID:19901}]},
];

test('raid catalog selects newest non-frozen Mythic raid without boss constants or reports',()=>{
  const catalog=compileRaidCatalogV1(zones);
  assert.equal(catalog.currentRaid.zoneId,71);
  assert.equal(catalog.currentRaid.encounters.length,2);
  assert.equal(catalog.currentRaid.encounters[0].journalEncounterId,17101);
  assert.equal(catalog.currentRaid.defaultPartition.id,3);
  assert.equal(catalog.selection.hardcodedZoneId,false);
  assert.equal(catalog.evidenceContract.reportRequired,false);
  assert.equal(catalog.evidenceContract.wclCombatEventCalls,0);
});

test('official raid bootstrap fills every boss from cache/provider without combat logs',async()=>{
  const catalog=compileRaidCatalogV1(zones);
  let resolved=0;
  const result=await ensureRaidOfficialKnowledgeV1(catalog,{
    loadOfficial:async id=>id===7101?{fingerprint:'a'.repeat(40),encounter:{name:'Alpha'},source:{namespace:'static-test'},graph:{sectionCount:4,spellCount:2,officialMembershipEdges:2,maxDepth:2},abilities:[{abilityId:21001,name:'A1',memberships:[]}]}:null,
    resolveOfficial:async input=>{resolved++;return{fingerprint:'b'.repeat(40),encounter:{name:'Beta'},source:{namespace:'static-test'},graph:{sectionCount:5,spellCount:3,officialMembershipEdges:3,maxDepth:2},abilities:[{abilityId:22001,name:'B1',memberships:[]}],usage:{oauthCalls:1,blizzardGameDataCalls:1},requested:input};},
  });
  assert.equal(result.summary.bosses,2);
  assert.equal(result.summary.officialReady,2);
  assert.equal(resolved,1);
  assert.equal(result.bosses[0].source,'cache');
  assert.equal(result.bosses[1].source,'blizzard');
  assert.equal(result.evidenceContract.reportRequired,false);
  assert.equal(result.usage.wclCombatEventCalls,0);
});
