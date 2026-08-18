export const BLIZZARD_GAME_DATA_PROVIDER_VERSION='blizzard-game-data-client-v1';
export const BLIZZARD_OAUTH_URL='https://oauth.battle.net/token';

let tokenCache=null;

const cleanRegion=value=>String(value||process.env.BLIZZARD_REGION||'eu').trim().toLowerCase()||'eu';
const cleanLocale=value=>String(value||process.env.BLIZZARD_LOCALE||'en_US').trim()||'en_US';
const positiveInt=(value,label)=>{const n=Number(value);if(!Number.isInteger(n)||n<=0)throw new Error(`${label} must be a positive integer`);return n;};
const localized=(value,locale='en_US')=>{
  if(value==null)return null;
  if(typeof value==='string')return value;
  if(typeof value==='object')return value[locale]??value.en_US??value.en_GB??Object.values(value).find(v=>typeof v==='string')??null;
  return String(value);
};

export function blizzardGameDataConfigured(env=process.env){
  return Boolean(String(env?.BLIZZARD_CLIENT_ID||'').trim()&&String(env?.BLIZZARD_CLIENT_SECRET||'').trim());
}

export function classifyBlizzardFailure(status){
  const code=Number(status)||null;
  if(code===401)return {status:'authentication-failed',negativeEvidence:false,retryable:true};
  if(code===403)return {status:'provider-forbidden-or-unavailable',negativeEvidence:false,retryable:true};
  if(code===404)return {status:'not-published-by-endpoint',negativeEvidence:false,retryable:false};
  if(code&&code>=500)return {status:'provider-unavailable',negativeEvidence:false,retryable:true};
  return {status:'request-failed',negativeEvidence:false,retryable:false};
}

function providerError(message,{status=null,body=null,url=null}={}){
  const error=new Error(message);
  error.name='BlizzardGameDataError';
  error.status=status;
  error.body=body;
  error.url=url;
  error.provider='blizzard-game-data';
  error.classification=classifyBlizzardFailure(status);
  return error;
}

async function responsePayload(response,url){
  const text=await response.text();
  let payload=null;
  if(text){try{payload=JSON.parse(text);}catch{payload=text;}}
  if(!response.ok){
    const detail=typeof payload==='object'&&payload?payload.detail||payload.title||payload.code:null;
    throw providerError(`Blizzard Game Data HTTP ${response.status}${detail?`: ${detail}`:''}`,{status:response.status,body:payload,url});
  }
  return payload;
}

export function resetBlizzardTokenCacheV1(){tokenCache=null;}

export async function getBlizzardAccessTokenV1({
  fetcher=fetch,
  clientId=process.env.BLIZZARD_CLIENT_ID,
  clientSecret=process.env.BLIZZARD_CLIENT_SECRET,
  now=()=>Date.now(),
  forceRefresh=false,
}={}){
  const id=String(clientId||'').trim(),secret=String(clientSecret||'').trim();
  if(!id||!secret)throw new Error('BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET are required');
  const nowMs=Number(now());
  if(!forceRefresh&&tokenCache?.accessToken&&tokenCache.expiresAtMs-nowMs>60_000){
    return {provider:'blizzard-game-data',accessToken:tokenCache.accessToken,expiresAtMs:tokenCache.expiresAtMs,cacheHit:true,oauthCalls:0};
  }
  const basic=Buffer.from(`${id}:${secret}`,'utf8').toString('base64');
  let response;
  try{
    response=await fetcher(BLIZZARD_OAUTH_URL,{method:'POST',headers:{authorization:`Basic ${basic}`,'content-type':'application/x-www-form-urlencoded',accept:'application/json'},body:'grant_type=client_credentials'});
  }catch(error){throw providerError(`Blizzard OAuth network error: ${error instanceof Error?error.message:String(error)}`,{url:BLIZZARD_OAUTH_URL});}
  const payload=await responsePayload(response,BLIZZARD_OAUTH_URL);
  const accessToken=String(payload?.access_token||'').trim();
  if(!accessToken)throw providerError('Blizzard OAuth response did not include access_token',{status:response.status,body:payload,url:BLIZZARD_OAUTH_URL});
  const expiresIn=Math.max(60,Number(payload?.expires_in)||86400);
  tokenCache={accessToken,expiresAtMs:nowMs+expiresIn*1000};
  return {provider:'blizzard-game-data',accessToken,expiresAtMs:tokenCache.expiresAtMs,cacheHit:false,oauthCalls:1};
}

async function getJson(url,{fetcher=fetch,accessToken,timeoutMs=10000}={}){
  if(!accessToken)throw new Error('Blizzard access token is required');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Math.max(1000,Number(timeoutMs)||10000));
  let response;
  try{
    response=await fetcher(url,{method:'GET',headers:{authorization:`Bearer ${accessToken}`,accept:'application/json'},signal:controller.signal});
  }catch(error){
    if(controller.signal.aborted)throw providerError(`Blizzard Game Data timeout for ${url}`,{url});
    throw providerError(`Blizzard Game Data network error for ${url}: ${error instanceof Error?error.message:String(error)}`,{url});
  }finally{clearTimeout(timer);}
  return responsePayload(response,url);
}

export async function searchBlizzardJournalEncounterV1(encounterName,{fetcher=fetch,accessToken,region,locale,pageSize=50}={}){
  const name=String(encounterName||'').trim();
  if(!name)throw new Error('encounterName is required');
  const r=cleanRegion(region),l=cleanLocale(locale);
  const url=new URL(`https://${r}.api.blizzard.com/data/wow/search/journal-encounter`);
  url.searchParams.set('namespace',`static-${r}`);
  url.searchParams.set('locale',l);
  url.searchParams.set(`name.${l}`,name);
  url.searchParams.set('_pageSize',String(Math.max(1,Math.min(100,Number(pageSize)||50))));
  const payload=await getJson(url.toString(),{fetcher,accessToken});
  const candidates=(payload?.results||[]).map(row=>({
    id:Number(row?.data?.id)||null,
    name:localized(row?.data?.name,l),
    instanceId:Number(row?.data?.instance?.id)||null,
    instanceName:localized(row?.data?.instance?.name,l),
    href:String(row?.key?.href||'').trim()||null,
    raw:row?.data||null,
  })).filter(row=>row.id);
  const exact=candidates.find(row=>String(row.name||'').toLowerCase()===name.toLowerCase())||null;
  return {provider:'blizzard-game-data',endpoint:url.toString(),region:r,locale:l,candidates,match:exact||(candidates.length===1?candidates[0]:null)};
}

export async function fetchBlizzardJournalEncounterV1(journalEncounterId,{fetcher=fetch,accessToken,region,locale,href=null}={}){
  const id=positiveInt(journalEncounterId,'journalEncounterId');
  const r=cleanRegion(region),l=cleanLocale(locale);
  const requestedUrl=href?new URL(String(href)):new URL(`https://${r}.api.blizzard.com/data/wow/journal-encounter/${id}`);
  if(!href)requestedUrl.searchParams.set('namespace',`static-${r}`);
  if(!requestedUrl.searchParams.has('locale'))requestedUrl.searchParams.set('locale',l);
  const journal=await getJson(requestedUrl.toString(),{fetcher,accessToken});
  const selfHref=String(journal?._links?.self?.href||'').trim()||null;
  let endpoint=requestedUrl.toString();
  let namespace=requestedUrl.searchParams.get('namespace')||null;
  if(selfHref){
    try{
      const selfUrl=new URL(selfHref);
      endpoint=selfUrl.toString();
      namespace=selfUrl.searchParams.get('namespace')||namespace;
    }catch{}
  }
  return {provider:'blizzard-game-data',endpoint,requestedEndpoint:requestedUrl.toString(),region:r,locale:l,namespace,journal};
}

export async function fetchBlizzardSpellV1(spellId,{fetcher=fetch,accessToken,region,locale,namespace=null}={}){
  const id=positiveInt(spellId,'spellId'),r=cleanRegion(region),l=cleanLocale(locale);
  const url=new URL(`https://${r}.api.blizzard.com/data/wow/spell/${id}`);
  url.searchParams.set('namespace',namespace||`static-${r}`);
  url.searchParams.set('locale',l);
  try{
    const spell=await getJson(url.toString(),{fetcher,accessToken});
    return {provider:'blizzard-game-data',endpoint:url.toString(),status:'resolved',negativeEvidence:false,spell};
  }catch(error){
    if(error?.name!=='BlizzardGameDataError')throw error;
    return {provider:'blizzard-game-data',endpoint:url.toString(),status:error.classification?.status||'request-failed',negativeEvidence:false,httpStatus:error.status||null,error:error.message,spell:null};
  }
}

export const blizzardLocalizationV1=Object.freeze({localized,cleanRegion,cleanLocale});
