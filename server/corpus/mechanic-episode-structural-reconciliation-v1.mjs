import { createHash } from 'node:crypto';

export const MECHANIC_EPISODE_STRUCTURAL_RECONCILIATION_VERSION='mechanic-episode-structural-reconciliation-v1';

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const fingerprint=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0,40);

function compactRelation(row){
  return{
    sourceAbilityId:Number(row?.sourceAbilityId)||null,
    targetAbilityId:Number(row?.targetAbilityId)||null,
    relationKind:row?.relationKind||null,
    relationLabel:row?.relationLabel||null,
    providerRowId:row?.providerRowId??null,
    officialContext:row?.officialContext?.status||null,
    structuralEvidence:row?.structuralEvidence||null,
  };
}

function directRelations(relations,anchorAbilityId,candidateAbilityId){
  return (relations||[]).filter(row=>{
    const source=Number(row?.sourceAbilityId),target=Number(row?.targetAbilityId);
    return(source===anchorAbilityId&&target===candidateAbilityId)||(source===candidateAbilityId&&target===anchorAbilityId);
  });
}

function semanticOriginCandidate(node,{direct=[],inbound=[]}={}){
  if(node?.actorProvenance?.encounterOrigin===true)return{
    status:'encounter-action-observed',
    evidenceClass:'wcl-actor-provenance',
    confidence:'empirical-actor-only',
    reason:'Exact/current Episode actor provenance observes encounter-side ownership. DB2 structure is supplementary.',
    promotionEffect:'none',
  };

  if(node?.actorProvenance?.playerOrigin===true){
    const anchoredInbound=direct.some(row=>Number(row?.targetAbilityId)===Number(node.abilityId));
    const officialInbound=inbound.some(row=>['official-source-to-unlisted-target','official-to-official-structural-link'].includes(row?.officialContext?.status));
    if(anchoredInbound||officialInbound)return{
      status:'encounter-applied-player-state-candidate',
      evidenceClass:'wcl-actor-plus-db2-structural-corroboration',
      confidence:anchoredInbound?'medium':'low',
      reason:anchoredInbound
        ?'The Episode observes player-side ownership while build-pinned DB2 directly links the anchor spell into this ability. This can explain player-carried state without rewriting actor provenance.'
        :'The Episode observes player-side ownership and build-pinned DB2 supplies an inbound relation from an officially encounter-associated spell. Semantic origin remains a candidate until empirical behavior supports it.',
      promotionEffect:'none',
    };
    return{
      status:'player-actor-observed-semantic-origin-unresolved',
      evidenceClass:'wcl-actor-provenance',
      confidence:'empirical-actor-only',
      reason:'Player-side actor provenance is observed, but current structural evidence does not establish encounter-applied semantic origin.',
      promotionEffect:'none',
    };
  }

  if(direct.length||inbound.length)return{
    status:'structurally-related-semantic-origin-unresolved',
    evidenceClass:'db2-structural-metadata',
    confidence:'low',
    reason:'Build-pinned DB2 relates this ability to Episode/encounter spells, but actor provenance is insufficient to classify semantic origin.',
    promotionEffect:'none',
  };

  return{
    status:'unresolved',
    evidenceClass:'insufficient-semantic-evidence',
    confidence:'low',
    reason:'No structural relation plus actor provenance combination currently establishes semantic origin.',
    promotionEffect:'none',
  };
}

function guidance(node,direct){
  if(node?.officialSemantics?.empiricalSupportPreserved===true)return'retain-empirical-support';
  if(direct.length)return'investigate-direct-db2-link-with-wcl';
  return node?.officialSemantics?.investigationGuidance||'structural-context-only';
}

export function enrichMechanicEpisodeWithStructuralKnowledgeV1(episode,structuralKnowledge){
  if(!episode||typeof episode!=='object')throw new Error('mechanic episode is required');
  if(!structuralKnowledge)return{
    ...episode,
    structuralReconciliation:{
      version:MECHANIC_EPISODE_STRUCTURAL_RECONCILIATION_VERSION,
      status:'not-available',
      structuralFingerprint:null,
      providerNetworkCallsExecuted:0,
      wclCallsExecuted:0,
    },
  };

  const episodeEncounterId=Number(episode?.scope?.encounterId||0);
  const structuralEncounterId=Number(structuralKnowledge?.scope?.wclEncounterId||structuralKnowledge?.scope?.encounterId||0);
  if(episodeEncounterId&&structuralEncounterId&&episodeEncounterId!==structuralEncounterId)throw new Error('spell structural knowledge does not match mechanic episode encounter scope');

  const anchorAbilityId=Number(episode?.anchor?.abilityId||0);
  if(!anchorAbilityId)throw new Error('mechanic episode anchor ability id is required for structural reconciliation');
  const relations=structuralKnowledge?.relations||[];
  const statuses={};
  let directAnchorLinks=0;
  let semanticOriginCandidates=0;

  const nodes=(episode.nodes||[]).map(node=>{
    if(node?.roleInEpisode==='anchor'||String(node?.patternKey)===String(episode?.anchor?.patternKey))return node;
    const abilityId=Number(node?.abilityId||0);
    const inbound=relations.filter(row=>Number(row?.targetAbilityId)===abilityId);
    const outbound=relations.filter(row=>Number(row?.sourceAbilityId)===abilityId);
    const direct=directRelations(relations,anchorAbilityId,abilityId);
    const origin=semanticOriginCandidate(node,{direct,inbound});
    const status=direct.length?'direct-anchor-structural-link':(inbound.length||outbound.length?'structurally-related':'no-known-structural-relation');
    statuses[status]=(statuses[status]||0)+1;
    directAnchorLinks+=direct.length?1:0;
    if(origin.status==='encounter-applied-player-state-candidate')semanticOriginCandidates++;
    return{
      ...node,
      structuralSemantics:{
        version:MECHANIC_EPISODE_STRUCTURAL_RECONCILIATION_VERSION,
        provider:'wago-db2',
        evidenceClass:'structural',
        build:structuralKnowledge?.provider?.build||null,
        structuralFingerprint:structuralKnowledge?.fingerprint||null,
        status,
        inbound:inbound.map(compactRelation),
        outbound:outbound.map(compactRelation),
        directAnchorRelations:direct.map(compactRelation),
        semanticOriginCandidate:origin,
        investigationGuidance:guidance(node,direct),
        observedOccurrence:false,
        causalCombatEvidence:false,
        negativeEvidence:false,
        promotionEffect:'none',
      },
    };
  });

  const nodeByPattern=new Map(nodes.map(node=>[String(node?.patternKey),node]));
  const edges=(episode.edges||[]).map(edge=>{
    const candidateKey=String(edge.toPatternKey===episode.anchor?.patternKey?edge.fromPatternKey:edge.toPatternKey);
    const semantics=nodeByPattern.get(candidateKey)?.structuralSemantics||null;
    return semantics?{
      ...edge,
      structuralSemantics:{
        status:semantics.status,
        directAnchorLink:semantics.directAnchorRelations.length>0,
        semanticOriginCandidate:semantics.semanticOriginCandidate.status,
        investigationGuidance:semantics.investigationGuidance,
        structuralFingerprint:semantics.structuralFingerprint,
        promotionEffect:'none',
      },
    }:edge;
  });

  const priorBuildFingerprint=episode.buildFingerprint||null;
  const buildFingerprint=fingerprint({
    priorBuildFingerprint,
    structuralFingerprint:structuralKnowledge?.fingerprint||null,
    structuralReconciliationVersion:MECHANIC_EPISODE_STRUCTURAL_RECONCILIATION_VERSION,
    relationships:nodes.filter(node=>node?.structuralSemantics).map(node=>({
      patternKey:node.patternKey,
      status:node.structuralSemantics.status,
      semanticOriginCandidate:node.structuralSemantics.semanticOriginCandidate.status,
      direct:node.structuralSemantics.directAnchorRelations.map(row=>[row.sourceAbilityId,row.targetAbilityId,row.relationKind]),
    })).sort((a,b)=>String(a.patternKey).localeCompare(String(b.patternKey))),
  });

  return{
    ...episode,
    buildFingerprint,
    preStructuralBuildFingerprint:priorBuildFingerprint,
    nodes,
    edges,
    summary:{
      ...(episode.summary||{}),
      structuralReconciliation:{
        evaluated:nodes.filter(node=>node?.structuralSemantics).length,
        statuses,
        directAnchorLinks,
        encounterAppliedPlayerStateCandidates:semanticOriginCandidates,
      },
    },
    structuralReconciliation:{
      version:MECHANIC_EPISODE_STRUCTURAL_RECONCILIATION_VERSION,
      status:'applied',
      provider:'wago-db2',
      evidenceClass:'structural',
      build:structuralKnowledge?.provider?.build||null,
      structuralFingerprint:structuralKnowledge?.fingerprint||null,
      coverage:structuralKnowledge?.coverage||null,
      providerNetworkCallsExecuted:0,
      wclCallsExecuted:0,
      rule:'DB2 structural wiring may reprioritize a hypothesis or support semantic-origin candidates, but cannot prove observed occurrence, causal combat behavior, exact-pattern provenance or Promotion.',
    },
    contracts:{
      ...(episode.contracts||{}),
      structuralMetadataCanPromote:false,
      structuralMetadataCanSatisfyExactPatternProvenance:false,
      structuralMetadataCanOverrideActorProvenance:false,
      structuralDirectLinkIsCausalCombatEvidence:false,
    },
  };
}
