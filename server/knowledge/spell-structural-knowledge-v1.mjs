import { createHash } from 'node:crypto';
import { buildSpellRelationGraphV1 } from './spell-relation-graph-v1.mjs';
import { officialEncounterMembershipForAbilityV1 } from './official-encounter-knowledge-v1.mjs';
import { resolveWagoTriggerRelationsV1,wagoBuildFromBlizzardNamespaceV1,WAGO_DB2_MAX_SEEDS } from './providers/wago-db2-spell-effect-v1.mjs';
import { persistSpellStructuralKnowledgeV1 } from './spell-structural-store-v1.mjs';

export const SPELL_STRUCTURAL_KNOWLEDGE_VERSION='spell-structural-knowledge-v1';
export const SPELL_STRUCTURAL_PREVIEW_VERSION='spell-structural-knowledge-preview-v1';

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=value=>createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');
const positiveId=(value,label)=>{const n=Number(value);if(!Number.isInteger(n)||n<=0)throw new Error(`${label} must be a positive integer`);return n;};
const seeds=value=>[...new Set((Array.isArray(value)?value:[value]).map(Number).filter(id=>Number.isInteger(id)&&id>0))];

export function normalizeSpellStructuralKnowledgeRequestV1(input={}){
  const seedAbilityIds=seeds(input.seedAbilityIds??input.abilityIds??input.abilityId);
  if(!seedAbilityIds.length)throw new Error('At least one seed ability ID is required');
  if(seedAbilityIds.length>WAGO_DB2_MAX_SEEDS)throw new Error(`At most ${WAGO_DB2_MAX_SEEDS} seed ability IDs are supported`);
  const directions=String(input.directions||input.direction||'both').toLowerCase();
  if(!['both','outbound','inbound'].includes(directions))throw new Error('directions must be both, outbound or inbound');
  return{
    wclEncounterId:positiveId(input.wclEncounterId??input.encounterId,'wclEncounterId'),
    seedAbilityIds:seedAbilityIds.sort((a,b)=>a-b),
    directions,
  };
}

function officialAssociation(graph,abilityId){
  const membership=officialEncounterMembershipForAbilityV1(graph,abilityId);
  return membership?{
    status:'provider-supported',
    encounterId:Number(graph?.encounter?.wclEncounterId)||null,
    basis:'Blizzard Encounter Journal official spell membership',
    name:membership.name||null,
    memberships:membership.memberships||[],
  }:{status:'unknown',encounterId:Number(graph?.encounter?.wclEncounterId)||null,basis:'not listed in current official Journal graph; non-negative'};
}

function structuralContext(sourceOfficial,targetOfficial){
  if(sourceOfficial.status==='provider-supported'&&targetOfficial.status==='provider-supported')return'official-to-official-structural-link';
  if(sourceOfficial.status==='provider-supported')return'official-source-to-unlisted-target';
  if(targetOfficial.status==='provider-supported')return'unlisted-source-to-official-target';
  return'official-context-unresolved';
}

export function buildSpellStructuralKnowledgePreviewV1(input={},officialGraph){
  const request=normalizeSpellStructuralKnowledgeRequestV1(input);
  if(!officialGraph)throw new Error('Persisted official encounter graph is required before structural DB2 resolution');
  if(Number(officialGraph?.encounter?.wclEncounterId)!==request.wclEncounterId)throw new Error('Official encounter graph does not match requested WCL encounter');
  const namespace=String(officialGraph?.source?.namespace||'').trim();
  const build=wagoBuildFromBlizzardNamespaceV1(namespace);
  const callsPerSeed=request.directions==='both'?2:1;
  const fingerprint=digest({version:SPELL_STRUCTURAL_KNOWLEDGE_VERSION,request,officialGraphFingerprint:officialGraph.fingerprint,build});
  return{
    version:SPELL_STRUCTURAL_PREVIEW_VERSION,
    fingerprint,
    request,
    officialGraph:{journalEncounterId:officialGraph?.encounter?.journalEncounterId||null,fingerprint:officialGraph.fingerprint||null,namespace,build},
    networkUpperBound:{wagoCalls:request.seedAbilityIds.length*callsPerSeed,blizzardCalls:0,wclCalls:0,thirdPartyCalls:request.seedAbilityIds.length*callsPerSeed},
    safety:{rawCsvPersisted:false,observedCombat:false,causalCombatEvidence:false,exactPatternProvenanceSatisfied:false,automaticPromotion:false},
  };
}

export async function resolveSpellStructuralKnowledgeV1(input={},options={}){
  const officialGraph=options.officialGraph;
  const preview=buildSpellStructuralKnowledgePreviewV1(input,officialGraph);
  const resolved=await resolveWagoTriggerRelationsV1(preview.request.seedAbilityIds,{build:preview.officialGraph.build,directions:preview.request.directions,fetcher:options.fetcher||fetch,baseUrl:options.baseUrl});
  const observations=resolved.relations.map(row=>{
    const sourceOfficial=officialAssociation(officialGraph,row.sourceAbilityId),targetOfficial=officialAssociation(officialGraph,row.targetAbilityId);
    return{
      ...row,
      sourceName:sourceOfficial.name||null,
      targetName:targetOfficial.name||null,
      sourceEncounterAssociation:{status:sourceOfficial.status,encounterId:sourceOfficial.encounterId,basis:sourceOfficial.basis},
      officialContext:{
        status:structuralContext(sourceOfficial,targetOfficial),
        source:sourceOfficial,
        target:targetOfficial,
        negativeEvidence:false,
        promotionEffect:'none',
      },
    };
  });
  const graph=buildSpellRelationGraphV1({
    scope:{encounterId:preview.request.wclEncounterId,stateScope:'global'},
    seedAbilityIds:preview.request.seedAbilityIds,
    observations,
    actorProvenance:options.actorProvenance||[],
  });
  const fingerprint=digest({version:SPELL_STRUCTURAL_KNOWLEDGE_VERSION,previewFingerprint:preview.fingerprint,providerBuild:resolved.build,relations:observations.map(row=>({sourceAbilityId:row.sourceAbilityId,targetAbilityId:row.targetAbilityId,providerRowId:row.providerRowId,relationKind:row.relationKind,structuralEvidence:row.structuralEvidence,officialContext:row.officialContext.status}))});
  const result={
    version:SPELL_STRUCTURAL_KNOWLEDGE_VERSION,
    fingerprint,
    previewFingerprint:preview.fingerprint,
    scope:{wclEncounterId:preview.request.wclEncounterId},
    provider:{id:'wago-db2',build:resolved.build,table:'SpellEffect',retrievalMode:'build-pinned-filtered-csv',officialBlizzardApi:false},
    officialGraph:preview.officialGraph,
    seedAbilityIds:preview.request.seedAbilityIds,
    directions:preview.request.directions,
    relations:observations,
    graph,
    usage:{wagoCalls:resolved.usage.networkCalls,blizzardCalls:0,wclCalls:0,queries:resolved.usage.queries},
    summary:{relations:observations.length,officialToOfficial:observations.filter(row=>row.officialContext.status==='official-to-official-structural-link').length,unlistedSourceToOfficial:observations.filter(row=>row.officialContext.status==='unlisted-source-to-official-target').length,officialSourceToUnlisted:observations.filter(row=>row.officialContext.status==='official-source-to-unlisted-target').length,unresolved:observations.filter(row=>row.officialContext.status==='official-context-unresolved').length},
    evidenceContract:{
      clientDb2StructuralMetadata:true,
      providerIsOfficialBlizzardApi:false,
      officialEncounterContextFromBlizzard:true,
      observedCombat:false,
      causalCombatEvidence:false,
      providerRelationsCannotSatisfyExactPatternProvenance:true,
      providerRelationsCannotPromoteMechanic:true,
      rawCsvPersisted:false,
      canonicalDeepContribution:{reports:0,pulls:0},
      directScoreDelta:0,
      automaticPromotion:false,
    },
  };
  return options.persist===false?result:persistSpellStructuralKnowledgeV1(result,{fetchedAt:options.fetchedAt});
}
