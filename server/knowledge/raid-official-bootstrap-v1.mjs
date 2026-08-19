import { loadLatestOfficialEncounterGraphByWclIdV1 } from './official-encounter-store-v1.mjs';
import { resolveOfficialEncounterKnowledgeV1 } from './official-encounter-knowledge-v1.mjs';

export const RAID_OFFICIAL_BOOTSTRAP_VERSION='raid-official-bootstrap-v1';

export async function ensureRaidOfficialKnowledgeV1(catalog,{region='eu',locale='en_US',force=false}={}){
  const raid=catalog?.currentRaid;
  if(!raid?.encounters?.length)throw new Error('current raid catalog with encounters is required');
  const bosses=[];let blizzardGameDataCalls=0,oauthCalls=0;
  for(const encounter of raid.encounters){
    let graph=null,source='cache';
    if(!force)graph=await loadLatestOfficialEncounterGraphByWclIdV1(encounter.wclEncounterId).catch(()=>null);
    if(!graph){
      source='blizzard';
      const resolved=await resolveOfficialEncounterKnowledgeV1({journalEncounterId:encounter.journalEncounterId,wclEncounterId:encounter.wclEncounterId,region,locale});
      graph=resolved;
      blizzardGameDataCalls+=Number(resolved?.usage?.blizzardGameDataCalls||0);
      oauthCalls+=Number(resolved?.usage?.oauthCalls||0);
    }
    bosses.push({
      wclEncounterId:encounter.wclEncounterId,
      journalEncounterId:encounter.journalEncounterId,
      name:graph?.encounter?.name||encounter.name||null,
      officialStatus:graph?'ready':'unavailable',
      source,
      fingerprint:graph?.fingerprint||null,
      namespace:graph?.source?.namespace||null,
      sectionCount:Number(graph?.graph?.sectionCount||0),
      spellCount:Number(graph?.graph?.spellCount||0),
      spellMembershipCount:Number(graph?.graph?.officialMembershipEdges||0),
      maxDepth:Number(graph?.graph?.maxDepth||0),
      abilities:(graph?.abilities||[]).map(row=>({abilityId:Number(row.abilityId),name:row.name||null,memberships:row.memberships||[]})),
    });
  }
  return{
    version:RAID_OFFICIAL_BOOTSTRAP_VERSION,
    raid:{zoneId:raid.zoneId,name:raid.name,expansion:raid.expansion,partition:raid.defaultPartition||null},
    bosses,
    summary:{bosses:bosses.length,officialReady:bosses.filter(row=>row.officialStatus==='ready').length,abilities:bosses.reduce((sum,row)=>sum+row.abilities.length,0)},
    usage:{oauthCalls,blizzardGameDataCalls,wclMetadataCalls:0,wclCombatEventCalls:0},
    evidenceContract:{officialOnly:true,observedOccurrence:false,combatTruth:'WCL observed combat remains separate.',reportRequired:false,automaticPromotion:false},
  };
}
