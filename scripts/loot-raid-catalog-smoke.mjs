import { ensureRaidLootCatalogV1,searchRaidLootCatalogV1 } from '../server/loot/raid-item-catalog-v1.mjs';

const args=process.argv.slice(2),arg=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;},refresh=args.includes('--refresh'),query=arg('--query')||arg('--item')||null;
console.log('\nCURRENT RAID LOOT CATALOG');
const ensured=await ensureRaidLootCatalogV1({refresh});
const c=ensured.catalog;
console.log(JSON.stringify({raid:{zoneId:c.zoneId,name:c.raidName},version:c.version,generatedAt:c.generatedAt,locales:c.locales,itemCount:c.items?.length||0,bosses:(c.bosses||[]).map(b=>({order:b.order,name:b.name,journalEncounterId:b.journalEncounterId,items:(c.items||[]).filter(i=>(i.bosses||[]).some(x=>Number(x.journalEncounterId)===Number(b.journalEncounterId))).length})),coverage:c.coverage,networkExecuted:ensured.networkExecuted,usage:ensured.usage,evidenceContract:c.evidenceContract},null,2));
if(query){const result=await searchRaidLootCatalogV1(query,{limit:30});console.log(`\nSEARCH · ${query}`);console.table((result.items||[]).map(item=>({id:item.id,name:item.name,es:item.names?.es_ES||'—',slot:item.inventoryType?.name||item.inventoryType?.type||'—',type:item.itemSubclass?.name||item.itemClass?.name||'—',bosses:(item.bosses||[]).map(b=>b.name).join(', ')})));if(!result.items?.length)console.log('No current-raid encounter loot matched this query.');}
if(!(c.items||[]).length)throw new Error('Current raid Journal catalog contains zero items; inspect coverage.errors before using Loot.');
console.log('\nOK: current-raid item catalog is persisted. Subsequent searches use the stored Journal index; exact item details are resolved only for matching results.');
