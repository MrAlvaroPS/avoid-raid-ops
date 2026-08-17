import { reportSourceKey } from './aggregate.mjs';

export const SURGICAL_PROBE_PLAN_VERSION='surgical-probe-plan-v1';

const num=value=>Number.isFinite(Number(value))?Number(value):0;
const uniq=values=>[...new Set((values||[]).filter(x=>x!==null&&x!==undefined))];

function profileHasAbility(profile,id){
  const key=String(id);
  for(const table of Object.values(profile?.tables||{})){
    const row=table?.[key];
    if(row&&(num(row.count)>0||num(row.total)>0||num(row.rows)>0))return true;
  }
  return false;
}

function selectedFightIDs(profile,maxFights=2){
  const fights=(profile?.fights||[]).filter(f=>Number.isFinite(Number(f?.id)));
  const ranked=[...fights].sort((a,b)=>
    Number(Boolean(a.kill))-Number(Boolean(b.kill))
    || Number(a.fightPercentage??100)-Number(b.fightPercentage??100)
    || Number(a.id)-Number(b.id)
  );
  return uniq(ranked.slice(0,Math.max(1,Math.min(3,Number(maxFights)||2))).map(f=>Number(f.id)));
}

function canonicalPool(profiles=[],selectedWideCodes=[]){
  const selected=new Set((selectedWideCodes||[]).map(String).filter(Boolean));
  return (profiles||[]).filter(profile=>profile?.code&&(!selected.size||selected.has(String(profile.code))));
}

function probeTargets(model={}){
  const triage=model?.learning?.signalTriage||{};
  const rows=triage.criticalProbeQueue||triage.signals?.filter(row=>row?.critical&&['mixed','unknown'].includes(row?.origin?.classification))||[];
  return rows.map(row=>({
    id:Number(row.id),
    name:row.name||`Ability ${row.id}`,
    importance:num(row.importance),
    origin:row.origin||null,
    reason:row.actionReason||'Critical unresolved signal still lacks decisive source provenance.',
  })).filter(row=>Number.isFinite(row.id)&&row.id>0);
}

export function buildSurgicalProbePlanV1({
  model={},
  aggregate={},
  profiles=[],
  encounterId=0,
  difficulty=5,
  partition=0,
  maxSignals=7,
  maxSourcesPerSignal=5,
  maxFightsPerSource=2,
}={}){
  const selectedWideCodes=aggregate?.sampling?.selectedWideCodes||[];
  const pool=canonicalPool(profiles,selectedWideCodes);
  const targets=probeTargets(model).slice(0,Math.max(1,Number(maxSignals)||7));
  const signals=[];

  for(const target of targets){
    const candidates=pool
      .filter(profile=>profileHasAbility(profile,target.id))
      .map(profile=>({profile,source:reportSourceKey(profile)}))
      .filter(row=>row.source)
      .sort((a,b)=>String(a.source).localeCompare(String(b.source))||String(a.profile.code).localeCompare(String(b.profile.code)));
    const seenSources=new Set(),requests=[];
    for(const row of candidates){
      if(seenSources.has(row.source))continue;
      const fightIDs=selectedFightIDs(row.profile,maxFightsPerSource);
      if(!fightIDs.length)continue;
      seenSources.add(row.source);
      requests.push({
        reportCode:String(row.profile.code),
        source:row.source,
        fightIDs,
        question:'Resolve source provenance for one critical unresolved ability using the smallest exact-fight event query.',
        queryShape:{
          encounterID:Number(encounterId)||null,
          difficulty:Number(difficulty)||5,
          partition:Number(partition)||0,
          abilityID:target.id,
          filterExpression:`ability.id IN (${target.id})`,
          startTime:null,
          endTime:null,
          phase:null,
          sourceID:null,
          targetID:null,
          includeResources:false,
          limit:1000,
        },
        evidenceClass:'diagnostic-surgical',
        canonicalCoverageContribution:{deepReports:0,deepPulls:0},
        executesWcl:false,
      });
      if(requests.length>=Math.max(1,Number(maxSourcesPerSignal)||5))break;
    }
    const requestedSources=Math.max(1,Number(maxSourcesPerSignal)||5);
    signals.push({
      ...target,
      selectedSources:requests.length,
      requestedSources,
      sourceShortfall:Math.max(0,requestedSources-requests.length),
      requests,
      followUpTemplate:{
        onlyAfterProvenanceNeedsIt:true,
        purpose:'temporal-context',
        timeWindowMs:{before:5000,after:5000},
        preserveExactFightIDs:true,
        allowedNarrowing:['startTime','endTime','phase','sourceID','targetID','filterExpression'],
        note:'Anchor the time window on a matching event returned by the provenance probe. Do not broaden to a whole-report scan by default.',
      },
      reportLevelPresenceCaveat:'Wide cache proves report-level presence, not which exact pull contains the event. Empty exact-fight probe results are valid diagnostics and must not be counted as evidence success.',
    });
  }

  const requestCount=signals.reduce((sum,row)=>sum+row.requests.length,0);
  return {
    version:SURGICAL_PROBE_PLAN_VERSION,
    dryRun:true,
    executesWcl:false,
    wclCallsExecuted:0,
    scope:{encounterId:Number(encounterId),difficulty:Number(difficulty)||5,partition:Number(partition)||0},
    canonicalWideOnly:Boolean(selectedWideCodes.length),
    canonicalWideReportsInPool:pool.length,
    targetSignals:signals.length,
    plannedRequests:requestCount,
    signals,
    evidenceContract:{
      class:'diagnostic-surgical',
      countsTowardDeepReports:false,
      countsTowardDeepPulls:false,
      canChangeScoresDirectly:false,
      promotionRule:'A probe may only change provenance/relationship knowledge through a separately versioned verification contract after independent-source reproduction. The dry-run planner never changes model scores.',
    },
    safety:{
      exactFightIDs:true,
      independentSourceFirst:true,
      noWholeReportFallback:true,
      includeResources:false,
      executorImplemented:false,
    },
    nextStep:signals.length
      ? 'Review this 0-WCL plan. Execution is intentionally not implemented in v1.'
      : 'No mixed/unknown critical signal currently requires a surgical provenance probe.',
  };
}
