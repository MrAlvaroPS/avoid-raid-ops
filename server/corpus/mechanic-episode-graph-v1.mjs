import { createHash } from 'node:crypto';

export const MECHANIC_EPISODE_GRAPH_V1_VERSION='mechanic-episode-graph-v1';
export const MECHANIC_EPISODE_SCHEMA_V1_VERSION='iris-mechanic-episode-schema-v1';

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const fingerprint=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0,40);
const finite=value=>Number.isFinite(Number(value))?Number(value):null;

function abilityKnowledgeMap(abilityKnowledge){
  const rows=Array.isArray(abilityKnowledge)?abilityKnowledge:Array.isArray(abilityKnowledge?.abilities)?abilityKnowledge.abilities:[];
  return new Map(rows.map(row=>[Number(row?.abilityId),row]).filter(([id])=>Number.isFinite(id)));
}

function nameFor(id,knowledge,fallback=null){
  return knowledge.get(Number(id))?.identity?.name||fallback||null;
}

function relationRole(relation=''){
  const value=String(relation);
  if(value.startsWith('before-'))return'precursor';
  if(value.startsWith('after-'))return'aftermath';
  if(value.startsWith('simultaneous-'))return'simultaneous';
  return'context-marker';
}

function relationWindowMs(relation=''){
  const match=String(relation).match(/-(1s|2\.5s|5s)$/);
  if(!match)return null;
  if(match[1]==='1s')return 1000;
  if(match[1]==='2.5s')return 2500;
  if(match[1]==='5s')return 5000;
  return null;
}

function temporalDirection(relation=''){
  const value=String(relation);
  if(value.startsWith('before-'))return'before';
  if(value.startsWith('after-'))return'after';
  if(value.startsWith('simultaneous-'))return'simultaneous';
  return'unknown';
}

function contextDisposition(assessment){
  const mechanical=String(assessment?.mechanical?.status||'unverified');
  if(mechanical==='mechanically-supported')return'mechanic-support';
  if(mechanical==='player-origin-context-marker')return'context-only';
  if(mechanical==='provenance-required')return'provenance-required';
  if(mechanical==='specificity-supported')return'specificity-supported';
  return'other';
}

function edgeClass(assessment){
  if(assessment?.mechanical?.status==='mechanically-supported'&&assessment?.actorProvenance?.granularity==='pattern'&&assessment?.actorProvenance?.encounterOrigin===true)return'mechanically-supported';
  if(assessment?.topology?.consistent===true)return'actor-linked';
  return'temporal-association';
}

function supportingNode(assessment,knowledge){
  const pattern=assessment.pattern||{};
  return{
    patternKey:String(pattern.key||''),
    abilityId:Number(pattern.abilityId),
    displayName:nameFor(pattern.abilityId,knowledge),
    eventType:String(pattern.eventType||'event'),
    stream:String(pattern.stream||'unknown'),
    relation:String(pattern.relation||'unknown'),
    roleInEpisode:relationRole(pattern.relation),
    disposition:contextDisposition(assessment),
    structurallyEligible:Boolean(assessment.structurallyEligible),
    specificity:{
      status:assessment?.specificity?.status||'unknown',
      anchorPrevalence:finite(assessment?.specificity?.anchorPrevalence),
      backgroundPrevalence:finite(assessment?.specificity?.backgroundPrevalence),
      lift:finite(assessment?.specificity?.lift),
      prevalenceDelta:finite(assessment?.specificity?.prevalenceDelta),
    },
    timing:{
      medianDeltaMs:finite(pattern.medianDeltaMs),
      temporalSpreadP80P20Ms:finite(pattern.temporalSpreadP80P20Ms),
    },
    actorProvenance:{
      status:assessment?.actorProvenance?.status||'unresolved',
      granularity:assessment?.actorProvenance?.granularity||'none',
      sourceRole:assessment?.actorProvenance?.sourceRole||null,
      sourceShare:finite(assessment?.actorProvenance?.sourceShare)??0,
      targetRole:assessment?.actorProvenance?.targetRole||null,
      targetShare:finite(assessment?.actorProvenance?.targetShare)??0,
      encounterOrigin:Boolean(assessment?.actorProvenance?.encounterOrigin),
      playerOrigin:Boolean(assessment?.actorProvenance?.playerOrigin),
    },
    topology:{
      dominant:assessment?.topology?.dominant||'unknown',
      share:finite(assessment?.topology?.share)??0,
      consistent:Boolean(assessment?.topology?.consistent),
    },
    provider:{status:assessment?.provider?.status||'unresolved'},
    evidence:{
      independentSources:Number(pattern.independentSources||0),
      windows:Number(pattern.windows||0),
      rawEvents:Number(pattern.rawEvents||0),
    },
  };
}

function supportingEdge(node,assessment,anchorPatternKey){
  const direction=temporalDirection(node.relation);
  const fromPatternKey=direction==='before'?node.patternKey:anchorPatternKey;
  const toPatternKey=direction==='before'?anchorPatternKey:node.patternKey;
  return{
    fromPatternKey,
    toPatternKey,
    temporalRelation:direction,
    temporalWindowMs:relationWindowMs(node.relation),
    medianDeltaMs:node.timing.medianDeltaMs,
    temporalSpreadP80P20Ms:node.timing.temporalSpreadP80P20Ms,
    anchorPrevalence:node.specificity.anchorPrevalence,
    backgroundPrevalence:node.specificity.backgroundPrevalence,
    lift:node.specificity.lift,
    prevalenceDelta:node.specificity.prevalenceDelta,
    sourceRole:node.actorProvenance.sourceRole,
    targetRole:node.actorProvenance.targetRole,
    actorProvenanceStatus:node.actorProvenance.status,
    actorProvenanceGranularity:node.actorProvenance.granularity,
    actorTopology:node.topology.dominant,
    actorTopologyShare:node.topology.share,
    edgeClass:edgeClass(assessment),
    contextOnly:node.disposition==='context-only',
    promotionRelevant:edgeClass(assessment)==='mechanically-supported',
    independentSourcesDiagnostic:node.evidence.independentSources,
    independentEvidenceGroups:null,
    sourceSupportRate:null,
    evidenceRefs:[],
  };
}

function anchorContextProvenance(signalId,actorProvenance){
  const rows=(actorProvenance?.patterns||[]).filter(row=>Number(row?.abilityId)===Number(signalId));
  const sourceCounts={};
  let events=0;
  for(const row of rows){
    const count=Number(row?.events||0);events+=count;
    for(const [role,value] of Object.entries(row?.sourceRoles||{}))sourceCounts[role]=(sourceCounts[role]||0)+Number(value||0);
  }
  const ranked=Object.entries(sourceCounts).sort((a,b)=>b[1]-a[1]);
  const best=ranked[0]||[null,0];
  const share=events?Number(best[1])/events:0;
  const encounter=['encounter-boss','encounter-npc','encounter-environment'].includes(best[0])&&share>=0.8;
  return{
    status:encounter?'encounter-origin':'unresolved',
    granularity:rows.length?'signal-context-patterns':'signal-origin',
    sourceRole:best[0],
    sourceShare:share,
    evidenceEvents:events,
    exactPatternForPromotion:false,
    reason:rows.length?'Derived from exact-pattern context rows for the anchor ability, not from a dedicated canonical anchor-pattern identity.':'No pattern-level actor provenance rows were available for the anchor ability.',
  };
}

export function buildMechanicEpisodeGraphV1({scope={},signal={},verification={},abilityKnowledge=null,actorProvenance=null,actorProvenanceFingerprint=null}={}){
  const signalId=Number(signal?.id||verification?.signalId||0);
  if(!signalId)throw new Error('signal id is required to build a mechanic episode');
  const encounterId=Number(scope?.encounterId||0),difficulty=Number(scope?.difficulty||0),partition=Number(scope?.partition||0);
  if(!encounterId||!difficulty||!partition)throw new Error('resolved encounter/difficulty/partition scope is required');

  const knowledge=abilityKnowledgeMap(abilityKnowledge);
  const anchorPatternKey=`anchor|anchor|${signalId}|signal-anchor`;
  const stateDiscriminator='global';
  const episodeSeed={encounterId,difficulty,partition,signalId,stateDiscriminator};
  const episodeId=`episode:${encounterId}:${difficulty}:${partition}:${fingerprint(episodeSeed)}`;
  const mechanicSeedKey=[encounterId,difficulty,partition,signalId,'signal-anchor',stateDiscriminator].join('|');
  const anchorProvenance=anchorContextProvenance(signalId,actorProvenance);
  const anchorNode={
    patternKey:anchorPatternKey,
    abilityId:signalId,
    displayName:nameFor(signalId,knowledge,signal?.name||null),
    eventType:'signal-anchor',
    stream:'anchor',
    relation:'anchor',
    roleInEpisode:'anchor',
    disposition:'anchor',
    originEvidence:signal?.origin||null,
    actorProvenance:anchorProvenance,
  };

  const allAssessments=Array.isArray(verification?.candidateAssessments)?verification.candidateAssessments:[];
  const includedAssessments=allAssessments.filter(row=>row?.specificity?.status==='specificity-supported');
  const nodes=includedAssessments.map(row=>supportingNode(row,knowledge));
  const edges=nodes.map((node,index)=>supportingEdge(node,includedAssessments[index],anchorPatternKey));
  const mechanicallySupportedEdges=edges.filter(row=>row.edgeClass==='mechanically-supported').length;
  const contextOnlyNodes=nodes.filter(row=>row.disposition==='context-only').length;
  const provenanceRequiredNodes=nodes.filter(row=>row.disposition==='provenance-required').length;
  const exactEncounterNodes=nodes.filter(row=>row.actorProvenance.granularity==='pattern'&&row.actorProvenance.encounterOrigin===true).length;

  const blockers=['matched-null-baseline','independent-evidence-groups','statistical-stability','untouched-holdout'];
  if(mechanicallySupportedEdges===0)blockers.unshift('exact-encounter-origin-edge');

  const buildFingerprint=fingerprint({
    version:MECHANIC_EPISODE_GRAPH_V1_VERSION,
    episodeSeed,
    verifierVersion:verification?.version||null,
    actorProvenanceVersion:actorProvenance?.version||null,
    actorProvenanceFingerprint:actorProvenanceFingerprint||actorProvenance?.previewFingerprint||null,
    patterns:nodes.map(row=>({key:row.patternKey,disposition:row.disposition,specificity:row.specificity.status,provenance:row.actorProvenance.status,granularity:row.actorProvenance.granularity})).sort((a,b)=>a.key.localeCompare(b.key)),
  });

  return{
    version:MECHANIC_EPISODE_GRAPH_V1_VERSION,
    schemaVersion:MECHANIC_EPISODE_SCHEMA_V1_VERSION,
    buildFingerprint,
    episodeId,
    mechanicSeedKey,
    scope:{encounterId,difficulty,partition,stateScope:stateDiscriminator},
    anchor:anchorNode,
    nodes:[anchorNode,...nodes],
    edges,
    summary:{
      candidateAssessmentsAvailable:allAssessments.length,
      specificitySupportedNodes:nodes.length,
      contextOnlyNodes,
      provenanceRequiredNodes,
      exactPatternEncounterOriginNodes:exactEncounterNodes,
      mechanicallySupportedEdges,
      backgroundNoiseExcluded:Number(verification?.selectionDiagnostics?.backgroundNoiseCandidates||0),
      structuralTopRejectedAsNoise:Boolean(verification?.selectionDiagnostics?.structuralTopRejectedAsNoise),
    },
    promotion:{
      lifecycle:'promotion-pending',
      eligible:false,
      automatic:false,
      blockers,
      reason:mechanicallySupportedEdges===0?'Episode is structurally useful but has no exact-pattern encounter-origin supporting edge. Later Promotion v3 gates are also not implemented in this episode-builder version.':'Episode contains encounter-origin mechanical support, but later Promotion v3 gates are intentionally not evaluated by this version.',
    },
    contracts:{
      causalClaims:false,
      playerOriginCanPromote:false,
      providerCanOverrideProvenance:false,
      localFlankBaselineIsPromotionBaseline:false,
      independentEvidenceGroupsImplemented:false,
      matchedNullBaselineImplemented:false,
      holdoutImplemented:false,
    },
    safety:{
      wclCallsExecuted:0,
      providerNetworkCallsExecuted:0,
      canonicalDeepContribution:{reports:0,pulls:0},
      directScoreDelta:0,
      automaticPromotion:false,
    },
  };
}
