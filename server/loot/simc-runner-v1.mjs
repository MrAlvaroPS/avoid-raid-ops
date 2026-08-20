import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, isAbsolute } from 'node:path';
import { simcSlotsForItemV1 } from './eligibility-v1.mjs';
import { dockerSimcCurrentV1, simcDockerFreshnessV1 } from './simc-docker-manager-v1.mjs';
import { shouldRetryWindowsShellLaunchV1 } from './simc-manager-v1.mjs';

export const LOOT_SIMC_RUNNER_VERSION='loot-simc-runner-v1.10';

const clean=value=>String(value||'').trim();
const safeToken=value=>clean(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');
const finite=value=>value===null||value===undefined||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const metricNode=row=>Array.isArray(row?.metrics)?(row.metrics.find(metric=>safeToken(metric?.metric)==='dps')||row.metrics[0]||null):row;
const metricMean=row=>{const node=metricNode(row);return finite(node?.mean??node?.dps?.mean??node?.metric?.mean??node?.data?.mean);};
const metricError=row=>{const node=metricNode(row);return finite(node?.mean_std_dev??node?.mean_stddev??node?.stddev??node?.dps?.mean_std_dev??node?.dps?.mean_stddev);};
const CLASS_TOKEN={deathknight:'death_knight',demonhunter:'demon_hunter',druid:'druid',evoker:'evoker',hunter:'hunter',mage:'mage',monk:'monk',paladin:'paladin',priest:'priest',rogue:'rogue',shaman:'shaman',warlock:'warlock',warrior:'warrior'};
const WCL_SLOT={head:'head',neck:'neck',shoulders:'shoulder',shoulder:'shoulder',back:'back',chest:'chest',waist:'waist',legs:'legs',feet:'feet',wrists:'wrist',wrist:'wrist',hands:'hands','ring 1':'finger1','ring 2':'finger2',trinket1:'trinket1',trinket2:'trinket2','trinket 1':'trinket1','trinket 2':'trinket2','main hand':'main_hand','off hand':'off_hand'};
const TANK_SPECS=new Set(['blood','protection','guardian','brewmaster','vengeance']);
const HEAL_SPECS=new Set(['discipline','holy','mistweaver','preservation','restoration']);

async function exists(path){try{await access(path);return true}catch{return false}}
function lookupOnPath(command='simc'){
  const locator=process.platform==='win32'?'where.exe':'which';
  try{const result=spawnSync(locator,[command],{encoding:'utf8',windowsHide:true,timeout:4000});if(result.status!==0)return null;return String(result.stdout||'').split(/\r?\n/).map(clean).find(Boolean)||null;}catch{return null;}
}

export async function resolveSimcExecutableV1(){
  const configured=clean(process.env.SIMC_PATH);
  if(configured){
    if(isAbsolute(configured))return await exists(configured)?{available:true,kind:'native',path:configured,source:'SIMC_PATH',managed:false}:{available:false,kind:'native',path:configured,source:'SIMC_PATH',managed:false,reason:'SIMC_PATH does not exist'};
    const found=lookupOnPath(configured);return found?{available:true,kind:'native',path:found,source:'SIMC_PATH/PATH',managed:false}:{available:false,kind:'native',path:configured,source:'SIMC_PATH',managed:false,reason:`Configured command ${configured} was not found on PATH`};
  }
  const docker=await dockerSimcCurrentV1();
  if(docker)return{available:true,kind:'docker',path:docker.dockerPath||lookupOnPath('docker'),source:'MANAGED_DOCKER',managed:true,imageTag:docker.imageTag,imageId:docker.imageId,docker:{commit:docker.commit,nightlyCommit:docker.nightlyCommit,nightlyFilename:docker.nightlyFilename,buildInfo:docker.buildInfo,builtAt:docker.builtAt,serverVersion:docker.docker?.serverVersion||null,context:docker.docker?.context||null,osType:docker.docker?.osType||'linux'}};
  const fromPath=lookupOnPath('simc');if(fromPath)return{available:true,kind:'native',path:fromPath,source:'PATH',managed:false};
  return{available:false,kind:null,path:null,source:'UNRESOLVED',managed:false,reason:'No SimulationCraft worker is ready. Start Docker Desktop and run npm run sync:simc, or explicitly configure SIMC_PATH.'};
}

export async function simcWorkerStatusV1(){
  const resolved=await resolveSimcExecutableV1(),freshness=await simcDockerFreshnessV1();
  return{version:LOOT_SIMC_RUNNER_VERSION,...resolved,managedFreshness:resolved.source==='MANAGED_DOCKER'?{lastCheckedAt:freshness.lastCheckedAt,lastBuildError:freshness.lastBuildError,previousCommit:freshness.previous?.commit||null,docker:freshness.docker}:null};
}

function gearOption(row){
  const parts=[`id=${Number(row.id)}`];
  if(finite(row.itemLevel))parts.push(`ilevel=${Number(row.itemLevel)}`);
  if((row.gems||[]).length)parts.push(`gem_id=${row.gems.map(Number).filter(Number.isFinite).join('/')}`);
  if((row.enchants||[]).length)parts.push(`enchant_id=${Number(row.enchants[0])}`);
  return `,${parts.join(',')}`;
}

function wclProfile(player){
  const gear=(player?.character?.gear||[]).filter(row=>Number(row?.id)>0),talents=clean(player?.character?.talentImportCode),classKey=safeToken(player.className).replaceAll('_',''),classToken=CLASS_TOKEN[classKey],name=clean(player.name),spec=safeToken(player.spec);
  const mapped=gear.map(row=>({slot:WCL_SLOT[clean(row.slot).toLowerCase()]||null,row})).filter(x=>x.slot);
  if(!classToken||!name||mapped.length<10||!talents)return null;
  const lines=[`${classToken}="${name.replaceAll('"','')}"`];if(spec)lines.push(`spec=${spec}`);lines.push(`talents=${talents}`);for(const {slot,row} of mapped)lines.push(`${slot}=${gearOption(row)}`);
  return{lines,source:'wcl-combatantinfo',profileCompleteness:{gearRows:gear.length,mappedGearRows:mapped.length,talents:true,bonusIdsPreserved:false,craftedOptionsPreserved:false},importedSpecialization:spec||null,importedRole:clean(player.role).toLowerCase()||null};
}

function armoryProfile(player){
  const region=safeToken(player.region||process.env.BLIZZARD_REGION||'eu'),realm=safeToken(player.server||player.realm),name=clean(player.name);
  if(!realm||!name)throw new Error(`Profile identity incomplete for ${name||'player'}: realm/server is required`);
  return{lines:[`armory=${region},${realm},${name}`],source:'battle-net-armory',profileCompleteness:{gearRows:null,mappedGearRows:null,talents:null,bonusIdsPreserved:true,craftedOptionsPreserved:true}};
}

function roleFromSpec(spec){const token=safeToken(spec);if(TANK_SPECS.has(token))return'tank';if(HEAL_SPECS.has(token))return'heal';return token?'attack':null;}
function savedProfileIdentity(text=''){
  const spec=clean(String(text).match(/^spec\s*=\s*([^\r\n#]+)/mi)?.[1]),role=clean(String(text).match(/^role\s*=\s*([^\r\n#]+)/mi)?.[1]);
  return{specialization:spec||null,role:(role||roleFromSpec(spec)||null)?.toLowerCase?.()||null};
}
function rawIdentity(raw,player={}){
  const row=raw?.sim?.players?.[0]||{},specialization=clean(row.specialization)||clean(player?.spec)||null,role=clean(row.role).toLowerCase()||roleFromSpec(specialization)||null;
  return{specialization,role};
}
function rolePolicy(identity,{player,item}={}){
  const role=clean(identity?.role).toLowerCase(),specialization=clean(identity?.specialization)||clean(player?.spec)||null;
  if(role!=='heal'&&role!=='healer'&&role!=='tank')return null;
  return{playerName:player.name,itemId:item.id,status:'role-model-pending',gainPct:null,simSupport:'role-not-modeled-for-raid-value',unsupportedModel:specialization?`${specialization} · ${role}`:role,reason:role==='tank'?'Tank survivability/raid value is not modeled safely; SimC DPS output is deliberately ignored.':'Healing raid value is not modeled safely; SimC DPS output is deliberately ignored.',importedRole:role,importedSpecialization:specialization};
}

function profileText({profile,item,itemLevel,slots,iterations=1000,scenario='raid_st',jsonPath='result.json'}){
  if(scenario!=='raid_st')throw new Error('Loot v0.1 only supports raid_st; Mythic+/dungeon profiles are forbidden');
  const itemOpt=`,id=${Number(item.id)}${finite(itemLevel)?`,ilevel=${Number(itemLevel)}`:''}`;
  const lines=['fight_style=Patchwerk','max_time=300','vary_combat_length=0.20',`iterations=${Math.max(250,Math.min(10000,Number(iterations)||1000))}`,'threads=4','profileset_work_threads=1','profileset_metric=dps','report_details=0',`json2=${jsonPath}`,...profile.lines];
  slots.forEach((slot,index)=>lines.push(`profileset.loot_${index+1}=${slot}=${itemOpt}`));
  return lines.join('\n')+'\n';
}

function jsonDiagnostics(raw){
  const player=raw?.sim?.players?.[0]||{},collected=player?.collected_data||{},profilesets=raw?.profilesets||raw?.sim?.profilesets||null,results=Array.isArray(profilesets?.results)?profilesets.results:[];
  return{rootKeys:Object.keys(raw||{}).slice(0,30),simKeys:Object.keys(raw?.sim||{}).slice(0,30),playerKeys:Object.keys(player).slice(0,30),collectedKeys:Object.keys(collected).slice(0,30),profilesetKeys:Object.keys(profilesets||{}).slice(0,30),profilesetCount:results.length,firstProfileset:results[0]?{name:results[0].name||results[0].profileset||null,keys:Object.keys(results[0]).slice(0,20),mean:metricMean(results[0]),metrics:Array.isArray(results[0].metrics)?results[0].metrics.slice(0,5).map(metric=>({metric:metric.metric,mean:metric.mean,mean_stddev:metric.mean_stddev,stddev:metric.stddev})):null}:null};
}

function parseResult(raw,{player,item,slots}){
  const baseRow=raw?.sim?.players?.[0]?.collected_data?.dps||raw?.sim?.players?.[0]?.collected_data?.damage_per_second||null,baseline=metricMean(baseRow),baseError=metricError(baseRow),container=raw?.profilesets||raw?.sim?.profilesets||null,results=Array.isArray(container?.results)?container.results:[];
  const candidates=results.map((row,index)=>({name:row?.name||row?.profileset||`loot_${index+1}`,slot:slots[index]||null,dps:metricMean(row),error:metricError(row)})).filter(row=>row.dps!=null),best=candidates.slice().sort((a,b)=>b.dps-a.dps)[0]||null;
  if(baseline==null||!best){const error=new Error(`SimulationCraft JSON did not expose baseline/profileset DPS for ${player.name}`);error.code=baseline==null?'SIMC_BASELINE_MISSING':'SIMC_PROFILESET_EMPTY';error.diagnostics=jsonDiagnostics(raw);throw error;}
  const delta=best.dps-baseline,gainPct=baseline>0?100*delta/baseline:null,noise=Math.max(Number(baseError)||0,Number(best.error)||0),signal=Math.abs(delta),confidence=noise<=0?'unknown':signal>=2*noise?'high':signal>=noise?'medium':'low',identity=rawIdentity(raw,player);
  return{playerName:player.name,itemId:item.id,baselineDps:baseline,candidateDps:best.dps,deltaDps:delta,gainPct,bestSlot:best.slot,baselineError:baseError,candidateError:best.error,confidence,statisticalSignal:noise>0?signal/noise:null,candidates,status:'simulated',importedRole:identity.role,importedSpecialization:identity.specialization};
}

function spawnProcessOnce(command,args,{cwd,timeoutMs=180000,mode='direct'}={}){
  return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd,windowsHide:true,env:{...process.env},shell:mode==='windows-shell-fallback'});let stdout='',stderr='',settled=false;const timer=setTimeout(()=>{if(settled)return;settled=true;child.kill();const error=new Error(`SimulationCraft timed out after ${timeoutMs} ms`);error.code='ETIMEDOUT';reject(error);},timeoutMs);child.stdout?.on('data',d=>stdout+=d);child.stderr?.on('data',d=>stderr+=d);child.on('error',error=>{if(settled)return;settled=true;clearTimeout(timer);error.launchMode=mode;reject(error)});child.on('close',code=>{if(settled)return;settled=true;clearTimeout(timer);if(code!==0){const error=new Error(`SimulationCraft exited ${code} via ${mode}: ${stderr.slice(-3000)||stdout.slice(-3000)}`);error.exitCode=code;error.launchMode=mode;return reject(error);}resolve({stdout,stderr,code,launchMode:mode});});});
}
async function runNative(command,args,{cwd,timeoutMs=180000}={}){try{return await spawnProcessOnce(command,args,{cwd,timeoutMs,mode:'direct'});}catch(error){if(!shouldRetryWindowsShellLaunchV1(error))throw error;return spawnProcessOnce(command,args,{cwd,timeoutMs,mode:'windows-shell-fallback'});}}
async function runWorker(worker,{dir,input,timeoutMs}){
  if(worker.kind==='docker'){const mount=`${dir}:/work`,inside=`/work/${basename(input)}`;return spawnProcessOnce(worker.path,['run','--rm','-v',mount,'-w','/work','--entrypoint','/app/SimulationCraft/simc',worker.imageTag,inside],{cwd:dir,timeoutMs,mode:'docker'});}
  return runNative(worker.path,[input],{cwd:dir,timeoutMs});
}
async function writeArmoryCredentials(dir){const id=clean(process.env.BLIZZARD_CLIENT_ID),secret=clean(process.env.BLIZZARD_CLIENT_SECRET);if(!id||!secret)return{written:false,reason:'BLIZZARD_CLIENT_ID/SECRET unavailable; SimC compiled credential may still be used'};await writeFile(join(dir,'apikey.txt'),`${id}:${secret}\n`,'utf8');return{written:true,source:'Raid Ops Blizzard client credentials',persisted:false};}

function provenance(worker){return{source:worker.source,managed:worker.managed,docker:worker.kind==='docker'?{imageTag:worker.imageTag,imageId:worker.imageId,...worker.docker}:null};}

async function materializeArmoryProfile({worker,player,dir,timeoutMs}){
  const source=armoryProfile(player),input=join(dir,'armory-import.simc'),output=join(dir,'armory-import.json'),saved=join(dir,'base.simc');
  const text=['report_details=0','iterations=1','max_time=1','json2=armory-import.json',...source.lines,'save=base.simc'].join('\n')+'\n';
  await writeFile(input,text,'utf8');
  const execution=await runWorker(worker,{dir,input,timeoutMs});
  if(!await exists(saved)){const error=new Error(`SimulationCraft imported ${player.name} but did not materialize base.simc`);error.code='SIMC_ARMORY_SAVE_MISSING';throw error;}
  const savedText=await readFile(saved,'utf8'),savedIdentity=savedProfileIdentity(savedText);let raw=null;try{raw=JSON.parse(await readFile(output,'utf8'));}catch{}
  const imported=rawIdentity(raw||{},player),identity={specialization:imported.specialization||savedIdentity.specialization,role:imported.role||savedIdentity.role};
  return{profile:{lines:['base.simc'],source:'battle-net-armory-materialized',profileCompleteness:{...source.profileCompleteness,materializedProfile:true},importedSpecialization:identity.specialization,importedRole:identity.role},identity,execution};
}

export async function simulateLootForPlayerV1({player,item,itemLevel=null,iterations=1000,scenario='raid_st',timeoutMs=180000}={}){
  if(!player?.name)throw new Error('player is required');if(!item?.id)throw new Error('item is required');
  const declaredRole=String(player.role||'UNKNOWN').toUpperCase();
  if(declaredRole==='HEAL'||declaredRole==='HEALER')return{playerName:player.name,itemId:item.id,status:'role-model-pending',gainPct:null,reason:'Healing raid value is not modeled safely by Loot v0.1'};
  if(declaredRole==='TANK')return{playerName:player.name,itemId:item.id,status:'role-model-pending',gainPct:null,reason:'Tank survival raid value is not modeled safely by Loot v0.1'};
  const slots=simcSlotsForItemV1(item);if(!slots.length)return{playerName:player.name,itemId:item.id,status:'unsupported-slot',gainPct:null,reason:'No SimulationCraft slot mapping'};
  const worker=await resolveSimcExecutableV1();if(!worker.available)return{version:LOOT_SIMC_RUNNER_VERSION,engine:'simulationcraft-official-cli',playerName:player.name,itemId:item.id,status:'simc-worker-offline',gainPct:null,reason:worker.reason,worker};
  const dir=await mkdtemp(join(tmpdir(),'avoid-loot-simc-')),input=join(dir,'loot.simc'),output=join(dir,'result.json');let profile=null,credentials=null,execution=null,identity={specialization:clean(player.spec)||null,role:clean(player.role).toLowerCase()||null};
  try{
    profile=wclProfile(player);
    if(!profile){credentials=await writeArmoryCredentials(dir);const materialized=await materializeArmoryProfile({worker,player,dir,timeoutMs});profile=materialized.profile;identity=materialized.identity;const pending=rolePolicy(identity,{player,item});if(pending)return{version:LOOT_SIMC_RUNNER_VERSION,engine:'simulationcraft-official-cli',engineProvenance:provenance(worker),processLaunchMode:materialized.execution.launchMode,scenario:'raid_st',iterations:Math.max(250,Math.min(10000,Number(iterations)||1000)),itemLevel:finite(itemLevel),profileSource:profile.source,profileCompleteness:profile.profileCompleteness,armoryCredentials:credentials?{written:credentials.written,source:credentials.source||null,persisted:false}:null,...pending};}
    const text=profileText({profile,item,itemLevel,slots,iterations,scenario,jsonPath:'result.json'});await writeFile(input,text,'utf8');execution=await runWorker(worker,{dir,input,timeoutMs});
    const raw=JSON.parse(await readFile(output,'utf8')),observedIdentity=rawIdentity(raw,player),pending=rolePolicy(observedIdentity,{player,item}),meta={version:LOOT_SIMC_RUNNER_VERSION,engine:'simulationcraft-official-cli',engineProvenance:provenance(worker),processLaunchMode:execution.launchMode,scenario:'raid_st',iterations:Math.max(250,Math.min(10000,Number(iterations)||1000)),itemLevel:finite(itemLevel),profileSource:profile.source,profileCompleteness:profile.profileCompleteness,armoryCredentials:credentials?{written:credentials.written,source:credentials.source||null,persisted:false}:null};
    if(pending)return{...meta,...pending};
    return{...meta,...parseResult(raw,{player,item,slots})};
  }catch(error){
    if(error?.code==='SIMC_PROFILESET_EMPTY')return{version:LOOT_SIMC_RUNNER_VERSION,engine:'simulationcraft-official-cli',engineProvenance:provenance(worker),processLaunchMode:execution?.launchMode||error?.launchMode||null,playerName:player.name,itemId:item.id,itemLevel:finite(itemLevel),status:'simc-profileset-unavailable',gainPct:null,profileSource:profile?.source||null,profileCompleteness:profile?.profileCompleteness||null,importedSpecialization:identity.specialization||null,importedRole:identity.role||null,diagnostics:error.diagnostics||null,reason:`SimulationCraft produced a baseline for ${player.name} but no item profileset result. Treat this item/spec combination as not yet simulatable rather than as 0% gain.`};
    return{version:LOOT_SIMC_RUNNER_VERSION,engine:'simulationcraft-official-cli',engineProvenance:provenance(worker),processLaunchMode:execution?.launchMode||error?.launchMode||null,playerName:player.name,itemId:item.id,itemLevel:finite(itemLevel),status:'sim-failed',gainPct:null,profileSource:profile?.source||null,profileCompleteness:profile?.profileCompleteness||null,importedSpecialization:identity.specialization||null,importedRole:identity.role||null,errorCode:error?.code||null,exitCode:error?.exitCode??null,diagnostics:error?.diagnostics||null,reason:error instanceof Error?error.message:String(error)};
  }finally{await rm(dir,{recursive:true,force:true}).catch(()=>{});}
}

export async function simulateLootRaidV1({players=[],item,itemLevel=null,iterations=1000,scenario='raid_st',concurrency=2}={}){
  const queue=[...(players||[])],results=[],workers=Math.max(1,Math.min(4,Number(concurrency)||2));
  await Promise.all(Array.from({length:workers},async()=>{while(queue.length){const player=queue.shift();if(!player)continue;results.push(await simulateLootForPlayerV1({player,item,itemLevel,iterations,scenario}));}}));
  results.sort((a,b)=>((b.gainPct==null?-Infinity:Number(b.gainPct))-(a.gainPct==null?-Infinity:Number(a.gainPct)))||String(a.playerName).localeCompare(String(b.playerName)));
  const engineProvenance=results.find(r=>r.engineProvenance)?.engineProvenance||null;
  return{version:LOOT_SIMC_RUNNER_VERSION,engine:'simulationcraft-official-cli',engineProvenance,scenario,metric:'raid-single-target-dps-gain',itemLevel:finite(itemLevel),results};
}
