import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { simcSlotsForItemV1 } from './eligibility-v1.mjs';

export const LOOT_SIMC_RUNNER_VERSION='loot-simc-runner-v1.2';
const clean=value=>String(value||'').trim();
const safeToken=value=>clean(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const metricMean=row=>finite(row?.mean??row?.dps?.mean??row?.metric?.mean??row?.data?.mean);
const metricError=row=>finite(row?.mean_std_dev??row?.mean_stddev??row?.stddev??row?.dps?.mean_std_dev??row?.dps?.mean_stddev);
const CLASS_TOKEN={deathknight:'death_knight',demonhunter:'demon_hunter',druid:'druid',evoker:'evoker',hunter:'hunter',mage:'mage',monk:'monk',paladin:'paladin',priest:'priest',rogue:'rogue',shaman:'shaman',warlock:'warlock',warrior:'warrior'};
const WCL_SLOT={head:'head',neck:'neck',shoulders:'shoulder',shoulder:'shoulder',back:'back',chest:'chest',waist:'waist',legs:'legs',feet:'feet',wrists:'wrist',wrist:'wrist',hands:'hands','ring 1':'finger1','ring 2':'finger2','trinket 1':'trinket1','trinket 2':'trinket2','main hand':'main_hand','off hand':'off_hand'};

async function exists(path){try{await access(path);return true}catch{return false}}
function lookupOnPath(command='simc'){
  const locator=process.platform==='win32'?'where.exe':'which';
  try{
    const result=spawnSync(locator,[command],{encoding:'utf8',windowsHide:true,timeout:4000});
    if(result.status!==0)return null;
    return String(result.stdout||'').split(/\r?\n/).map(clean).find(Boolean)||null;
  }catch{return null;}
}
function windowsCandidates(){
  if(process.platform!=='win32')return[];
  const home=clean(process.env.USERPROFILE),local=clean(process.env.LOCALAPPDATA);
  return[
    'C:\\SimulationCraft\\simc.exe',
    'C:\\Program Files\\SimulationCraft\\simc.exe',
    'C:\\Program Files (x86)\\SimulationCraft\\simc.exe',
    home?join(home,'SimulationCraft','simc.exe'):null,
    local?join(local,'SimulationCraft','simc.exe'):null,
  ].filter(Boolean);
}
export async function resolveSimcExecutableV1(){
  const configured=clean(process.env.SIMC_PATH);
  if(configured){
    if(isAbsolute(configured))return await exists(configured)?{available:true,path:configured,source:'SIMC_PATH'}:{available:false,path:configured,source:'SIMC_PATH',reason:'SIMC_PATH does not exist'};
    const found=lookupOnPath(configured);return found?{available:true,path:found,source:'SIMC_PATH/PATH'}:{available:false,path:configured,source:'SIMC_PATH',reason:`Configured command ${configured} was not found on PATH`};
  }
  const fromPath=lookupOnPath('simc');if(fromPath)return{available:true,path:fromPath,source:'PATH'};
  for(const candidate of windowsCandidates())if(await exists(candidate))return{available:true,path:candidate,source:'WINDOWS_AUTO_DETECT'};
  return{available:false,path:null,source:'UNRESOLVED',reason:process.platform==='win32'?'simc.exe was not found in PATH or common Windows install folders; set SIMC_PATH to the official SimulationCraft simc.exe':'simc was not found on PATH; set SIMC_PATH to the official SimulationCraft CLI'};
}
export async function simcWorkerStatusV1(){return{version:LOOT_SIMC_RUNNER_VERSION,...await resolveSimcExecutableV1()};}

function gearOption(row){
  const parts=[`id=${Number(row.id)}`];if(finite(row.itemLevel))parts.push(`ilevel=${Number(row.itemLevel)}`);if((row.gems||[]).length)parts.push(`gem_id=${row.gems.map(Number).filter(Number.isFinite).join('/')}`);if((row.enchants||[]).length)parts.push(`enchant_id=${Number(row.enchants[0])}`);return parts.join(',');
}
function wclProfile(player){
  const gear=(player?.character?.gear||[]).filter(row=>Number(row?.id)>0),talents=clean(player?.character?.talentImportCode),classKey=safeToken(player.className).replaceAll('_',''),classToken=CLASS_TOKEN[classKey],name=clean(player.name),spec=safeToken(player.spec);
  const mapped=gear.map(row=>({slot:WCL_SLOT[clean(row.slot).toLowerCase()]||null,row})).filter(x=>x.slot);
  if(!classToken||!name||mapped.length<10||!talents)return null;
  const lines=[`${classToken}="${name.replaceAll('"','')}"`];if(spec)lines.push(`spec=${spec}`);lines.push(`talents=${talents}`);for(const {slot,row} of mapped)lines.push(`${slot}=${gearOption(row)}`);
  return{lines,source:'wcl-combatantinfo',profileCompleteness:{gearRows:gear.length,mappedGearRows:mapped.length,talents:true,bonusIdsPreserved:false,craftedOptionsPreserved:false}};
}
function armoryProfile(player){
  const region=safeToken(player.region||process.env.BLIZZARD_REGION||'eu'),realm=safeToken(player.server||player.realm),name=clean(player.name);if(!realm||!name)throw new Error(`Profile identity incomplete for ${name||'player'}: realm/server is required`);return{lines:[`armory=${region},${realm},${name}`],source:'battle-net-armory',profileCompleteness:{gearRows:null,mappedGearRows:null,talents:null,bonusIdsPreserved:true,craftedOptionsPreserved:true}};
}
function baseProfile(player){return wclProfile(player)||armoryProfile(player);}

function profileText({player,item,itemLevel,slots,iterations=1000,scenario='raid_st',jsonPath}){
  if(scenario!=='raid_st')throw new Error('Loot v0.1 only supports raid_st; Mythic+/dungeon profiles are forbidden');
  const profile=baseProfile(player),itemOpt=`id=${Number(item.id)}${finite(itemLevel)?`,ilevel=${Number(itemLevel)}`:''}`;
  const lines=['fight_style=Patchwerk','max_time=300','vary_combat_length=0.20',`iterations=${Math.max(250,Math.min(10000,Number(iterations)||1000))}`,'threads=4','profileset_work_threads=1','profileset_metric=dps','report_details=0',`json2=${jsonPath.replaceAll('\\','/')}`,...profile.lines];
  slots.forEach((slot,index)=>lines.push(`profileset.loot_${index+1}=${slot}=${itemOpt}`));
  return{text:lines.join('\n')+'\n',profile};
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
  const worker=await resolveSimcExecutableV1();if(!worker.available)return{version:LOOT_SIMC_RUNNER_VERSION,engine:'simulationcraft-official-cli',playerName:player.name,itemId:item.id,status:'simc-worker-offline',gainPct:null,reason:worker.reason,worker};
  const dir=await mkdtemp(join(tmpdir(),'avoid-loot-simc-')),input=join(dir,'loot.simc'),output=join(dir,'result.json');let profile=null;
  try{const built=profileText({player,item,itemLevel,slots,iterations,scenario,jsonPath:output});profile=built.profile;await writeFile(input,built.text,'utf8');await runProcess(worker.path,[input],{cwd:dir,timeoutMs});const raw=JSON.parse(await readFile(output,'utf8'));return{version:LOOT_SIMC_RUNNER_VERSION,engine:'simulationcraft-official-cli',worker:{path:worker.path,source:worker.source},scenario:'raid_st',iterations:Math.max(250,Math.min(10000,Number(iterations)||1000)),profileSource:profile.source,profileCompleteness:profile.profileCompleteness,...parseResult(raw,{player,item,slots})};}
  catch(error){return{version:LOOT_SIMC_RUNNER_VERSION,engine:'simulationcraft-official-cli',worker:{path:worker.path,source:worker.source},playerName:player.name,itemId:item.id,status:'sim-failed',gainPct:null,profileSource:profile?.source||null,profileCompleteness:profile?.profileCompleteness||null,reason:error instanceof Error?error.message:String(error)};}
  finally{await rm(dir,{recursive:true,force:true}).catch(()=>{});}
}

export async function simulateLootRaidV1({players=[],item,itemLevel=null,iterations=1000,scenario='raid_st',concurrency=2}={}){
  const queue=[...(players||[])],results=[],workers=Math.max(1,Math.min(4,Number(concurrency)||2));
  await Promise.all(Array.from({length:workers},async()=>{while(queue.length){const player=queue.shift();if(!player)continue;results.push(await simulateLootForPlayerV1({player,item,itemLevel,iterations,scenario}));}}));
  results.sort((a,b)=>(Number(b.gainPct)||-Infinity)-(Number(a.gainPct)||-Infinity)||String(a.playerName).localeCompare(String(b.playerName)));
  return{version:LOOT_SIMC_RUNNER_VERSION,engine:'simulationcraft-official-cli',scenario,metric:'raid-single-target-dps-gain',results};
}
