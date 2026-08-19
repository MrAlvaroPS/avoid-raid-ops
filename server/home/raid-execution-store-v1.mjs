import { createHash } from 'node:crypto';
import { corpusGet,corpusSet,corpusList } from '../corpus/storage.mjs';
import { homeGuildId } from '../knowledge/scopes.mjs';

export const HOME_RAID_EXECUTION_VERSION='home-raid-execution-v1';
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const digest=value=>createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');
const pos=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const safe=value=>String(value||'').replace(/[^A-Za-z0-9._-]/g,'_');
const root=({guildId,encounterId,difficulty})=>`home/raid-execution/g${Number(guildId)}/e${Number(encounterId)}/d${Number(difficulty)}`;
export const homeExecutionLatestKeyV1=scope=>`${root(scope)}/reports/${safe(scope.reportCode)}/latest.json`;
export const homeExecutionRevisionKeyV1=(scope,fingerprint)=>`${root(scope)}/reports/${safe(scope.reportCode)}/revisions/${fingerprint}.json`;

function mechanicRow(row={}){return{
  key:String(row.key||''),name:row.name||row.key||'Unknown mechanic',category:row.category||null,severity:row.severity||null,scoreable:Boolean(row.scoreable),expectedAction:row.expectedAction||null,
  opportunities:Number(row.opportunities||0),failedOccurrences:Number(row.failedOccurrences||0),failures:Number(row.failures||0),playerExposures:Number(row.playerExposures||0),observedIncidents:Number(row.observedIncidents||0),unresolvedAssignments:Number(row.unresolvedAssignments||0),cleanOccurrences:finite(row.cleanOccurrences),executionSuccessPct:finite(row.executionSuccessPct),denominatorStatus:row.denominatorStatus||'pending',linkedDeaths:Number(row.linkedDeaths||0),firstDeaths:Number(row.firstDeaths||0),confidence:row.confidence||'unknown'
};}
function failureRow(row={}){return{mechanicKey:String(row.mechanicKey||''),mechanicName:row.mechanicName||null,fightId:Number(row.fightId),actorId:finite(row.actorId),scope:row.scope||null,reason:row.reason||null,confidence:row.confidence||null,weight:finite(row.weight)};}

export function buildHomeExecutionSnapshotV1(data,{reportCode,guildId=homeGuildId()}={}){
  if(data?.status!=='ready')throw new Error('ready operational execution is required');
  if(data?.raidKnowledge?.homeRaidEligible!==true)throw new Error('Only HOME execution may enter the HOME longitudinal store');
  const encounterId=pos(data?.encounter?.id),difficulty=pos(data?.encounter?.difficulty);if(!encounterId||!difficulty)throw new Error('encounter+difficulty are required');
  const code=String(reportCode||data?.report?.code||'').trim();if(!code)throw new Error('reportCode is required');
  const mechanics=(data?.mechanics?.mechanics||[]).map(mechanicRow).filter(row=>row.key),failures=(data?.mechanics?.failures||[]).map(failureRow).filter(row=>row.mechanicKey&&Number.isFinite(row.fightId));
  const evidence={reportCode:code,encounterId,difficulty,eligibleFightIds:(data?.analysisPopulation?.eligibleFightIds||[]).map(Number).filter(Number.isFinite),mechanics,failures,blocker:data?.blocker||null,nextPullCalls:data?.nextPullCalls||[],rulePack:data?.rulePack||null,operationalReference:data?.operationalReference||null};
  const fingerprint=digest(evidence);
  return{version:HOME_RAID_EXECUTION_VERSION,fingerprint,generatedAt:Number(data.generatedAt)||Date.now(),guildId:Number(guildId),reportCode:code,report:data?.report||{code},encounter:{id:encounterId,name:data?.encounter?.name||null,difficulty,difficultyName:data?.encounter?.difficultyName||null,scopeKey:`${encounterId}:d${difficulty}`},analysisPopulation:data?.analysisPopulation||null,mechanics,failures,blocker:data?.blocker||null,nextPullCalls:data?.nextPullCalls||[],rulePack:data?.rulePack||null,operationalReference:data?.operationalReference||null,evidenceContract:{homeOnly:true,derivedFromObservedWcl:true,scopeIdentity:'encounter+difficulty',crossDifficultyAggregationForbidden:true,latestPullDoesNotReplaceHistory:true,automaticPromotion:false}};
}

export async function persistHomeExecutionSnapshotV1(snapshot,{storageSet=corpusSet}={}){
  const scope={guildId:snapshot.guildId,encounterId:snapshot.encounter.id,difficulty:snapshot.encounter.difficulty,reportCode:snapshot.reportCode};
  const revisionKey=homeExecutionRevisionKeyV1(scope,snapshot.fingerprint),latestKey=homeExecutionLatestKeyV1(scope);
  const stored={...snapshot,storage:{revisionKey,latestKey,persistedAt:Date.now()}};
  await storageSet(revisionKey,stored);await storageSet(latestKey,stored);return stored;
}

export async function listHomeExecutionSnapshotsV1({guildId=homeGuildId(),encounterId,difficulty,storageList=corpusList,storageGet=corpusGet}={}){
  const scope={guildId,encounterId:pos(encounterId),difficulty:pos(difficulty)};if(!scope.encounterId||!scope.difficulty)throw new Error('encounter+difficulty are required');
  const prefix=`${root(scope)}/reports/`,keys=(await storageList(prefix)).filter(key=>key.endsWith('/latest.json'));
  return (await Promise.all(keys.map(key=>storageGet(key).catch(()=>null)))).filter(Boolean);
}

function pullOrder(snapshots=[]){
  const rows=[];
  for(const snapshot of snapshots){const ids=(snapshot?.analysisPopulation?.eligibleFightIds||[]).map(Number).filter(Number.isFinite);ids.forEach((fightId,index)=>rows.push({key:`${snapshot.reportCode}:${fightId}`,reportCode:snapshot.reportCode,fightId,index,at:Number(snapshot?.report?.startTime||snapshot.generatedAt||0)+index,snapshotAt:Number(snapshot.generatedAt||0)}));}
  const byKey=new Map();for(const row of rows)byKey.set(row.key,row);return [...byKey.values()].sort((a,b)=>a.at-b.at||a.snapshotAt-b.snapshotAt||a.index-b.index);
}
function rate(failures,pulls){if(!pulls.length)return null;const ids=new Set(pulls.map(row=>row.key)),failed=new Set();for(const row of failures){const key=`${row.reportCode}:${row.fightId}`;if(ids.has(key))failed.add(key);}return failed.size/pulls.length;}
const trend=(recent,previous)=>recent==null||previous==null?'baseline':recent<previous-.08?'improving':recent>previous+.08?'regressing':'stable';

export function aggregateHomeRaidExecutionV1(snapshots=[],{guildId=homeGuildId(),encounterId,difficulty,recentWindow=8}={}){
  const valid=(snapshots||[]).filter(s=>Number(s?.guildId)===Number(guildId)&&Number(s?.encounter?.id)===Number(encounterId)&&Number(s?.encounter?.difficulty)===Number(difficulty));
  const pulls=pullOrder(valid),window=Math.max(3,Math.min(20,Number(recentWindow)||8)),recent=pulls.slice(-window),previous=pulls.slice(-window*2,-window);
  const map=new Map(),failures=[];
  for(const snapshot of valid){
    for(const f of snapshot.failures||[])failures.push({...f,reportCode:snapshot.reportCode});
    for(const m of snapshot.mechanics||[]){if(!map.has(m.key))map.set(m.key,{key:m.key,name:m.name,category:m.category,severity:m.severity,expectedAction:m.expectedAction,opportunities:0,failedOccurrences:0,failures:0,playerExposures:0,observedIncidents:0,unresolvedAssignments:0,linkedDeaths:0,firstDeaths:0,normalizedSnapshots:0});const a=map.get(m.key);for(const k of ['opportunities','failedOccurrences','failures','playerExposures','observedIncidents','unresolvedAssignments','linkedDeaths','firstDeaths'])a[k]+=Number(m[k]||0);if(m.denominatorStatus==='normalized')a.normalizedSnapshots++;}
  }
  const mechanics=[...map.values()].map(m=>{
    const mf=failures.filter(f=>f.mechanicKey===m.key),recentFailurePullRate=rate(mf,recent),previousFailurePullRate=rate(mf,previous),executionSuccessPct=m.opportunities>0&&m.failedOccurrences<=m.opportunities?100*Math.max(0,m.opportunities-m.failedOccurrences)/m.opportunities:null;
    return{...m,executionSuccessPct,denominatorStatus:m.normalizedSnapshots>0&&m.opportunities>0?'normalized':'pending',recentFailurePullRate,previousFailurePullRate,trend:trend(recentFailurePullRate,previousFailurePullRate),recentFailedPulls:recentFailurePullRate==null?0:Math.round(recentFailurePullRate*recent.length),previousFailedPulls:previousFailurePullRate==null?0:Math.round(previousFailurePullRate*previous.length)};
  }).sort((a,b)=>(b.recentFailurePullRate??-1)-(a.recentFailurePullRate??-1)||b.linkedDeaths-a.linkedDeaths||b.failedOccurrences-a.failedOccurrences);
  const normalized=mechanics.filter(m=>m.denominatorStatus==='normalized'),opp=normalized.reduce((s,m)=>s+m.opportunities,0),failed=normalized.reduce((s,m)=>s+m.failedOccurrences,0),mechanicalAccuracyPct=opp>0?100*Math.max(0,opp-failed)/opp:null,blocker=mechanics.find(m=>(m.recentFailurePullRate??0)>0)||mechanics.find(m=>m.failedOccurrences>0)||null;
  let state='NO AVOID DATA',tone='muted',mechanicsGate='pending';
  if(pulls.length>0&&pulls.length<3){state='BASELINE',tone='info';}
  else if(pulls.length>=3&&!normalized.length){state='LEARNING',tone='info';}
  else if(pulls.length>=3&&blocker&&(blocker.recentFailurePullRate??0)>=.35){state='MECHANICS BLOCKING',tone='bad';mechanicsGate='fail';}
  else if(pulls.length>=3&&blocker&&(blocker.recentFailurePullRate??0)>=.12){state=blocker.trend==='improving'?'STABILIZING':'MECHANICS TO CLEAN',tone='warn';mechanicsGate='pending';}
  else if(pulls.length>=3&&normalized.length){state='MECHANICALLY STABLE',tone='good';mechanicsGate='pass';}
  const latest=valid.slice().sort((a,b)=>Number(a.generatedAt)-Number(b.generatedAt)).at(-1)||null,nextPullCalls=mechanics.filter(m=>(m.recentFailurePullRate??0)>0).slice(0,3).map(m=>({kind:'mechanic',confidence:m.linkedDeaths>0?'high':'medium',title:m.name,detail:m.expectedAction||`${m.recentFailedPulls}/${recent.length||0} recent pulls contained this classified failure.`}));
  return{version:HOME_RAID_EXECUTION_VERSION,status:pulls.length?'ready':'empty',generatedAt:Date.now(),guildId:Number(guildId),encounter:{id:Number(encounterId),name:latest?.encounter?.name||null,difficulty:Number(difficulty),difficultyName:latest?.encounter?.difficultyName||null,scopeKey:`${Number(encounterId)}:d${Number(difficulty)}`},state:{key:state.toLowerCase().replace(/\s+/g,'-'),label:state,tone,mechanicsGate,mechanicalAccuracyPct,scoreSemantics:'aggregate clean mechanic occurrences / observed mechanic opportunities; never a single-pull score'},population:{reports:valid.length,pulls:pulls.length,recentPulls:recent.length,previousPulls:previous.length,normalizedMechanics:normalized.length,totalMechanics:mechanics.length},blocker: blocker?{key:blocker.key,name:blocker.name,recentFailurePullRate:blocker.recentFailurePullRate,previousFailurePullRate:blocker.previousFailurePullRate,trend:blocker.trend,linkedDeaths:blocker.linkedDeaths,expectedAction:blocker.expectedAction}:null,mechanics,nextPullCalls:nextPullCalls.length?nextPullCalls:(latest?.nextPullCalls||[]).slice(0,3),latestReportCode:latest?.reportCode||null,evidenceContract:{homeOnly:true,longitudinalAcrossAllPersistedPulls:true,recentWindowForCurrentState:window,singlePullCannotReplaceAggregate:true,mechanicallyReadyIsNotOverallKillability:true,automaticPromotion:false},networkExecuted:false,wclCallsExecuted:0};
}

export async function loadHomeRaidExecutionV1({guildId=homeGuildId(),encounterId,difficulty,recentWindow=8}={}){const snapshots=await listHomeExecutionSnapshotsV1({guildId,encounterId,difficulty});return aggregateHomeRaidExecutionV1(snapshots,{guildId,encounterId,difficulty,recentWindow});}
