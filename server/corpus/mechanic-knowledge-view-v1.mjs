import { reconcileOfficialEncounterAbilitiesV1 } from '../knowledge/official-encounter-reconciliation-v1.mjs';

export const MECHANIC_KNOWLEDGE_VIEW_V1='iris-mechanic-knowledge-view-v1';

const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const pct=value=>Number.isFinite(Number(value))?Number(value):null;

function officialMembership(graph,abilityId){
  return (graph?.abilities||[]).find(row=>Number(row?.abilityId)===Number(abilityId))||null;
}

function directStructuralRelations(structural,anchorId,candidateId){
  return (structural?.relations||[]).filter(row=>{
    const source=Number(row?.sourceAbilityId),target=Number(row?.targetAbilityId);
    return(source===Number(anchorId)&&target===Number(candidateId))||(source===Number(candidateId)&&target===Number(anchorId));
  }).map(row=>({
    sourceAbilityId:Number(row.sourceAbilityId),targetAbilityId:Number(row.targetAbilityId),relationKind:row.relationKind||null,
    providerRowId:row.providerRowId??null,officialContext:row?.officialContext?.status||null,
  }));
}

function candidateState(matched){
  if(!matched)return{code:'diagnostic',label:'DIAGNOSTIC',tone:'neutral'};
  if(matched.status==='matched-specificity-supported')return{code:'supported',label:'SUPPORTED',tone:'good'};
  if(matched.status==='matched-background-noise')return{code:'rejected-noise',label:'BACKGROUND NOISE',tone:'bad'};
  if(matched.status==='matched-specificity-partial')return{code:'partial',label:'PARTIAL',tone:'warn'};
  return{code:'insufficient',label:'INSUFFICIENT',tone:'neutral'};
}

function stage(code,label,status,tone='neutral',detail=null){return{code,label,status,tone,detail};}

function stopReason({matchedNull,evidenceGroups,stability,holdoutResult,holdoutReservation,episode}){
  if(matchedNull?.baselineSufficient===true&&Number(matchedNull?.summary?.supported||0)===0)return{
    code:'matched-null-no-supported-pattern',
    title:'Stopped at Matched Null',
    message:'No candidate relation survived the paired same-fight null baseline. Additional WCL acquisition is not justified under the current hypothesis.',
  };
  const groupGate=evidenceGroups?.promotionContribution?.independentEvidenceGroupsGate;
  if(groupGate&&groupGate!=='evidence-available')return{code:groupGate,title:'Stopped at Independent Evidence Groups',message:evidenceGroups?.promotionContribution?.reason||'Independent source coverage is not sufficient to advance.'};
  const stabilityGate=stability?.holdoutContribution?.statisticalStabilityGate;
  if(stabilityGate&&stabilityGate!=='evidence-available')return{code:stabilityGate,title:'Stopped at Statistical Stability',message:stability?.holdoutContribution?.reason||'The candidate is not stable enough across independent sources to spend a Holdout.'};
  const holdoutGate=holdoutResult?.promotionContribution?.untouchedHoldoutGate;
  if(holdoutGate==='rejected')return{code:'untouched-holdout-rejected',title:'Rejected by Untouched Holdout',message:holdoutResult?.promotionContribution?.reason||'The frozen candidate failed to replicate in untouched sources.'};
  if(holdoutGate==='inconclusive'||holdoutReservation?.status==='holdout-unavailable-insufficient-unseen-sources')return{code:'untouched-holdout-inconclusive',title:'Holdout incomplete',message:'The candidate cannot advance until the precommitted untouched-source contract can be satisfied.'};
  return{code:'promotion-pending',title:'Promotion pending',message:episode?.promotion?.reason||'The mechanic has not yet satisfied the complete Promotion Contract.'};
}

function evidenceLadder({episode,matchedNull,evidenceGroups,stability,holdoutReservation,holdoutResult}){
  const matchedSupported=Number(matchedNull?.summary?.supported||0);
  const groupGate=evidenceGroups?.promotionContribution?.independentEvidenceGroupsGate||null;
  const stabilityGate=stability?.holdoutContribution?.statisticalStabilityGate||null;
  const holdoutGate=holdoutResult?.promotionContribution?.untouchedHoldoutGate||holdoutReservation?.status||null;
  return[
    stage('signal','Signal discovery','observed','good',`${Number(episode?.summary?.candidateAssessmentsAvailable||0)} candidate assessments`),
    stage('specificity','Specificity',Number(episode?.summary?.specificitySupportedNodes||0)>0?'evidence-available':'insufficient',Number(episode?.summary?.specificitySupportedNodes||0)>0?'good':'warn',`${Number(episode?.summary?.specificitySupportedNodes||0)} supported diagnostic patterns`),
    stage('provenance','Exact provenance',Number(episode?.summary?.mechanicallySupportedEdges||0)>0?'encounter-edge-supported':Number(episode?.summary?.provenanceRequiredNodes||0)>0?'provenance-required':'no-exact-encounter-edge',Number(episode?.summary?.mechanicallySupportedEdges||0)>0?'good':'warn',`${Number(episode?.summary?.exactPatternEncounterOriginNodes||0)} exact encounter-origin nodes`),
    stage('episode','Episode Graph','built','good',`${Math.max(0,Number(episode?.nodes?.length||0)-1)} supporting nodes`),
    stage('matched-null','Matched Null',matchedNull?.baselineSufficient?matchedSupported>0?'supported':'no-supported-pattern':'insufficient',matchedNull?.baselineSufficient?(matchedSupported>0?'good':'bad'):'neutral',matchedNull?`${Number(matchedNull.matchedPairs||0)} controls · ${Number(matchedNull.matchedSources||0)} sources`:null),
    stage('groups','Evidence Groups',groupGate||'not-built',groupGate==='evidence-available'?'good':groupGate?'neutral':'neutral',evidenceGroups?`${Number(evidenceGroups?.summary?.patternsWithIndependentGroupCoverage||0)} eligible patterns`:null),
    stage('stability','Statistical Stability',stabilityGate||'not-built',stabilityGate==='evidence-available'?'good':stabilityGate?'neutral':'neutral',stability?`${Number(stability?.summary?.stabilitySupportedPatterns||0)} stable patterns`:null),
    stage('holdout','Untouched Holdout',holdoutGate||'not-built',holdoutGate==='evidence-available'?'good':holdoutGate==='rejected'?'bad':'neutral',holdoutResult?`${Number(holdoutResult?.summary?.evidenceSources||0)} evidence sources`:holdoutReservation?.status||null),
    stage('promotion','Promotion','pending','neutral','Automatic promotion is forbidden'),
  ];
}

export function buildMechanicKnowledgeViewV1({scope,encounterName=null,aggregateSummary=null,officialGraph=null,structuralKnowledge=null,episode,matchedNull=null,evidenceGroups=null,stability=null,holdoutReservation=null,holdoutResult=null}={}){
  if(!scope?.encounterId||!scope?.difficulty||!scope?.partition)throw new Error('Resolved encounter/difficulty/partition scope is required');
  if(!episode?.episodeId||!episode?.anchor?.abilityId)throw new Error('Persisted mechanic Episode is required');
  const anchorId=Number(episode.anchor.abilityId),anchorOfficial=officialMembership(officialGraph,anchorId);
  const matchedByPattern=new Map((matchedNull?.patternAssessments||[]).map(row=>[String(row.patternKey),row]));
  const candidates=(episode.nodes||[]).filter(row=>row?.roleInEpisode!=='anchor').map(node=>{
    const matched=matchedByPattern.get(String(node.patternKey))||null;
    const official=officialGraph?reconcileOfficialEncounterAbilitiesV1(officialGraph,anchorId,node.abilityId):null;
    const structural=directStructuralRelations(structuralKnowledge,anchorId,node.abilityId);
    return{
      patternKey:String(node.patternKey||''),abilityId:Number(node.abilityId),name:node.displayName||officialMembership(officialGraph,node.abilityId)?.name||null,
      relation:node.relation||null,eventType:node.eventType||null,stream:node.stream||null,disposition:node.disposition||null,state:candidateState(matched),
      specificity:{status:node?.specificity?.status||null,anchorPrevalence:pct(node?.specificity?.anchorPrevalence),backgroundPrevalence:pct(node?.specificity?.backgroundPrevalence),lift:finite(node?.specificity?.lift),prevalenceDelta:pct(node?.specificity?.prevalenceDelta)},
      actorProvenance:{status:node?.actorProvenance?.status||'unresolved',granularity:node?.actorProvenance?.granularity||null,sourceRole:node?.actorProvenance?.sourceRole||null,sourceShare:pct(node?.actorProvenance?.sourceShare),encounterOrigin:node?.actorProvenance?.encounterOrigin===true,playerOrigin:node?.actorProvenance?.playerOrigin===true},
      matchedNull:matched?{status:matched.status,matchedPairs:Number(matched.matchedPairs||0),anchorPrevalence:pct(matched.anchorPrevalence),backgroundPrevalence:pct(matched.matchedBackgroundPrevalence),lift:finite(matched.lift),prevalenceDelta:pct(matched.prevalenceDelta)}:null,
      official:official?{status:official.status,path:official?.rightOfficial?.memberships?.[0]?.path||official?.bestRelation?.right?.path||[],mechanic:official?.bestRelation?.right?.mechanic?.title||null}:null,
      structural:{direct:structural.length>0,relations:structural},
    };
  }).sort((a,b)=>{
    const order={supported:0,partial:1,diagnostic:2,insufficient:3,'rejected-noise':4};
    return(order[a.state.code]??9)-(order[b.state.code]??9)||Number(b.specificity.anchorPrevalence||0)-Number(a.specificity.anchorPrevalence||0)||a.abilityId-b.abilityId;
  });
  const stop=stopReason({matchedNull,evidenceGroups,stability,holdoutResult,holdoutReservation,episode});
  return{
    version:MECHANIC_KNOWLEDGE_VIEW_V1,
    scope:{encounterId:Number(scope.encounterId),difficulty:Number(scope.difficulty),partition:Number(scope.partition)},
    encounterName:encounterName||officialGraph?.encounter?.name||null,
    episode:{id:episode.episodeId,buildFingerprint:episode.buildFingerprint,empiricalEvidenceFingerprint:episode.empiricalBuildFingerprint||episode.matchedNullEvidenceFingerprint||episode.buildFingerprint,lifecycle:episode?.promotion?.lifecycle||'promotion-pending'},
    anchor:{abilityId:anchorId,name:episode.anchor.displayName||anchorOfficial?.name||null,actorProvenance:episode.anchor.actorProvenance||null,officialMembership:anchorOfficial?{name:anchorOfficial.name||null,memberships:anchorOfficial.memberships||[]}:null},
    status:{code:stop.code,label:stop.title.toUpperCase(),tone:stop.code.includes('rejected')||stop.code.includes('no-supported')?'bad':stop.code==='promotion-pending'?'warn':'neutral',why:stop.message},
    evidenceLadder:evidenceLadder({episode,matchedNull,evidenceGroups,stability,holdoutReservation,holdoutResult}),
    matchedNull:matchedNull?{baselineSufficient:Boolean(matchedNull.baselineSufficient),matchedPairs:Number(matchedNull.matchedPairs||0),matchedSources:Number(matchedNull.matchedSources||0),summary:matchedNull.summary||{}}:null,
    evidenceGroups:evidenceGroups?{summary:evidenceGroups.summary||{},gate:evidenceGroups?.promotionContribution?.independentEvidenceGroupsGate||null}:null,
    stability:stability?{summary:stability.summary||{},gate:stability?.holdoutContribution?.statisticalStabilityGate||null}:null,
    holdout:holdoutResult?{summary:holdoutResult.summary||{},gate:holdoutResult?.promotionContribution?.untouchedHoldoutGate||null}:holdoutReservation?{status:holdoutReservation.status,reservedSources:Number(holdoutReservation?.reservedSources?.length||0)}:null,
    candidates,
    contracts:{observedTruth:'wcl',officialSemantics:'blizzard',structuralMetadata:'build-pinned-db2',automaticPromotion:false},
  };
}
