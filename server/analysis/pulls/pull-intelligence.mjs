import { median,durationMs } from '../../wcl/normalization/primitives.mjs';
import { stageCount,normalizeStages } from '../../wcl/normalization/fights.mjs';
import { summarizeThroughput } from '../throughput/summary.mjs';
import { classifyPullForAnalysis } from './pull-eligibility.mjs';

const finite=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v));
const pctChange=(current,base)=>finite(current)&&finite(base)&&Number(base)!==0?100*(Number(current)/Number(base)-1):null;
const rosterFingerprint=f=>(f?.friendlyPlayers||[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b).join('-');
const compactDeath=row=>row?({fightId:Number(row.fightId),actorId:finite(row.actorId)?Number(row.actorId):null,player:row.player||null,fightRelativeMs:finite(row.fightRelativeMs)?Number(row.fightRelativeMs):null,abilityId:finite(row.abilityId)?Number(row.abilityId):null,killingBlow:row.killingBlow||null,overkill:finite(row.overkill)?Number(row.overkill):null}):null;

function pullFact(f,originalPullNumber,summaryTable,deathAnalysis){
  const throughput=summaryTable?summarizeThroughput(summaryTable,f):null;
  const raw=deathAnalysis?.rawByFight?.[f.id]||[];
  const meaningful=deathAnalysis?.meaningfulByFight?.[f.id]||[];
  const first=raw[0]||null;
  return {
    fightId:Number(f.id),pullNumber:originalPullNumber,kill:Boolean(f.kill),
    fightPercentage:finite(f.fightPercentage)?Number(f.fightPercentage):null,
    bossPercentage:finite(f.bossPercentage)?Number(f.bossPercentage):null,
    durationMs:durationMs(f),stageCount:stageCount(f),stages:normalizeStages(f),
    raidDps:throughput?.raidDps??throughput?.dps??null,
    raidHps:throughput?.raidHps??throughput?.hps??null,
    firstDeathMs:first?.fightRelativeMs??null,firstDeath:compactDeath(first),
    rawDeaths:raw.length,meaningfulDeaths:meaningful.length,
    rawDeathTimeline:raw.slice(0,12).map(compactDeath).filter(Boolean),
    meaningfulDeathTimeline:meaningful.slice(0,12).map(compactDeath).filter(Boolean),
    rosterFingerprint:rosterFingerprint(f),rosterSize:(f.friendlyPlayers||[]).length
  };
}

function signal(key,label,current,baseline,{better='higher',unit='',priority=10,allowClassify=true,evidence='WCL observed/derived'}={}){
  if(!finite(current)||!finite(baseline))return {key,label,status:'unavailable',current:current??null,baseline:baseline??null,delta:null,unit,priority,evidence,confidence:'unknown'};
  const delta=Number(current)-Number(baseline);
  let status='observed';
  if(allowClassify&&Math.abs(delta)>1e-9){const positive=better==='higher'?delta>0:delta<0;status=positive?'improved':'regressed';}
  else if(allowClassify)status='stable';
  return {key,label,status,current:Number(current),baseline:Number(baseline),delta,unit,priority,evidence,confidence:'high'};
}

function firstDeathSignal(current,baseline){
  const hasCurrent=finite(current),hasBaseline=finite(baseline),base={key:'firstDeath',label:'First death',unit:'ms',priority:85,confidence:'high'};
  if(!hasCurrent&&!hasBaseline)return{...base,status:'stable',current:null,baseline:null,delta:0,evidence:'No friendly death event in either pull'};
  if(!hasCurrent&&hasBaseline)return{...base,status:'improved',current:null,baseline:Number(baseline),delta:Number(baseline),evidence:'Current pull had no friendly death; baseline first death occurred earlier'};
  if(hasCurrent&&!hasBaseline)return{...base,status:'regressed',current:Number(current),baseline:null,delta:-Number(current),evidence:'Baseline had no friendly death; current pull recorded a first death'};
  return signal('firstDeath','First death',current,baseline,{better:'higher',unit:'ms',priority:85,evidence:'First friendly death event in each pull'});
}

function comparePulls(current,baseline){
  if(!current||!baseline)return null;
  const sameStage=Number(current.stageCount)===Number(baseline.stageCount);
  const signals=[
    signal('progress','Fight progress',current.fightPercentage,baseline.fightPercentage,{better:'lower',unit:'pp',priority:100,evidence:'WCL fightPercentage; lower is deeper progression'}),
    signal('stage','Stage reached',current.stageCount,baseline.stageCount,{better:'higher',unit:'stage',priority:95,evidence:'WCL absolute stage model'}),
    firstDeathSignal(current.firstDeathMs,baseline.firstDeathMs),
    signal('meaningfulDeaths','Meaningful deaths',current.meaningfulDeaths,baseline.meaningfulDeaths,{better:'lower',unit:'deaths',priority:80,evidence:'WCL death events with wipeCutoff'}),
    signal('raidDps','Raid DPS',current.raidDps,baseline.raidDps,{better:'higher',unit:'dps',priority:40,allowClassify:sameStage,evidence:sameStage?'WCL Summary; same absolute stage reached':'Observed only: pulls reached different stages'}),
    signal('raidHps','Raid HPS',current.raidHps,baseline.raidHps,{better:'higher',unit:'hps',priority:20,allowClassify:false,evidence:'Observed only; HPS is demand-dependent and is not treated as better/worse'})
  ];
  const rosterChanged=current.rosterFingerprint!==baseline.rosterFingerprint;
  return {
    currentPull:current.pullNumber,baselinePull:baseline.pullNumber,sameStage,rosterChanged,
    skippedRawPulls:Math.max(0,Number(current.pullNumber)-Number(baseline.pullNumber)-1),
    signals,
    improvements:signals.filter(s=>s.status==='improved').sort((a,b)=>b.priority-a.priority),
    regressions:signals.filter(s=>s.status==='regressed').sort((a,b)=>b.priority-a.priority),
    observations:signals.filter(s=>s.status==='observed').sort((a,b)=>b.priority-a.priority)
  };
}

function medianBaseline(prior,count,latestStage){
  const sample=prior.slice(-count);
  const same=sample.filter(p=>p.stageCount===latestStage);
  const vals=(rows,key)=>median(rows.map(x=>x[key]).filter(finite));
  return {
    sampleSize:sample.length,sameStageSampleSize:same.length,
    fightPercentage:vals(sample,'fightPercentage'),
    stageCount:vals(sample,'stageCount'),
    firstDeathMs:vals(sample,'firstDeathMs'),
    meaningfulDeaths:vals(sample,'meaningfulDeaths'),
    raidDps:vals(same,'raidDps'),raidHps:vals(same,'raidHps')
  };
}

export function buildPullIntelligence({fights=[],summaryTables=new Map(),deathAnalysis=null}={}){
  const closed=(fights||[]).filter(f=>!f.inProgress).slice().sort((a,b)=>Number(a.startTime)-Number(b.startTime));
  const allFacts=closed.map((f,i)=>{
    const fact=pullFact(f,i+1,summaryTables.get(Number(f.id)),deathAnalysis);
    const eligibility=classifyPullForAnalysis(f,{firstDeathMs:fact.firstDeathMs});
    return {...fact,analysisEligible:eligibility.eligible,analysisClassification:eligibility.classification,excludedReason:eligibility.reason,excludedReasons:eligibility.reasons||[],eligibilityEvidence:eligibility.evidence||{}};
  });
  const pulls=allFacts.filter(p=>p.analysisEligible);
  const excludedPulls=allFacts.filter(p=>!p.analysisEligible).map(p=>({
    fightId:p.fightId,pullNumber:p.pullNumber,durationMs:p.durationMs,
    fightPercentage:p.fightPercentage,bossPercentage:p.bossPercentage,stageCount:p.stageCount,
    firstDeathMs:p.firstDeathMs,classification:p.analysisClassification,reason:p.excludedReason,reasons:p.excludedReasons,
    wipeCalledRelativeMs:p.eligibilityEvidence?.wipeCalledRelativeMs??null
  }));
  const latest=pulls.at(-1)||null,previous=pulls.at(-2)||null;
  const best=pulls.filter(p=>finite(p.fightPercentage)).slice().sort((a,b)=>Number(a.fightPercentage)-Number(b.fightPercentage))[0]||null;
  const prior=latest?pulls.slice(0,-1):[];
  const currentVsPrevious=comparePulls(latest,previous);
  return {
    pulls,excludedPulls,rawClosedPullCount:closed.length,analysisPullCount:pulls.length,
    analysisPopulation:{rawPulls:closed.length,eligiblePulls:pulls.length,excludedPulls,eligibleFightIds:pulls.map(p=>p.fightId),policy:'called-wipe/reset pulls remain in WCL history but are excluded from product analytics'},
    latest,previous,best,currentVsPrevious,
    baselines:latest?{last3:medianBaseline(prior,3,latest.stageCount),last5:medianBaseline(prior,5,latest.stageCount),best}:null,
    provenance:{
      progress:'WCL fightPercentage',
      throughput:'WCL Summary table per pull',
      deaths:'WCL Death events; per-pull raw and meaningful timelines are objective observations, not wipe-cause classification',
      eligibility:'Called-wipe/reset pulls are first-class excluded records and never enter analytical baselines',
      classification:'Only progress/stage/first-death/meaningful-death and same-stage DPS receive directional labels'
    },
    status:pulls.length>=2?'ready':'insufficient-data'
  };
}
