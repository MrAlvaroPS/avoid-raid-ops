import { RELIABILITY_MODEL_VERSION,RELIABILITY_POLICY,RELIABILITY_METRIC_IDS,reliabilityWeightsForRole } from './reliability-policy-v1.mjs';
import { selectPeerBaseline,peerBaselineQuality } from './peer-baseline-v1.mjs';

const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const round=(v,d=1)=>Number.isFinite(Number(v))?Number(Number(v).toFixed(d)):null;
const arr=v=>Array.isArray(v)?v:[];

function confidenceFactor(value,policy=RELIABILITY_POLICY){
  const key=String(value||'unknown').toLowerCase();
  return Number(policy.evidenceConfidence[key]??policy.evidenceConfidence.unknown??0);
}

function rawMechanics(ledger,policy){
  let opportunityMass=0,failureMass=0,failures=0;
  for(const o of arr(ledger?.mechanics?.opportunities)){
    const importance=Number(policy.mechanicSeverityImportance[Math.max(1,Math.min(5,Number(o.severity)||3))]||0.7);
    opportunityMass+=importance;
    if(!o.success){failureMass+=importance*confidenceFactor(o.failure?.confidence||o.confidence,policy);failures++;}
  }
  return rawDimension({opportunityMass,failureMass,opportunityCount:arr(ledger?.mechanics?.opportunities).length,failures,unscored:arr(ledger?.mechanics?.unscoredFailures).length});
}

function rawSurvival(ledger){
  const rows=arr(ledger?.survival?.opportunities),opportunityMass=rows.length;
  const failureMass=rows.reduce((s,r)=>s+clamp(Number(r.incidentPenalty)||0),0);
  return rawDimension({opportunityMass,failureMass,opportunityCount:rows.length,failures:rows.filter(r=>Number(r.incidentPenalty)>0).length,firstDeaths:rows.filter(r=>r.firstMeaningfulDeath).length,meaningfulDeaths:rows.filter(r=>r.meaningfulDeath).length,unscored:0});
}

function rawDefensives(ledger,policy){
  let opportunityMass=0,failureMass=0,failures=0;
  for(const o of arr(ledger?.defensives?.opportunities)){
    const weight=clamp(Number(o.dangerWeight)||1,0.25,1);opportunityMass+=weight;
    if(!o.success){failureMass+=weight*confidenceFactor(o.confidence,policy);failures++;}
  }
  return rawDimension({opportunityMass,failureMass,opportunityCount:arr(ledger?.defensives?.opportunities).length,failures,unscored:arr(ledger?.defensives?.unscored).length});
}

function rawDuties(ledger,policy){
  let opportunityMass=0,failureMass=0,failures=0;
  for(const o of arr(ledger?.duties?.opportunities)){
    const weight=clamp(Number(o.importance)||1,0.25,1);opportunityMass+=weight;
    if(!o.success){failureMass+=weight*confidenceFactor(o.confidence,policy);failures++;}
  }
  return rawDimension({opportunityMass,failureMass,opportunityCount:arr(ledger?.duties?.opportunities).length,failures,unscored:arr(ledger?.duties?.unscored).length});
}

function rawDimension(extra){
  const opportunityMass=Math.max(0,Number(extra.opportunityMass)||0),failureMass=clamp(Number(extra.failureMass)||0,0,opportunityMass||0);
  return{
    ...extra,opportunityMass:round(opportunityMass,3),failureMass:round(failureMass,3),
    successMass:round(Math.max(0,opportunityMass-failureMass),3),
    successRate:opportunityMass>0?clamp((opportunityMass-failureMass)/opportunityMass):null
  };
}

export function buildRawReliabilityProfile(ledger,{policy=RELIABILITY_POLICY}={}){
  return{
    identity:ledger.identity,
    context:ledger.context,
    participation:ledger.participation,
    integrity:ledger.integrity,
    adaptation:ledger.adaptation,
    raw:{
      mechanics:rawMechanics(ledger,policy),
      survival:rawSurvival(ledger),
      defensives:rawDefensives(ledger,policy),
      duties:rawDuties(ledger,policy)
    },
    evidence:{
      mechanicUnscoredFailures:arr(ledger?.mechanics?.unscoredFailures),
      defensiveUnscored:arr(ledger?.defensives?.unscored),
      dutyUnscored:arr(ledger?.duties?.unscored)
    }
  };
}

function dimensionThreshold(dimension,policy){
  if(dimension==='mechanics')return policy.publication.minMechanicOpportunityMass;
  if(dimension==='survival')return policy.publication.minSurvivalPulls;
  if(dimension==='defensives')return policy.publication.minDefensiveOpportunityMass;
  if(dimension==='duties')return policy.publication.minDutyOpportunityMass;
  return Infinity;
}

function finalizeDimension(raw,baseline,dimension,policy){
  const min=dimensionThreshold(dimension,policy),observed=Number(raw?.opportunityMass)||0;
  if(observed<min){
    return{
      id:RELIABILITY_METRIC_IDS[dimension],dimension,status:'pending',value:null,
      reason:`${round(observed,1)} effective opportunities; ${min} required.`,sample:raw,peer:baseline,
      peerQuality:peerBaselineQuality(baseline)
    };
  }
  const priorStrength=Number(policy.priors.equivalentOpportunityStrength)||0;
  const priorRate=clamp(Number(baseline?.successRate));
  const posterior=(Number(raw.successMass)+priorStrength*priorRate)/(observed+priorStrength);
  return{
    id:RELIABILITY_METRIC_IDS[dimension],dimension,status:'scored',value:round(100*clamp(posterior),1),
    rawValue:round(100*Number(raw.successRate),1),sample:raw,
    peer:{...baseline,value:round(100*priorRate,1)},peerQuality:peerBaselineQuality(baseline),
    deltaVsPeer:round(100*(posterior-priorRate),1),
    formula:'posterior=(successMass + priorStrength*peerSuccessRate)/(opportunityMass + priorStrength)'
  };
}

function confidenceForProfile(profile,components,coverage,policy){
  const pulls=Number(profile.participation?.pullsAttended)||0,nights=Number(profile.context?.nights)||0;
  const effective=Object.values(components).reduce((s,c)=>s+(c.status==='scored'?Number(c.sample?.opportunityMass)||0:0),0);
  const identityStatus=profile.identity?.status||'report-scoped';
  const passes=t=>pulls>=t.pulls&&nights>=t.nights&&effective>=t.effectiveOpportunities&&coverage>=t.evidenceCoverage;
  let level=passes(policy.confidence.high)?'high':passes(policy.confidence.medium)?'medium':'low';
  if(identityStatus==='report-scoped')level='low';
  if(identityStatus==='provisional-name-realm'&&level==='high')level='medium';
  return{id:RELIABILITY_METRIC_IDS.confidence,level,pulls,nights,effectiveOpportunities:round(effective,1),evidenceCoverage:round(coverage,3),identityStatus};
}

function publicationGate(profile,components,coverage,confidence,policy){
  const reasons=[],pub=policy.publication;
  const scored=Object.values(components).filter(c=>c.status==='scored').map(c=>c.dimension);
  const pulls=Number(profile.participation?.pullsAttended)||0,nights=Number(profile.context?.nights)||0;
  if(pulls<pub.minPullsAttended)reasons.push(`pulls ${pulls}/${pub.minPullsAttended}`);
  if(nights<pub.minNights)reasons.push(`nights ${nights}/${pub.minNights}`);
  if(profile.identity?.status==='report-scoped')reasons.push('stable cross-report player identity missing');
  for(const dim of pub.requiredDimensions)if(!scored.includes(dim))reasons.push(`${dim} dimension not scored`);
  if(scored.length<pub.minScoredDimensions)reasons.push(`scored dimensions ${scored.length}/${pub.minScoredDimensions}`);
  if(coverage<pub.minScoredWeightCoverage)reasons.push(`weight coverage ${round(100*coverage,0)}%/${round(100*pub.minScoredWeightCoverage,0)}%`);
  return{publishable:reasons.length===0,reasons,scoredDimensions:scored,confidence:confidence.level};
}

function explanation(profile,components,gate,trace){
  const name=profile.identity?.name||'Player';
  if(!gate.publishable){
    const observed=[];
    if(profile.evidence?.mechanicUnscoredFailures?.length)observed.push(`${profile.evidence.mechanicUnscoredFailures.length} classified mechanic failures lack player-level opportunity denominators`);
    if(profile.evidence?.defensiveUnscored?.length)observed.push(`${profile.evidence.defensiveUnscored.length} defensive rows are not scoreable because availability/outcome is unproven`);
    return{
      headline:`${name} Reliability is pending`,
      summary:`No overall score is published until the same evidence contract can defend the denominator and comparison context.`,
      blockers:gate.reasons,
      observedNotScored:observed,
      scoredComponents:Object.values(components).filter(c=>c.status==='scored').map(c=>({dimension:c.dimension,value:c.value,deltaVsPeer:c.deltaVsPeer}))
    };
  }
  const scored=Object.values(components).filter(c=>c.status==='scored').sort((a,b)=>a.value-b.value);
  const lowest=scored[0],highest=scored.at(-1);
  return{
    headline:`${name} Reliability ${trace.value}`,
    summary:`The score is the exact weighted sum of scored execution dimensions; parse/output is excluded.`,
    strongest:highest?`${highest.dimension} ${highest.value} (${highest.deltaVsPeer>=0?'+':''}${highest.deltaVsPeer} vs peer baseline)`:null,
    primaryDrag:lowest?`${lowest.dimension} ${lowest.value} (${lowest.deltaVsPeer>=0?'+':''}${lowest.deltaVsPeer} vs peer baseline)`:null,
    blockers:[]
  };
}

export function scoreReliabilityProfiles(ledgers,{policy=RELIABILITY_POLICY}={}){
  const rawProfiles=arr(ledgers).map(l=>buildRawReliabilityProfile(l,{policy}));
  return rawProfiles.map(profile=>{
    const role=profile.identity?.role||'UNKNOWN',weights=reliabilityWeightsForRole(role);
    const components={};
    for(const dimension of ['mechanics','survival','defensives','duties']){
      const baseline=selectPeerBaseline(rawProfiles,profile,dimension,{policy});
      components[dimension]=finalizeDimension(profile.raw[dimension],baseline,dimension,policy);
    }
    const scored=Object.values(components).filter(c=>c.status==='scored');
    const scoredBaseWeight=scored.reduce((s,c)=>s+Number(weights[c.dimension]||0),0);
    const coverage=Object.entries(weights).reduce((s,[d,w])=>s+(components[d]?.status==='scored'?Number(w):0),0);
    const traceRows=scored.map(c=>{
      const normalizedWeight=scoredBaseWeight>0?Number(weights[c.dimension]||0)/scoredBaseWeight:0;
      return{dimension:c.dimension,componentValue:c.value,baseWeight:Number(weights[c.dimension]||0),effectiveWeight:round(normalizedWeight,4),contribution:round(c.value*normalizedWeight,3)};
    });
    const shadowValue=traceRows.length?round(traceRows.reduce((s,r)=>s+Number(r.contribution||0),0),1):null;
    const confidence=confidenceForProfile(profile,components,coverage,policy);
    const gate=publicationGate(profile,components,coverage,confidence,policy);
    const value=gate.publishable?shadowValue:null;
    const peerOverall=traceRows.length?round(traceRows.reduce((s,r)=>{
      const peer=components[r.dimension]?.peer?.value;return s+(Number.isFinite(Number(peer))?Number(peer)*r.effectiveWeight:0);
    },0),1):null;
    const trace={
      formula:'overall=sum(componentValue*effectiveWeight); effective weights are base role weights renormalized across scored dimensions after publication gates pass',
      value,shadowValue,baseRoleWeights:weights,scoredWeightCoverage:round(coverage,3),rows:traceRows,
      exactContributionSum:round(traceRows.reduce((s,r)=>s+Number(r.contribution||0),0),3)
    };
    const result={
      schemaVersion:1,modelVersion:RELIABILITY_MODEL_VERSION,id:RELIABILITY_METRIC_IDS.overall,
      identity:profile.identity,context:profile.context,participation:profile.participation,
      status:gate.publishable?'published':'shadow-pending',value,shadowValue,
      confidence,components,adaptation:profile.adaptation,publication:gate,scoreTrace:trace,
      peerComparison:{id:RELIABILITY_METRIC_IDS.peerDelta,baselineValue:peerOverall,delta:value!=null&&peerOverall!=null?round(value-peerOverall,1):null,sourceByDimension:Object.fromEntries(Object.entries(components).map(([d,c])=>[d,c.peer?.source||null]))},
      explanation:null,
      dataTruth:{...policy.dataTruth,parseExcluded:true,performanceInputsUsed:[]},
      evidenceSummary:{
        mechanicUnscoredFailures:profile.evidence.mechanicUnscoredFailures.length,
        defensiveUnscored:profile.evidence.defensiveUnscored.length,
        dutyUnscored:profile.evidence.dutyUnscored.length
      }
    };
    result.explanation=explanation(profile,components,gate,{value});
    return result;
  });
}

const confidenceRank={unknown:0,low:1,medium:2,high:3};
export function compareReliabilityProfiles(a,b,{policy=RELIABILITY_POLICY}={}){
  if(!a||!b)return{status:'unavailable',reason:'Both Reliability profiles are required.'};
  const aDims=Object.values(a.components||{}).filter(x=>x.status==='scored').map(x=>x.dimension).sort();
  const bDims=Object.values(b.components||{}).filter(x=>x.status==='scored').map(x=>x.dimension).sort();
  const sameDims=JSON.stringify(aDims)===JSON.stringify(bDims);
  const minRank=confidenceRank[policy.comparison.minimumConfidence]||2;
  const confidenceOk=(confidenceRank[a.confidence?.level]||0)>=minRank&&(confidenceRank[b.confidence?.level]||0)>=minRank;
  const comparable=(!policy.comparison.requireSameScoredDimensions||sameDims)&&confidenceOk;
  const dimensions={};
  for(const d of [...new Set([...aDims,...bDims])]){
    const av=a.components?.[d]?.value,bv=b.components?.[d]?.value;
    dimensions[d]={a:av??null,b:bv??null,delta:Number.isFinite(Number(av))&&Number.isFinite(Number(bv))?round(Number(av)-Number(bv),1):null};
  }
  return{
    status:comparable?'comparable':'context-mismatch',
    comparable,
    reason:comparable?null:!sameDims?'Players do not have the same scored Reliability dimensions.':'Both players need at least medium confidence for overall comparison.',
    a:{key:a.identity?.key,name:a.identity?.name,value:a.value,confidence:a.confidence?.level},
    b:{key:b.identity?.key,name:b.identity?.name,value:b.value,confidence:b.confidence?.level},
    overallDelta:comparable&&a.value!=null&&b.value!=null?round(Number(a.value)-Number(b.value),1):null,
    dimensions
  };
}
