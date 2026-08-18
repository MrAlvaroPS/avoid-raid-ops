import { eventAbilityId,eventSourceId,eventTargetId } from '../wcl/normalization/events.mjs';
import { verifySemanticProbeEvidenceV1 } from './semantic-probe-verifier-v1.mjs';

export const SEMANTIC_PROBE_VERIFIER_V32_VERSION='semantic-candidate-specificity-verification-v3.2.1';

export const SEMANTIC_SPECIFICITY_V32_DEFAULTS=Object.freeze({
  minimumBackgroundWindows:6,
  minimumAnchorPrevalence:0.60,
  minimumSpecificityLift:1.75,
  minimumPrevalenceDelta:0.25,
  backgroundNoiseRatio:0.80,
  backgroundNoiseMaxDelta:0.15,
  minimumTopologyShare:0.60,
  minimumActorRoleShare:0.80,
  strongTemporalSpreadMs:750,
  moderateTemporalSpreadMs:1500,
  maxCandidateAssessments:24,
});

const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const median=values=>{const rows=(values||[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);if(!rows.length)return null;const m=Math.floor(rows.length/2);return rows.length%2?rows[m]:(rows[m-1]+rows[m])/2;};
const quantile=(values,q)=>{const rows=(values||[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);if(!rows.length)return null;const p=(rows.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);return lo===hi?rows[lo]:rows[lo]+(rows[hi]-rows[lo])*(p-lo);};

function relativeBucket(delta){
  const abs=Math.abs(Number(delta)||0);
  const distance=abs<=1000?'1s':abs<=2500?'2.5s':abs<=5000?'5s':'far';
  if(abs<=250)return`simultaneous-${distance}`;
  return`${delta<0?'before':'after'}-${distance}`;
}

function anchorForContext(sourceRow,context){
  const timestamp=finite(context?.anchorTimestamp),fightID=finite(context?.fightID);
  return (sourceRow?.anchorOccurrences||[]).find(row=>{
    const t=finite(row?.timestamp);if(t==null||timestamp==null||Math.abs(t-timestamp)>25)return false;
    const f=finite(row?.fightID);return fightID==null||f==null||f===fightID;
  })||null;
}

function actorTopology(event,anchor){
  const source=eventSourceId(event),target=eventTargetId(event),as=finite(anchor?.sourceID),at=finite(anchor?.targetID);
  if(source==null&&target==null)return'no-actors';
  if(as==null&&at==null)return'unknown-anchor-actors';
  if(source!=null&&target!=null&&as!=null&&at!=null&&source===as&&target===at)return'same-edge';
  if(source!=null&&target!=null&&as!=null&&at!=null&&source===at&&target===as)return'reverse-edge';
  if(source!=null&&as!=null&&source===as)return'same-source';
  if(target!=null&&at!=null&&target===at)return'same-target';
  if(source!=null&&at!=null&&source===at)return'from-anchor-target';
  if(target!=null&&as!=null&&target===as)return'to-anchor-source';
  return'unrelated';
}

function eventPattern(event,referenceTimestamp,stream,targetAbilityId,anchor=null){
  const abilityId=eventAbilityId(event),timestamp=finite(event?.timestamp);
  if(abilityId==null||timestamp==null||Number(abilityId)===Number(targetAbilityId))return null;
  const deltaMs=timestamp-Number(referenceTimestamp),relation=relativeBucket(deltaMs),eventType=String(event?.type||'event');
  return{key:[relation,stream,Number(abilityId),eventType].join('|'),relation,stream,abilityId:Number(abilityId),eventType,deltaMs,topology:actorTopology(event,anchor)};
}

function collectPatterns(sourceEvidence=[],signalId){
  const map=new Map();let completeWindows=0;
  for(const sourceRow of sourceEvidence||[]){
    const source=String(sourceRow?.source||'unknown');
    for(const context of sourceRow?.contexts||[]){
      if(context?.complete===false)continue;
      const reference=finite(context?.anchorTimestamp??context?.referenceTimestamp);if(reference==null)continue;
      completeWindows++;
      const anchor=anchorForContext(sourceRow,context),nearest=new Map();
      for(const [stream,events] of Object.entries(context?.streams||{}))for(const event of events||[]){
        const pattern=eventPattern(event,reference,stream,signalId,anchor);if(!pattern)continue;
        const prev=nearest.get(pattern.key);if(!prev||Math.abs(pattern.deltaMs)<Math.abs(prev.deltaMs))nearest.set(pattern.key,pattern);
        const row=map.get(pattern.key)||{...pattern,sources:new Set(),windows:0,rawEvents:0,deltas:[],topologies:new Map()};
        row.rawEvents++;map.set(pattern.key,row);
      }
      for(const pattern of nearest.values()){
        const row=map.get(pattern.key);row.windows++;row.sources.add(source);row.deltas.push(pattern.deltaMs);
        row.topologies.set(pattern.topology,(row.topologies.get(pattern.topology)||0)+1);
      }
    }
  }
  return{map,completeWindows};
}

function summarizePattern(row,totalWindows){
  const topologyRows=[...row.topologies.entries()].sort((a,b)=>b[1]-a[1]),dominant=topologyRows[0]||[null,0];
  const q20=quantile(row.deltas,.2),q80=quantile(row.deltas,.8),spread=q20==null||q80==null?null:q80-q20;
  return{
    key:row.key,relation:row.relation,stream:row.stream,abilityId:row.abilityId,eventType:row.eventType,
    independentSources:row.sources.size,windows:row.windows,rawEvents:row.rawEvents,prevalence:totalWindows?row.windows/totalWindows:0,
    medianDeltaMs:median(row.deltas),temporalSpreadP80P20Ms:spread,
    topology:{dominant:dominant[0],dominantWindows:dominant[1],share:row.windows?dominant[1]/row.windows:0,distribution:Object.fromEntries(topologyRows)},
  };
}

function knowledgeMap(abilityKnowledge){
  const rows=Array.isArray(abilityKnowledge)?abilityKnowledge:Array.isArray(abilityKnowledge?.abilities)?abilityKnowledge.abilities:[];
  return new Map(rows.map(row=>[Number(row?.abilityId),row]).filter(([id])=>Number.isFinite(id)));
}

function actorProvenanceMaps(actorProvenance){
  const abilityRows=Array.isArray(actorProvenance)?actorProvenance:Array.isArray(actorProvenance?.abilities)?actorProvenance.abilities:[];
  const patternRows=Array.isArray(actorProvenance?.patterns)?actorProvenance.patterns:[];
  return{
    abilities:new Map(abilityRows.map(row=>[Number(row?.abilityId),row]).filter(([id])=>Number.isFinite(id))),
    patterns:new Map(patternRows.map(row=>[String(row?.key||''),row]).filter(([key])=>key)),
  };
}

function actorProvenanceForPattern(pattern,maps){
  const exact=maps.patterns.get(String(pattern?.key||''));
  if(exact)return{row:exact,granularity:'pattern'};
  const fallback=maps.abilities.get(Number(pattern?.abilityId));
  return{row:fallback||null,granularity:fallback?'ability-fallback':'none'};
}

function providerAssessment(knowledge){
  if(!knowledge)return{status:'unresolved',encounterSupported:false,hardContradiction:false,reason:'No provider-aware metadata supplied for this candidate.'};
  const status=String(knowledge?.encounterAssociation?.status||'unknown');
  if(status==='supported')return{status:'encounter-supported',encounterSupported:true,hardContradiction:false,reason:'Reviewed provider/rule evidence supports encounter relevance for the ability identity; this cannot substitute for event-source provenance.'};
  if(status==='not-listed-by-lorrgs')return{status:'not-listed-secondary',encounterSupported:false,hardContradiction:false,reason:'Lorrgs does not track the ID in its curated boss timeline catalogue; this is weak negative evidence, not a contradiction.'};
  return{status:'unresolved',encounterSupported:false,hardContradiction:false,reason:'Provider metadata does not establish encounter relevance.'};
}

function actorProvenanceAssessment(row,config,granularity='none'){
  if(!row)return{status:'unresolved',granularity,sourceRole:null,sourceShare:0,targetRole:null,targetShare:0,encounterOrigin:false,playerOrigin:false,reason:'No actor-provenance summary supplied for this candidate.'};
  const sourceRole=String(row?.dominantSource?.role||'unknown'),sourceShare=Number(row?.dominantSource?.share||0);
  const targetRole=String(row?.dominantTarget?.role||'unknown'),targetShare=Number(row?.dominantTarget?.share||0);
  const strong=sourceShare>=config.minimumActorRoleShare;
  const exactPattern=granularity==='pattern';
  const encounterLike=strong&&['encounter-boss','encounter-npc','encounter-environment'].includes(sourceRole);
  const encounterOrigin=exactPattern&&encounterLike;
  const playerOrigin=strong&&['friendly-player','friendly-pet','owned-actor'].includes(sourceRole);
  if(encounterOrigin)return{status:'encounter-origin',granularity,sourceRole,sourceShare,targetRole,targetShare,encounterOrigin:true,playerOrigin:false,reason:'Exact pattern-level actor provenance strongly attributes this event source to the encounter side.'};
  if(playerOrigin)return{status:'player-origin',granularity,sourceRole,sourceShare,targetRole,targetShare,encounterOrigin:false,playerOrigin:true,reason:'Actor metadata strongly attributes this event pattern to a friendly player-owned actor.'};
  if(encounterLike&&!exactPattern)return{status:'mixed-or-unknown',granularity,sourceRole,sourceShare,targetRole,targetShare,encounterOrigin:false,playerOrigin:false,reason:'Ability-level encounter provenance is diagnostic only; exact pattern-level provenance is required before encounter origin can be established.'};
  return{status:'mixed-or-unknown',granularity,sourceRole,sourceShare,targetRole,targetShare,encounterOrigin:false,playerOrigin:false,reason:'Actor provenance is mixed, weak or unresolved and cannot establish event origin.'};
}

function temporalAssessment(pattern,config){
  const spread=finite(pattern?.temporalSpreadP80P20Ms);
  if(spread==null)return{status:'unknown',spreadMs:null};
  if(spread<=config.strongTemporalSpreadMs)return{status:'strong',spreadMs:spread};
  if(spread<=config.moderateTemporalSpreadMs)return{status:'moderate',spreadMs:spread};
  return{status:'diffuse',spreadMs:spread};
}

function specificityAssessment(pattern,backgroundMap,anchorWindows,backgroundWindows,config){
  if(!pattern)return{status:'not-eligible',reason:'No structural candidate is available.'};
  if(backgroundWindows<config.minimumBackgroundWindows)return{status:'background-required',reason:`At least ${config.minimumBackgroundWindows} complete null/control windows are required before mechanical specificity can be claimed.`,anchorWindows,backgroundWindows,anchorPrevalence:pattern.prevalence,backgroundPrevalence:null,lift:null,prevalenceDelta:null};
  const background=backgroundMap.get(pattern.key),bgHits=Number(background?.windows||0);
  const anchorPrev=anchorWindows?pattern.windows/anchorWindows:0,bgPrev=backgroundWindows?bgHits/backgroundWindows:0;
  const smoothAnchor=(pattern.windows+.5)/(anchorWindows+1),smoothBg=(bgHits+.5)/(backgroundWindows+1),lift=smoothBg?smoothAnchor/smoothBg:null,delta=anchorPrev-bgPrev;
  if(anchorPrev>=config.minimumAnchorPrevalence&&lift>=config.minimumSpecificityLift&&delta>=config.minimumPrevalenceDelta)return{status:'specificity-supported',reason:'The pattern is materially enriched around target anchors versus null/control windows.',anchorWindows,backgroundWindows,anchorHits:pattern.windows,backgroundHits:bgHits,anchorPrevalence:anchorPrev,backgroundPrevalence:bgPrev,lift,prevalenceDelta:delta};
  if(bgPrev>=anchorPrev*config.backgroundNoiseRatio&&delta<=config.backgroundNoiseMaxDelta)return{status:'background-noise',reason:'The pattern is almost as prevalent in null/control windows as around target anchors.',anchorWindows,backgroundWindows,anchorHits:pattern.windows,backgroundHits:bgHits,anchorPrevalence:anchorPrev,backgroundPrevalence:bgPrev,lift,prevalenceDelta:delta};
  return{status:'specificity-partial',reason:'Anchor enrichment is visible but does not satisfy the versioned specificity thresholds.',anchorWindows,backgroundWindows,anchorHits:pattern.windows,backgroundHits:bgHits,anchorPrevalence:anchorPrev,backgroundPrevalence:bgPrev,lift,prevalenceDelta:delta};
}

function assessCandidate(pattern,{backgroundMap,anchorWindows,backgroundWindows,knowledge,actorProvenance,actorGranularity,config,minimumIndependentSources,minimumAnchorOccurrences,structuralStatus}){
  const structurallyEligible=structuralStatus==='reproduced'&&pattern.independentSources>=minimumIndependentSources&&pattern.windows>=minimumAnchorOccurrences;
  const specificity=structurallyEligible?specificityAssessment(pattern,backgroundMap,anchorWindows,backgroundWindows,config):{status:'not-eligible',reason:'This candidate does not independently satisfy the structural source/window minimum.',anchorWindows,backgroundWindows};
  const provider=providerAssessment(knowledge),actor=actorProvenanceAssessment(actorProvenance,config,actorGranularity),temporal=temporalAssessment(pattern,config);
  const topologyShare=Number(pattern?.topology?.share||0),topology=String(pattern?.topology?.dominant||'unknown');
  const topologyConsistent=topology!=='unrelated'&&topology!=='unknown-anchor-actors'&&topology!=='no-actors'&&topologyShare>=config.minimumTopologyShare;
  let status='unverified',reason='Specificity has not been established.';
  if(specificity.status==='background-noise'){status='background-noise';reason='This recurring candidate is also common in null/control windows.';}
  else if(specificity.status==='specificity-supported'){
    if(actor.playerOrigin){
      status='player-origin-context-marker';
      reason='The relation is specific, but actor provenance strongly attributes the source to a friendly player-owned actor; retain it only as encounter-context evidence.';
    }else if(actor.encounterOrigin){
      if(provider.encounterSupported||topologyConsistent){
        status='mechanically-supported';
        reason=provider.encounterSupported&&topologyConsistent?'Specificity, exact encounter-side pattern provenance, encounter relevance and topology agree.':provider.encounterSupported?'Specificity, exact encounter-side pattern provenance and reviewed encounter relevance support a mechanical relationship candidate.':'Specificity, exact encounter-side pattern provenance and consistent topology support a mechanical relationship candidate.';
      }else{
        status='specificity-supported';
        reason='The relation is specific and exact-pattern encounter-origin, but lacks independent topology/provider corroboration required for mechanical support.';
      }
    }else{
      status='provenance-required';
      reason=actor.granularity==='ability-fallback'?'The relation is specific, but only ability-level actor provenance is available. Exact pattern-level provenance is required; provider identity and topology cannot substitute for it.':'The relation is specific, but actor origin is unresolved or mixed. Provider identity and topology may strengthen context but cannot substitute for encounter-side source provenance.';
    }
  }else if(specificity.status==='specificity-partial'){status='specificity-partial';reason='Some enrichment exists, but the specificity contract is not yet satisfied.';}
  else if(specificity.status==='background-required'){status='background-required';reason='Stored anchor evidence lacks enough null/control windows.';}
  return{pattern,specificity,provider,actorProvenance:actor,temporal,topology:{dominant:topology,share:topologyShare,consistent:topologyConsistent,minimumShare:config.minimumTopologyShare},mechanical:{status,reason},structurallyEligible};
}

const STATUS_RANK=Object.freeze({'mechanically-supported':7,'specificity-supported':6,'provenance-required':5,'player-origin-context-marker':4,'specificity-partial':3,'background-required':2,'background-noise':1,unverified:0});
const TEMPORAL_RANK=Object.freeze({strong:3,moderate:2,diffuse:1,unknown:0});
function compareCandidateAssessments(a,b){
  const status=(STATUS_RANK[b.mechanical.status]||0)-(STATUS_RANK[a.mechanical.status]||0);if(status)return status;
  const actor=Number(Boolean(b.actorProvenance?.encounterOrigin))-Number(Boolean(a.actorProvenance?.encounterOrigin));if(actor)return actor;
  const aSpec=a.specificity||{},bSpec=b.specificity||{};
  const lift=(Number(bSpec.lift)||0)-(Number(aSpec.lift)||0);if(lift)return lift;
  const delta=(Number(bSpec.prevalenceDelta)||0)-(Number(aSpec.prevalenceDelta)||0);if(delta)return delta;
  const provider=Number(Boolean(b.provider?.encounterSupported))-Number(Boolean(a.provider?.encounterSupported));if(provider)return provider;
  const topology=Number(Boolean(b.topology?.consistent))-Number(Boolean(a.topology?.consistent));if(topology)return topology;
  const temporal=(TEMPORAL_RANK[b.temporal?.status]||0)-(TEMPORAL_RANK[a.temporal?.status]||0);if(temporal)return temporal;
  return b.pattern.independentSources-a.pattern.independentSources||b.pattern.windows-a.pattern.windows||b.pattern.prevalence-a.pattern.prevalence||a.pattern.rawEvents-b.pattern.rawEvents||a.pattern.abilityId-b.pattern.abilityId;
}

export function verifySemanticProbeEvidenceV32({signalId,sourceEvidence=[],backgroundEvidence=[],abilityKnowledge=null,actorProvenance=null,minimumIndependentSources=3,minimumAnchorOccurrences=6,config:configInput={}}={}){
  const config={...SEMANTIC_SPECIFICITY_V32_DEFAULTS,...(configInput||{})};
  const minSources=Math.max(2,Number(minimumIndependentSources)||3),minOccurrences=Math.max(2,Number(minimumAnchorOccurrences)||6);
  const structural=verifySemanticProbeEvidenceV1({signalId,sourceEvidence,minimumIndependentSources:minSources,minimumAnchorOccurrences:minOccurrences});
  const anchors=collectPatterns(sourceEvidence,signalId),background=collectPatterns(backgroundEvidence,signalId),knowledge=knowledgeMap(abilityKnowledge),actors=actorProvenanceMaps(actorProvenance);
  const structuralRanked=[...anchors.map.values()].map(row=>summarizePattern(row,anchors.completeWindows)).sort((a,b)=>b.independentSources-a.independentSources||b.windows-a.windows||b.prevalence-a.prevalence||a.rawEvents-b.rawEvents||a.abilityId-b.abilityId);
  const assessed=structuralRanked.slice(0,Math.max(1,Number(config.maxCandidateAssessments)||24)).map(pattern=>{
    const actor=actorProvenanceForPattern(pattern,actors);
    return assessCandidate(pattern,{backgroundMap:background.map,anchorWindows:anchors.completeWindows,backgroundWindows:background.completeWindows,knowledge:knowledge.get(Number(pattern.abilityId))||null,actorProvenance:actor.row,actorGranularity:actor.granularity,config,minimumIndependentSources:minSources,minimumAnchorOccurrences:minOccurrences,structuralStatus:structural.status});
  });
  const semanticRanked=[...assessed].sort(compareCandidateAssessments),selected=semanticRanked[0]||null,structuralTop=structuralRanked[0]||null;
  const fallbackSpecificity={status:'not-eligible',reason:'No structural candidate is available.',anchorWindows:anchors.completeWindows,backgroundWindows:background.completeWindows};
  const fallbackProvider=providerAssessment(null),fallbackActor=actorProvenanceAssessment(null,config,'none'),fallbackTemporal={status:'unknown',spreadMs:null},fallbackTopology={dominant:'unknown',share:0,consistent:false,minimumShare:config.minimumTopologyShare},fallbackMechanical={status:'unverified',reason:'No candidate could be evaluated.'};
  return{
    version:SEMANTIC_PROBE_VERIFIER_V32_VERSION,signalId:Number(signalId),selectionPolicy:'candidate-wise-specificity-exact-pattern-provenance-gated-v3.1',
    structural:{status:structural.status,reason:structural.reason,evidence:structural.evidence,topPattern:structuralTop},
    specificity:selected?.specificity||fallbackSpecificity,provider:selected?.provider||fallbackProvider,actorProvenance:selected?.actorProvenance||fallbackActor,temporal:selected?.temporal||fallbackTemporal,topology:selected?.topology||fallbackTopology,mechanical:selected?.mechanical||fallbackMechanical,
    bestPattern:selected?.pattern||null,structuralBestPattern:structuralTop,
    candidateAssessments:semanticRanked.slice(0,12).map(row=>({pattern:row.pattern,specificity:row.specificity,provider:row.provider,actorProvenance:row.actorProvenance,temporal:row.temporal,topology:row.topology,mechanical:row.mechanical,structurallyEligible:row.structurallyEligible})),
    topPatterns:structuralRanked.slice(0,12),
    selectionDiagnostics:{
      evaluatedCandidates:assessed.length,
      structurallyEligibleCandidates:assessed.filter(row=>row.structurallyEligible).length,
      backgroundNoiseCandidates:assessed.filter(row=>row.mechanical.status==='background-noise').length,
      specificitySupportedCandidates:assessed.filter(row=>['specificity-supported','mechanically-supported','provenance-required','player-origin-context-marker'].includes(row.mechanical.status)).length,
      mechanicallySupportedCandidates:assessed.filter(row=>row.mechanical.status==='mechanically-supported').length,
      provenanceRequiredCandidates:assessed.filter(row=>row.mechanical.status==='provenance-required').length,
      playerOriginCandidates:assessed.filter(row=>row.actorProvenance?.playerOrigin).length,
      encounterOriginCandidates:assessed.filter(row=>row.actorProvenance?.encounterOrigin).length,
      exactPatternEncounterOriginCandidates:assessed.filter(row=>row.actorProvenance?.encounterOrigin&&row.actorProvenance?.granularity==='pattern').length,
      patternProvenanceCandidates:assessed.filter(row=>row.actorProvenance?.granularity==='pattern').length,
      abilityFallbackProvenanceCandidates:assessed.filter(row=>row.actorProvenance?.granularity==='ability-fallback').length,
      structuralTopRejectedAsNoise:Boolean(structuralTop&&selected&&structuralTop.key!==selected.pattern.key&&assessed.find(row=>row.pattern.key===structuralTop.key)?.mechanical.status==='background-noise'),
    },
    thresholds:{minimumBackgroundWindows:config.minimumBackgroundWindows,minimumAnchorPrevalence:config.minimumAnchorPrevalence,minimumSpecificityLift:config.minimumSpecificityLift,minimumPrevalenceDelta:config.minimumPrevalenceDelta,backgroundNoiseRatio:config.backgroundNoiseRatio,backgroundNoiseMaxDelta:config.backgroundNoiseMaxDelta,minimumTopologyShare:config.minimumTopologyShare,minimumActorRoleShare:config.minimumActorRoleShare,strongTemporalSpreadMs:config.strongTemporalSpreadMs,moderateTemporalSpreadMs:config.moderateTemporalSpreadMs,minimumIndependentSources:minSources,minimumAnchorOccurrences:minOccurrences},
    promotion:{eligible:false,automatic:false,reason:'Diagnostic only. Mechanical support requires exact pattern-level encounter-origin provenance plus specificity and independent topology/provider corroboration; Promotion is handled by a separate contract.'},
    canonicalCoverageContribution:{deepReports:0,deepPulls:0},scoreChange:{allowed:false,directDelta:0},
  };
}
