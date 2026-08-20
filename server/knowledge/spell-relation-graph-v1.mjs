import { createHash } from 'node:crypto';

export const SPELL_RELATION_GRAPH_V1_VERSION='provider-spell-relation-graph-v1';
export const SPELL_RELATION_GRAPH_PREVIEW_V1_VERSION='provider-spell-relation-graph-preview-v1';
export const SPELL_RELATION_OBSERVATION_V1_VERSION='provider-spell-relation-observation-v1';

export const SPELL_RELATION_KINDS=Object.freeze([
  'trigger-spell',
  'trigger-missile',
  'apply-aura',
  'cancel-aura',
  'allow-spell',
  'effect-reference',
  'related-spell',
]);

const PROVIDER_ENCOUNTER_STATUSES=new Set(['provider-described','provider-supported','unknown']);
const ACTOR_STATUSES=new Set(['encounter-origin','player-origin','mixed-or-unknown','unknown']);
const TRIGGER_RELATIONS=new Set(['trigger-spell','trigger-missile','apply-aura']);

const finiteId=value=>{const id=Number(value);return Number.isInteger(id)&&id>0?id:null;};
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=(value,length=40)=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0,length);
const cleanString=(value,max=300)=>String(value??'').trim().slice(0,max)||null;
const cleanUrl=value=>{const raw=cleanString(value,1000);if(!raw)return null;try{const url=new URL(raw);return ['http:','https:'].includes(url.protocol)?url.toString():null;}catch{return null;}};

function normalizeScope(input={}){
  const encounterId=finiteId(input.encounterId),difficulty=finite(input.difficulty),partition=finite(input.partition);
  return{
    encounterId,
    difficulty:difficulty==null?null:Number(difficulty),
    partition:partition==null?null:Number(partition),
    stateScope:cleanString(input.stateScope,40)||'global',
  };
}

export function normalizeSpellRelationObservationV1(input={}){
  const sourceAbilityId=finiteId(input.sourceAbilityId),targetAbilityId=finiteId(input.targetAbilityId);
  if(!sourceAbilityId||!targetAbilityId)throw new Error('Spell relation observation requires valid sourceAbilityId and targetAbilityId');
  if(sourceAbilityId===targetAbilityId)throw new Error('Spell relation observation cannot self-link an ability');
  const relationKind=cleanString(input.relationKind,60);
  if(!SPELL_RELATION_KINDS.includes(relationKind))throw new Error(`Unsupported spell relation kind: ${relationKind||'missing'}`);
  const provider=cleanString(input.provider,80);
  if(!provider)throw new Error('Spell relation observation requires provider provenance');
  const sourceUrl=cleanUrl(input.sourceUrl);
  if(!sourceUrl)throw new Error('Spell relation observation requires a valid sourceUrl');
  const encounterStatus=PROVIDER_ENCOUNTER_STATUSES.has(String(input?.sourceEncounterAssociation?.status))?String(input.sourceEncounterAssociation.status):'unknown';
  return{
    version:SPELL_RELATION_OBSERVATION_V1_VERSION,
    provider,
    retrievalMode:cleanString(input.retrievalMode,80)||'operator-reviewed-reference',
    sourceUrl,
    sourceAbilityId,
    sourceName:cleanString(input.sourceName,160),
    targetAbilityId,
    targetName:cleanString(input.targetName,160),
    relationKind,
    relationLabel:cleanString(input.relationLabel,160),
    sourceEncounterAssociation:{
      status:encounterStatus,
      encounterId:finiteId(input?.sourceEncounterAssociation?.encounterId),
      basis:cleanString(input?.sourceEncounterAssociation?.basis,160),
    },
    reviewedAt:cleanString(input.reviewedAt,80),
  };
}

function normalizeActorProvenanceRows(rows=[]){
  const out=new Map();
  for(const row of rows||[]){
    const abilityId=finiteId(row?.abilityId);if(!abilityId)continue;
    const status=ACTOR_STATUSES.has(String(row?.status))?String(row.status):'unknown';
    out.set(abilityId,{
      abilityId,status,
      granularity:cleanString(row?.granularity,80),
      sourceRole:cleanString(row?.sourceRole,80),
      sourceShare:finite(row?.sourceShare),
      targetRole:cleanString(row?.targetRole,80),
      evidenceEvents:finite(row?.evidenceEvents),
      exactPatternForPromotion:row?.exactPatternForPromotion===true,
    });
  }
  return out;
}

function observationKey(row){return[row.provider,row.sourceAbilityId,row.relationKind,row.targetAbilityId,row.sourceUrl].join('|');}

function nodeSemanticOrigin({abilityId,actor,inbound=[]}){
  if(actor?.status==='encounter-origin')return{
    status:'encounter-action-observed',
    evidenceClass:'wcl-actor-provenance',
    confidence:'empirical',
    providerDerived:false,
    promotionEligible:false,
    reason:'WCL actor provenance classifies this ability as encounter-origin; semantic-origin remains separate from mechanic promotion.',
  };
  const providerInbound=inbound.filter(edge=>TRIGGER_RELATIONS.has(edge.relationKind)&&['provider-described','provider-supported'].includes(edge.sourceEncounterAssociation.status));
  if(providerInbound.length&&['player-origin','mixed-or-unknown','unknown'].includes(actor?.status||'unknown'))return{
    status:'encounter-applied-player-state-candidate',
    evidenceClass:'provider-spell-relation-corroboration',
    confidence:providerInbound.some(edge=>edge.sourceEncounterAssociation.status==='provider-supported')?'medium':'low',
    providerDerived:true,
    promotionEligible:false,
    reason:'A provider-reviewed encounter-associated spell points to this ability through a trigger/apply relation. This may explain player-side event ownership but cannot replace WCL exact-pattern provenance.',
  };
  if(actor?.status==='player-origin')return{
    status:'player-actor-observed-semantic-origin-unresolved',
    evidenceClass:'wcl-actor-provenance',
    confidence:'empirical-actor-only',
    providerDerived:false,
    promotionEligible:false,
    reason:'WCL observes a player actor, but actor ownership alone does not prove the semantic origin of the state or proc.',
  };
  return{
    status:'unresolved',
    evidenceClass:'insufficient-semantic-evidence',
    confidence:'low',
    providerDerived:false,
    promotionEligible:false,
    reason:'Available evidence does not establish semantic origin.',
  };
}

function normalizedInput(input={}){
  const scope=normalizeScope(input.scope||input);
  const observations=[];const seen=new Set();
  for(const raw of input.observations||[]){const row=normalizeSpellRelationObservationV1(raw),key=observationKey(row);if(seen.has(key))continue;seen.add(key);observations.push(row);}
  observations.sort((a,b)=>a.sourceAbilityId-b.sourceAbilityId||a.targetAbilityId-b.targetAbilityId||a.relationKind.localeCompare(b.relationKind)||a.provider.localeCompare(b.provider));
  const actorRows=[...normalizeActorProvenanceRows(input.actorProvenance||[]).values()].sort((a,b)=>a.abilityId-b.abilityId);
  const seedAbilityIds=[...new Set((input.seedAbilityIds||[]).map(finiteId).filter(Boolean))].sort((a,b)=>a-b);
  return{scope,seedAbilityIds,observations,actorProvenance:actorRows};
}

export function buildSpellRelationGraphPreviewV1(input={}){
  const request=normalizedInput(input);
  const fingerprint=digest({version:SPELL_RELATION_GRAPH_V1_VERSION,request});
  return{
    version:SPELL_RELATION_GRAPH_PREVIEW_V1_VERSION,
    fingerprint,
    dryRun:true,
    executesNetwork:false,
    networkCallsExecuted:0,
    request,
    summary:{seedAbilities:request.seedAbilityIds.length,observations:request.observations.length,actorProvenanceRows:request.actorProvenance.length},
    safety:{
      providerObservationOnly:true,
      rawProviderPagePersisted:false,
      rawScreenshotsPersisted:false,
      wclCalls:0,
      parseCredits:0,
      directWebsiteScraping:false,
      exactPatternProvenanceSatisfied:false,
      automaticPromotion:false,
    },
  };
}

export function buildSpellRelationGraphV1(input={}){
  const preview=buildSpellRelationGraphPreviewV1(input),request=preview.request,actorMap=normalizeActorProvenanceRows(request.actorProvenance);
  const abilityIds=new Set(request.seedAbilityIds);
  for(const row of request.observations){abilityIds.add(row.sourceAbilityId);abilityIds.add(row.targetAbilityId);}
  for(const row of request.actorProvenance)abilityIds.add(row.abilityId);
  const edges=request.observations.map((row,index)=>({
    edgeId:`spell-edge:${digest({row,index},20)}`,
    sourceAbilityId:row.sourceAbilityId,
    targetAbilityId:row.targetAbilityId,
    relationKind:row.relationKind,
    relationLabel:row.relationLabel,
    provider:row.provider,
    retrievalMode:row.retrievalMode,
    sourceUrl:row.sourceUrl,
    sourceEncounterAssociation:row.sourceEncounterAssociation,
    evidenceClass:'provider-spell-relation',
    empiricalCombatEvidence:false,
    exactPatternProvenance:false,
    promotionEligible:false,
  }));
  const nodes=[...abilityIds].sort((a,b)=>a-b).map(abilityId=>{
    const inbound=edges.filter(edge=>edge.targetAbilityId===abilityId),outbound=edges.filter(edge=>edge.sourceAbilityId===abilityId),actor=actorMap.get(abilityId)||{abilityId,status:'unknown',granularity:null,sourceRole:null,sourceShare:null,targetRole:null,evidenceEvents:null,exactPatternForPromotion:false};
    const names=[...new Set(request.observations.flatMap(row=>[row.sourceAbilityId===abilityId?row.sourceName:null,row.targetAbilityId===abilityId?row.targetName:null]).filter(Boolean))];
    return{
      abilityId,
      displayName:names[0]||null,
      actorProvenance:actor,
      semanticOrigin:nodeSemanticOrigin({abilityId,actor,inbound}),
      inboundEdges:inbound.map(edge=>edge.edgeId),
      outboundEdges:outbound.map(edge=>edge.edgeId),
    };
  });
  const graphPayload={version:SPELL_RELATION_GRAPH_V1_VERSION,scope:request.scope,seedAbilityIds:request.seedAbilityIds,observations:request.observations,actorProvenance:request.actorProvenance,nodes,edges};
  return{
    version:SPELL_RELATION_GRAPH_V1_VERSION,
    previewFingerprint:preview.fingerprint,
    graphFingerprint:digest(graphPayload),
    scope:request.scope,
    seedAbilityIds:request.seedAbilityIds,
    nodes,edges,
    summary:{
      nodes:nodes.length,
      edges:edges.length,
      encounterAppliedPlayerStateCandidates:nodes.filter(row=>row.semanticOrigin.status==='encounter-applied-player-state-candidate').length,
      empiricalEncounterActionNodes:nodes.filter(row=>row.semanticOrigin.status==='encounter-action-observed').length,
      unresolvedSemanticOriginNodes:nodes.filter(row=>row.semanticOrigin.status==='unresolved').length,
    },
    evidenceContract:{
      actorProvenancePreserved:true,
      semanticOriginSeparateFromActorProvenance:true,
      providerRelationsAreCorroborationOnly:true,
      providerRelationsCannotSatisfyExactPatternProvenance:true,
      providerRelationsCannotPromoteMechanic:true,
      rawProviderPagePersisted:false,
      rawScreenshotsPersisted:false,
      wclCalls:0,
      parseCredits:0,
      canonicalDeepContribution:{reports:0,pulls:0},
      directScoreDelta:0,
      automaticPromotion:false,
    },
  };
}
