import { eventAbilityId, eventSourceId, eventTargetId } from '../wcl/normalization/events.mjs';

export const SEMANTIC_PROBE_VERIFIER_VERSION='semantic-surgical-verification-v1';

const num=value=>Number.isFinite(Number(value))?Number(value):0;

function relativeBucket(delta){
  const abs=Math.abs(Number(delta)||0);
  const distance=abs<=1000?'1s':abs<=2500?'2.5s':abs<=5000?'5s':'far';
  if(abs<=250)return`simultaneous-${distance}`;
  return`${delta<0?'before':'after'}-${distance}`;
}

function patternFor(event,anchorTimestamp,stream,targetAbilityId){
  const abilityId=eventAbilityId(event);
  if(!Number.isFinite(abilityId)||Number(abilityId)===Number(targetAbilityId))return null;
  const timestamp=Number(event?.timestamp);
  if(!Number.isFinite(timestamp))return null;
  const sourcePresent=eventSourceId(event)!=null?'source':'no-source';
  const targetPresent=eventTargetId(event)!=null?'target':'no-target';
  const eventType=String(event?.type||'event');
  const relation=relativeBucket(timestamp-Number(anchorTimestamp));
  const key=[relation,stream,abilityId,eventType,sourcePresent,targetPresent].join('|');
  return{key,relation,stream,abilityId,eventType,sourcePresent:sourcePresent==='source',targetPresent:targetPresent==='target'};
}

/**
 * Verify whether a structural context pattern reproduces across independent sources.
 * Actor identities are deliberately not part of the cross-source signature: only the
 * presence of source/target identities and event/ability structure is compared.
 */
export function verifySemanticProbeEvidenceV1({
  signalId,sourceEvidence=[],minimumIndependentSources=3,minimumAnchorOccurrences=6,
}={}){
  const sources=(sourceEvidence||[]).filter(row=>row?.source);
  const completeContexts=sources.flatMap(row=>(row.contexts||[]).filter(context=>context?.complete!==false));
  const allAnchorOccurrences=sources.flatMap(row=>row.anchorOccurrences||[]);
  const queriedSources=new Set(sources.map(row=>String(row.source)));
  const anchorSources=new Set(sources.filter(row=>(row.anchorOccurrences||[]).length>0).map(row=>String(row.source)));
  const contextSources=new Set(sources.filter(row=>(row.contexts||[]).some(context=>context?.complete!==false)).map(row=>String(row.source)));

  const patterns=new Map();
  for(const sourceRow of sources){
    const source=String(sourceRow.source);
    for(const context of sourceRow.contexts||[]){
      if(context?.complete===false)continue;
      const seenInWindow=new Set();
      for(const [stream,events] of Object.entries(context?.streams||{})){
        for(const event of events||[]){
          const pattern=patternFor(event,context.anchorTimestamp,stream,signalId);
          if(!pattern)continue;
          const current=patterns.get(pattern.key)||{...pattern,sources:new Set(),windows:0,events:0};
          current.events++;
          if(!seenInWindow.has(pattern.key)){current.windows++;seenInWindow.add(pattern.key);}
          current.sources.add(source);
          patterns.set(pattern.key,current);
        }
      }
    }
  }

  const ranked=[...patterns.values()].map(row=>({
    relation:row.relation,stream:row.stream,abilityId:row.abilityId,eventType:row.eventType,
    sourcePresent:row.sourcePresent,targetPresent:row.targetPresent,
    independentSources:row.sources.size,windows:row.windows,events:row.events,
  })).sort((a,b)=>b.independentSources-a.independentSources||b.windows-a.windows||b.events-a.events||a.abilityId-b.abilityId);
  const best=ranked[0]||null;
  const minSources=Math.max(2,Number(minimumIndependentSources)||3);
  const minOccurrences=Math.max(2,Number(minimumAnchorOccurrences)||6);

  let status='insufficient';
  let reason='No reproducible structural neighbor reached the verification minimum.';
  if(queriedSources.size>=minSources&&anchorSources.size<Math.min(minSources,queriedSources.size)){
    status='contradicted';
    reason='The persisted target-presence expectation did not reproduce across the required independent queried sources.';
  }else if(best&&best.independentSources>=minSources&&best.windows>=minOccurrences){
    status='reproduced';
    reason='A structural temporal neighbor reproduced across the required independent sources and anchor windows.';
  }else if(best&&(best.independentSources>=2||best.windows>=Math.ceil(minOccurrences/2))){
    status='partially-reproduced';
    reason='A recurring structural neighbor is visible but does not yet satisfy the independent-source verification minimum.';
  }

  return{
    version:SEMANTIC_PROBE_VERIFIER_VERSION,
    signalId:Number(signalId),
    status,reason,
    evidence:{
      queriedSources:queriedSources.size,
      sourcesWithAnchors:anchorSources.size,
      sourcesWithCompleteContext:contextSources.size,
      anchorOccurrences:allAnchorOccurrences.length,
      completeContextWindows:completeContexts.length,
      minimumIndependentSources:minSources,
      minimumAnchorOccurrences:minOccurrences,
    },
    bestPattern:best,
    topPatterns:ranked.slice(0,12),
    promotion:{eligible:false,automatic:false,reason:'Semantic probe verification is diagnostic only. A separately versioned promotion contract is required.'},
    canonicalCoverageContribution:{deepReports:0,deepPulls:0},
    scoreChange:{allowed:false,directDelta:0},
  };
}
