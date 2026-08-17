export const PARSE_WOWHEAD_CLIENT_VERSION='parse-wowhead-client-v1';
export const PARSE_WOWHEAD_API_BASE_DEFAULT='https://api.parse.bot/scraper/93b56483-7fc6-48da-bd9f-1310e3bca1c3';

const finiteId=value=>{const id=Number(value);if(!Number.isInteger(id)||id<=0)throw new Error(`Invalid Wowhead id: ${value}`);return id;};
const cleanBase=value=>String(value||PARSE_WOWHEAD_API_BASE_DEFAULT).replace(/\/+$/,'');

function unwrap(payload){
  if(payload&&typeof payload==='object'&&!Array.isArray(payload)){
    if(payload.data&&typeof payload.data==='object'&&!Array.isArray(payload.data))return payload.data;
    if(payload.result&&typeof payload.result==='object'&&!Array.isArray(payload.result))return payload.result;
  }
  return payload;
}

export function parseWowheadConfigured(env=process.env){return Boolean(String(env?.PARSE_API_KEY||'').trim());}

export async function fetchParseWowheadSpell(spellId,{fetcher=fetch,apiKey=process.env.PARSE_API_KEY,baseUrl=process.env.PARSE_WOWHEAD_API_BASE||PARSE_WOWHEAD_API_BASE_DEFAULT,timeoutMs=8000}={}){
  const id=finiteId(spellId);
  const key=String(apiKey||'').trim();
  if(!key)return {provider:'parse-wowhead',configured:false,creditUpperBound:0,spell:null,reason:'PARSE_API_KEY is not configured'};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Math.max(1000,Number(timeoutMs)||8000));
  const endpoint=`/get_spell?id=${id}`;
  let response;
  try{
    response=await fetcher(`${cleanBase(baseUrl)}${endpoint}`,{method:'GET',headers:{accept:'application/json','X-API-Key':key},signal:controller.signal});
  }catch(error){
    if(controller.signal.aborted)throw new Error(`Parse Wowhead timeout for spell ${id}`);
    throw new Error(`Parse Wowhead network error for spell ${id}: ${error instanceof Error?error.message:String(error)}`);
  }finally{clearTimeout(timer);}
  const text=await response.text();
  let payload=null;
  try{payload=text?JSON.parse(text):null;}catch{throw new Error(`Parse Wowhead returned non-JSON (${response.status}) for spell ${id}`);}
  if(!response.ok)throw new Error(`Parse Wowhead HTTP ${response.status} for spell ${id}: ${JSON.stringify(payload).slice(0,500)}`);
  const row=unwrap(payload)||{};
  return {
    provider:'parse-wowhead',configured:true,creditUpperBound:1,endpoint,
    spell:{id:Number(row.id??id),name:row.name||null,url:row.url||row.link||`https://www.wowhead.com/spell=${id}`},
  };
}
