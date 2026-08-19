export const AVOID_EXECUTION_CONTEXT_VERSION='avoid-execution-context-v1';
export const ACTIVE_REPORT_MANIFEST_VERSION='active-report-manifest-v1';
export const PULL_SELECTION_ALL='all';

const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
const difficultyName=value=>({1:'LFR',2:'Flexible',3:'Normal',4:'Heroic',5:'Mythic'})[Number(value)]||`Difficulty ${value??'?'}`;
const fightStart=row=>Number(row?.startTime)||0;

export function normalizeWclReportReferenceV1(value){
  const raw=String(value||'').trim();
  if(!raw)return null;
  if(/^[A-Za-z0-9]{8,32}$/.test(raw))return{reportCode:raw,requestedFight:null,source:'report-code'};
  let url;
  try{url=new URL(raw);}catch{return null;}
  if(!/(^|\.)warcraftlogs\.com$/i.test(url.hostname))return null;
  const match=url.pathname.match(/\/reports\/([A-Za-z0-9]{8,32})(?:\/|$)/i);if(!match)return null;
  const hashParams=new URLSearchParams(String(url.hash||'').replace(/^#/,''));
  const searchFight=url.searchParams.get('fight'),hashFight=hashParams.get('fight'),fightRaw=searchFight||hashFight||null;
  const requestedFight=fightRaw==='last'?'last':positive(fightRaw);
  return{reportCode:match[1],requestedFight,source:'warcraftlogs-url'};
}

export function normalizePullSelectionV1(value){
  if(value==null||value===''||String(value).toLowerCase()==='all')return Object.freeze({mode:'all',fightId:null});
  const fightId=positive(typeof value==='object'?value.fightId:value);
  if(!fightId)throw new Error('Pull selection must be all or a positive fight id');
  return Object.freeze({mode:'single',fightId});
}

export function classifyActiveReportManifestV1({report,live=false,requestedFight=null,generatedAt=Date.now()}={}){
  if(!report?.code)throw new Error('WCL report metadata is required');
  const fights=(report.fights||[])
    .filter(row=>positive(row?.encounterID)&&positive(row?.difficulty))
    .map(row=>({
      fightId:positive(row.id),encounterId:positive(row.encounterID),bossName:row.name||`Encounter ${row.encounterID}`,
      difficulty:positive(row.difficulty),difficultyName:difficultyName(row.difficulty),scopeKey:`${positive(row.encounterID)}:d${positive(row.difficulty)}`,
      startTime:Number(row.startTime)||0,endTime:Number(row.endTime)||0,inProgress:Boolean(row.inProgress),kill:Boolean(row.kill),
      fightPercentage:Number.isFinite(Number(row.fightPercentage))?Number(row.fightPercentage):null,bossPercentage:Number.isFinite(Number(row.bossPercentage))?Number(row.bossPercentage):null,
    }))
    .filter(row=>row.fightId)
    .sort((a,b)=>fightStart(a)-fightStart(b)||a.fightId-b.fightId);

  const scopeMap=new Map();
  for(const fight of fights){
    const row=scopeMap.get(fight.scopeKey)||{scopeKey:fight.scopeKey,encounterId:fight.encounterId,bossName:fight.bossName,difficulty:fight.difficulty,difficultyName:fight.difficultyName,pulls:0,completedPulls:0,inProgressPulls:0,latestFightId:null,latestStartTime:0};
    row.pulls++;if(fight.inProgress)row.inProgressPulls++;else row.completedPulls++;
    if(fight.startTime>=row.latestStartTime){row.latestStartTime=fight.startTime;row.latestFightId=fight.fightId;}
    scopeMap.set(fight.scopeKey,row);
  }
  const scopes=[...scopeMap.values()].sort((a,b)=>a.latestStartTime-b.latestStartTime);

  let selectedFight=null;
  const wanted=requestedFight==='last'?'last':positive(requestedFight);
  if(wanted==='last')selectedFight=fights.at(-1)||null;
  else if(wanted)selectedFight=fights.find(row=>row.fightId===wanted)||null;
  if(!selectedFight)selectedFight=[...fights].reverse().find(row=>row.inProgress)||fights.at(-1)||null;
  const selectedScope=selectedFight?scopeMap.get(selectedFight.scopeKey)||null:null;

  const state=fights.length
    ?'ready'
    :live===true?'waiting-for-first-combat':'no-raid-combat-found';
  return{
    version:ACTIVE_REPORT_MANIFEST_VERSION,
    generatedAt:Number(generatedAt),
    report:{code:String(report.code),title:report.title||null,startTime:Number(report.startTime)||0,endTime:Number(report.endTime)||0,revision:Number(report.revision)||0,zone:report.zone?{id:positive(report.zone.id),name:report.zone.name||null}:null,guild:report.guild?{id:positive(report.guild.id),name:report.guild.name||null}:null,owner:report.owner?{id:positive(report.owner.id)}:null},
    live:Boolean(live),state,isError:false,
    waitingForFirstCombat:state==='waiting-for-first-combat',
    fights,scopes,
    selectedFight,
    selectedScope:selectedScope?{scopeKey:selectedScope.scopeKey,encounterId:selectedScope.encounterId,bossName:selectedScope.bossName,difficulty:selectedScope.difficulty,difficultyName:selectedScope.difficultyName}:null,
    evidenceContract:{difficultyClassifiedPerFight:true,crossDifficultyAggregationForbidden:true,emptyLiveReportIsNotFailure:true,combatEventsFetched:false},
  };
}

export function buildAvoidExecutionContextV1({homeHistory=null,activeReport=null,pullSelection='all'}={}){
  const selection=normalizePullSelectionV1(pullSelection);
  return Object.freeze({
    version:AVOID_EXECUTION_CONTEXT_VERSION,
    homeHistory:homeHistory||null,
    activeReport:activeReport||null,
    pullSelection:selection,
    isolation:{
      globalIrisIndependent:true,
      activeReportDoesNotMutateHomeHistory:true,
      homeHistoryRefreshExplicit:true,
      pullSelectionIsConsumerOptIn:true,
      firstPageWclNetworkAllowed:false,
    },
  });
}
