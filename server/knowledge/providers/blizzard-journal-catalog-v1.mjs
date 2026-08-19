import { getBlizzardAccessTokenV1 } from './blizzard-game-data-v1.mjs';

export const BLIZZARD_JOURNAL_CATALOG_PROVIDER_VERSION='blizzard-journal-catalog-v1';

const cleanRegion=value=>String(value||process.env.BLIZZARD_REGION||'eu').trim().toLowerCase()||'eu';
const cleanLocale=value=>String(value||process.env.BLIZZARD_LOCALE||'en_US').trim()||'en_US';
const localized=(value,locale='en_US')=>typeof value==='string'?value:value&&typeof value==='object'?(value[locale]??value.en_US??value.en_GB??Object.values(value).find(v=>typeof v==='string')??null):value==null?null:String(value);
const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};

async function getJson(url,{accessToken,fetcher=fetch,timeoutMs=10000}={}){
  if(!accessToken)throw new Error('Blizzard access token is required');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Math.max(1000,Number(timeoutMs)||10000));
  try{
    const response=await fetcher(url,{headers:{authorization:`Bearer ${accessToken}`,accept:'application/json'},signal:controller.signal});
    const text=await response.text();
    let payload=null;
    try{payload=text?JSON.parse(text):null;}catch{payload=text;}
    if(!response.ok)throw new Error(`Blizzard Journal HTTP ${response.status} for ${url}`);
    return payload;
  }finally{clearTimeout(timer);}
}

function endpoint(path,{region,locale}={}){
  const r=cleanRegion(region),l=cleanLocale(locale);
  const url=new URL(`https://${r}.api.blizzard.com${path}`);
  url.searchParams.set('namespace',`static-${r}`);
  url.searchParams.set('locale',l);
  return url.toString();
}

export async function fetchBlizzardJournalRaidCatalogV1({region,locale,fetcher=fetch}={}){
  const r=cleanRegion(region),l=cleanLocale(locale);
  const token=await getBlizzardAccessTokenV1({fetcher});
  const indexUrl=endpoint('/data/wow/journal-expansion/index',{region:r,locale:l});
  const index=await getJson(indexUrl,{accessToken:token.accessToken,fetcher});
  const tiers=(index?.tiers||[]).map(row=>({id:positive(row?.id),name:localized(row?.name,l),href:String(row?.key?.href||'').trim()||null})).filter(row=>row.id);
  const latest=tiers.slice().sort((a,b)=>b.id-a.id)[0]||null;
  if(!latest)throw new Error('Blizzard Journal expansion index returned no tiers');
  const expansionUrl=endpoint(`/data/wow/journal-expansion/${latest.id}`,{region:r,locale:l});
  const expansion=await getJson(expansionUrl,{accessToken:token.accessToken,fetcher});
  const raids=(expansion?.raids||[]).map(row=>({journalInstanceId:positive(row?.id),name:localized(row?.name,l),href:String(row?.key?.href||'').trim()||null})).filter(row=>row.journalInstanceId);
  const dungeons=(expansion?.dungeons||[]).map(row=>({journalInstanceId:positive(row?.id),name:localized(row?.name,l),href:String(row?.key?.href||'').trim()||null})).filter(row=>row.journalInstanceId);
  return{
    version:BLIZZARD_JOURNAL_CATALOG_PROVIDER_VERSION,
    provider:'blizzard-game-data',region:r,locale:l,
    expansion:{id:positive(expansion?.id)||latest.id,name:localized(expansion?.name,l)||latest.name,raids,dungeons},
    usage:{oauthCalls:token.oauthCalls,blizzardGameDataCalls:2},
    evidenceContract:{officialRaidClassification:true,combatLogsRequired:false,wclCombatEventCalls:0,automaticPromotion:false},
  };
}

export async function fetchBlizzardJournalInstanceCatalogV1(journalInstanceId,{region,locale,fetcher=fetch,accessToken=null}={}){
  const id=positive(journalInstanceId);if(!id)throw new Error('journalInstanceId is required');
  const r=cleanRegion(region),l=cleanLocale(locale);
  let tokenCalls=0,tokenValue=accessToken;
  if(!tokenValue){const token=await getBlizzardAccessTokenV1({fetcher});tokenValue=token.accessToken;tokenCalls=token.oauthCalls;}
  const url=endpoint(`/data/wow/journal-instance/${id}`,{region:r,locale:l});
  const journal=await getJson(url,{accessToken:tokenValue,fetcher});
  return{
    version:BLIZZARD_JOURNAL_CATALOG_PROVIDER_VERSION,provider:'blizzard-game-data',endpoint:url,region:r,locale:l,
    instance:{
      journalInstanceId:positive(journal?.id)||id,name:localized(journal?.name,l),description:localized(journal?.description,l),
      encounters:(journal?.encounters||[]).map(row=>({journalEncounterId:positive(row?.id),name:localized(row?.name,l),href:String(row?.key?.href||'').trim()||null})).filter(row=>row.journalEncounterId),
      modes:(journal?.modes||[]).map(row=>({type:String(row?.type||'').trim()||null,name:localized(row?.name,l)})).filter(row=>row.type||row.name),
    },
    usage:{oauthCalls:tokenCalls,blizzardGameDataCalls:1},
  };
}
