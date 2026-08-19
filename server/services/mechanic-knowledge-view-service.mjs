import { loadAnyEncounterModel } from '../corpus/service.mjs';
import { aggregateKey,corpusId } from '../corpus/keys.mjs';
import { corpusGet,corpusList } from '../corpus/storage.mjs';
import { aggregateSummary } from '../corpus/aggregate.mjs';
import { evaluateMatchedNullBaselineV1 } from '../corpus/matched-null-baseline-v1.mjs';
import { buildIndependentEvidenceGroupsV1 } from '../corpus/independent-evidence-groups-v1.mjs';
import { buildStatisticalStabilityV1 } from '../corpus/statistical-stability-v1.mjs';
import { buildUntouchedHoldoutReservationV1 } from '../corpus/untouched-holdout-v1.mjs';
import { buildMechanicKnowledgeViewV1 } from '../corpus/mechanic-knowledge-view-v1.mjs';
import { loadLatestOfficialEncounterGraphByWclIdV1,loadLatestOfficialEncounterGraphV1 } from '../knowledge/official-encounter-store-v1.mjs';
import { loadLatestOfficialEncounterDifficultyViewV1 } from '../knowledge/official-encounter-difficulty-store-v1.mjs';
import { compileOfficialEncounterDifficultyViewV1 } from '../knowledge/official-encounter-difficulty-v1.mjs';
import { loadLatestSpellStructuralKnowledgeV1 } from '../knowledge/spell-structural-store-v1.mjs';
import { buildSpellStructuralDifficultyViewV1 } from '../knowledge/spell-structural-difficulty-v1.mjs';
import { loadRaidLearningScopeV1 } from '../knowledge/raid-learning-plan-store-v1.mjs';

export const MECHANIC_KNOWLEDGE_VIEW_SERVICE_VERSION='iris-mechanic-knowledge-view-service-v5';
const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};

async function persistedAt(prefix,{storageList=corpusList,storageGet=corpusGet}={}){const keys=await storageList(prefix).catch(()=>[]),rows=[];for(const key of keys||[]){const value=await storageGet(key).catch(()=>null);if(value)rows.push({key,value});}return rows;}
function empiricalFingerprint(episode){return String(episode?.empiricalBuildFingerprint||episode?.matchedNullEvidenceFingerprint||episode?.buildFingerprint||'');}
function currentEpisodeScore(episode,official,structural){let score=0;if(episode?.officialReconciliation?.status==='applied')score+=10;if(official?.fingerprint&&episode?.officialReconciliation?.graphFingerprint===official.fingerprint)score+=30;if(episode?.structuralReconciliation?.status==='applied')score+=10;if(structural?.fingerprint&&episode?.structuralReconciliation?.structuralFingerprint===structural.fingerprint)score+=30;score+=Math.min(20,Number(episode?.nodes?.length||0));return score;}
function selectEpisodes(rows,official,structural){const bySignal=new Map();for(const {value} of rows){const signalId=Number(value?.anchor?.abilityId||0);if(!signalId)continue;const current=bySignal.get(signalId);if(!current||currentEpisodeScore(value,official,structural)>currentEpisodeScore(current,official,structural))bySignal.set(signalId,value);}return[...bySignal.values()].sort((a,b)=>Number(a?.anchor?.abilityId||0)-Number(b?.anchor?.abilityId||0));}

function officialMechanics(graph){
  if(!graph)return[];const groups=new Map();
  for(const ability of graph.abilities||[])for(const membership of ability.memberships||[]){
    const stage=(membership.sectionPath||[]).find(row=>row.structuralRole==='stage')||null,mechanic=(membership.sectionPath||[]).find(row=>row.structuralRole==='mechanic')||null;
    const key=mechanic?.sectionId?`mechanic:${mechanic.sectionId}`:stage?.sectionId?`stage:${stage.sectionId}`:`ability:${ability.abilityId}`;
    if(!groups.has(key))groups.set(key,{key,name:mechanic?.title||membership.title||ability.name||`Ability ${ability.abilityId}`,stage:stage?{sectionId:stage.sectionId,name:stage.title||null}:null,sectionId:mechanic?.sectionId||membership.sectionId||null,abilities:[]});
    const group=groups.get(key);if(!group.abilities.some(row=>Number(row.abilityId)===Number(ability.abilityId)))group.abilities.push({abilityId:Number(ability.abilityId),name:ability.name||membership.title||null,path:membership.path||[],structuralRole:membership.structuralRole||null,difficultyApplicability:ability.difficultyApplicability||membership.difficultyApplicability||null});
  }
  return[...groups.values()].map(row=>({...row,abilities:row.abilities.sort((a,b)=>a.abilityId-b.abilityId)})).sort((a,b)=>String(a.stage?.name||'').localeCompare(String(b.stage?.name||''))||String(a.name||'').localeCompare(String(b.name||'')));
}

async function downstreamFor(scope,episode,{storageList=corpusList,storageGet=corpusGet}={}){
  const cid=corpusId(scope),signalId=Number(episode.anchor.abilityId),empirical=empiricalFingerprint(episode),controls=(await persistedAt(`matched-null-baselines/${cid}/${signalId}/${empirical}/evidence/`,{storageList,storageGet})).map(row=>row.value);
  const matchedNull=evaluateMatchedNullBaselineV1({episode,controlRecords:controls}),evidenceGroups=buildIndependentEvidenceGroupsV1({episode,matchedNullEvaluation:matchedNull,controlRecords:controls}),stability=buildStatisticalStabilityV1({evidenceGroups});
  const episodeBuild=String(episode.buildFingerprint||''),holdoutBase=`untouched-holdout/${cid}/${signalId}/${episodeBuild}`;
  const [holdoutReservation,holdoutResult]=await Promise.all([storageGet(`${holdoutBase}/reservation-latest.json`).catch(()=>null),storageGet(`${holdoutBase}/result-latest.json`).catch(()=>null)]);
  return{controls,matchedNull,evidenceGroups,stability,holdoutReservation:holdoutReservation||buildUntouchedHoldoutReservationV1({stability,sourceCandidates:[]}),holdoutResult};
}

async function loadOfficialBase({wclEncounterId,journalEncounterId,storageGet,loadByWcl,loadByJournal}){
  if(wclEncounterId){const row=await loadByWcl(wclEncounterId,{storageGet}).catch(()=>null);if(row)return row;}
  if(journalEncounterId)return loadByJournal(journalEncounterId,{storageGet}).catch(()=>null);
  return null;
}

export async function loadMechanicKnowledgeViewV1(input={},options={}){
  const storageGet=options.storageGet||corpusGet,storageList=options.storageList||corpusList;
  const requestedDifficulty=positive(input.difficulty);if(!requestedDifficulty)throw new Error('difficulty is required for Iris Mechanics Knowledge');
  let wclEncounterId=positive(input.encounterId||input.wclEncounterId),journalEncounterId=positive(input.journalEncounterId);
  const officialBase=await loadOfficialBase({wclEncounterId,journalEncounterId,storageGet,loadByWcl:options.loadOfficialByWcl||loadLatestOfficialEncounterGraphByWclIdV1,loadByJournal:options.loadOfficialByJournal||loadLatestOfficialEncounterGraphV1});
  if(officialBase){wclEncounterId=wclEncounterId||positive(officialBase.encounter?.wclEncounterId);journalEncounterId=journalEncounterId||positive(officialBase.encounter?.journalEncounterId);}
  if(!wclEncounterId&&!journalEncounterId)throw new Error('encounter or journal encounter id is required');

  let difficultyOfficial=null;
  if(journalEncounterId)difficultyOfficial=await (options.loadDifficultyOfficial||loadLatestOfficialEncounterDifficultyViewV1)(journalEncounterId,requestedDifficulty,{storageGet}).catch(()=>null);
  if(!difficultyOfficial&&officialBase)difficultyOfficial=compileOfficialEncounterDifficultyViewV1({officialGraph:officialBase,difficulty:{id:requestedDifficulty,name:input.difficultyName||`Difficulty ${requestedDifficulty}`},journalDifficultySnapshot:null});
  const officialView=difficultyOfficial||officialBase;

  const modelInput=wclEncounterId?{encounterId:wclEncounterId,difficulty:requestedDifficulty,partition:Number(input.partition||0)}:null;
  const raw=modelInput?await (options.loadModel||loadAnyEncounterModel)(modelInput).catch(()=>null):null;
  if(raw&&Number(raw.difficulty)!==requestedDifficulty)throw new Error(`Cross-difficulty model load rejected: requested d${requestedDifficulty}, got d${raw.difficulty}`);
  if(!raw&&!officialBase&&!difficultyOfficial)return null;
  const partition=Number(raw?.resolvedPartition??raw?.partition??input.partition??0),scope={encounterId:wclEncounterId||0,difficulty:requestedDifficulty,partition};
  const empiricalAvailable=Boolean(wclEncounterId&&raw&&partition>0);
  const [aggregate,structuralBase,episodeRows,learningAvailability]=await Promise.all([
    empiricalAvailable?storageGet(aggregateKey(scope)).catch(()=>null):Promise.resolve(null),
    wclEncounterId?(options.loadStructural||loadLatestSpellStructuralKnowledgeV1)(wclEncounterId,{storageGet}).catch(()=>null):Promise.resolve(null),
    empiricalAvailable?persistedAt(`mechanic-episodes/${corpusId(scope)}/`,{storageList,storageGet}):Promise.resolve([]),
    wclEncounterId?(options.loadLearningAvailability||loadRaidLearningScopeV1)(wclEncounterId,requestedDifficulty,{storageGet}).catch(()=>null):Promise.resolve(null),
  ]);
  if(aggregate&&Number(aggregate.difficulty??scope.difficulty)!==requestedDifficulty)throw new Error('Cross-difficulty aggregate rejected');
  if(learningAvailability?.scope&&Number(learningAvailability.scope.difficulty?.id)!==requestedDifficulty)throw new Error('Cross-difficulty raid learning availability rejected');
  const structuralView=structuralBase&&officialBase&&difficultyOfficial?buildSpellStructuralDifficultyViewV1({structuralKnowledge:structuralBase,baseOfficialGraph:officialBase,difficultyOfficialView:difficultyOfficial}):structuralBase;
  const episodes=selectEpisodes(episodeRows,officialBase,structuralBase),corpus=aggregate?aggregateSummary(aggregate):null,encounterName=officialView?.encounter?.name||aggregate?.encounter?.name||raw?.encounterName||raw?.name||input.encounterName||null,mechanics=[];
  for(const episode of episodes){
    if(Number(episode?.scope?.difficulty??scope.difficulty)!==requestedDifficulty)throw new Error('Cross-difficulty Episode rejected');
    const downstream=await downstreamFor(scope,episode,{storageList,storageGet});
    mechanics.push(buildMechanicKnowledgeViewV1({scope,encounterName,aggregateSummary:corpus,officialGraph:officialView,structuralKnowledge:structuralView,episode,...downstream}));
  }
  const publishedMechanics=officialMechanics(officialView),publicAvailability=learningAvailability?.scope||null;
  const executionStatus=!wclEncounterId?'wcl-encounter-not-published':empiricalAvailable?'wcl-corpus-available':publicAvailability?.status==='public-evidence-available'?'public-evidence-available-corpus-not-built':publicAvailability?.status||'no-combat-corpus-yet';
  return{
    version:MECHANIC_KNOWLEDGE_VIEW_SERVICE_VERSION,generatedAt:Date.now(),scope,
    encounter:{name:encounterName,wclEncounterId:wclEncounterId||null,journalEncounterId:journalEncounterId||null},
    difficulty:{id:requestedDifficulty,name:difficultyOfficial?.difficulty?.name||input.difficultyName||`Difficulty ${requestedDifficulty}`,officialFingerprint:difficultyOfficial?.fingerprint||null,applicability:difficultyOfficial?.applicability||null},
    bossKnowledge:{status:officialView?'official-ready':'official-not-available',reportRequired:false,difficultyRequired:true,officialMechanics:publishedMechanics,officialAbilityCount:Number(officialView?.abilities?.length||0)},
    executionKnowledge:{status:executionStatus,reportRequired:true,difficultyRequired:true,corpusAvailable:Boolean(corpus),publicSourceAvailability:publicAvailability?{status:publicAvailability.status,publicSources:Number(publicAvailability.publicSources||0),rankingOutcomeDiscarded:true,checkedAt:learningAvailability.updatedAt||null}:null,episodeCount:mechanics.length},
    sources:{
      official:officialView?{status:'ready',provider:'blizzard-game-data+wago-db2-difficulty',fingerprint:officialView.fingerprint,baseFingerprint:officialBase?.fingerprint||null,namespace:officialBase?.source?.namespace||null,sectionCount:Number(officialView?.graph?.sectionCount||0),spellCount:Number(officialView?.graph?.spellCount||0),membershipEdges:Number(officialView?.graph?.officialMembershipEdges||0),difficultyApplicability:officialView?.applicability||null}:{status:'not-available'},
      structural:structuralView?{status:'ready',provider:'wago-db2',fingerprint:structuralView.fingerprint,baseFingerprint:structuralBase?.fingerprint||null,build:structuralView?.provider?.build||structuralBase?.provider?.build||null,relations:Number(structuralView?.relations?.length||0),baseRelations:Number(structuralView?.summary?.baseRelations??structuralBase?.relations?.length??0),seedAbilities:Number(structuralView?.seedAbilityIds?.length||0),resolvedQueries:Number(structuralView?.coverage?.resolvedQueries||0),queryCount:Number(structuralView?.coverage?.queryCount||0),difficultyScopedInterpretation:Boolean(difficultyOfficial),difficultyApplicabilityVerified:structuralView?.difficultyApplicabilityVerified===true,empiricalDifficultyEvidence:false}:{status:'not-available'},
      corpus:corpus?{status:'ready',difficulty:requestedDifficulty,...corpus}:publicAvailability?{status:'not-built',difficulty:requestedDifficulty,publicSourceAvailability:publicAvailability.status,publicSources:Number(publicAvailability.publicSources||0)}:{status:'not-available'},
    },
    summary:{officialMechanics:publishedMechanics.length,officialAbilities:Number(officialView?.abilities?.length||0),mechanicInvestigations:mechanics.length,promotionPending:mechanics.filter(row=>row?.episode?.lifecycle==='promotion-pending').length,accepted:0,networkExecuted:false,wclCallsExecuted:0,providerNetworkCallsExecuted:0},
    mechanics,
    evidenceContract:{readOnly:true,scopeIdentity:'boss+difficulty',officialKnowledgeIndependentOfReports:true,empiricalOverlayOptional:true,difficultyIsolation:true,officialAndStructuralViewsDifficultyScoped:true,learningAvailabilityIsMetadataOnly:true,crossDifficultyComparisonForbidden:true,crossDifficultyEmpiricalReuse:false,normalHeroicCannotCountAsMythicEvidence:true,wclCombatTruthCanonical:true,providerMetadataCannotPromote:true,automaticPromotion:false},
  };
}
