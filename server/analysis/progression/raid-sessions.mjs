import { median } from '../../wcl/normalization/primitives.mjs';
import { stageCount } from '../../wcl/normalization/fights.mjs';
import { classifyPullForAnalysis } from '../pulls/pull-eligibility.mjs';
import { canonicalActorIdentity } from '../reliability/attendance-history-v1.mjs';

const absStart=(report,fight)=>Number(report.startTime||0)+Number(fight.startTime||0);
const absEnd=(report,fight)=>Number(report.startTime||0)+Number(fight.endTime||0);
const duration=(fight)=>Math.max(0,Number(fight.endTime||0)-Number(fight.startTime||0));

function samePull(a,b){
  if(Number(a.encounterID)!==Number(b.encounterID))return false;
  if(Math.abs(a.absoluteStartTime-b.absoluteStartTime)>12000)return false;
  if(Math.abs(a.durationMs-b.durationMs)>12000)return false;
  const ap=Number(a.fightPercentage),bp=Number(b.fightPercentage);
  if(Number.isFinite(ap)&&Number.isFinite(bp)&&Math.abs(ap-bp)>0.8)return false;
  return true;
}

function fightRosterIdentities(report,fight){
  const actors=new Map((report?.masterData?.actors||[]).map(a=>[Number(a.id),a]));
  const byKey=new Map();
  for(const id of fight?.friendlyPlayers||[]){
    const actor=actors.get(Number(id));
    const identity=canonicalActorIdentity(actor);
    if(identity)byKey.set(identity.key,identity);
  }
  return [...byKey.values()];
}

function normalizePull(report,fight){
  const rosterIdentities=fightRosterIdentities(report,fight);
  return {
    reportCodes:[report.code],
    fightIds:[fight.id],
    encounterID:fight.encounterID,
    name:fight.name,
    difficulty:fight.difficulty,
    absoluteStartTime:absStart(report,fight),
    absoluteEndTime:absEnd(report,fight),
    durationMs:duration(fight),
    stageCount:stageCount(fight),
    kill:Boolean(fight.kill),
    fightPercentage:Number.isFinite(Number(fight.fightPercentage))?Number(fight.fightPercentage):null,
    bossPercentage:Number.isFinite(Number(fight.bossPercentage))?Number(fight.bossPercentage):null,
    rosterSize:(fight.friendlyPlayers||[]).length,
    rosterIdentities
  };
}

export function dedupeSessionPulls(reports){
  const candidates=[];
  for(const report of reports||[]){
    for(const fight of (report.fights||[]).filter(f=>!f.inProgress&&classifyPullForAnalysis(f).eligible)){
      candidates.push(normalizePull(report,fight));
    }
  }
  candidates.sort((a,b)=>a.absoluteStartTime-b.absoluteStartTime);
  const out=[];
  for(const pull of candidates){
    const match=out.slice(-4).find(x=>samePull(x,pull));
    if(match){
      match.reportCodes=[...new Set([...match.reportCodes,...pull.reportCodes])];
      match.fightIds=[...match.fightIds,...pull.fightIds];
      const identities=new Map([...(match.rosterIdentities||[]),...(pull.rosterIdentities||[])].map(x=>[x.key,x]));
      match.rosterIdentities=[...identities.values()];
      match.rosterSize=Math.max(match.rosterSize,pull.rosterSize,match.rosterIdentities.length);
      match.kill=match.kill||pull.kill;
      match.stageCount=Math.max(Number(match.stageCount)||1,Number(pull.stageCount)||1);
      if(Number.isFinite(pull.fightPercentage)&&(!Number.isFinite(match.fightPercentage)||pull.fightPercentage<match.fightPercentage))match.fightPercentage=pull.fightPercentage;
    }else out.push(pull);
  }
  return out;
}

export function clusterRaidSessions(reports,{gapMs=45*60*1000,currentReportCode=null}={}){
  const sorted=(reports||[]).filter(Boolean).slice().sort((a,b)=>Number(a.startTime)-Number(b.startTime));
  const clusters=[];
  for(const report of sorted){
    let session=clusters.at(-1);
    if(!session||Number(report.startTime)>Number(session.endTime)+gapMs){
      session={reports:[],startTime:Number(report.startTime),endTime:Number(report.endTime)};
      clusters.push(session);
    }
    session.reports.push(report);
    session.startTime=Math.min(session.startTime,Number(report.startTime));
    session.endTime=Math.max(session.endTime,Number(report.endTime));
  }
  return clusters.map((session,index)=>{
    const pulls=dedupeSessionPulls(session.reports);
    const pcts=pulls.map(p=>p.fightPercentage).filter(Number.isFinite);
    const reportCodes=session.reports.map(r=>r.code);
    const preferred=session.reports.find(r=>r.code===currentReportCode)||session.reports[0];
    const titles=[...new Set(session.reports.map(r=>r.title).filter(Boolean))];
    const sessionId=`${new Date(session.startTime).toISOString().slice(0,10)}-${reportCodes[0]}`;
    return {
      sessionId,
      sessionIndex:index+1,
      reportCode:preferred?.code||reportCodes[0],
      reportCodes,
      sourceReports:reportCodes.length,
      title:preferred?.title||titles.join(' / '),
      titles,
      startTime:session.startTime,
      endTime:session.endTime,
      pulls:pulls.length,
      kills:pulls.filter(p=>p.kill).length,
      bestFightPercentage:pcts.length?Math.min(...pcts):null,
      medianFightPercentage:pcts.length?median(pcts):null,
      rosterSizeMedian:median(pulls.map(p=>p.rosterSize).filter(Number.isFinite)),
      deduplicatedPulls:candidatesCount(session.reports)-pulls.length,
      progressionPulls:pulls.map((p,pullIndex)=>({
        ...p,
        sessionId,
        sessionIndex:index+1,
        sessionPullNumber:pullIndex+1
      }))
    };
  }).filter(s=>s.pulls>0);
}

function candidatesCount(reports){
  return (reports||[]).reduce((n,r)=>n+(r.fights||[]).filter(f=>!f.inProgress&&classifyPullForAnalysis(f).eligible).length,0);
}
