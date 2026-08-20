import { createHash } from 'node:crypto';
import { corpusGet,corpusSet,corpusList } from '../corpus/storage.mjs';
import { homeGuildId } from '../knowledge/scopes.mjs';

export const HOME_RAID_PULL_FACTS_VERSION='home-raid-pull-facts-v1';
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const digest=value=>createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');
const pos=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const safe=value=>String(value||'').replace(/[^A-Za-z0-9._-]/g,'_');
const root=({guildId,encounterId,difficulty})=>`home/raid-pull-facts/g${Number(guildId)}/e${Number(encounterId)}/d${Number(difficulty)}`;
const latestKey=scope=>`${root(scope)}/reports/${safe(scope.reportCode)}/latest.json`;
const revisionKey=(scope,fingerprint)=>`${root(scope)}/reports/${safe(scope.reportCode)}/revisions/${fingerprint}.json`;

export function buildHomePullFactsSnapshotV1({manifest,scope,guildId=homeGuildId()}={}){
  if(!manifest?.report?.code)throw new Error('manifest report is required');
  const encounterId=pos(scope?.encounterId),difficulty=pos(scope?.difficulty);if(!encounterId||!difficulty)throw new Error('encounter+difficulty are required');
  const scopeKey=`${encounterId}:d${difficulty}`,rows=(manifest.fights||[]).filter(row=>row?.scopeKey===scopeKey&&!row?.inProgress).sort((a,b)=>Number(a.startTime||0)-Number(b.startTime||0)||Number(a.fightId||0)-Number(b.fightId||0));
  if(!rows.length)return null;
  const pulls=rows.map((row,index)=>({fightId:Number(row.fightId),pullNumber:index+1,kill:Boolean(row.kill),fightPercentage:finite(row.fightPercentage),bossPercentage:finite(row.bossPercentage),durationMs:Math.max(0,Number(row.endTime||0)-Number(row.startTime||0)),startTime:finite(row.startTime),endTime:finite(row.endTime)}));
  const evidence={reportCode:String(manifest.report.code),encounterId,difficulty,pulls};const fingerprint=digest(evidence);
  return{version:HOME_RAID_PULL_FACTS_VERSION,fingerprint,generatedAt:Number(manifest.generatedAt)||Date.now(),guildId:Number(guildId),reportCode:String(manifest.report.code),report:{code:String(manifest.report.code),title:manifest.report.title||null,startTime:finite(manifest.report.startTime),endTime:finite(manifest.report.endTime),revision:finite(manifest.report.revision),zone:manifest.report.zone||null,guild:manifest.report.guild||null},encounter:{id:encounterId,name:scope?.bossName||rows.at(-1)?.bossName||null,difficulty,difficultyName:scope?.difficultyName||rows.at(-1)?.difficultyName||null,scopeKey},analysisPopulation:{rawPulls:rows.length,eligiblePulls:rows.length,excludedPulls:[],eligibleFightIds:pulls.map(row=>row.fightId)},pulls,evidenceContract:{homeOnly:true,objectivePullFactsOnly:true,derivedFromWclManifest:true,combatEventsRequired:false,mechanicClassificationRequired:false,scopeIdentity:'encounter+difficulty',crossDifficultyAggregationForbidden:true,killAndProgressIndependentOfMechanicReadiness:true,automaticPromotion:false}};
}

export async function persistHomePullFactsSnapshotV1(snapshot,{storageGet=corpusGet,storageSet=corpusSet}={}){
  if(!snapshot)return null;const scope={guildId:snapshot.guildId,encounterId:snapshot.encounter.id,difficulty:snapshot.encounter.difficulty,reportCode:snapshot.reportCode},latest=latestKey(scope),existing=await storageGet(latest).catch(()=>null);if(existing?.fingerprint===snapshot.fingerprint)return existing;
  const revision=revisionKey(scope,snapshot.fingerprint),stored={...snapshot,storage:{revisionKey:revision,latestKey:latest,persistedAt:Date.now()}};await storageSet(revision,stored);await storageSet(latest,stored);return stored;
}

export async function listHomePullFactsSnapshotsV1({guildId=homeGuildId(),encounterId,difficulty,storageList=corpusList,storageGet=corpusGet}={}){
  const scope={guildId,encounterId:pos(encounterId),difficulty:pos(difficulty)};if(!scope.encounterId||!scope.difficulty)throw new Error('encounter+difficulty are required');const prefix=`${root(scope)}/reports/`,keys=(await storageList(prefix)).filter(key=>key.endsWith('/latest.json'));return(await Promise.all(keys.map(key=>storageGet(key).catch(()=>null)))).filter(Boolean);
}
