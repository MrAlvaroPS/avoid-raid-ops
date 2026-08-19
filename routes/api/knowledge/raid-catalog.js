import { defineHandler } from 'nitro/h3';
import { resolveRaidCatalogV1 } from '../../../server/knowledge/raid-catalog-v1.mjs';
import { loadLatestRaidCatalogV1,persistRaidCatalogV1 } from '../../../server/knowledge/raid-catalog-store-v1.mjs';
import { ensureRaidOfficialKnowledgeV1 } from '../../../server/knowledge/raid-official-bootstrap-v1.mjs';
import { corpusStorageErrorInfo } from '../../../server/corpus/storage.mjs';

const API_VERSION='raid-catalog-api-v1';
const DEFAULT_MAX_AGE_MS=60*60*1000;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});

async function ensureCatalog({force=false,maxAgeMs=DEFAULT_MAX_AGE_MS}={}){
  const cached=await loadLatestRaidCatalogV1().catch(()=>null);
  const age=cached?.storage?.fetchedAt?Date.now()-Number(cached.storage.fetchedAt):Infinity;
  if(cached&&!force&&age<=maxAgeMs)return{catalog:cached,refreshed:false,wclMetadataCalls:0};
  const resolved=await resolveRaidCatalogV1();
  const catalog=await persistRaidCatalogV1(resolved);
  return{catalog,refreshed:true,wclMetadataCalls:Number(resolved?.usage?.wclMetadataCalls||1)};
}

export default defineHandler(async event=>{
  try{
    if(event.req.method!=='GET')return json({ok:false,error:'GET only'},405);
    const url=new URL(event.req.url,'http://localhost');
    const latestOnly=url.searchParams.get('latest')==='1';
    const force=url.searchParams.get('refresh')==='1';
    const includeOfficial=url.searchParams.get('official')!=='0';
    const region=url.searchParams.get('region')||process.env.BLIZZARD_REGION||'eu';
    const locale=url.searchParams.get('locale')||process.env.BLIZZARD_LOCALE||'en_US';
    let catalog,wclMetadataCalls=0,refreshed=false;
    if(latestOnly){catalog=await loadLatestRaidCatalogV1();}
    else{const ensured=await ensureCatalog({force});catalog=ensured.catalog;wclMetadataCalls=ensured.wclMetadataCalls;refreshed=ensured.refreshed;}
    if(!catalog)return json({ok:false,apiVersion:API_VERSION,error:'No persisted raid catalog is available',networkExecuted:false,wclCombatEventCalls:0},404);
    const official=includeOfficial?await ensureRaidOfficialKnowledgeV1(catalog,{region,locale}):null;
    const blizzardCalls=Number(official?.usage?.blizzardGameDataCalls||0)+Number(official?.usage?.oauthCalls||0);
    return json({
      ok:true,apiVersion:API_VERSION,networkExecuted:wclMetadataCalls+blizzardCalls>0,
      usage:{wclMetadataCalls,wclCombatEventCalls:0,blizzardGameDataCalls:Number(official?.usage?.blizzardGameDataCalls||0),oauthCalls:Number(official?.usage?.oauthCalls||0)},
      refreshed,catalog,official,
      evidenceContract:{reportRequired:false,combatLogsRequired:false,wclCombatEventCalls:0,officialKnowledgeAvailableDuringCombatLogEmbargo:true,automaticPromotion:false},
    });
  }catch(error){
    const storage=corpusStorageErrorInfo(error);
    return json({ok:false,apiVersion:API_VERSION,error:error instanceof Error?error.message:String(error),...(storage?{storage}:{}),wclCombatEventCalls:0},Number(error?.httpStatus)||500);
  }
});
