import { loadLatestOfficialEncounterGraphByWclIdV1,loadLatestOfficialEncounterGraphV1 } from './official-encounter-store-v1.mjs';
import { resolveOfficialEncounterKnowledgeV1 } from './official-encounter-knowledge-v1.mjs';
import { compileOfficialEncounterDifficultyViewV1 } from './official-encounter-difficulty-v1.mjs';
import { persistOfficialEncounterDifficultyViewV1 } from './official-encounter-difficulty-store-v1.mjs';
import { loadLatestJournalDifficultySnapshotV1,persistJournalDifficultySnapshotV1 } from './journal-difficulty-store-v1.mjs';
import { fetchWagoJournalDifficultySnapshotV1 } from './providers/wago-db2-journal-difficulty-v1.mjs';
import { wagoBuildFromBlizzardNamespaceV1 } from './providers/wago-db2-spell-effect-v1.mjs';

export const RAID_OFFICIAL_BOOTSTRAP_VERSION='raid-official-bootstrap-v2';

async function loadGraph(encounter,{loadByWcl=loadLatestOfficialEncounterGraphByWclIdV1,loadByJournal=loadLatestOfficialEncounterGraphV1}={}){
  if(encounter.wclEncounterId){const graph=await loadByWcl(encounter.wclEncounterId).catch(()=>null);if(graph)return graph;}
  return loadByJournal(encounter.journalEncounterId).catch(()=>null);
}

export async function ensureRaidOfficialKnowledgeV1(catalog,{region='eu',locale='en_US',force=false,loadByWcl=loadLatestOfficialEncounterGraphByWclIdV1,loadByJournal=loadLatestOfficialEncounterGraphV1,resolveOfficial=resolveOfficialEncounterKnowledgeV1,loadDifficultySnapshot=loadLatestJournalDifficultySnapshotV1,fetchDifficultySnapshot=fetchWagoJournalDifficultySnapshotV1,persistDifficultySnapshot=persistJournalDifficultySnapshotV1,persistDifficultyView=persistOfficialEncounterDifficultyViewV1}={}){
  const raid=catalog?.currentRaid;if(!raid?.encounters?.length)throw new Error('current raid catalog with encounters is required');
  const resolvedBosses=[];let blizzardGameDataCalls=0,oauthCalls=0,wagoCalls=0;
  for(const encounter of raid.encounters){
    let graph=null,source='cache';if(!force)graph=await loadGraph(encounter,{loadByWcl,loadByJournal});
    if(!graph){source='blizzard';graph=await resolveOfficial({journalEncounterId:encounter.journalEncounterId,wclEncounterId:encounter.wclEncounterId||null,region,locale});blizzardGameDataCalls+=Number(graph?.usage?.blizzardGameDataCalls||0);oauthCalls+=Number(graph?.usage?.oauthCalls||0);}
    resolvedBosses.push({encounter,graph,source});
  }

  const namespace=resolvedBosses.map(row=>row.graph?.source?.namespace).find(Boolean)||null;
  let difficultySnapshot=null,difficultySource='unavailable';
  if(namespace){
    try{
      const build=wagoBuildFromBlizzardNamespaceV1(namespace);
      if(!force)difficultySnapshot=await loadDifficultySnapshot(build).catch(()=>null);
      if(difficultySnapshot)difficultySource='cache';
      else{difficultySnapshot=await fetchDifficultySnapshot({build});wagoCalls+=Number(difficultySnapshot?.usage?.networkCalls||0);difficultySnapshot=await persistDifficultySnapshot(difficultySnapshot);difficultySource='wago-db2';}
    }catch{difficultySnapshot=null;difficultySource='unavailable';}
  }

  const bosses=[];
  for(const {encounter,graph,source} of resolvedBosses){
    const difficulties=[];
    for(const difficulty of encounter.difficulties||raid.difficulties||[]){
      const view=compileOfficialEncounterDifficultyViewV1({officialGraph:graph,difficulty,journalDifficultySnapshot:difficultySnapshot});
      const stored=await persistDifficultyView(view);
      difficulties.push({id:Number(difficulty.id),name:difficulty.name||`Difficulty ${difficulty.id}`,fingerprint:stored.fingerprint,applicability:stored.applicability,sectionCount:Number(stored.graph?.sectionCount||0),spellCount:Number(stored.graph?.spellCount||0),spellMembershipCount:Number(stored.graph?.officialMembershipEdges||0),abilities:stored.abilities.map(row=>({abilityId:Number(row.abilityId),name:row.name||null,difficultyApplicability:row.difficultyApplicability,memberships:row.memberships||[]}))});
    }
    bosses.push({wclEncounterId:encounter.wclEncounterId||null,journalEncounterId:encounter.journalEncounterId,name:graph?.encounter?.name||encounter.name||null,officialStatus:graph?'ready':'unavailable',source,fingerprint:graph?.fingerprint||null,namespace:graph?.source?.namespace||null,sectionCount:Number(graph?.graph?.sectionCount||0),spellCount:Number(graph?.graph?.spellCount||0),spellMembershipCount:Number(graph?.graph?.officialMembershipEdges||0),maxDepth:Number(graph?.graph?.maxDepth||0),difficulties});
  }
  return{
    version:RAID_OFFICIAL_BOOTSTRAP_VERSION,
    raid:{zoneId:raid.zoneId,journalInstanceId:raid.journalInstanceId||null,name:raid.name,expansion:raid.expansion,partition:raid.defaultPartition||null,difficulties:raid.difficulties||[]},
    difficultyApplicability:{status:difficultySnapshot?'ready':'unresolved',source:difficultySource,provider:'wago-db2',build:difficultySnapshot?.build||null,fingerprint:difficultySnapshot?.fingerprint||null},
    bosses,
    summary:{bosses:bosses.length,officialReady:bosses.filter(row=>row.officialStatus==='ready').length,difficultyViews:bosses.reduce((sum,row)=>sum+row.difficulties.length,0),difficultyScopedAbilities:bosses.reduce((sum,row)=>sum+row.difficulties.reduce((s,d)=>s+d.abilities.length,0),0)},
    usage:{oauthCalls,blizzardGameDataCalls,wagoCalls,wclMetadataCalls:0,wclCombatEventCalls:0},
    evidenceContract:{officialPublishedSemantics:true,difficultyScoped:true,crossDifficultyComparisonForbidden:true,normalHeroicCannotCountAsMythicEvidence:true,observedOccurrence:false,combatTruth:'WCL observed combat remains separate and difficulty scoped.',reportRequired:false,automaticPromotion:false},
  };
}
