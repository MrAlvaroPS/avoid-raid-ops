import { access } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { simcWorkerStatusV1, simulateLootForPlayerV1 } from '../server/loot/simc-runner-v1.mjs';
import { fetchLootItemV1 } from '../server/loot/item-provider-v1.mjs';

const args=process.argv.slice(2);const arg=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;};
const player=arg('--player'),realm=arg('--realm'),itemId=Number(arg('--item')),itemLevel=Number(arg('--ilevel'))||null,iterations=Number(arg('--iterations'))||500;
const status=await simcWorkerStatusV1();
console.log('\n[1/2] Official SimulationCraft worker');
console.log(JSON.stringify(status,null,2));
if(!process.env.SIMC_PATH){console.error('\nSIMC_PATH is not configured. For tonight, point it at the official SimulationCraft executable, e.g. SIMC_PATH=C:\\SimulationCraft\\simc.exe in .env.local.');process.exitCode=2;}
else if(isAbsolute(process.env.SIMC_PATH)){try{await access(process.env.SIMC_PATH);}catch{console.error(`\nSIMC_PATH does not exist: ${process.env.SIMC_PATH}`);process.exit(2);}}

if(!player&&!realm&&!itemId){console.log('\n[2/2] Real character/item simulation');console.log('SKIPPED · worker path validation only. Add --player NAME --realm REALM --item ID [--ilevel N] to run a real raid-only test.');if(!process.exitCode)console.log('\nOK: Loot SimulationCraft v0.1 local worker path is configured.');}
else{
  if(!player||!realm||!Number.isInteger(itemId)||itemId<=0){console.error('\nTo run a real simulation provide --player NAME --realm REALM --item ID together.');process.exit(2);}
  console.log('\n[2/2] Real raid-only character/item simulation');
  const fetched=await fetchLootItemV1(itemId),result=await simulateLootForPlayerV1({player:{name:player,server:realm,region:process.env.BLIZZARD_REGION||'eu',role:'DPS'},item:fetched.item,itemLevel,iterations,scenario:'raid_st'});
  console.log(JSON.stringify({item:{id:fetched.item.id,name:fetched.item.name},result},null,2));
  if(result.status!=='simulated')throw new Error(`Simulation did not complete: ${result.reason||result.status}`);
  console.log('\nOK: official SimulationCraft completed a real raid-only loot comparison.');
}
