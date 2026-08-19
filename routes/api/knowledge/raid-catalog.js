import { defineHandler } from 'nitro/h3';
import { resolveRaidCatalogV1 } from '../../../server/knowledge/raid-catalog-v1.mjs';
import { loadLatestRaidCatalogV1,persistRaidCatalogV1 } from '../../../server/knowledge/raid-catalog-store-v1.mjs';
import { ensureRaidOfficialKnowledgeV1 } from '../../../server/knowledge/raid-official-bootstrap-v1.mjs';
import { corpusStorageErrorInfo } from '../../../server/corpus/storage.mjs';

const API_VERSION='raid-catalog-api-v2';
const DEFAULT_MAX_AGE_MS=60*60*1000;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});

async function ensureCatalog({force=false,maxAgeMs=DEFAULT_MAX_AGE_MS}={}){
  const cached=await loadLatestRaidCatalogV1().catch(()=>null),age=cached?.storage?.fetchedAt?Date.now()-Number(cached.storage.fetchedAt):Infinity;
  if(cached&&!force&&age<=maxAgeMs)return{catalog:cached,refreshed:false,usage:{wclMetadataCalls:0,blizzardGameDataCalls:0,oauthCalls:0}};
  const resolved=await resolveRaidCatalogV1(),catalog=await persistRaidCatalogV1(resolved);
  return{catalog,refreshed:true,usage:resolved.usage||{wclMetadataCalls:1,blizzardGameDataCalls:0,oauthCalls:0}};
}

export default defineHandler(async event=>{
  try{
    if(event.req.method!=='GET')return json({ok:false,error:'GET only'},405);
    const url=new URL(event.req.url,'http://localhost'),latestOnly=url.searchParams.get('latest')==='1',force=url.searchParams.get('refresh')==='1',includeOfficial=url.searchParams.get('official')!=='0',region=url.searchParams.get('region')||process.env.BLIZZARD_REGION||'eu',locale=url.searchParams.get('locale')||process.env.BLIZZARD_LOCALE||'en_US';
    let catalog,refreshed=false,catalogUsage={wclMetadataCalls:0,blizzardGameDataCalls:0,oauthCalls:0};
    if(latestOnly)catalog=await loadLatestRaidCatalogV1();
    else{const ensured=await ensureCatalog({force});catalog=ensured.catalog;catalogUsage=ensured.usage;refreshed=ensured.refreshed;}
    if(!catalog)return json({ok:false,apiVersion:API_VERSION,error:'No persisted raid catalog is available',networkExecuted:false,wclCombatEventCalls:0},404);
    const official=includeOfficial?await ensureRaidOfficialKnowledgeV1(catalog,{region,locale,force}):null;
    const usage={
      wclMetadataCalls:Number(catalogUsage.wclMetadataCalls||0),wclCombatEventCalls:0,
      blizzardGameDataCalls:Number(catalogUsage.blizzardGameDataCalls||0)+Number(official?.usage?.blizzardGameDataCalls||0),
      oauthCalls:Number(catalogUsage.oauthCalls||0)+Number(official?.usage?.oauthCalls||0),
      wagoCalls:Number(official?.usage?.wagoCalls||0),
    };
    return json({
      ok:true,apiVersion:API_VERSION,networkExecuted:Object.values(usage).some(Number),usage,refreshed,catalog,official,
      evidenceContract:{reportRequired:false,combatLogsRequired:false,wclCombatEventCalls:0,bossAndDifficultyAreKnowledgeScope:true,crossDifficultyComparisonForbidden:true,normalHeroicCannotCountAsMythicEvidence:true,officialKnowledgeAvailableDuringCombatLogEmbargo:true,automaticPromotion:false},
    });
  }catch(error){const storage=corpusStorageErrorInfo(error);return json({ok:false,apiVersion:API_VERSION,error:error instanceof Error?error.message:String(error),...(storage?{storage}:{}),wclCombatEventCalls:0},Number(error?.httpStatus)||500);}
});
