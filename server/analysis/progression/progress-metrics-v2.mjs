const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const num=v=>finite(v)?Number(v):null;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)));

export const PROGRESS_METRICS_VERSION='2.0.0';

/**
 * Progress v2 policy is deliberately boss-agnostic. All strategic metrics use
 * the same metric-eligible pull population and the same CURRENT FORM window.
 * Changes to these values change metric semantics and require a version review.
 */
export const PROGRESS_METRIC_POLICY=Object.freeze({
  currentFormPulls:20,
  previousFormPulls:20,
  // Compatibility aliases for older consumers/documentation.
  currentBlockPulls:20,
  previousBlockPulls:20,
  deepPullMarginPp:10,
  breakthroughDepthPp:2,
  retentionClosingPulls:5,
  retentionRollingPulls:3,
  retentionTolerancePp:2,
  retentionBaselineMaxPct:97.5,
  throughputGapCapMinutes:30,
  matrixWindowPulls:20,
  matrixMaxPulls:160,
  stableStageConversionPct:70,
  stableDeepPullRatePct:50,
  stableConsistencyGapPp:15,
  convertingStageDeltaPp:10,
  improvingDeepDeltaPp:10,
  improvingGapPp:5,
  plateauPulls:40,
  plateauNights:2,
  minEligiblePullsForState:5,
  exactHundredEpsilon:0.001,
  stageContradictionMinStage:2,
  bossFightDisagreementPp:20,
  qualityExactHundredReviewSharePct:35,
  qualityExcludedReviewSharePct:10,
  qualityWarningPartialSharePct:15,
  qualityAuditRows:60
});

export function median(values=[]){
  const a=values.filter(finite).map(Number).sort((x,y)=>x-y);
  if(!a.length)return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}

export function rate(n,d){return d>0?100*Number(n)/Number(d):null;}

export function progressValue(pull){
  if(pull?.kill)return 0;
  const value=num(pull?.fightPercentage);
  return value!=null&&value>=0&&value<=100?value:null;
}

function isExactHundred(value,policy){
  return value!=null&&Math.abs(Number(value)-100)<=policy.exactHundredEpsilon;
}

/**
 * Metric eligibility is intentionally separate from analytical-pull eligibility.
 * A fight may remain part of the raw raid history while being withheld from
 * strategic progression formulas when its progress fields contradict each other.
 * Raw source values are never rewritten.
 */
export function classifyProgressMetricEligibility(pull,policy=PROGRESS_METRIC_POLICY){
  const value=progressValue(pull);
  const stage=Math.max(1,num(pull?.stageCount)??1);
  const boss=num(pull?.bossPercentage);
  const duration=num(pull?.durationMs);
  const flags=[];

  if(pull?.kill){
    return {eligible:true,reason:'kill',severity:'confirmed',flags,value:0};
  }
  if(value==null){
    return {eligible:false,reason:'missing-or-invalid-fight-percentage',severity:'error',flags:['missing-progress-value'],value:null};
  }

  const exact100=isExactHundred(value,policy);
  if(exact100)flags.push('exact-100-fight-progress');
  if(exact100&&stage>=policy.stageContradictionMinStage){
    flags.push('fight-progress-contradicts-stage');
    return {eligible:false,reason:'fight-progress-100-after-stage-transition',severity:'error',flags,value};
  }

  if(boss!=null&&Math.abs(value-boss)>=policy.bossFightDisagreementPp){
    // WCL explicitly documents fightPercentage as the authoritative completion
    // field for complicated/multi-boss/healing encounters. This disagreement is
    // diagnostic only; it is not generic evidence that either field is wrong.
    flags.push('boss-fight-percentage-disagreement');
  }
  if(duration!=null&&duration<=0){
    return {eligible:false,reason:'non-positive-duration',severity:'error',flags:[...flags,'invalid-duration'],value};
  }

  return {
    eligible:true,
    reason:exact100?'wcl-no-measurable-completion':'wcl-fight-percentage',
    severity:flags.length?'review':'confirmed',
    flags,
    value
  };
}

export function canonicalizeProgressPulls(input=[],options={}){
  const policy={...PROGRESS_METRIC_POLICY,...(options.policy||{})};
  const rows=(input||[]).filter(Boolean).map((p,index)=>({...p,__inputIndex:index}));
  rows.sort((a,b)=>{
    const at=num(a.absoluteStartTime),bt=num(b.absoluteStartTime);
    if(at!=null&&bt!=null&&at!==bt)return at-bt;
    if(at!=null&&bt==null)return -1;
    if(at==null&&bt!=null)return 1;
    const ag=num(a.globalPullNumber??a.pullNumber),bg=num(b.globalPullNumber??b.pullNumber);
    if(ag!=null&&bg!=null&&ag!==bg)return ag-bg;
    return a.__inputIndex-b.__inputIndex;
  });

  return rows.map((p,index)=>{
    const stage=Math.max(1,num(p.stageCount)??1);
    const normalized={
      ...p,
      pullNumber:index+1,
      globalPullNumber:index+1,
      fightPercentage:progressValue(p),
      bossPercentage:num(p.bossPercentage),
      durationMs:num(p.durationMs),
      stageCount:stage,
      kill:Boolean(p.kill),
      absoluteStartTime:num(p.absoluteStartTime),
      absoluteEndTime:num(p.absoluteEndTime),
      sessionIndex:num(p.sessionIndex)??1,
      __inputIndex:undefined
    };
    const verdict=classifyProgressMetricEligibility(normalized,policy);
    return {
      ...normalized,
      progressScored:verdict.value!=null,
      progressMetricEligible:verdict.eligible,
      progressMetricReason:verdict.reason,
      progressMetricSeverity:verdict.severity,
      progressMetricFlags:verdict.flags,
      progressMetricValue:verdict.value
    };
  });
}

export function groupProgressNights(pulls=[]){
  const map=new Map();
  for(const pull of pulls){
    const key=pull.sessionId||`session-${pull.sessionIndex||1}`;
    if(!map.has(key))map.set(key,[]);
    map.get(key).push(pull);
  }

  return [...map.entries()].map(([sessionId,rows],index)=>{
    const ordered=rows.slice().sort((a,b)=>(num(a.absoluteStartTime)??a.pullNumber)-(num(b.absoluteStartTime)??b.pullNumber));
    const eligible=ordered.filter(p=>p.progressMetricEligible);
    const values=eligible.map(progressValue).filter(finite);
    const reports=[...new Set(ordered.flatMap(p=>Array.isArray(p.reportCodes)?p.reportCodes:[]).filter(Boolean))];
    return {
      sessionId,
      sessionIndex:index+1,
      startTime:num(ordered.find(p=>num(p.absoluteStartTime)!=null)?.absoluteStartTime)??num(ordered[0]?.sessionStartTime),
      endTime:num([...ordered].reverse().find(p=>num(p.absoluteEndTime)!=null)?.absoluteEndTime),
      title:ordered.find(p=>p.sessionTitle)?.sessionTitle||null,
      pulls:ordered.length,
      metricEligiblePulls:eligible.length,
      metricExcludedPulls:ordered.length-eligible.length,
      scoredPulls:values.length,
      unscoredPulls:ordered.length-values.length,
      kills:ordered.filter(p=>p.kill).length,
      bestFightPercentage:values.length?Math.min(...values):null,
      medianFightPercentage:median(values),
      firstGlobalPull:ordered[0]?.pullNumber??null,
      lastGlobalPull:ordered.at(-1)?.pullNumber??null,
      sourceReports:reports.length||1,
      reportCodes:reports,
      rows:ordered,
      eligibleRows:eligible
    };
  });
}

function blockMetrics(eligiblePulls,policy){
  const best=eligiblePulls.slice().sort((a,b)=>progressValue(a)-progressValue(b))[0]||null;
  const bestPct=progressValue(best);
  const current=eligiblePulls.slice(-policy.currentFormPulls);
  const previous=eligiblePulls.slice(-(policy.currentFormPulls+policy.previousFormPulls),-policy.currentFormPulls);
  const deepThreshold=bestPct==null?null:clamp(bestPct+policy.deepPullMarginPp,0,100);
  const deepRate=block=>deepThreshold==null||!block.length?null:rate(block.filter(p=>progressValue(p)<=deepThreshold).length,block.length);
  const currentDeep=deepRate(current),previousDeep=deepRate(previous);
  const currentMedian=median(current.map(progressValue)),previousMedian=median(previous.map(progressValue));
  const beforeCurrent=eligiblePulls.slice(0,Math.max(0,eligiblePulls.length-current.length));
  const bestBefore=beforeCurrent.slice().sort((a,b)=>progressValue(a)-progressValue(b))[0]||best;
  const bestBeforePct=progressValue(bestBefore);
  const gap=currentMedian!=null&&bestPct!=null?Math.max(0,currentMedian-bestPct):null;
  const previousGap=previousMedian!=null&&bestBeforePct!=null?Math.max(0,previousMedian-bestBeforePct):null;
  const deepest=Math.max(1,...eligiblePulls.map(p=>Number(p.stageCount)||1));
  const stageRate=block=>block.length?rate(block.filter(p=>Number(p.stageCount)>=deepest).length,block.length):null;
  const currentStage=stageRate(current),previousStage=stageRate(previous);
  return {
    bestPull:best?{pullNumber:best.pullNumber,fightPercentage:bestPct,kill:best.kill,stageCount:best.stageCount,absoluteStartTime:best.absoluteStartTime,sessionId:best.sessionId}:null,
    bestPct,
    currentBlock:{pulls:current.length,metricEligiblePulls:current.length,firstGlobalPull:current[0]?.pullNumber??null,lastGlobalPull:current.at(-1)?.pullNumber??null},
    previousBlock:{pulls:previous.length,metricEligiblePulls:previous.length,firstGlobalPull:previous[0]?.pullNumber??null,lastGlobalPull:previous.at(-1)?.pullNumber??null},
    scope:`latest-${policy.currentFormPulls}-metric-eligible-pulls`,
    deepThreshold,
    currentDeepRatePct:currentDeep,
    previousDeepRatePct:previousDeep,
    deepDeltaPp:currentDeep!=null&&previousDeep!=null?currentDeep-previousDeep:null,
    currentMedianPct:currentMedian,
    previousMedianPct:previousMedian,
    consistencyGapPp:gap,
    previousConsistencyGapPp:previousGap,
    consistencyGapImprovementPp:gap!=null&&previousGap!=null?previousGap-gap:null,
    deepestStage:deepest,
    currentStageConversionPct:currentStage,
    previousStageConversionPct:previousStage,
    stageConversionDeltaPp:currentStage!=null&&previousStage!=null?currentStage-previousStage:null
  };
}

function breakthroughMetrics(eligiblePulls,nightBySession,policy){
  if(!eligiblePulls.length)return {latest:null,pullsSince:null,nightsSince:null,count:0,scope:'metric-eligible-history'};
  let meaningfulBest=progressValue(eligiblePulls[0])??100;
  let deepest=Number(eligiblePulls[0].stageCount)||1;
  const events=[];
  for(let i=1;i<eligiblePulls.length;i++){
    const p=eligiblePulls[i],value=progressValue(p),stage=Number(p.stageCount)||1;
    const reasons=[];
    if(p.kill)reasons.push('kill');
    if(stage>deepest)reasons.push(`stage ${stage}`);
    if(value!=null&&value<=meaningfulBest-policy.breakthroughDepthPp)reasons.push(`${(meaningfulBest-value).toFixed(1)}pp depth`);
    if(reasons.length){
      events.push({pullNumber:p.pullNumber,sessionId:p.sessionId,absoluteStartTime:p.absoluteStartTime,stageCount:stage,fightPercentage:value,reasons,index:i});
      if(value!=null)meaningfulBest=value;
    }
    if(stage>deepest)deepest=stage;
  }
  const latest=events.at(-1)||null;
  const lastNight=nightBySession.get(eligiblePulls.at(-1)?.sessionId)?.sessionIndex??1;
  const latestNight=latest?nightBySession.get(latest.sessionId)?.sessionIndex:null;
  return {
    latest:latest?{pullNumber:latest.pullNumber,sessionId:latest.sessionId,absoluteStartTime:latest.absoluteStartTime,stageCount:latest.stageCount,fightPercentage:latest.fightPercentage,reasons:latest.reasons}:null,
    pullsSince:latest?Math.max(0,eligiblePulls.length-1-latest.index):Math.max(0,eligiblePulls.length-1),
    nightsSince:latestNight!=null?Math.max(0,lastNight-latestNight):Math.max(0,lastNight-1),
    count:events.length,
    scope:'metric-eligible-history'
  };
}

function retentionMetrics(nights,policy){
  if(nights.length<2)return {available:false,reason:'need-two-nights',scope:'metric-eligible-pulls'};
  const previous=nights.at(-2),current=nights.at(-1);
  const previousEligible=previous.eligibleRows||[];
  const currentEligible=current.eligibleRows||[];
  if(previousEligible.length<policy.retentionClosingPulls||currentEligible.length<policy.retentionRollingPulls){
    return {available:false,reason:'insufficient-eligible-pulls',previousEligible:previousEligible.length,currentEligible:currentEligible.length,scope:'metric-eligible-pulls'};
  }
  const closing=median(previousEligible.slice(-policy.retentionClosingPulls).map(progressValue));
  if(closing==null)return {available:false,reason:'no-closing-baseline',scope:'metric-eligible-pulls'};
  if(closing>=policy.retentionBaselineMaxPct){
    return {available:false,reason:'weak-closing-baseline',previousClosingPct:closing,scope:'metric-eligible-pulls'};
  }
  const threshold=closing+policy.retentionTolerancePp;
  let recoveryIndex=null;
  for(let i=policy.retentionRollingPulls-1;i<currentEligible.length;i++){
    const m=median(currentEligible.slice(i-policy.retentionRollingPulls+1,i+1).map(progressValue));
    if(m!=null&&m<=threshold){recoveryIndex=i;break;}
  }
  if(recoveryIndex==null){
    return {available:true,recovered:false,previousClosingPct:closing,thresholdPct:threshold,currentPulls:current.rows.length,currentEligiblePulls:currentEligible.length,scope:'metric-eligible-pulls'};
  }
  const recovery=currentEligible[recoveryIndex],first=current.rows[0];
  const minutes=num(first?.absoluteStartTime)!=null&&num(recovery?.absoluteEndTime)!=null?Math.max(0,(recovery.absoluteEndTime-first.absoluteStartTime)/60000):null;
  return {available:true,recovered:true,pullsToRecover:recoveryIndex+1,minutes,previousClosingPct:closing,thresholdPct:threshold,scope:'metric-eligible-pulls'};
}

function throughputForNight(night,policy){
  const rows=night.rows.filter(p=>num(p.absoluteStartTime)!=null&&num(p.absoluteEndTime)!=null);
  if(rows.length<2)return null;
  let activeMs=rows.reduce((sum,p)=>sum+Math.max(0,(p.absoluteEndTime-p.absoluteStartTime)||(p.durationMs||0)),0);
  const gaps=[];
  for(let i=1;i<rows.length;i++){
    const gapMs=Math.max(0,rows[i].absoluteStartTime-rows[i-1].absoluteEndTime);
    const gapMinutes=gapMs/60000;
    if(gapMinutes<policy.throughputGapCapMinutes){activeMs+=gapMs;gaps.push(gapMinutes);}
  }
  const activeMinutes=Math.max(1,activeMs/60000);
  return {pulls:rows.length,activeMinutes,pullsPerHour:rows.length/(activeMinutes/60),medianDowntimeMinutes:median(gaps)};
}

function throughputMetrics(nights,policy){
  if(!nights.length)return {available:false,reason:'no-nights',scope:'raw-analytical-night'};
  const current=throughputForNight(nights.at(-1),policy);
  if(!current)return {available:false,reason:'insufficient-timestamps',scope:'raw-analytical-night'};
  const previous=nights.length>1?throughputForNight(nights.at(-2),policy):null;
  return {available:true,current,previous,deltaPullsPerHour:previous?current.pullsPerHour-previous.pullsPerHour:null,scope:'raw-analytical-night'};
}

function matrixMetrics(eligiblePulls,policy){
  const source=eligiblePulls.slice(-policy.matrixMaxPulls);
  const deepest=Math.max(1,...eligiblePulls.map(p=>Number(p.stageCount)||1));
  const windows=[];
  for(let i=0;i<source.length;i+=policy.matrixWindowPulls){
    const rows=source.slice(i,i+policy.matrixWindowPulls);
    windows.push({
      eligibleFirst:i+1,
      eligibleLast:i+rows.length,
      firstGlobalPull:rows[0]?.pullNumber??null,
      lastGlobalPull:rows.at(-1)?.pullNumber??null,
      pulls:rows.length,
      complete:rows.length===policy.matrixWindowPulls,
      stages:Array.from({length:deepest},(_,idx)=>{
        const stage=idx+1,hit=rows.filter(p=>Number(p.stageCount)>=stage).length;
        return {stage,hit,pulls:rows.length,ratePct:rate(hit,rows.length)};
      })
    });
  }
  return {deepestStage:deepest,windowSize:policy.matrixWindowPulls,maxPulls:policy.matrixMaxPulls,population:'metric-eligible-pulls',windows};
}

function summarizeDataQuality(pulls,eligiblePulls,policy,invariants){
  const excluded=pulls.filter(p=>!p.progressMetricEligible);
  const exactHundred=pulls.filter(p=>(p.progressMetricFlags||[]).includes('exact-100-fight-progress'));
  const contradictions=pulls.filter(p=>(p.progressMetricFlags||[]).includes('fight-progress-contradicts-stage'));
  const review=pulls.filter(p=>p.progressMetricEligible&&(p.progressMetricFlags||[]).length);
  const excludedShare=rate(excluded.length,pulls.length)??0;
  const warningShare=rate(review.length,pulls.length)??0;
  const exactShare=rate(exactHundred.length,pulls.length)??0;
  const reasonCounts={};
  for(const p of pulls){
    if(!p.progressMetricEligible)reasonCounts[p.progressMetricReason]=(reasonCounts[p.progressMetricReason]||0)+1;
    for(const flag of p.progressMetricFlags||[])reasonCounts[flag]=(reasonCounts[flag]||0)+1;
  }

  let grade='GOOD',holdStrategicState=false;
  const notes=[];
  if(!Object.values(invariants).every(Boolean)){
    grade='BLOCKED';holdStrategicState=true;notes.push('Canonical Progress invariants failed.');
  }else if(contradictions.length||excludedShare>=policy.qualityExcludedReviewSharePct||exactShare>=policy.qualityExactHundredReviewSharePct){
    grade='REVIEW';holdStrategicState=true;
  }else if(warningShare>=policy.qualityWarningPartialSharePct||excluded.length){
    grade='PARTIAL';
  }
  if(exactHundred.length)notes.push(`${exactHundred.length}/${pulls.length} raw pulls have exact 100.0% WCL fight progress.`);
  if(contradictions.length)notes.push(`${contradictions.length} pulls report 100.0% completion after a later absolute stage was reached.`);
  if(excluded.length)notes.push(`${excluded.length} raw analytical pulls are excluded from strategic Progress formulas but remain auditable.`);

  const auditRows=pulls
    .filter(p=>!p.progressMetricEligible||(p.progressMetricFlags||[]).length)
    .slice(-policy.qualityAuditRows)
    .map(p=>({
      globalPullNumber:p.pullNumber,
      sessionId:p.sessionId||null,
      sessionIndex:p.sessionIndex||null,
      reportCodes:Array.isArray(p.reportCodes)?p.reportCodes:[],
      fightIds:Array.isArray(p.fightIds)?p.fightIds:[],
      durationMs:p.durationMs,
      fightPercentage:p.fightPercentage,
      bossPercentage:p.bossPercentage,
      stageCount:p.stageCount,
      kill:p.kill,
      metricEligible:p.progressMetricEligible,
      reason:p.progressMetricReason,
      severity:p.progressMetricSeverity,
      flags:p.progressMetricFlags||[]
    }));

  return {
    version:'progress-data-quality-v1',
    grade,
    holdStrategicState,
    rawPulls:pulls.length,
    metricEligiblePulls:eligiblePulls.length,
    metricExcludedPulls:excluded.length,
    eligibleCoveragePct:rate(eligiblePulls.length,pulls.length),
    reviewFlaggedPulls:review.length,
    exactHundredPulls:exactHundred.length,
    exactHundredSharePct:exactShare,
    contradictoryPulls:contradictions.length,
    reasonCounts,
    notes,
    auditRows
  };
}

function candidateProgressionState(eligiblePulls,block,breakthrough,policy){
  if(eligiblePulls.some(p=>p.kill))return {key:'cleared',label:'CLEARED',tone:'good',detail:'Kill recorded in metric-eligible encounter history'};
  if(block.currentBlock.metricEligiblePulls<policy.minEligiblePullsForState){
    return {key:'baseline',label:'BUILDING BASELINE',tone:'',detail:`${block.currentBlock.metricEligiblePulls}/${policy.currentFormPulls} metric-eligible CURRENT FORM pulls available`};
  }
  const recentBreakthrough=breakthrough.pullsSince!=null&&breakthrough.pullsSince<=5;
  if(recentBreakthrough&&((block.deepDeltaPp??-Infinity)>=policy.improvingDeepDeltaPp||(block.stageConversionDeltaPp??-Infinity)>=policy.convertingStageDeltaPp)){
    return {key:'breakthrough',label:'BREAKTHROUGH',tone:'good',detail:`CURRENT FORM: deep rate ${signed(block.deepDeltaPp)} · stage conversion ${signed(block.stageConversionDeltaPp)}`};
  }
  const positive=(block.deepDeltaPp??0)>0||(block.consistencyGapImprovementPp??0)>0||(block.stageConversionDeltaPp??0)>0;
  if((breakthrough.pullsSince??0)>=policy.plateauPulls||(breakthrough.nightsSince??0)>=policy.plateauNights){
    if(!positive)return {key:'plateau',label:'PLATEAU',tone:'warn',detail:`${breakthrough.pullsSince??'—'} eligible pulls · ${breakthrough.nightsSince??'—'} nights since meaningful breakthrough`};
  }
  if((block.currentStageConversionPct??0)>=policy.stableStageConversionPct&&(block.currentDeepRatePct??0)>=policy.stableDeepPullRatePct&&(block.consistencyGapPp??Infinity)<=policy.stableConsistencyGapPp){
    return {key:'stabilizing',label:`STABILIZING S${block.deepestStage}`,tone:'good',detail:`CURRENT FORM: ${round(block.currentStageConversionPct)}% stage conversion · ${round(block.currentDeepRatePct)}% deep pulls · ${round1(block.consistencyGapPp)}pp gap`};
  }
  if((block.stageConversionDeltaPp??-Infinity)>=policy.convertingStageDeltaPp&&(block.currentStageConversionPct??0)>=40){
    return {key:'converting',label:`CONVERTING S${block.deepestStage}`,tone:'',detail:`CURRENT FORM deepest-stage conversion ${signed(block.stageConversionDeltaPp)} vs previous eligible block`};
  }
  if((block.deepDeltaPp??-Infinity)>=policy.improvingDeepDeltaPp||(block.consistencyGapImprovementPp??-Infinity)>=policy.improvingGapPp){
    return {key:'improving',label:'IMPROVING',tone:'good',detail:`CURRENT FORM: deep repeatability ${signed(block.deepDeltaPp)} · consistency ${signed(block.consistencyGapImprovementPp)}`};
  }
  if((block.deepDeltaPp??Infinity)<=-policy.improvingDeepDeltaPp&&(block.consistencyGapImprovementPp??Infinity)<=-policy.improvingGapPp){
    return {key:'regressing',label:'REGRESSING',tone:'warn',detail:`CURRENT FORM: deep repeatability ${signed(block.deepDeltaPp)} · consistency ${signed(block.consistencyGapImprovementPp)}`};
  }
  return {key:'learning',label:`LEARNING S${block.deepestStage}`,tone:'',detail:`CURRENT FORM: ${round(block.currentStageConversionPct)}% deepest-stage conversion · ${round(block.currentDeepRatePct)}% deep-pull rate`};
}

const round=v=>v==null?null:Math.round(v);
const round1=v=>v==null?null:Math.round(v*10)/10;
const signed=v=>v==null?'—':`${v>0?'+':''}${round1(v)}pp`;

export function buildProgressModel(inputPulls=[],options={}){
  const policy={...PROGRESS_METRIC_POLICY,...(options.policy||{})};
  const pulls=canonicalizeProgressPulls(inputPulls,{policy});
  const eligiblePulls=pulls.filter(p=>p.progressMetricEligible);
  const nights=groupProgressNights(pulls);
  const nightBySession=new Map(nights.map(n=>[n.sessionId,n]));
  const block=blockMetrics(eligiblePulls,policy);
  const breakthrough=breakthroughMetrics(eligiblePulls,nightBySession,policy);
  const retention=retentionMetrics(nights,policy);
  const throughput=throughputMetrics(nights,policy);
  const matrix=matrixMetrics(eligiblePulls,policy);
  const deepThreshold=block.deepThreshold;

  const nightSummaries=nights.map((night,index)=>{
    const eligible=night.eligibleRows||[];
    const deepRatePct=deepThreshold==null||!eligible.length?null:rate(eligible.filter(p=>progressValue(p)<=deepThreshold).length,eligible.length);
    const prior=index?nights[index-1]:null;
    const medianDeltaPp=prior?.medianFightPercentage!=null&&night.medianFightPercentage!=null?prior.medianFightPercentage-night.medianFightPercentage:null;
    return {
      sessionId:night.sessionId,sessionIndex:night.sessionIndex,startTime:night.startTime,endTime:night.endTime,title:night.title,
      pulls:night.pulls,metricEligiblePulls:night.metricEligiblePulls,metricExcludedPulls:night.metricExcludedPulls,
      scoredPulls:night.scoredPulls,unscoredPulls:night.unscoredPulls,kills:night.kills,
      bestFightPercentage:night.bestFightPercentage,medianFightPercentage:night.medianFightPercentage,
      deepPullRatePct:deepRatePct,medianDeltaPp,firstGlobalPull:night.firstGlobalPull,lastGlobalPull:night.lastGlobalPull,sourceReports:night.sourceReports
    };
  });

  const rawNightTotal=nightSummaries.reduce((sum,n)=>sum+n.pulls,0);
  const eligibleNightTotal=nightSummaries.reduce((sum,n)=>sum+n.metricEligiblePulls,0);
  const invariants={
    nightRawPullsMatch:rawNightTotal===pulls.length,
    nightEligiblePullsMatch:eligibleNightTotal===eligiblePulls.length,
    globalPullNumbersContiguous:pulls.every((p,i)=>p.pullNumber===i+1),
    eligiblePullsReferenceCanonical:eligiblePulls.every(p=>pulls[p.pullNumber-1]===p),
    currentFormUsesEligiblePopulation:block.currentBlock.metricEligiblePulls===Math.min(policy.currentFormPulls,eligiblePulls.length)
  };
  const dataQuality=summarizeDataQuality(pulls,eligiblePulls,policy,invariants);
  const candidateState=candidateProgressionState(eligiblePulls,block,breakthrough,policy);
  const state=dataQuality.holdStrategicState?{
    key:'data-review',
    label:'DATA REVIEW',
    tone:'warn',
    detail:dataQuality.notes[0]||'Progress data quality requires review before Iris presents a strategic progression state.',
    candidate:candidateState
  }:candidateState;

  return {
    modelVersion:'progress-model-v2',
    metricsVersion:PROGRESS_METRICS_VERSION,
    eligibilityVersion:'progress-metric-eligibility-v1',
    policy,
    population:{
      rawCanonical:'all deduplicated analytical pulls',
      strategic:'progressMetricEligible === true',
      currentForm:`latest ${policy.currentFormPulls} metric-eligible pulls`,
      previousForm:`previous ${policy.previousFormPulls} metric-eligible pulls`,
      throughput:'raw timestamped analytical pulls in raid night'
    },
    totals:{
      pulls:pulls.length,
      rawPulls:pulls.length,
      metricEligiblePulls:eligiblePulls.length,
      metricExcludedPulls:pulls.length-eligiblePulls.length,
      scoredPulls:eligiblePulls.length,
      nights:nights.length,
      kills:pulls.filter(p=>p.kill).length
    },
    bestPull:block.bestPull,
    block,
    breakthrough,
    candidateState,
    state,
    nights:nightSummaries,
    health:{phaseConversionPct:block.currentStageConversionPct,phaseConversionDeltaPp:block.stageConversionDeltaPp,retention,throughput},
    matrix,
    dataQuality,
    diagnostics:{rawNightTotal,eligibleNightTotal,canonicalPullTotal:pulls.length,metricEligiblePullTotal:eligiblePulls.length,invariants},
    canonicalPulls:pulls
  };
}
