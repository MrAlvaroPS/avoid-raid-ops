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
    const opportunityConfidence=confidenceFactor(o.confidence,policy);
    const mass=importance*opportunityConfidence;
    opportunityMass+=mass;
    if(!o.success){
      const failureConfidence=confidenceFactor(o.failure?.confidence||o.confidence,policy);
      failureMass+=importance*Math.min(opportunityConfidence,failureConfidence);
      failures++;
    }
  }
  return rawDimension({opportunityMass,failureMass,opportunityCount:arr(ledger?.mechanics?.opportunities).length,failures,unscored:arr(ledger?.mechanics?.unscoredFailures).length});
}

function rawSurvival(ledger){
  const rows=arr(ledger?.survival?.opportunities),opportunityMass=rows.length;
  const failureMass=rows.reduce((s,r)=>s+clamp(Number(r.incidentPenalty)||0),0);
  return rawDimension({opportunityMass,failureMass,opportunityCount:rows.length,failures:rows.filter(r=>Number(r.incidentPenalty)>0).length,firstDeaths:rows.filter(r=>r.firstMeaningfulDeath).length,meaningfulDeaths:rows.filter(r=>r.meaningfulDeath).length,unscored:arr(ledger?.survival?.unscored).length});
}

function rawDefensives(ledger,policy){
  let opportunityMass=0,failureMass=0,failures=0;
  for(const o of arr(ledger?.defensives?.opportunities)){
    const confidence=confidenceFactor(o.confidence,policy);
    const mass=clamp(Number(o.dangerWeight)||1,0.25,1)*confidence;
    opportunityMass+=mass;
    if(!o.success){failureMass+=mass;failures++;}
  }
  return rawDimension({opportunityMass,failureMass,opportunityCount:arr(ledger?.defensives?.opportunities).length,failures,unscored:arr(ledger?.defensives?.unscored).length});
}

function rawDuties(ledger,policy){
  let opportunityMass=0,failureMass=0,failures=0;
  for(const o of arr(ledger?.duties?.opportunities)){
    const confidence=confidenceFactor(o.confidence,policy);
    const mass=clamp(Number(o.importance)||1,0.25,1)*confidence;
    opportunityMass+=mass;
    if(!o.success){failureMass+=mass;failures++;}
  }
  return rawDimension({opportunityMass,failureMass,opportunityCount:arr(ledger?.duties?.opportunities).length,failures,unscored:arr(ledger?.duties?.unscored).length});
}

function rawDimension(extra){
  const opportunityMass=Math.max(0,Number(extra.opportunityMass)||0);
  const rawFailure=Math.max(0,Number(extra.failureMass)||0);
  const failureMass=clamp(rawFailure,0,opportunityMass||0);
  return{
    ...extra,opportunityMass:round(opportunityMass,3),failureMass:round(failureMass,3),
    successMass:round(Math.max(0,opportunityMass-failureMass),3),
    successRate:opportunityMass>0?clamp((opportunityMass-failureMass)/opportunityMass):null,
    massInvariantOk:rawFailure<=opportunityMass+1e-9
  };
}

export function buildRawReliabilityProfile(ledger,{policy=RELIABILITY_POLICY}={}){
  return{
    identity:ledger.identity,
    context:ledger.context,
    participation:ledger.participation,
    integrity:ledger.integrity,
    validation:ledger.validation||{ok:true,status:'valid',errors:[],warnings:[]},
    adaptation:ledger.adaptation,
    raw:{
      mechanics:rawMechanics(ledger,policy),
      survival:rawSurvival(ledger),
      defensives:rawDefensives(ledger,policy),
      duties:rawDuties(ledger,policy)
    },
    evidence:{
      mechanicUnscoredFailures:arr(ledger?.mechanics?.unscoredFailures),
      survivalUnscored:arr(ledger?.survival?.unscored),
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

function absoluteDimension(raw,dimension,policy){
  const min=dimensionThreshold(dimension,policy),observed=Number(raw?.opportunityMass)||0;
  const priorStrength=Number(policy.priors.equivalentOpportunityStrength)||0;
  const priorRate=clamp(Number(policy.priors.scoringSuccessRate[dimension]));
  if(observed<min){
    return{
      id:RELIABILITY_METRIC_IDS[dimension],dimension,status:'pending',value:null,
      reason:`${round(observed,1)} effective opportunities; ${min} required.`,sample:raw,
      scoringPrior:{successRate:priorRate,value:round(priorRate*100,1),strength:priorStrength,source:`policy-${policy.version}`},
      formula:'posterior=(successMass + priorStrength*fixedPolicySuccessRate)/(opportunityMass + priorStrength)'
    };
  }
  const posterior=(Number(raw.successMass)+priorStrength*priorRate)/(observed+priorStrength);
  return{
    id:RELIABILITY_METRIC_IDS[dimension],dimension,status:'scored',value:round(100*clamp(posterior),1),
    rawValue:round(100*Number(raw.successRate),1),sample:raw,
    scoringPrior:{successRate:priorRate,value:round(priorRate*100,1),strength:priorStrength,source:`policy-${policy.version}`},
    formula:'posterior=(successMass + priorStrength*fixedPolicySuccessRate)/(opportunityMass + priorStrength)'
  };
}

function componentWhy(component,baseline){
  const d=component.dimension,raw=component.sample||{},peerValue=Number(baseline?.value);
  const peer=`${baseline?.source||'unknown'}${Number.isFinite(peerValue)?` ${round(peerValue,1)}`:''}`;
  if(component.status!=='scored')return `${round(raw.opportunityMass||0,1)} effective opportunities observed; ${dimensionThreshold(d,RELIABILITY_POLICY)} required before ${d} can score. Absolute scoring prior: ${component.scoringPrior?.value}. Peer context: ${peer}.`;
  const delta=Number.isFinite(peerValue)?round(Number(component.value)-peerValue,1):null;
  const suffix=delta==null?`Peer context: ${peer}.`:`${delta>=0?'+':''}${delta} vs ${peer}.`;
  if(d==='survival')return `${raw.firstDeaths||0} first meaningful deaths and ${Math.max(0,(raw.meaningfulDeaths||0)-(raw.firstDeaths||0))} later meaningful deaths across ${raw.opportunityCount||0} attended pulls. Score ${component.value}; ${suffix}`;
  if(d==='mechanics')return `${raw.failures||0} failed player-owned mechanic opportunities from ${raw.opportunityCount||0} proven opportunities (${round(raw.failureMass||0,2)} weighted failure mass). Score ${component.value}; ${suffix}`;
  if(d==='defensives')return `${raw.failures||0} missed/late uses from ${raw.opportunityCount||0} confirmed-available defensive windows (${round(raw.failureMass||0,2)} weighted failure mass). Score ${component.value}; ${suffix}`;
  if(d==='duties')return `${raw.failures||0} failed assigned duties from ${raw.opportunityCount||0} proven duty opportunities. Score ${component.value}; ${suffix}`;
  return `${d} score ${component.value}; ${suffix}`;
}

function decorateComponent(component,baseline){
  const peerValue=Number(baseline?.value);
  const delta=component.status==='scored'&&Number.isFinite(peerValue)?round(Number(component.value)-peerValue,1):null;
  return{
    ...component,
    peer:baseline,
    peerQuality:peerBaselineQuality(baseline),
    deltaVsPeer:delta,
    why:componentWhy(component,baseline)
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
  if(profile.validation?.ok===false)level='low';
  return{id:RELIABILITY_METRIC_IDS.confidence,level,pulls,nights,effectiveOpportunities:round(effective,1),evidenceCoverage:round(coverage,3),identityStatus};
}

function publicationGate(profile,components,coverage,confidence,policy){
  const reasons=[],pub=policy.publication;
  const scored=Object.values(components).filter(c=>c.status==='scored').map(c=>c.dimension);
  const pulls=Number(profile.participation?.pullsAttended)||0,nights=Number(profile.context?.nights)||0;
  if(profile.validation?.ok===false)reasons.push(`data integrity: ${(profile.validation.errors||[]).join('; ')}`);
  if(Object.values(profile.raw||{}).some(x=>x?.massInvariantOk===false))reasons.push('weighted opportunity/failure mass invariant failed');
  if(pulls<pub.minPullsAttended)reasons.push(`pulls ${pulls}/${pub.minPullsAttended}`);
  if(nights<pub.minNights)reasons.push(`nights ${nights}/${pub.minNights}`);
  if(profile.identity?.status==='report-scoped')reasons.push('stable cross-report player identity missing');
  for(const dim of pub.requiredDimensions)if(!scored.includes(dim))reasons.push(`${dim} dimension not scored`);
  if(scored.length<pub.minScoredDimensions)reasons.push(`scored dimensions ${scored.length}/${pub.minScoredDimensions}`);
  if(coverage<pub.minScoredWeightCoverage)reasons.push(`weight coverage ${round(100*coverage,0)}%/${round(100*pub.minScoredWeightCoverage,0)}%`);
  return{publishable:reasons.length===0,reasons,scoredDimensions:scored,confidence:confidence.level,dataIntegrity:profile.validation};
}

function explanation(profile,components,gate,trace){
  const name=profile.identity?.name||'Player';
  const breakdown=Object.values(components).map(c=>({dimension:c.dimension,status:c.status,value:c.value,why:c.why,peerSource:c.peer?.source||null,peerValue:c.peer?.value??null,deltaVsPeer:c.deltaVsPeer??null}));
  if(!gate.publishable){
    const observed=[];
    if(profile.validation?.ok===false)observed.push(`Data integrity error: ${(profile.validation.errors||[]).join('; ')}`);
    if(profile.evidence?.mechanicUnscoredFailures?.length)observed.push(`${profile.evidence.mechanicUnscoredFailures.length} classified mechanic failures lack player-level opportunity denominators`);
    if(profile.evidence?.survivalUnscored?.length)observed.push(`${profile.evidence.survivalUnscored.length} survival rows are unavailable because the death stream is incomplete`);
    if(profile.evidence?.defensiveUnscored?.length)observed.push(`${profile.evidence.defensiveUnscored.length} defensive rows are not scoreable because availability/outcome is unproven`);
    return{
      headline:`${name} Reliability is pending`,
      summary:'No overall score is published until the same evidence contract can defend the denominator, mandatory dimensions and comparison context.',
      blockers:gate.reasons,observedNotScored:observed,breakdown,
      scoredComponents:breakdown.filter(c=>c.status==='scored')
    };
  }
  const scored=Object.values(components).filter(c=>c.status==='scored').sort((a,b)=>a.value-b.value);
  const lowest=scored[0],highest=scored.at(-1);
  return{
    headline:`${name} Reliability ${trace.value}`,
    summary:'The score is the exact weighted sum of absolute execution dimensions; peer groups explain comparison but do not move the score. Parse/output is excluded.',
    strongest:highest?`${highest.dimension} ${highest.value} (${highest.deltaVsPeer>=0?'+':''}${highest.deltaVsPeer} vs ${highest.peer?.source||'reference'})`:null,
    primaryDrag:lowest?`${lowest.dimension} ${lowest.value} (${lowest.deltaVsPeer>=0?'+':''}${lowest.deltaVsPeer} vs ${lowest.peer?.source||'reference'})`:null,
    blockers:[],breakdown
  };
}

export function scoreReliabilityProfiles(ledgers,{policy=RELIABILITY_POLICY}={}){
  const rawProfiles=arr(ledgers).map(l=>buildRawReliabilityProfile(l,{policy}));
  const absolute=rawProfiles.map(profile=>({
    ...profile,
    components:Object.fromEntries(['mechanics','survival','defensives','duties'].map(d=>[d,absoluteDimension(profile.raw[d],d,policy)]))
  }));

  return absolute.map(profile=>{
    const role=profile.identity?.role||'UNKNOWN',weights=reliabilityWeightsForRole(role);
    const components=Object.fromEntries(Object.entries(profile.components).map(([dimension,component])=>{
      const peer=selectPeerBaseline(absolute,profile,dimension,{policy});
      return[dimension,decorateComponent(component,peer)];
    }));
    const scored=Object.values(components).filter(c=>c.status==='scored');
    const scoredBaseWeight=scored.reduce((s,c)=>s+Number(weights[c.dimension]||0),0);
    const coverage=Object.entries(weights).reduce((s,[d,w])=>s+(components[d]?.status==='scored'?Number(w):0),0);
    const traceRows=scored.map(c=>{
      const normalizedWeight=scoredBaseWeight>0?Number(weights[c.dimension]||0)/scoredBaseWeight:0;
      return{dimension:c.dimension,componentValue:c.value,baseWeight:Number(weights[c.dimension]||0),effectiveWeight:round(normalizedWeight,4),contribution:round(c.value*normalizedWeight,3),why:c.why};
    });
    const shadowValue=traceRows.length?round(traceRows.reduce((s,r)=>s+Number(r.contribution||0),0),1):null;
    const confidence=confidenceForProfile(profile,components,coverage,policy);
    const gate=publicationGate(profile,components,coverage,confidence,policy);
    const value=gate.publishable?shadowValue:null;
    const peerOverall=traceRows.length?round(traceRows.reduce((s,r)=>{
      const peer=components[r.dimension]?.peer?.value;return s+(Number.isFinite(Number(peer))?Number(peer)*r.effectiveWeight:0);
    },0),1):null;
    const peerIsReal=traceRows.some(r=>components[r.dimension]?.peer?.peerCount>0);
    const trace={
      formula:'overall=sum(componentValue*effectiveWeight); component values use fixed versioned policy priors; peer benchmarks never enter the score',
      value,shadowValue,baseRoleWeights:weights,scoredWeightCoverage:round(coverage,3),rows:traceRows,
      exactContributionSum:round(traceRows.reduce((s,r)=>s+Number(r.contribution||0),0),3)
    };
    const status=profile.validation?.ok===false?'data-error':gate.publishable?'published':'shadow-pending';
    const result={
      schemaVersion:1,modelVersion:RELIABILITY_MODEL_VERSION,id:RELIABILITY_METRIC_IDS.overall,
      identity:profile.identity,context:profile.context,participation:profile.participation,
      status,value,shadowValue,
      confidence,components,adaptation:profile.adaptation,publication:gate,scoreTrace:trace,
      peerComparison:{id:RELIABILITY_METRIC_IDS.peerDelta,baselineValue:peerOverall,baselineKind:peerIsReal?'observed-peer':'policy-reference',delta:value!=null&&peerOverall!=null?round(value-peerOverall,1):null,sourceByDimension:Object.fromEntries(Object.entries(components).map(([d,c])=>[d,c.peer?.source||null]))},
      explanation:null,
      dataIntegrity:profile.validation,
      dataTruth:{...policy.dataTruth,parseExcluded:true,performanceInputsUsed:[],peerAffectsScore:false},
      evidenceSummary:{
        mechanicUnscoredFailures:profile.evidence.mechanicUnscoredFailures.length,
        survivalUnscored:profile.evidence.survivalUnscored.length,
        defensiveUnscored:profile.evidence.defensiveUnscored.length,
        dutyUnscored:profile.evidence.dutyUnscored.length
      }
    };
    result.explanation=explanation(profile,components,gate,{value});
    return result;
  });
}

const confidenceRank={unknown:0,low:1,medium:2,high:3};
const sameContext=(a,b)=>Number(a?.context?.encounterId)===Number(b?.context?.encounterId)
  && Number(a?.context?.difficulty)===Number(b?.context?.difficulty)
  && (a?.context?.partition==null||b?.context?.partition==null||Number(a.context.partition)===Number(b.context.partition));

export function compareReliabilityProfiles(a,b,{policy=RELIABILITY_POLICY}={}){
  if(!a||!b)return{status:'unavailable',reason:'Both Reliability profiles are required.'};
  const aDims=Object.values(a.components||{}).filter(x=>x.status==='scored').map(x=>x.dimension).sort();
  const bDims=Object.values(b.components||{}).filter(x=>x.status==='scored').map(x=>x.dimension).sort();
  const sameDims=JSON.stringify(aDims)===JSON.stringify(bDims);
  const minRank=confidenceRank[policy.comparison.minimumConfidence]||2;
  const confidenceOk=(confidenceRank[a.confidence?.level]||0)>=minRank&&(confidenceRank[b.confidence?.level]||0)>=minRank;
  const integrityOk=a.dataIntegrity?.ok!==false&&b.dataIntegrity?.ok!==false;
  const published=a.status==='published'&&b.status==='published'&&a.value!=null&&b.value!=null;
  const versionOk=a.modelVersion===b.modelVersion;
  const contextOk=sameContext(a,b);
  const comparable=published&&versionOk&&contextOk&&integrityOk&&(!policy.comparison.requireSameScoredDimensions||sameDims)&&confidenceOk;
  const dimensions={};
  for(const d of [...new Set([...aDims,...bDims])]){
    const av=a.components?.[d]?.value,bv=b.components?.[d]?.value;
    dimensions[d]={a:av??null,b:bv??null,delta:Number.isFinite(Number(av))&&Number.isFinite(Number(bv))?round(Number(av)-Number(bv),1):null};
  }
  const relationship=String(a.identity?.spec||'').toLowerCase()===String(b.identity?.spec||'').toLowerCase()?'same-spec':String(a.identity?.className||'').toLowerCase()===String(b.identity?.className||'').toLowerCase()?'same-class':String(a.identity?.role||'').toLowerCase()===String(b.identity?.role||'').toLowerCase()?'same-role':'cross-role';
  return{
    status:comparable?'comparable':'context-mismatch',comparable,relationship,
    reason:comparable?null:!published?'Both players need a published Reliability score before overall comparison.':!versionOk?'Players use different Reliability model versions.':!contextOk?'Players are not in the same encounter/difficulty/partition context.':!integrityOk?'At least one profile has a Reliability data-integrity error.':!sameDims?'Players do not have the same scored Reliability dimensions.':'Both players need at least medium confidence for overall comparison.',
    a:{key:a.identity?.key,name:a.identity?.name,value:a.value,confidence:a.confidence?.level,status:a.status},
    b:{key:b.identity?.key,name:b.identity?.name,value:b.value,confidence:b.confidence?.level,status:b.status},
    overallDelta:comparable?round(Number(a.value)-Number(b.value),1):null,
    dimensions
  };
}
