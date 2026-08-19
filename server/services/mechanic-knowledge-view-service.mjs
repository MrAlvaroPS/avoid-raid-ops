import { loadAnyEncounterModel } from '../corpus/service.mjs';
import { aggregateKey,corpusId } from '../corpus/keys.mjs';
import { corpusGet,corpusList } from '../corpus/storage.mjs';
import { aggregateSummary } from '../corpus/aggregate.mjs';
import { evaluateMatchedNullBaselineV1 } from '../corpus/matched-null-baseline-v1.mjs';
import { buildIndependentEvidenceGroupsV1 } from '../corpus/independent-evidence-groups-v1.mjs';
import { buildStatisticalStabilityV1 } from '../corpus/statistical-stability-v1.mjs';
import { buildUntouchedHoldoutReservationV1 } from '../corpus/untouched-holdout-v1.mjs';
import { buildMechanicKnowledgeViewV1 } from '../corpus/mechanic-knowledge-view-v1.mjs';
import { loadLatestOfficialEncounterGraphByWclIdV1 } from '../knowledge/official-encounter-store-v1.mjs';
import { loadLatestSpellStructuralKnowledgeV1 } from '../knowledge/spell-structural-store-v1.mjs';

export const MECHANIC_KNOWLEDGE_VIEW_SERVICE_VERSION='iris-mechanic-knowledge-view-service-v1';

async function persistedAt(prefix,{storageList=corpusList,storageGet=corpusGet}={}){
  const keys=await storageList(prefix).catch(()=>[]),rows=[];
  for(const key of keys||[]){const value=await storageGet(key).catch(()=>null);if(value)rows.push({key,value});}
  return rows;
}

function empiricalFingerprint(episode){return String(episode?.empiricalBuildFingerprint||episode?.matchedNullEvidenceFingerprint||episode?.buildFingerprint||'');}
function currentEpisodeScore(episode,official,structural){
  let score=0;
  if(episode?.officialReconciliation?.status==='applied')score+=10;
  if(official?.fingerprint&&episode?.officialReconciliation?.graphFingerprint===official.fingerprint)score+=30;
  if(episode?.structuralReconciliation?.status==='applied')score+=10;
  if(structural?.fingerprint&&episode?.structuralReconciliation?.structuralFingerprint===structural.fingerprint)score+=30;
  score+=Math.min(20,Number(episode?.nodes?.length||0));
  return score;
}

function selectEpisodes(rows,official,structural){
  const bySignal=new Map();
  for(const {value} of rows){
    const signalId=Number(value?.anchor?.abilityId||0);if(!signalId)continue;
    const current=bySignal.get(signalId);
    if(!current||currentEpisodeScore(value,official,structural)>currentEpisodeScore(current,official,structural))bySignal.set(signalId,value);
  }
  return [...bySignal.values()].sort((a,b)=>Number(a?.anchor?.abilityId||0)-Number(b?.anchor?.abilityId||0));
}

async function downstreamFor(scope,episode,{storageList=corpusList,storageGet=corpusGet}={}){
  const cid=corpusId(scope),signalId=Number(episode.anchor.abilityId),empirical=empiricalFingerprint(episode);
  const controls=(await persistedAt(`matched-null-baselines/${cid}/${signalId}/${empirical}/evidence/`,{storageList,storageGet})).map(row=>row.value);
  const matchedNull=evaluateMatchedNullBaselineV1({episode,controlRecords:controls});
  const evidenceGroups=buildIndependentEvidenceGroupsV1({episode,matchedNullEvaluation:matchedNull,controlRecords:controls});
  const stability=buildStatisticalStabilityV1({evidenceGroups});
  const episodeBuild=String(episode.buildFingerprint||'');
  const holdoutBase=`untouched-holdout/${cid}/${signalId}/${episodeBuild}`;
  const [holdoutReservation,holdoutResult]=await Promise.all([
    storageGet(`${holdoutBase}/reservation-latest.json`).catch(()=>null),
    storageGet(`${holdoutBase}/result-latest.json`).catch(()=>null),
  ]);
  const reservation=holdoutReservation||buildUntouchedHoldoutReservationV1({stability,sourceCandidates:[]});
  return{controls,matchedNull,evidenceGroups,stability,holdoutReservation:reservation,holdoutResult};
}

export async function loadMechanicKnowledgeViewV1(input={},options={}){
  const storageGet=options.storageGet||corpusGet,storageList=options.storageList||corpusList;
  const raw=await (options.loadModel||loadAnyEncounterModel)(input);
  if(!raw)return null;
  const scope={
    encounterId:Number(raw.encounterId||input.encounterId),
    difficulty:Number(raw.difficulty||input.difficulty||5),
    partition:Number(raw.resolvedPartition??raw.partition??input.partition??0),
  };
  if(!scope.encounterId||!scope.difficulty||!scope.partition)throw new Error('Resolved encounter/difficulty/partition is required for Iris Mechanics Knowledge');
  const [aggregate,official,structural,episodeRows]=await Promise.all([
    storageGet(aggregateKey(scope)).catch(()=>null),
    (options.loadOfficial||loadLatestOfficialEncounterGraphByWclIdV1)(scope.encounterId,{storageGet}).catch(()=>null),
    (options.loadStructural||loadLatestSpellStructuralKnowledgeV1)(scope.encounterId,{storageGet}).catch(()=>null),
    persistedAt(`mechanic-episodes/${corpusId(scope)}/`,{storageList,storageGet}),
  ]);
  const episodes=selectEpisodes(episodeRows,official,structural),corpus=aggregate?aggregateSummary(aggregate):null;
  const encounterName=official?.encounter?.name||aggregate?.encounter?.name||raw?.encounterName||raw?.name||null;
  const mechanics=[];
  for(const episode of episodes){
    const downstream=await downstreamFor(scope,episode,{storageList,storageGet});
    mechanics.push(buildMechanicKnowledgeViewV1({scope,encounterName,aggregateSummary:corpus,officialGraph:official,structuralKnowledge:structural,episode,...downstream}));
  }
  return{
    version:MECHANIC_KNOWLEDGE_VIEW_SERVICE_VERSION,
    generatedAt:Date.now(),
    scope,encounter:{name:encounterName,journalEncounterId:official?.encounter?.journalEncounterId||null},
    sources:{
      official:official?{status:'ready',provider:'blizzard-game-data',fingerprint:official.fingerprint,namespace:official?.source?.namespace||null,sectionCount:Number(official?.graph?.sectionCount||0),spellCount:Number(official?.graph?.spellCount||0),membershipEdges:Number(official?.graph?.officialMembershipEdges||0)}:{status:'not-available'},
      structural:structural?{status:'ready',provider:'wago-db2',fingerprint:structural.fingerprint,build:structural?.provider?.build||null,relations:Number(structural?.relations?.length||0),seedAbilities:Number(structural?.seedAbilityIds?.length||0),resolvedQueries:Number(structural?.coverage?.resolvedQueries||0),queryCount:Number(structural?.coverage?.queryCount||0)}:{status:'not-available'},
      corpus:corpus?{status:'ready',...corpus}:{status:'not-available'},
    },
    summary:{mechanicInvestigations:mechanics.length,promotionPending:mechanics.filter(row=>row?.episode?.lifecycle==='promotion-pending').length,accepted:0,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0},
    mechanics,
    evidenceContract:{readOnly:true,persistedEvidenceOnly:true,wclCombatTruthCanonical:true,providerMetadataCannotPromote:true,automaticPromotion:false},
  };
}
