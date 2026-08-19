import { jsonResponse } from '../api/http.mjs';
import { fetchLootItemV1, searchLootItemsV1 } from '../loot/item-provider-v1.mjs';
import { evaluateLootEligibilityV1 } from '../loot/eligibility-v1.mjs';
import { loadLootLedgerV1, lootCountsV1, awardLootV1, removeLootAwardV1 } from '../loot/ledger-v1.mjs';
import { simcWorkerStatusV1, simulateLootRaidV1 } from '../loot/simc-runner-v1.mjs';

const bodyJson=async req=>{try{return await req.json()}catch{return{}}};
const safePlayers=rows=>(Array.isArray(rows)?rows:[]).slice(0,40).map(row=>({name:String(row?.name||'').trim(),server:String(row?.server||row?.realm||'').trim()||null,region:String(row?.region||process.env.BLIZZARD_REGION||'eu').trim(),className:String(row?.className||row?.class||'').trim()||null,spec:String(row?.spec||'').trim()||null,role:String(row?.role||'DPS').trim().toUpperCase(),actorId:Number.isFinite(Number(row?.actorId))?Number(row.actorId):null,itemLevel:Number.isFinite(Number(row?.itemLevel))?Number(row.itemLevel):null})).filter(row=>row.name);

export default async req=>{
  try{
    const url=new URL(req.url);
    if(req.method==='GET'){
      if(url.searchParams.get('state')==='1'){const ledger=await loadLootLedgerV1(),worker=await simcWorkerStatusV1();return jsonResponse(200,{ok:true,version:'loot-api-v1',worker,ledger,lootCounts:lootCountsV1(ledger),networkExecuted:false},'private, no-store');}
      const itemId=Number(url.searchParams.get('item'));if(Number.isInteger(itemId)&&itemId>0){const result=await fetchLootItemV1(itemId);return jsonResponse(200,{ok:true,version:'loot-api-v1',...result},'private, no-store');}
      const q=String(url.searchParams.get('q')||'').trim();if(q){const result=await searchLootItemsV1(q,{limit:Number(url.searchParams.get('limit'))||12});return jsonResponse(200,{ok:true,version:'loot-api-v1',...result},'private, no-store');}
      return jsonResponse(400,{ok:false,error:'Use ?q=<name>, ?item=<id> or ?state=1'},'no-store');
    }
    if(req.method==='POST'){
      const body=await bodyJson(req),action=String(body?.action||'').trim();
      if(action==='simulate'){
        const item=body?.item?.id?body.item:(await fetchLootItemV1(body?.itemId)).item,players=safePlayers(body?.players),eligibility=players.map(player=>({player,eligibility:evaluateLootEligibilityV1(item,player)})),eligible=eligibility.filter(row=>row.eligibility.eligible).map(row=>row.player);
        if(!eligible.length)return jsonResponse(200,{ok:true,version:'loot-api-v1',item,eligibility,simulation:{results:[],status:'no-eligible-raiders'},evidenceContract:{simGainOnly:true,automaticAward:false,raidOnly:true}},'private, no-store');
        const simulation=await simulateLootRaidV1({players:eligible,item,itemLevel:body?.itemLevel,iterations:body?.iterations||1000,scenario:'raid_st',concurrency:body?.concurrency||2});
        return jsonResponse(200,{ok:true,version:'loot-api-v1',item,eligibility,simulation,evidenceContract:{simGainOnly:true,automaticAward:false,raidOnly:true,healerAndTankRaidValueNotFabricated:true}},'private, no-store');
      }
      if(action==='eligibility'){
        const item=body?.item?.id?body.item:(await fetchLootItemV1(body?.itemId)).item,players=safePlayers(body?.players);return jsonResponse(200,{ok:true,version:'loot-api-v1',item,rows:players.map(player=>({player,eligibility:evaluateLootEligibilityV1(item,player)}))},'private, no-store');
      }
      if(action==='award'){const result=await awardLootV1(body);return jsonResponse(200,{ok:true,version:'loot-api-v1',...result},'private, no-store');}
      if(action==='remove-award'){const result=await removeLootAwardV1(body?.id);return jsonResponse(200,{ok:true,version:'loot-api-v1',...result},'private, no-store');}
      return jsonResponse(400,{ok:false,error:'action must be simulate, eligibility, award or remove-award'},'no-store');
    }
    return jsonResponse(405,{ok:false,error:'Method not allowed'},'no-store');
  }catch(error){return jsonResponse(500,{ok:false,version:'loot-api-v1',error:error instanceof Error?error.message:String(error)},'no-store');}
};
