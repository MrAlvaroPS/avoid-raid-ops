import { defineHandler } from 'nitro/h3';
import { resolveRaidCatalogV1 } from '../../../server/knowledge/raid-catalog-v1.mjs';
import { loadLatestRaidCatalogV1,persistRaidCatalogV1 } from '../../../server/knowledge/raid-catalog-store-v1.mjs';
import { ensureRaidOfficialKnowledgeV1 } from '../../../server/knowledge/raid-official-bootstrap-v1.mjs';
import { corpusStorageErrorInfo } from '../../../server/corpus/storage.mjs';

const API_VERSION='raid-catalog-api-v3';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});

async function readCatalog(){return loadLatestRaidCatalogV1().catch(()=>null);}
async function refreshCatalog(){const resolved=await resolveRaidCatalogV1(),catalog=await persistRaidCatalogV1(resolved);return{catalog,usage:resolved.usage||{wclMetadataCalls:1,blizzardGameDataCalls:0,oauthCalls:0}};}

export default defineHandler(async event=>{
  try{
    if(event.req.method!=='GET')return json({ok:false,error:'GET only'},405);
    const url=new URL(event.req.url,'http://localhost'),force=url.searchParams.get('refresh')==='1',includeOfficial=url.searchParams.get('official')!=='0',region=url.searchParams.get('region')||process.env.BLIZZARD_REGION||'eu',locale=url.searchParams.get('locale')||process.env.BLIZZARD_LOCALE||'en_US';
    // Navigation/read paths are persisted-only. Provider network is an operator action:
    // callers must explicitly send refresh=1. This keeps opening or navigating the app
    // from silently spending WCL/Blizzard/Wago requests because a cache happened to age.
    let catalog=await readCatalog(),refreshed=false,catalogUsage={wclMetadataCalls:0,blizzardGameDataCalls:0,oauthCalls:0};
    if(force){const result=await refreshCatalog();catalog=result.catalog;catalogUsage=result.usage;refreshed=true;}
    if(!catalog)return json({ok:false,apiVersion:API_VERSION,error:'No persisted raid catalog is available. Run the explicit raid catalog refresh/bootstrap first.',networkExecuted:false,usage:{wclMetadataCalls:0,wclCombatEventCalls:0,blizzardGameDataCalls:0,oauthCalls:0,wagoCalls:0},wclCombatEventCalls:0},404);
    // Official/provider bootstrap is also a refresh operation. Normal reads obtain the
    // catalog only; boss knowledge endpoints read their already-persisted official and
    // structural products independently.
    const official=includeOfficial&&force?await ensureRaidOfficialKnowledgeV1(catalog,{region,locale,force:true}):null;
    const usage={
      wclMetadataCalls:Number(catalogUsage.wclMetadataCalls||0),wclCombatEventCalls:0,
      blizzardGameDataCalls:Number(catalogUsage.blizzardGameDataCalls||0)+Number(official?.usage?.blizzardGameDataCalls||0),
      oauthCalls:Number(catalogUsage.oauthCalls||0)+Number(official?.usage?.oauthCalls||0),
      wagoCalls:Number(official?.usage?.wagoCalls||0),
    };
    return json({
      ok:true,apiVersion:API_VERSION,networkExecuted:Object.values(usage).some(Number),usage,refreshed,catalog,official,
      readMode:force?'explicit-refresh':'persisted-only',
      evidenceContract:{reportRequired:false,combatLogsRequired:false,wclCombatEventCalls:0,bossAndDifficultyAreKnowledgeScope:true,crossDifficultyComparisonForbidden:true,normalHeroicCannotCountAsMythicEvidence:true,officialKnowledgeAvailableDuringCombatLogEmbargo:true,normalReadProviderNetwork:false,providerRefreshExplicit:true,automaticPromotion:false},
    });
  }catch(error){const storage=corpusStorageErrorInfo(error);return json({ok:false,apiVersion:API_VERSION,error:error instanceof Error?error.message:String(error),...(storage?{storage}:{}),wclCombatEventCalls:0},Number(error?.httpStatus)||500);}
});
