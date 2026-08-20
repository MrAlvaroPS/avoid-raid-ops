import { readHomeRosterV1 } from '../server/engines/home-roster-engine.mjs';
import { fetchLootItemV1 } from '../server/loot/item-provider-v1.mjs';
import { evaluateLootEligibilityV1 } from '../server/loot/eligibility-v1.mjs';
import { simcWorkerStatusV1,simulateLootForPlayerV1 } from '../server/loot/simc-runner-v1.mjs';
import { classifyLootSimResultV1 } from '../server/loot/simc-result-policy-v1.mjs';

const args=process.argv.slice(2),arg=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;};
const itemId=Number(arg('--item')),itemLevel=Number(arg('--ilevel'))||null,simulateCount=Math.max(0,Math.min(10,Number(arg('--simulate'))||0)),iterations=Math.max(250,Number(arg('--iterations'))||500),targetPlayer=String(arg('--player')||'').trim();
if(!Number.isInteger(itemId)||itemId<=0)throw new Error('Use --item ITEM_ID [--ilevel N] [--simulate N] [--player NAME]');
const home=await readHomeRosterV1({}),directory=home.roster?.members||[],members=directory.filter(row=>row?.raidActivity?.confirmedFromHomeLogs||row?.observed);if(!directory.length)throw new Error('HOME directory is empty. Run npm run sync:home-roster once if you need the temporary guild directory.');if(!members.length)throw new Error('HOME raid roster is empty. Refresh HOME history from the header (or npm run validate:home-history -- --refresh) so actual raid participants are derived from synced logs.');
const fetched=await fetchLootItemV1(itemId),item=fetched.item,players=members.map(row=>({name:row.name,server:row.server?.slug||row.server?.name,region:row.server?.region?.compactName||row.server?.region?.slug||'eu',className:row.className,spec:row.spec,role:row.role||'UNKNOWN',itemLevel:row.itemLevel,character:row.character||{}})),rows=players.map(player=>({player,eligibility:evaluateLootEligibilityV1(item,player)})),eligible=rows.filter(row=>row.eligibility.eligible),ineligible=rows.filter(row=>!row.eligibility.eligible);
const reasonCounts=Object.fromEntries([...ineligible.reduce((map,row)=>map.set(row.eligibility.status,(map.get(row.eligibility.status)||0)+1),new Map())].sort((a,b)=>b[1]-a[1]));
const itemSource=fetched.cache?.hit?(fetched.cache?.staleFallback?'cached-stale':'cached-verified'):'blizzard-live',worker=await simcWorkerStatusV1();
console.log('\nLOOT RAID ROSTER SMOKE');
console.log(JSON.stringify({item:{id:item.id,name:item.name,itemClass:item.itemClass?.name,itemSubclass:item.itemSubclass?.name,inventoryType:item.inventoryType?.type},itemProvider:{provider:fetched.provider,source:itemSource,cache:fetched.cache||null,providerStatus:fetched.providerStatus||null,usage:fetched.usage||null},roster:{directoryTotal:directory.length,raidParticipants:players.length,source:'HOME synced raid logs + observed CombatantInfo',networkForRoster:false},eligible:eligible.length,ineligible:ineligible.length,ineligibleReasons:reasonCounts,simRequested:simulateCount,targetPlayer:targetPlayer||null,simcWorker:{available:worker.available,source:worker.source,path:worker.path,reason:worker.reason||null,nightlyCommit:worker.docker?.nightlyCommit||worker.nightly?.commit||null}},null,2));
console.table(eligible.slice(0,30).map(row=>({name:row.player.name,class:row.player.className,spec:row.player.spec||'PENDING',role:row.player.role,reason:row.eligibility.reason})));
if(!eligible.length){console.log('\nNo eligible raiders. First exclusion samples:');console.table(ineligible.slice(0,12).map(row=>({name:row.player.name,class:row.player.className,status:row.eligibility.status,reason:row.eligibility.reason})));}
if(simulateCount||targetPlayer){
  let selected=targetPlayer?eligible.filter(row=>row.player.name.localeCompare(targetPlayer,undefined,{sensitivity:'base'})===0):eligible.slice(0,simulateCount);
  if(targetPlayer&&!selected.length)throw new Error(`${targetPlayer} is not an eligible current-raid participant for item ${item.id}.`);
  if(!targetPlayer)selected=selected.slice(0,simulateCount);
  console.log(`\nSimulating ${selected.length} eligible RAID member${selected.length===1?'':'s'} with official SimulationCraft...`);
  const results=[];for(const row of selected){const raw=await simulateLootForPlayerV1({player:row.player,item,itemLevel,iterations,scenario:'raid_st'});results.push(classifyLootSimResultV1(raw));}
  console.table(results.map(row=>({player:row.playerName,status:row.status,gainPct:row.gainPct!=null&&Number.isFinite(Number(row.gainPct))?Number(row.gainPct).toFixed(2):'—',profile:row.profileSource||'—',spec:row.importedSpecialization||'—',model:row.unsupportedModel||'—',reason:row.status==='simulated'?'OK':String(row.reason||'').slice(0,140)})));
  for(const row of results.filter(r=>r.diagnostics))console.log(`\n${row.playerName} diagnostics:\n${JSON.stringify(row.diagnostics,null,2)}`);
}
console.log('\nOK: Loot input is restricted to actual HOME raid participants. Guild-directory-only characters are excluded; CombatantInfo enriches participating rows when observed.');
