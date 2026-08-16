import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { CORPUS_REPORT_HEADER_QUERY, CORPUS_WIDE_TABLES_QUERY } from '../wcl/queries/corpus.mjs';
import { isHomeGuildId, sanitizeGlobalBossProfile } from '../knowledge/scopes.mjs';

const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
function unwrap(v){let x=v;for(let i=0;i<4;i++){if(x&&typeof x==='object'&&!Array.isArray(x)&&x.data&&typeof x.data==='object'){x=x.data;continue;}break;}return x||{};}

export function masterAbilityMaps(masterData){
  const byId=new Map(),byName=new Map();
  for(const a of masterData?.abilities||[]){const id=num(a.gameID??a.guid??a.id);if(id==null)continue;const row={id,name:a.name||`Ability ${id}`,type:a.type||null};byId.set(id,row);byName.set(String(row.name).toLowerCase(),row);}
  return{byId,byName};
}

function abilityIdFromObject(obj,path,maps){
  const candidates=[obj?.abilityGameID,obj?.guid,obj?.ability?.guid,obj?.ability?.gameID,obj?.ability?.id];
  if(path.includes('abilities'))candidates.push(obj?.id);
  if(path.endsWith('.entries')||path.includes('.entries.'))candidates.push(obj?.id);
  for(const x of candidates){const id=num(x);if(id!=null&&(!maps.byId.size||maps.byId.has(id)))return id;}
  const name=String(obj?.ability?.name||obj?.name||'').toLowerCase();return maps.byName.get(name)?.id??null;
}

function metricCount(obj){
  const values=[obj?.count,obj?.uses,obj?.casts,obj?.totalUses,obj?.hitCount];
  for(const x of values){const n=num(x);if(n!=null)return Math.max(0,n);}
  const total=num(obj?.total??obj?.amount);return total!=null&&total!==0?1:0;
}
function metricTotal(obj){return num(obj?.total??obj?.amount??obj?.totalAmount)??0;}

export function summarizeAbilityTable(value,maps){
  const out=new Map();const root=unwrap(value);const visited=new WeakSet();
  const walk=(node,path='root',depth=0)=>{
    if(depth>12||node==null)return;
    if(Array.isArray(node)){node.forEach((x,i)=>walk(x,`${path}.${i}`,depth+1));return;}
    if(typeof node!=='object')return;if(visited.has(node))return;visited.add(node);
    const id=abilityIdFromObject(node,path,maps);
    if(id!=null){const meta=maps.byId.get(id)||{id,name:node?.ability?.name||node?.name||`Ability ${id}`};const prev=out.get(id)||{id,name:meta.name,type:meta.type||null,count:0,total:0,rows:0};prev.count+=metricCount(node);prev.total+=metricTotal(node);prev.rows++;out.set(id,prev);}
    for(const [k,v] of Object.entries(node))if(v&&typeof v==='object')walk(v,`${path}.${k}`,depth+1);
  };walk(root);return Object.fromEntries([...out].map(([id,v])=>[String(id),v]));
}

// Player actor ids are report-local implementation detail and are deliberately not
// persisted in GLOBAL BOSS KNOWLEDGE. Raid/player identity lives in the home-raid scope.
export function compactFight(f){return{id:num(f.id),startTime:num(f.startTime),endTime:num(f.endTime),durationMs:num(f.endTime)!=null&&num(f.startTime)!=null?num(f.endTime)-num(f.startTime):null,kill:Boolean(f.kill),fightPercentage:num(f.fightPercentage),bossPercentage:num(f.bossPercentage),averageItemLevel:num(f.averageItemLevel),phaseTransitions:(f.phaseTransitions||[]).map(p=>({id:num(p.id),startTime:num(p.startTime)}))};}

export function normalizeReportHeader(data,{encounterId,difficulty}){
  const report=data?.reportData?.report;if(!report)return null;
  const fights=(report.fights||[]).map(compactFight).filter(f=>f.id!=null);
  return{
    schemaVersion:2,kind:'header',code:report.code,title:report.title||null,startTime:num(report.startTime),endTime:num(report.endTime),visibility:report.visibility||null,
    zone:report.zone?{id:num(report.zone.id),name:report.zone.name||null}:null,
    guild:report.guild?{id:num(report.guild.id),name:report.guild.name||null}:null,
    owner:report.owner?{id:num(report.owner.id)}:null,
    encounterId:Number(encounterId),difficulty:Number(difficulty),fights,
    masterData:report.masterData||null,rateLimit:data?.rateLimitData||null
  };
}

export async function fetchReportHeader({code,encounterId,difficulty=5}){
  const data=await wclGraphql(CORPUS_REPORT_HEADER_QUERY,{code:String(code),encounter:Number(encounterId),difficulty:Number(difficulty)});
  return normalizeReportHeader(data,{encounterId,difficulty});
}

export function normalizeWideProfile(header,tableData,{encounterId,difficulty}){
  if(!header)return null;const report=tableData?.reportData?.report||{};const fights=header.fights||[],kills=fights.filter(f=>f.kill),wipes=fights.filter(f=>!f.kill);const maps=masterAbilityMaps(header.masterData);
  const tables={};
  for(const kind of ['Casts','Damage','Debuffs','Buffs','Interrupts','Deaths'])for(const cohort of ['kill','wipe']){const key=`${cohort}${kind}`;tables[key]=summarizeAbilityTable(report[key],maps);}
  return sanitizeGlobalBossProfile({schemaVersion:2,kind:'wide',code:header.code,title:header.title||null,startTime:header.startTime,endTime:header.endTime,visibility:header.visibility||null,zone:header.zone||null,guild:header.guild||null,owner:header.owner||null,encounterId:Number(encounterId),difficulty:Number(difficulty),fights,kills:kills.length,wipes:wipes.length,tables,abilities:Object.fromEntries([...maps.byId].map(([id,v])=>[String(id),v])),rateLimit:tableData?.rateLimitData||header.rateLimit||null,generatedAt:Date.now()});
}

export async function fetchWideProfile({code,encounterId,difficulty=5}){
  const header=await fetchReportHeader({code,encounterId,difficulty});
  if(!header||!header.fights?.length)return null;
  // Double guard: the home guild is an application/evaluation cohort, never boss training/holdout.
  // Returning null here avoids the expensive Wide tables query as well as persistence/merge.
  if(isHomeGuildId(header?.guild?.id))return null;
  const killFightIDs=header.fights.filter(f=>f.kill).map(f=>f.id),wipeFightIDs=header.fights.filter(f=>!f.kill).map(f=>f.id);
  const tableData=await wclGraphql(CORPUS_WIDE_TABLES_QUERY,{code:String(code),killFightIDs,wipeFightIDs,hasKills:killFightIDs.length>0,hasWipes:wipeFightIDs.length>0});
  return normalizeWideProfile(header,tableData,{encounterId,difficulty});
}
