import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { simcSlotsForItemV1 } from './eligibility-v1.mjs';

export const LOOT_SIMC_RUNNER_VERSION='loot-simc-runner-v1';
const executable=()=>String(process.env.SIMC_PATH||'simc').trim()||'simc';
const clean=value=>String(value||'').trim();
const safeToken=value=>clean(value).toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'');
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const metricMean=row=>finite(row?.mean??row?.dps?.mean??row?.metric?.mean??row?.data?.mean);
const metricError=row=>finite(row?.mean_std_dev??row?.mean_stddev??row?.stddev??row?.dps?.mean_std_dev??row?.dps?.mean_stddev);

export async function simcWorkerStatusV1(){
  const path=executable();
  if(isAbsolute(path)){try{await access(path);return{version:LOOT_SIMC_RUNNER_VERSION,available:true,path,source:'SIMC_PATH'}}catch{return{version:LOOT_SIMC_RUNNER_VERSION,available:false,path,source:'SIMC_PATH',reason:'SIMC_PATH does not exist'}}}
  return{version:LOOT_SIMC_RUNNER_VERSION,available:true,path,source:'PATH',availability:'command-resolution-deferred-until-run'};
}

function profileText({player,item,itemLevel,slots,iterations=1000,scenario='raid_st',jsonPath}){
  if(scenario!=='raid_st')throw new Error('Loot v0.1 only supports raid_st; DungeonSlice/M+ profiles are forbidden');
  const region=safeToken(player.region||process.env.BLIZZARD_REGION||'eu'),realm=safeToken(player.server||player.realm),name=clean(player.name);if(!realm||!name)throw new Error(`Armory identity incomplete for ${name||'player'}: realm/server is required`);
  const itemOpt=`id=${Number(item.id)}${finite(itemLevel)?`,ilevel=${Number(itemLevel)}`:''}`;
  const lines=[
    'fight_style=Patchwerk','max_time=300','vary_combat_length=0.20',`iterations=${Math.max(250,Math.min(10000,Number(iterations)||1000))}`,'threads=4','profileset_work_threads=1','profileset_metric=dps','report_details=0',`json2=${jsonPath.replaceAll('\\','/')}`,`armory=${region},${realm},${name}`
  ];
  slots.forEach((slot,index)=>lines.push(`profileset.loot_${index+1}=${slot}=${itemOpt}`));
  return lines.join('\n')+'\n';
}

function parseResult(raw,{player,item,slots}){
  const baseRow=raw?.sim?.players?.[0]?.collected_data?.dps||raw?.sim?.players?.[0]?.collected_data?.damage_per_second||null,baseline=metricMean(baseRow),baseError=metricError(baseRow),results=raw?.profilesets?.results||[];
  const candidates=results.map((row,index)=>({name:row?.name||row?.profileset||`loot_${index+1}`,slot:slots[index]||null,dps:metricMean(row),error:metricError(row)})).filter(row=>row.dps!=null);
  const best=candidates.slice().sort((a,b)=>b.dps-a.dps)[0]||null;if(baseline==null||!best)throw new Error(`SimulationCraft JSON did not expose baseline/profileset DPS for ${player.name}`);
  const delta=best.dps-baseline,gainPct=baseline>0?100*delta/baseline:null,noise=Math.max(Number(baseError)||0,Number(best.error)||0),signal=Math.abs(delta),confidence=noise<=0?'unknown':signal>=2*noise?'high':signal>=noise?'medium':'low';
  return{playerName:player.name,itemId:item.id,baselineDps:baseline,candidateDps:best.dps,deltaDps:delta,gainPct,bestSlot:best.slot,baselineError:baseError,candidateError:best.error,confidence,statisticalSignal:noise>0?signal/noise:null,candidates,status:'simulated'};
}

function runProcess(command,args,{cwd,timeoutMs=180000}={}){return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd,windowsHide:true,env:{...process.env}});let stdout='',stderr='';const timer=setTimeout(()=>{child.kill();reject(new Error(`SimulationCraft timed out after ${timeoutMs} ms`));},timeoutMs);child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.on('error',error=>{clearTimeout(timer);reject(error)});child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(new Error(`SimulationCraft exited ${code}: ${stderr.slice(-1200)||stdout.slice(-1200)}`));resolve({stdout,stderr,code});});});}

export async function simulateLootForPlayerV1({player,item,itemLevel=null,iterations=1000,scenario='raid_st',timeoutMs=180000}={}){
  if(!player?.name)throw new Error('player is required');if(!item?.id)throw new Error('item is required');const role=String(player.role||'DPS').toUpperCase();if(role==='HEAL'||role==='HEALER')return{playerName:player.name,itemId:item.id,status:'role-model-pending',gainPct:null,reason:'Healing raid value is not modeled safely by Loot v0.1'};if(role==='TANK')return{playerName:player.name,itemId:item.id,status:'role-model-pending',gainPct:null,reason:'Tank survival raid value is not modeled safely by Loot v0.1'};
  const slots=simcSlotsForItemV1(item);if(!slots.length)return{playerName:player.name,itemId:item.id,status:'unsupported-slot',gainPct:null,reason:'No SimulationCraft slot mapping'};
  const dir=await mkdtemp(join(tmpdir(),'avoid-loot-simc-')),input=join(dir,'loot.simc'),output=join(dir,'result.json');
  try{await writeFile(input,profileText({player,item,itemLevel,slots,iterations,scenario,jsonPath:output}),'utf8');await runProcess(executable(),[input],{cwd:dir,timeoutMs});const raw=JSON.parse(await readFile(output,'utf8'));return{version:LOOT_SIMC_RUNNER_VERSION,engine:'simulationcraft-official-cli',scenario:'raid_st',iterations:Math.max(250,Math.min(10000,Number(iterations)||1000)),...parseResult(raw,{player,item,slots})};}
  catch(error){return{version:LOOT_SIMC_RUNNER_VERSION,engine:'simulationcraft-official-cli',playerName:player.name,itemId:item.id,status:'sim-failed',gainPct:null,reason:error instanceof Error?error.message:String(error)};}
  finally{await rm(dir,{recursive:true,force:true}).catch(()=>{});}
}

export async function simulateLootRaidV1({players=[],item,itemLevel=null,iterations=1000,scenario='raid_st',concurrency=2}={}){
  const queue=[...(players||[])],results=[],workers=Math.max(1,Math.min(4,Number(concurrency)||2));
  await Promise.all(Array.from({length:workers},async()=>{while(queue.length){const player=queue.shift();if(!player)continue;results.push(await simulateLootForPlayerV1({player,item,itemLevel,iterations,scenario}));}}));
  results.sort((a,b)=>(Number(b.gainPct)||-Infinity)-(Number(a.gainPct)||-Infinity)||String(a.playerName).localeCompare(String(b.playerName)));
  return{version:LOOT_SIMC_RUNNER_VERSION,engine:'simulationcraft-official-cli',scenario,metric:'raid-single-target-dps-gain',results};
}
