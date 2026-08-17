import { eventAbilityId,eventSourceId,eventTargetId } from '../wcl/normalization/events.mjs';
import { verifySemanticProbeEvidenceV1 } from './semantic-probe-verifier-v1.mjs';

export const SEMANTIC_PROBE_VERIFIER_V2_VERSION='semantic-specificity-verification-v2';

export const SEMANTIC_SPECIFICITY_DEFAULTS=Object.freeze({
  minimumBackgroundWindows:6,
  minimumAnchorPrevalence:0.60,
  minimumSpecificityLift:1.75,
  minimumPrevalenceDelta:0.25,
  backgroundNoiseRatio:0.80,
  backgroundNoiseMaxDelta:0.15,
  minimumTopologyShare:0.60,
  strongTemporalSpreadMs:750,
  moderateTemporalSpreadMs:1500,
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
  const timestamp=finite(context?.anchorTimestamp);
  const fightID=finite(context?.fightID);
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
  const deltaMs=timestamp-Number(referenceTimestamp);
  const relation=relativeBucket(deltaMs),eventType=String(event?.type||'event');
  return{
    key:[relation,stream,Number(abilityId),eventType].join('|'),
    relation,stream,abilityId:Number(abilityId),eventType,deltaMs,
    topology:actorTopology(event,anchor),
  };
}

function collectPatterns(sourceEvidence=[],signalId){
  const map=new Map();let completeWindows=0;
  for(const sourceRow of sourceEvidence||[]){
    const source=String(sourceRow?.source||'unknown');
    for(const context of sourceRow?.contexts||[]){
      if(context?.complete===false)continue;
      const reference=finite(context?.anchorTimestamp??context?.referenceTimestamp);if(reference==null)continue;
      completeWindows++;
      const anchor=anchorForContext(sourceRow,context);
      const nearest=new Map();
      for(const [stream,events] of Object.entries(context?.streams||{}))for(const event of events||[]){
        const pattern=eventPattern(event,reference,stream,signalId,anchor);if(!pattern)continue;
        const prev=nearest.get(pattern.key);
        if(!prev||Math.abs(pattern.deltaMs)<Math.abs(prev.deltaMs))nearest.set(pattern.key,pattern);
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
  const topologyRows=[...row.topologies.entries()].sort((a,b)=>b[1]-a[1]);
  const dominant=topologyRows[0]||[null,0];
  const q20=quantile(row.deltas,.2),q80=quantile(row.deltas,.8),spread=q20==null||q80==null?null:q80-q20;
  return{
    key:row.key,relation:row.relation,stream:row.stream,abilityId:row.abilityId,eventType:row.eventType,
    independentSources:row.sources.size,windows:row.windows,rawEvents:row.rawEvents,
    prevalence:totalWindows?row.windows/totalWindows:0,
    medianDeltaMs:median(row.deltas),temporalSpreadP80P20Ms:spread,
    topology:{dominant:dominant[0],dominantWindows:dominant[1],share:row.windows?dominant[1]/row.windows:0,distribution:Object.fromEntries(topologyRows)},
  };
}

function knowledgeMap(abilityKnowledge){
  const rows=Array.isArray(abilityKnowledge)?abilityKnowledge:Array.isArray(abilityKnowledge?.abilities)?abilityKnowledge.abilities:[];
  return new Map(rows.map(row=>[Number(row?.abilityId),row]).filter(([id])=>Number.isFinite(id)));
}

function providerAssessment(knowledge){
  if(!knowledge)return{status:'unresolved',encounterSupported:false,hardContradiction:false,reason:'No provider-aware metadata supplied for this candidate.'};
  const status=String(knowledge?.encounterAssociation?.status||'unknown');
  if(status==='supported')return{status:'encounter-supported',encounterSupported:true,hardContradiction:false,reason:'At least one reviewed provider/rule source supports encounter membership.'};
  if(status==='not-listed-by-lorrgs')return{status:'not-listed-secondary',encounterSupported:false,hardContradiction:false,reason:'Lorrgs did not list the ID for the boss; this is weak negative evidence, not a contradiction.'};
  return{status:'unresolved',encounterSupported:false,hardContradiction:false,reason:'Provider metadata does not establish encounter membership.'};
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
  if(backgroundWindows<config.minimumBackgroundWindows)return{
    status:'background-required',reason:`At least ${config.minimumBackgroundWindows} complete null/control windows are required before mechanical specificity can be claimed.`,
    anchorWindows,backgroundWindows,anchorPrevalence:pattern.prevalence,backgroundPrevalence:null,lift:null,prevalenceDelta:null,
  };
  const background=backgroundMap.get(pattern.key);const bgHits=Number(background?.windows||0);
  const anchorPrev=anchorWindows?pattern.windows/anchorWindows:0,bgPrev=backgroundWindows?bgHits/backgroundWindows:0;
  const smoothAnchor=(pattern.windows+.5)/(anchorWindows+1),smoothBg=(bgHits+.5)/(backgroundWindows+1);
  const lift=smoothBg?smoothAnchor/smoothBg:null,delta=anchorPrev-bgPrev;
  if(anchorPrev>=config.minimumAnchorPrevalence&&lift>=config.minimumSpecificityLift&&delta>=config.minimumPrevalenceDelta)return{
    status:'specificity-supported',reason:'The pattern is materially enriched around target anchors versus null/control windows.',anchorWindows,backgroundWindows,anchorHits:pattern.windows,backgroundHits:bgHits,anchorPrevalence:anchorPrev,backgroundPrevalence:bgPrev,lift,prevalenceDelta:delta,
  };
  if(bgPrev>=anchorPrev*config.backgroundNoiseRatio&&delta<=config.backgroundNoiseMaxDelta)return{
    status:'background-noise',reason:'The pattern is almost as prevalent in null/control windows as around target anchors.',anchorWindows,backgroundWindows,anchorHits:pattern.windows,backgroundHits:bgHits,anchorPrevalence:anchorPrev,backgroundPrevalence:bgPrev,lift,prevalenceDelta:delta,
  };
  return{status:'specificity-partial',reason:'Anchor enrichment is visible but does not satisfy the versioned specificity thresholds.',anchorWindows,backgroundWindows,anchorHits:pattern.windows,backgroundHits:bgHits,anchorPrevalence:anchorPrev,backgroundPrevalence:bgPrev,lift,prevalenceDelta:delta};
}

export function verifySemanticProbeEvidenceV2({
  signalId,sourceEvidence=[],backgroundEvidence=[],abilityKnowledge=null,
  minimumIndependentSources=3,minimumAnchorOccurrences=6,config:configInput={},
}={}){
  const config={...SEMANTIC_SPECIFICITY_DEFAULTS,...(configInput||{})};
  const structural=verifySemanticProbeEvidenceV1({signalId,sourceEvidence,minimumIndependentSources,minimumAnchorOccurrences});
  const anchors=collectPatterns(sourceEvidence,signalId),background=collectPatterns(backgroundEvidence,signalId);
  const ranked=[...anchors.map.values()].map(row=>summarizePattern(row,anchors.completeWindows))
    .sort((a,b)=>b.independentSources-a.independentSources||b.windows-a.windows||b.prevalence-a.prevalence||a.rawEvents-b.rawEvents||a.abilityId-b.abilityId);
  const candidate=ranked[0]||null;
  const specificity=structural.status==='reproduced'
    ?specificityAssessment(candidate,background.map,anchors.completeWindows,background.completeWindows,config)
    :{status:'not-eligible',reason:'Structural recurrence must reproduce before specificity is evaluated.',anchorWindows:anchors.completeWindows,backgroundWindows:background.completeWindows};
  const knowledge=knowledgeMap(abilityKnowledge).get(Number(candidate?.abilityId))||null;
  const provider=providerAssessment(knowledge),temporal=temporalAssessment(candidate,config);
  const topologyShare=Number(candidate?.topology?.share||0),topology=String(candidate?.topology?.dominant||'unknown');
  const topologyConsistent=topology!=='unrelated'&&topology!=='unknown-anchor-actors'&&topology!=='no-actors'&&topologyShare>=config.minimumTopologyShare;

  let mechanicalStatus='unverified';
  let mechanicalReason='Specificity has not been established.';
  if(specificity.status==='background-noise'){
    mechanicalStatus='background-noise';mechanicalReason='A recurring neighbor was reproduced, but the null/control baseline shows it is not specific to the target signal.';
  }else if(specificity.status==='specificity-supported'){
    if(provider.encounterSupported||topologyConsistent){
      mechanicalStatus='mechanically-supported';
      mechanicalReason=provider.encounterSupported&&topologyConsistent?'Specificity, encounter provenance and actor topology agree.':provider.encounterSupported?'Specificity plus reviewed encounter-membership evidence support a mechanical relationship candidate.':'Specificity plus consistent actor topology support a mechanical relationship candidate.';
    }else{
      mechanicalStatus='specificity-supported';mechanicalReason='The temporal relationship is specific, but encounter provenance/topology is not strong enough for mechanical support.';
    }
  }else if(specificity.status==='specificity-partial'){
    mechanicalStatus='specificity-partial';mechanicalReason='Some enrichment exists, but the specificity contract is not yet satisfied.';
  }else if(specificity.status==='background-required'){
    mechanicalStatus='background-required';mechanicalReason='Stored anchor evidence is insufficient to distinguish a mechanic from a generally frequent event without null/control windows.';
  }

  return{
    version:SEMANTIC_PROBE_VERIFIER_V2_VERSION,signalId:Number(signalId),
    structural:{status:structural.status,reason:structural.reason,evidence:structural.evidence},
    specificity,
    provider,
    temporal,
    topology:{dominant:topology,share:topologyShare,consistent:topologyConsistent,minimumShare:config.minimumTopologyShare},
    mechanical:{status:mechanicalStatus,reason:mechanicalReason},
    bestPattern:candidate,
    topPatterns:ranked.slice(0,12),
    thresholds:{
      minimumBackgroundWindows:config.minimumBackgroundWindows,minimumAnchorPrevalence:config.minimumAnchorPrevalence,
      minimumSpecificityLift:config.minimumSpecificityLift,minimumPrevalenceDelta:config.minimumPrevalenceDelta,
      backgroundNoiseRatio:config.backgroundNoiseRatio,backgroundNoiseMaxDelta:config.backgroundNoiseMaxDelta,
      minimumTopologyShare:config.minimumTopologyShare,strongTemporalSpreadMs:config.strongTemporalSpreadMs,moderateTemporalSpreadMs:config.moderateTemporalSpreadMs,
    },
    promotion:{eligible:false,automatic:false,reason:'v2 remains diagnostic. A separately versioned promotion contract is required even when mechanically-supported.'},
    canonicalCoverageContribution:{deepReports:0,deepPulls:0},scoreChange:{allowed:false,directDelta:0},
  };
}
