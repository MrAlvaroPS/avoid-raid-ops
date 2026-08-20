import { createHash } from 'node:crypto';
import { reconcileOfficialEncounterAbilitiesV1 } from '../knowledge/official-encounter-reconciliation-v1.mjs';

export const MECHANIC_EPISODE_OFFICIAL_RECONCILIATION_VERSION='mechanic-episode-official-reconciliation-v1';

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const fingerprint=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0,40);

function guidance(status,{empiricallyMechanical=false}={}){
  if(empiricallyMechanical)return 'retain-empirical-support';
  if(status==='same-official-section'||status==='same-official-mechanic-branch')return 'officially-aligned-hypothesis';
  if(status==='same-stage-different-official-branch')return 'deprioritize-as-native-child-unless-new-empirical-hypothesis';
  if(status==='different-official-stage')return 'deprioritize-across-stage-unless-new-empirical-hypothesis';
  return 'official-semantics-unresolved';
}

function semanticRow(graph,anchorAbilityId,node,edge){
  const reconciliation=reconcileOfficialEncounterAbilitiesV1(graph,anchorAbilityId,node.abilityId);
  const empiricallyMechanical=edge?.edgeClass==='mechanically-supported';
  return {
    version:MECHANIC_EPISODE_OFFICIAL_RECONCILIATION_VERSION,
    provider:'blizzard-game-data',
    evidenceClass:'official',
    graphFingerprint:graph?.fingerprint||null,
    namespace:graph?.source?.namespace||null,
    status:reconciliation.status,
    bestRelation:reconciliation.bestRelation,
    leftOfficial:reconciliation.leftOfficial,
    rightOfficial:reconciliation.rightOfficial,
    investigationGuidance:guidance(reconciliation.status,{empiricallyMechanical}),
    observedOccurrence:false,
    causalCombatEvidence:false,
    negativeEvidence:false,
    promotionEffect:'none',
    empiricalSupportPreserved:empiricallyMechanical,
  };
}

export function enrichMechanicEpisodeWithOfficialKnowledgeV1(episode,officialGraph){
  if(!episode||typeof episode!=='object')throw new Error('mechanic episode is required');
  if(!officialGraph)return {
    ...episode,
    officialReconciliation:{
      version:MECHANIC_EPISODE_OFFICIAL_RECONCILIATION_VERSION,
      status:'not-available',
      graphFingerprint:null,
      providerNetworkCallsExecuted:0,
      wclCallsExecuted:0,
    },
  };

  const episodeEncounterId=Number(episode?.scope?.encounterId||0);
  const graphEncounterId=Number(officialGraph?.encounter?.wclEncounterId||0);
  if(graphEncounterId&&episodeEncounterId&&graphEncounterId!==episodeEncounterId)throw new Error('official encounter graph does not match mechanic episode encounter scope');

  const anchorAbilityId=Number(episode?.anchor?.abilityId||0);
  if(!anchorAbilityId)throw new Error('mechanic episode anchor ability id is required for official reconciliation');

  const edgeByPattern=new Map((episode.edges||[]).map(edge=>[String(edge.toPatternKey===episode.anchor?.patternKey?edge.fromPatternKey:edge.toPatternKey),edge]));
  const statuses={};
  const nodes=(episode.nodes||[]).map(node=>{
    if(node?.roleInEpisode==='anchor'||String(node?.patternKey)===String(episode?.anchor?.patternKey))return node;
    const edge=edgeByPattern.get(String(node?.patternKey))||null;
    const officialSemantics=semanticRow(officialGraph,anchorAbilityId,node,edge);
    statuses[officialSemantics.status]=(statuses[officialSemantics.status]||0)+1;
    return {...node,officialSemantics};
  });

  const nodeByPattern=new Map(nodes.map(node=>[String(node?.patternKey),node]));
  const edges=(episode.edges||[]).map(edge=>{
    const candidateKey=String(edge.toPatternKey===episode.anchor?.patternKey?edge.fromPatternKey:edge.toPatternKey);
    const officialSemantics=nodeByPattern.get(candidateKey)?.officialSemantics||null;
    return officialSemantics?{...edge,officialSemantics:{status:officialSemantics.status,investigationGuidance:officialSemantics.investigationGuidance,graphFingerprint:officialSemantics.graphFingerprint,promotionEffect:'none',empiricalSupportPreserved:officialSemantics.empiricalSupportPreserved}}:edge;
  });

  const empiricalBuildFingerprint=episode.buildFingerprint||null;
  const buildFingerprint=fingerprint({
    empiricalBuildFingerprint,
    officialGraphFingerprint:officialGraph?.fingerprint||null,
    officialReconciliationVersion:MECHANIC_EPISODE_OFFICIAL_RECONCILIATION_VERSION,
    relationships:nodes.filter(node=>node?.officialSemantics).map(node=>({patternKey:node.patternKey,status:node.officialSemantics.status,guidance:node.officialSemantics.investigationGuidance})).sort((a,b)=>String(a.patternKey).localeCompare(String(b.patternKey))),
  });

  return {
    ...episode,
    buildFingerprint,
    empiricalBuildFingerprint,
    nodes,
    edges,
    summary:{
      ...(episode.summary||{}),
      officialReconciliation:{
        evaluated:nodes.filter(node=>node?.officialSemantics).length,
        statuses,
        crossBranch:(statuses['same-stage-different-official-branch']||0)+(statuses['different-official-stage']||0),
      },
    },
    officialReconciliation:{
      version:MECHANIC_EPISODE_OFFICIAL_RECONCILIATION_VERSION,
      status:'applied',
      provider:'blizzard-game-data',
      evidenceClass:'official',
      graphFingerprint:officialGraph?.fingerprint||null,
      namespace:officialGraph?.source?.namespace||null,
      journalEncounterId:officialGraph?.encounter?.journalEncounterId||null,
      wclEncounterId:officialGraph?.encounter?.wclEncounterId||episodeEncounterId||null,
      providerNetworkCallsExecuted:0,
      wclCallsExecuted:0,
      rule:'Official hierarchy guides semantic hypothesis priority but cannot promote, demote, or erase exact empirical WCL support.',
    },
    contracts:{
      ...(episode.contracts||{}),
      officialSemanticsCanPromote:false,
      officialSemanticsCanOverrideEmpiricalSupport:false,
      officialCrossBranchIsNegativeEvidence:false,
    },
  };
}
