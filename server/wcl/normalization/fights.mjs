import { durationMs } from './primitives.mjs';

export function normalizeStages(fight){
  const start=Number(fight?.startTime||0), end=Number(fight?.endTime||start);
  const transitions=(fight?.phaseTransitions||[])
    .map(x=>({semanticPhaseId:Number(x.id),startTime:Number(x.startTime)}))
    .filter(x=>Number.isFinite(x.semanticPhaseId)&&Number.isFinite(x.startTime))
    .sort((a,b)=>a.startTime-b.startTime);

  const stages=[];
  // WCL usually includes the initial semantic phase at fight start, but not every
  // report shape is guaranteed to. Preserve it when present and synthesize only
  // when necessary.
  if(!transitions.length || transitions[0].startTime>start+5){
    stages.push({absoluteStageIndex:1,semanticPhaseId:transitions[0]?.semanticPhaseId||1,startTime:start,endTime:null});
  }
  for(const t of transitions){
    const prev=stages.at(-1);
    if(prev && Math.abs(prev.startTime-t.startTime)<=5){
      prev.semanticPhaseId=t.semanticPhaseId;
      continue;
    }
    stages.push({absoluteStageIndex:stages.length+1,semanticPhaseId:t.semanticPhaseId,startTime:t.startTime,endTime:null});
  }
  if(!stages.length) stages.push({absoluteStageIndex:1,semanticPhaseId:1,startTime:start,endTime:end});
  stages.forEach((s,i)=>{s.absoluteStageIndex=i+1;s.endTime=i+1<stages.length?stages[i+1].startTime:end;});

  // lastPhaseAsAbsoluteIndex is zero-based and is the authoritative signal when
  // it indicates more stages than phaseTransitions materialized.
  const absolute=Number(fight?.lastPhaseAsAbsoluteIndex);
  const expected=Number.isFinite(absolute)?absolute+1:stages.length;
  while(stages.length<expected){
    const last=stages.at(-1);
    stages.push({absoluteStageIndex:stages.length+1,semanticPhaseId:last?.semanticPhaseId??null,startTime:null,endTime:end,inferred:true});
  }
  return stages;
}

// Backwards-compatible name: throughout Raid Ops "phase 3" historically meant
// the third progression segment. Internally it is now an absolute stage index.
export function maxPhase(fight){return Math.max(1,normalizeStages(fight).length);}
export function stageCount(fight){return maxPhase(fight);}
export function stageStart(fight,stageIndex){
  if(Number(stageIndex)<=1)return Number(fight?.startTime||0);
  const s=normalizeStages(fight).find(x=>x.absoluteStageIndex===Number(stageIndex));
  return Number.isFinite(Number(s?.startTime))?Number(s.startTime):null;
}
export function stageEnd(fight,stageIndex){
  const s=normalizeStages(fight).find(x=>x.absoluteStageIndex===Number(stageIndex));
  return Number.isFinite(Number(s?.endTime))?Number(s.endTime):null;
}
export const phaseStart=stageStart;
export function phaseReached(fight,stageIndex){return stageCount(fight)>=Number(stageIndex);}
export function semanticPhaseStarts(fight,semanticPhaseId){return normalizeStages(fight).filter(s=>s.semanticPhaseId===Number(semanticPhaseId)).map(s=>s.startTime).filter(Number.isFinite);}
export function selectEncounter(fights,requestedId){ const valid=(fights||[]).filter(f=>Number(f.encounterID)>0); if(requestedId){const hit=valid.filter(f=>Number(f.encounterID)===Number(requestedId));if(hit.length)return hit.sort((a,b)=>a.startTime-b.startTime);} const latest=valid.slice().sort((a,b)=>b.startTime-a.startTime)[0]; return latest?valid.filter(f=>Number(f.encounterID)===Number(latest.encounterID)).sort((a,b)=>a.startTime-b.startTime):[]; }
export function bestFight(fights){return (fights||[]).filter(f=>!f.inProgress&&Number.isFinite(Number(f.fightPercentage))).slice().sort((a,b)=>Number(a.fightPercentage)-Number(b.fightPercentage))[0]||null;}
export function toProgressionPoint(f,index){return{pullNumber:index+1,fightId:f.id,fightPercentage:Number.isFinite(Number(f.fightPercentage))?Number(f.fightPercentage):null,bossPercentage:Number.isFinite(Number(f.bossPercentage))?Number(f.bossPercentage):null,durationMs:durationMs(f),kill:Boolean(f.kill),inProgress:Boolean(f.inProgress),maxPhase:maxPhase(f),stageCount:stageCount(f),stages:normalizeStages(f),phaseTransitions:f.phaseTransitions||[]};}
