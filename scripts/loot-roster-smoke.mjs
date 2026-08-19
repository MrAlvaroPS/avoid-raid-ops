import { readHomeRosterV1 } from '../server/engines/home-roster-engine.mjs';
import { fetchLootItemV1 } from '../server/loot/item-provider-v1.mjs';
import { evaluateLootEligibilityV1 } from '../server/loot/eligibility-v1.mjs';
import { simulateLootForPlayerV1 } from '../server/loot/simc-runner-v1.mjs';
import { classifyLootSimResultV1 } from '../server/loot/simc-result-policy-v1.mjs';

const args=process.argv.slice(2),arg=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;};
const itemId=Number(arg('--item')),itemLevel=Number(arg('--ilevel'))||null,simulateCount=Math.max(0,Math.min(10,Number(arg('--simulate'))||0)),iterations=Math.max(250,Number(arg('--iterations'))||500);
if(!Number.isInteger(itemId)||itemId<=0)throw new Error('Use --item ITEM_ID [--ilevel N] [--simulate N]');
const home=await readHomeRosterV1({}),members=home.roster?.members||[];if(!members.length)throw new Error('HOME roster is empty. Run npm run sync:home-roster first.');
const fetched=await fetchLootItemV1(itemId),item=fetched.item,players=members.map(row=>({name:row.name,server:row.server?.slug||row.server?.name,region:row.server?.region?.compactName||row.server?.region?.slug||'eu',className:row.className,spec:row.spec,role:row.role||'UNKNOWN',itemLevel:row.itemLevel,character:row.character||{}})),rows=players.map(player=>({player,eligibility:evaluateLootEligibilityV1(item,player)})),eligible=rows.filter(row=>row.eligibility.eligible),ineligible=rows.filter(row=>!row.eligibility.eligible);
const reasonCounts=Object.fromEntries([...ineligible.reduce((map,row)=>map.set(row.eligibility.status,(map.get(row.eligibility.status)||0)+1),new Map())].sort((a,b)=>b[1]-a[1]));
const itemSource=fetched.cache?.hit?(fetched.cache?.staleFallback?'cached-stale':'cached-verified'):'blizzard-live';
console.log('\nLOOT ROSTER SMOKE');
console.log(JSON.stringify({item:{id:item.id,name:item.name,itemClass:item.itemClass?.name,itemSubclass:item.itemSubclass?.name,inventoryType:item.inventoryType?.type},itemProvider:{provider:fetched.provider,source:itemSource,cache:fetched.cache||null,providerStatus:fetched.providerStatus||null,usage:fetched.usage||null},rosterTotal:players.length,eligible:eligible.length,ineligible:ineligible.length,ineligibleReasons:reasonCounts,networkForRoster:false,simRequested:simulateCount},null,2));
console.table(eligible.slice(0,30).map(row=>({name:row.player.name,class:row.player.className,spec:row.player.spec||'PENDING',role:row.player.role,reason:row.eligibility.reason})));
if(!eligible.length){console.log('\nNo eligible raiders. First exclusion samples:');console.table(ineligible.slice(0,12).map(row=>({name:row.player.name,class:row.player.className,status:row.eligibility.status,reason:row.eligibility.reason})));}
if(simulateCount){
  console.log(`\nSimulating first ${Math.min(simulateCount,eligible.length)} eligible roster members with official SimulationCraft...`);
  const results=[];for(const row of eligible.slice(0,simulateCount)){const raw=await simulateLootForPlayerV1({player:row.player,item,itemLevel,iterations,scenario:'raid_st'});results.push(classifyLootSimResultV1(raw));}
  console.table(results.map(row=>({player:row.playerName,status:row.status,gainPct:Number.isFinite(Number(row.gainPct))?Number(row.gainPct).toFixed(2):'—',profile:row.profileSource||'—',model:row.unsupportedModel||'—',reason:row.status==='simulated'?'OK':String(row.reason||'').slice(0,100)})));
}
console.log('\nOK: persisted HOME roster is usable as temporary Loot input. CombatantInfo will override these rows when observed.');
