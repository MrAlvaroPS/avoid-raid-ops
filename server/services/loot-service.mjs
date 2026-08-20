import { jsonResponse } from '../api/http.mjs';
import { fetchLootItemV1, searchLootItemsV1 } from '../loot/item-provider-v1.mjs';
import { searchRaidLootCatalogV1,ensureRaidLootCatalogV1 } from '../loot/raid-item-catalog-v1.mjs';
import { evaluateLootEligibilityV1 } from '../loot/eligibility-v1.mjs';
import { loadLootLedgerV1, lootCountsV1, awardLootV1, removeLootAwardV1 } from '../loot/ledger-v1.mjs';
import { simcWorkerStatusV1, simulateLootRaidV1 } from '../loot/simc-runner-v1.mjs';
import { classifyLootSimulationV1 } from '../loot/simc-result-policy-v1.mjs';

const bodyJson=async req=>{try{return await req.json()}catch{return{}}};
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
function safeCharacter(row={}){
  const source=row?.character||{},gear=(Array.isArray(source.gear)?source.gear:[]).slice(0,20).map(item=>({id:finite(item?.id),name:String(item?.name||'').trim()||null,icon:String(item?.icon||'').trim()||null,slot:String(item?.slot||'').trim()||null,slotId:finite(item?.slotId),itemLevel:finite(item?.itemLevel),gems:(Array.isArray(item?.gems)?item.gems:[]).slice(0,4).map(Number).filter(Number.isFinite),enchants:(Array.isArray(item?.enchants)?item.enchants:[]).slice(0,3).map(Number).filter(Number.isFinite),wowhead:item?.wowhead||null,wowheadUrl:String(item?.wowheadUrl||item?.wowhead?.url||'').trim()||null})).filter(item=>item.id&&item.slot);
  const talentImportCode=String(source?.talentImportCode||'').trim();return{gear,talentImportCode:talentImportCode.slice(0,2000),gearCount:gear.length,profileSource:String(source?.combatantInfoSource||'').trim()||null};
}
const safePlayers=rows=>(Array.isArray(rows)?rows:[]).slice(0,100).map(row=>({name:String(row?.name||'').trim(),server:String(row?.server||row?.realm||'').trim()||null,region:String(row?.region||process.env.BLIZZARD_REGION||'eu').trim(),className:String(row?.className||row?.class||'').trim()||null,spec:String(row?.spec||'').trim()||null,role:String(row?.role||'UNKNOWN').trim().toUpperCase(),actorId:finite(row?.actorId),itemLevel:finite(row?.itemLevel),character:safeCharacter(row)})).filter(row=>row.name);
const completeItem=item=>Boolean(item?.id&&item?.itemClass?.name&&item?.itemSubclass?.name&&item?.inventoryType?.type);
async function resolveItem(body={}){const candidate=body?.item?.id?body.item:null;if(completeItem(candidate))return candidate;const id=Number(candidate?.id||body?.itemId);if(!Number.isInteger(id)||id<=0)throw new Error('A complete item or itemId is required');return(await fetchLootItemV1(id)).item;}

export default async req=>{
  try{
    const url=new URL(req.url);
    if(req.method==='GET'){
      if(url.searchParams.get('state')==='1'){const ledger=await loadLootLedgerV1(),worker=await simcWorkerStatusV1();return jsonResponse(200,{ok:true,version:'loot-api-v1.3',worker,ledger,lootCounts:lootCountsV1(ledger),networkExecuted:false},'private, no-store');}
      if(url.searchParams.get('raidCatalog')==='1'){const result=await ensureRaidLootCatalogV1({refresh:url.searchParams.get('refresh')==='1'});return jsonResponse(200,{ok:true,version:'loot-api-v1.3',...result},'private, no-store');}
      const itemId=Number(url.searchParams.get('item'));if(Number.isInteger(itemId)&&itemId>0){const result=await fetchLootItemV1(itemId);return jsonResponse(200,{ok:true,version:'loot-api-v1.3',...result},'private, no-store');}
      const q=String(url.searchParams.get('q')||'').trim();if(q){const result=url.searchParams.get('global')==='1'?await searchLootItemsV1(q,{limit:Number(url.searchParams.get('limit'))||12}):await searchRaidLootCatalogV1(q,{limit:Number(url.searchParams.get('limit'))||30,refresh:url.searchParams.get('refresh')==='1'});return jsonResponse(200,{ok:true,version:'loot-api-v1.3',...result},'private, no-store');}
      return jsonResponse(400,{ok:false,error:'Use ?q=<current-raid-name-or-id>, ?global=1&q=<global-name>, ?item=<id>, ?raidCatalog=1 or ?state=1'},'no-store');
    }
    if(req.method==='POST'){
      const body=await bodyJson(req),action=String(body?.action||'').trim();
      if(action==='simulate'){
        const item=await resolveItem(body),players=safePlayers(body?.players),eligibility=players.map(player=>({player,eligibility:evaluateLootEligibilityV1(item,player)})),eligible=eligibility.filter(row=>row.eligibility.simEligible===true).map(row=>row.player);
        if(!eligible.length)return jsonResponse(200,{ok:true,version:'loot-api-v1.3',item,eligibility,simulation:{results:[],status:'no-spec-compatible-raiders'},evidenceContract:{simGainOnly:true,automaticAward:false,raidOnly:true,physicalEligibilitySeparateFromSpecFit:true}},'private, no-store');
        const rawSimulation=await simulateLootRaidV1({players:eligible,item,itemLevel:body?.itemLevel,iterations:body?.iterations||1000,scenario:'raid_st',concurrency:body?.concurrency||2}),simulation=classifyLootSimulationV1(rawSimulation);
        return jsonResponse(200,{ok:true,version:'loot-api-v1.3',item,eligibility,simulation,evidenceContract:{simGainOnly:true,automaticAward:false,raidOnly:true,physicalEligibilitySeparateFromSpecFit:true,simRequiresNoKnownSpecContradiction:true,healerAndTankRaidValueNotFabricated:true,observedCombatantInfoPreferred:true,armoryFallbackAllowed:true,unsupportedSimcSpecsRemainEligible:true}},'private, no-store');
      }
      if(action==='eligibility'){
        const item=await resolveItem(body),players=safePlayers(body?.players);return jsonResponse(200,{ok:true,version:'loot-api-v1.3',item,rows:players.map(player=>({player,eligibility:evaluateLootEligibilityV1(item,player)}))},'private, no-store');
      }
      if(action==='award'){const result=await awardLootV1(body);return jsonResponse(200,{ok:true,version:'loot-api-v1.3',...result},'private, no-store');}
      if(action==='remove-award'){const result=await removeLootAwardV1(body?.id);return jsonResponse(200,{ok:true,version:'loot-api-v1.3',...result},'private, no-store');}
      return jsonResponse(400,{ok:false,error:'action must be simulate, eligibility, award or remove-award'},'no-store');
    }
    return jsonResponse(405,{ok:false,error:'Method not allowed'},'no-store');
  }catch(error){return jsonResponse(500,{ok:false,version:'loot-api-v1.3',error:error instanceof Error?error.message:String(error)},'no-store');}
};
