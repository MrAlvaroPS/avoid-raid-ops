const finite=v=>Number.isFinite(Number(v));
const num=v=>finite(v)?Number(v):null;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)));

export const PROGRESS_METRICS_VERSION='1.0.0';

export const PROGRESS_METRIC_POLICY=Object.freeze({
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
  minScoredPullsForState:5
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

export function canonicalizeProgressPulls(input=[]){
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
    const value=progressValue(p);
    const stage=Math.max(1,num(p.stageCount)??1);
    return {
      ...p,
      pullNumber:index+1,
      globalPullNumber:index+1,
      fightPercentage:value,
      bossPercentage:num(p.bossPercentage),
      durationMs:num(p.durationMs),
      stageCount:stage,
      kill:Boolean(p.kill),
      absoluteStartTime:num(p.absoluteStartTime),
      absoluteEndTime:num(p.absoluteEndTime),
      sessionIndex:num(p.sessionIndex)??1,
      progressScored:value!=null,
      __inputIndex:undefined
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
    const scored=ordered.filter(p=>progressValue(p)!=null);
    const values=scored.map(progressValue);
    const reports=[...new Set(ordered.flatMap(p=>Array.isArray(p.reportCodes)?p.reportCodes:[]).filter(Boolean))];
    return {
      sessionId,
      sessionIndex:index+1,
      startTime:num(ordered.find(p=>num(p.absoluteStartTime)!=null)?.absoluteStartTime)??num(ordered[0]?.sessionStartTime),
      endTime:num([...ordered].reverse().find(p=>num(p.absoluteEndTime)!=null)?.absoluteEndTime),
      title:ordered.find(p=>p.sessionTitle)?.sessionTitle||null,
      pulls:ordered.length,
      scoredPulls:scored.length,
      unscoredPulls:ordered.length-scored.length,
      kills:ordered.filter(p=>p.kill).length,
      bestFightPercentage:values.length?Math.min(...values):null,
      medianFightPercentage:median(values),
      firstGlobalPull:ordered[0]?.pullNumber??null,
      lastGlobalPull:ordered.at(-1)?.pullNumber??null,
      sourceReports:reports.length||1,
      reportCodes:reports,
      rows:ordered
    };
  });
}

function blockMetrics(pulls,policy){
  const best=pulls.filter(p=>progressValue(p)!=null).slice().sort((a,b)=>progressValue(a)-progressValue(b))[0]||null;
  const bestPct=progressValue(best);
  const currentRaw=pulls.slice(-policy.currentBlockPulls);
  const previousRaw=pulls.slice(-(policy.currentBlockPulls+policy.previousBlockPulls),-policy.currentBlockPulls);
  const current=currentRaw.filter(p=>progressValue(p)!=null);
  const previous=previousRaw.filter(p=>progressValue(p)!=null);
  const deepThreshold=bestPct==null?null:clamp(bestPct+policy.deepPullMarginPp,0,100);
  const deepRate=block=>deepThreshold==null||!block.length?null:rate(block.filter(p=>progressValue(p)<=deepThreshold).length,block.length);
  const currentDeep=deepRate(current),previousDeep=deepRate(previous);
  const currentMedian=median(current.map(progressValue)),previousMedian=median(previous.map(progressValue));
  const beforeCurrent=pulls.slice(0,Math.max(0,pulls.length-currentRaw.length));
  const bestBefore=beforeCurrent.filter(p=>progressValue(p)!=null).slice().sort((a,b)=>progressValue(a)-progressValue(b))[0]||best;
  const bestBeforePct=progressValue(bestBefore);
  const gap=currentMedian!=null&&bestPct!=null?Math.max(0,currentMedian-bestPct):null;
  const previousGap=previousMedian!=null&&bestBeforePct!=null?Math.max(0,previousMedian-bestBeforePct):null;
  const deepest=Math.max(1,...pulls.map(p=>Number(p.stageCount)||1));
  const stageRate=block=>block.length?rate(block.filter(p=>Number(p.stageCount)>=deepest).length,block.length):null;
  const currentStage=stageRate(currentRaw),previousStage=stageRate(previousRaw);
  return {
    bestPull:best?{pullNumber:best.pullNumber,fightPercentage:bestPct,kill:best.kill,stageCount:best.stageCount,absoluteStartTime:best.absoluteStartTime,sessionId:best.sessionId}:null,
    bestPct,
    currentBlock:{pulls:currentRaw.length,scoredPulls:current.length,firstPull:currentRaw[0]?.pullNumber??null,lastPull:currentRaw.at(-1)?.pullNumber??null},
    previousBlock:{pulls:previousRaw.length,scoredPulls:previous.length,firstPull:previousRaw[0]?.pullNumber??null,lastPull:previousRaw.at(-1)?.pullNumber??null},
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

function breakthroughMetrics(pulls,nightBySession,policy){
  if(!pulls.length)return {latest:null,pullsSince:null,nightsSince:null,count:0};
  let meaningfulBest=progressValue(pulls[0])??100;
  let deepest=Number(pulls[0].stageCount)||1;
  const events=[];
  for(let i=1;i<pulls.length;i++){
    const p=pulls[i],value=progressValue(p),stage=Number(p.stageCount)||1;
    const reasons=[];
    if(p.kill)reasons.push('kill');
    if(stage>deepest)reasons.push(`stage ${stage}`);
    if(value!=null&&value<=meaningfulBest-policy.breakthroughDepthPp){
      reasons.push(`${(meaningfulBest-value).toFixed(1)}pp depth`);
    }
    if(reasons.length){
      events.push({pullNumber:p.pullNumber,sessionId:p.sessionId,absoluteStartTime:p.absoluteStartTime,stageCount:stage,fightPercentage:value,reasons,index:i});
      if(value!=null)meaningfulBest=value;
    }
    if(stage>deepest)deepest=stage;
  }
  const latest=events.at(-1)||null;
  const lastNight=nightBySession.get(pulls.at(-1)?.sessionId)?.sessionIndex??1;
  const latestNight=latest?nightBySession.get(latest.sessionId)?.sessionIndex:null;
  return {
    latest:latest?{pullNumber:latest.pullNumber,sessionId:latest.sessionId,absoluteStartTime:latest.absoluteStartTime,stageCount:latest.stageCount,fightPercentage:latest.fightPercentage,reasons:latest.reasons}:null,
    pullsSince:latest?Math.max(0,pulls.length-1-latest.index):Math.max(0,pulls.length-1),
    nightsSince:latestNight!=null?Math.max(0,lastNight-latestNight):Math.max(0,lastNight-1),
    count:events.length
  };
}

function retentionMetrics(nights,policy){
  if(nights.length<2)return {available:false,reason:'need-two-nights'};
  const previous=nights.at(-2),current=nights.at(-1);
  const previousScored=previous.rows.filter(p=>progressValue(p)!=null);
  const currentScored=current.rows.filter(p=>progressValue(p)!=null);
  if(previousScored.length<policy.retentionClosingPulls||currentScored.length<policy.retentionRollingPulls){
    return {available:false,reason:'insufficient-scored-pulls',previousScored:previousScored.length,currentScored:currentScored.length};
  }
  const closing=median(previousScored.slice(-policy.retentionClosingPulls).map(progressValue));
  if(closing==null)return {available:false,reason:'no-closing-baseline'};
  if(closing>=policy.retentionBaselineMaxPct){
    return {available:false,reason:'weak-closing-baseline',previousClosingPct:closing};
  }
  const threshold=closing+policy.retentionTolerancePp;
  let recoveryIndex=null;
  for(let i=policy.retentionRollingPulls-1;i<currentScored.length;i++){
    const m=median(currentScored.slice(i-policy.retentionRollingPulls+1,i+1).map(progressValue));
    if(m!=null&&m<=threshold){recoveryIndex=i;break;}
  }
  if(recoveryIndex==null){
    return {available:true,recovered:false,previousClosingPct:closing,thresholdPct:threshold,currentPulls:current.rows.length,currentScoredPulls:currentScored.length};
  }
  const recovery=currentScored[recoveryIndex],first=current.rows[0];
  const minutes=num(first?.absoluteStartTime)!=null&&num(recovery?.absoluteEndTime)!=null?Math.max(0,(recovery.absoluteEndTime-first.absoluteStartTime)/60000):null;
  return {available:true,recovered:true,pullsToRecover:recoveryIndex+1,minutes,previousClosingPct:closing,thresholdPct:threshold};
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
  if(!nights.length)return {available:false,reason:'no-nights'};
  const current=throughputForNight(nights.at(-1),policy);
  if(!current)return {available:false,reason:'insufficient-timestamps'};
  const previous=nights.length>1?throughputForNight(nights.at(-2),policy):null;
  return {available:true,current,previous,deltaPullsPerHour:previous?current.pullsPerHour-previous.pullsPerHour:null};
}

function matrixMetrics(pulls,policy){
  const source=pulls.slice(-policy.matrixMaxPulls);
  const deepest=Math.max(1,...pulls.map(p=>Number(p.stageCount)||1));
  const windows=[];
  for(let i=0;i<source.length;i+=policy.matrixWindowPulls){
    const rows=source.slice(i,i+policy.matrixWindowPulls);
    windows.push({
      firstPull:rows[0]?.pullNumber??null,
      lastPull:rows.at(-1)?.pullNumber??null,
      pulls:rows.length,
      stages:Array.from({length:deepest},(_,idx)=>{
        const stage=idx+1,hit=rows.filter(p=>Number(p.stageCount)>=stage).length;
        return {stage,hit,pulls:rows.length,ratePct:rate(hit,rows.length)};
      })
    });
  }
  return {deepestStage:deepest,windowSize:policy.matrixWindowPulls,maxPulls:policy.matrixMaxPulls,windows};
}

function progressionState(pulls,block,breakthrough,policy){
  if(pulls.some(p=>p.kill))return {key:'cleared',label:'CLEARED',tone:'good',detail:'Kill recorded in the canonical encounter history'};
  if(block.currentBlock.scoredPulls<policy.minScoredPullsForState){
    return {key:'baseline',label:'BUILDING BASELINE',tone:'',detail:`${block.currentBlock.scoredPulls}/${block.currentBlock.pulls} latest pulls have scored WCL progress`};
  }
  const recentBreakthrough=breakthrough.pullsSince!=null&&breakthrough.pullsSince<=5;
  if(recentBreakthrough&&((block.deepDeltaPp??-Infinity)>=policy.improvingDeepDeltaPp||(block.stageConversionDeltaPp??-Infinity)>=policy.convertingStageDeltaPp)){
    return {key:'breakthrough',label:'BREAKTHROUGH',tone:'good',detail:`Latest block: deep rate ${signed(block.deepDeltaPp)} · stage conversion ${signed(block.stageConversionDeltaPp)}`};
  }
  const positive=(block.deepDeltaPp??0)>0||(block.consistencyGapImprovementPp??0)>0||(block.stageConversionDeltaPp??0)>0;
  if((breakthrough.pullsSince??0)>=policy.plateauPulls||(breakthrough.nightsSince??0)>=policy.plateauNights){
    if(!positive)return {key:'plateau',label:'PLATEAU',tone:'warn',detail:`${breakthrough.pullsSince??'—'} pulls · ${breakthrough.nightsSince??'—'} nights since meaningful breakthrough`};
  }
  if((block.currentStageConversionPct??0)>=policy.stableStageConversionPct&&(block.currentDeepRatePct??0)>=policy.stableDeepPullRatePct&&(block.consistencyGapPp??Infinity)<=policy.stableConsistencyGapPp){
    return {key:'stabilizing',label:`STABILIZING S${block.deepestStage}`,tone:'good',detail:`${round(block.currentStageConversionPct)}% stage conversion · ${round(block.currentDeepRatePct)}% deep pulls · ${round1(block.consistencyGapPp)}pp consistency gap`};
  }
  if((block.stageConversionDeltaPp??-Infinity)>=policy.convertingStageDeltaPp&&(block.currentStageConversionPct??0)>=40){
    return {key:'converting',label:`CONVERTING S${block.deepestStage}`,tone:'',detail:`Deepest-stage conversion ${signed(block.stageConversionDeltaPp)} vs previous block`};
  }
  if((block.deepDeltaPp??-Infinity)>=policy.improvingDeepDeltaPp||(block.consistencyGapImprovementPp??-Infinity)>=policy.improvingGapPp){
    return {key:'improving',label:'IMPROVING',tone:'good',detail:`Deep-pull repeatability ${signed(block.deepDeltaPp)} · consistency ${signed(block.consistencyGapImprovementPp)}`};
  }
  if((block.deepDeltaPp??Infinity)<=-policy.improvingDeepDeltaPp&&(block.consistencyGapImprovementPp??Infinity)<=-policy.improvingGapPp){
    return {key:'regressing',label:'REGRESSING',tone:'warn',detail:`Deep-pull repeatability ${signed(block.deepDeltaPp)} · consistency ${signed(block.consistencyGapImprovementPp)}`};
  }
  return {key:'learning',label:`LEARNING S${block.deepestStage}`,tone:'',detail:`${round(block.currentStageConversionPct)}% deepest-stage conversion · ${round(block.currentDeepRatePct)}% deep-pull rate`};
}

const round=v=>v==null?null:Math.round(v);
const round1=v=>v==null?null:Math.round(v*10)/10;
const signed=v=>v==null?'—':`${v>0?'+':''}${round1(v)}pp`;

export function buildProgressModel(inputPulls=[],options={}){
  const policy={...PROGRESS_METRIC_POLICY,...(options.policy||{})};
  const pulls=canonicalizeProgressPulls(inputPulls);
  const nights=groupProgressNights(pulls);
  const nightBySession=new Map(nights.map(n=>[n.sessionId,n]));
  const block=blockMetrics(pulls,policy);
  const breakthrough=breakthroughMetrics(pulls,nightBySession,policy);
  const retention=retentionMetrics(nights,policy);
  const throughput=throughputMetrics(nights,policy);
  const matrix=matrixMetrics(pulls,policy);
  const deepThreshold=block.deepThreshold;
  const nightSummaries=nights.map((night,index)=>{
    const scored=night.rows.filter(p=>progressValue(p)!=null);
    const deepRatePct=deepThreshold==null||!scored.length?null:rate(scored.filter(p=>progressValue(p)<=deepThreshold).length,scored.length);
    const prior=index?nights[index-1]:null;
    const medianDeltaPp=prior?.medianFightPercentage!=null&&night.medianFightPercentage!=null?prior.medianFightPercentage-night.medianFightPercentage:null;
    return {
      sessionId:night.sessionId,sessionIndex:night.sessionIndex,startTime:night.startTime,endTime:night.endTime,title:night.title,
      pulls:night.pulls,scoredPulls:night.scoredPulls,unscoredPulls:night.unscoredPulls,kills:night.kills,
      bestFightPercentage:night.bestFightPercentage,medianFightPercentage:night.medianFightPercentage,
      deepPullRatePct,medianDeltaPp,firstGlobalPull:night.firstGlobalPull,lastGlobalPull:night.lastGlobalPull,sourceReports:night.sourceReports
    };
  });
  const state=progressionState(pulls,block,breakthrough,policy);
  const scoredPulls=pulls.filter(p=>progressValue(p)!=null).length;
  const hundredPctPulls=pulls.filter(p=>progressValue(p)===100).length;
  const nightPullTotal=nightSummaries.reduce((sum,n)=>sum+n.pulls,0);
  const invariants={nightPullsMatch:nightPullTotal===pulls.length,globalPullNumbersContiguous:pulls.every((p,i)=>p.pullNumber===i+1)};
  return {
    modelVersion:'progress-model-v1',
    metricsVersion:PROGRESS_METRICS_VERSION,
    policy,
    totals:{pulls:pulls.length,scoredPulls,unscoredPulls:pulls.length-scoredPulls,nights:nights.length,kills:pulls.filter(p=>p.kill).length},
    bestPull:block.bestPull,
    block,
    breakthrough,
    state,
    nights:nightSummaries,
    health:{phaseConversionPct:block.currentStageConversionPct,phaseConversionDeltaPp:block.stageConversionDeltaPp,retention,throughput},
    matrix,
    diagnostics:{nightPullTotal,canonicalPullTotal:pulls.length,hundredPctPulls,hundredPctSharePct:rate(hundredPctPulls,scoredPulls),invariants},
    canonicalPulls:pulls
  };
}
