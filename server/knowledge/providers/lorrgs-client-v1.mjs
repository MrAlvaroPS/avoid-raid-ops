export const LORRGS_CLIENT_VERSION='lorrgs-readonly-client-v1';
export const LORRGS_API_BASE_DEFAULT='https://api2.lorrgs.io/api';

const finiteId=value=>{const id=Number(value);if(!Number.isInteger(id)||id<=0)throw new Error(`Invalid WoW id: ${value}`);return id;};
const cleanBase=value=>String(value||LORRGS_API_BASE_DEFAULT).replace(/\/+$/,'');

async function getJson(path,{fetcher=fetch,baseUrl=LORRGS_API_BASE_DEFAULT,timeoutMs=8000}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Math.max(1000,Number(timeoutMs)||8000));
  let response;
  try{
    response=await fetcher(`${cleanBase(baseUrl)}${path}`,{method:'GET',headers:{accept:'application/json'},signal:controller.signal});
  }catch(error){
    if(controller.signal.aborted)throw new Error(`Lorrgs timeout for ${path}`);
    throw new Error(`Lorrgs network error for ${path}: ${error instanceof Error?error.message:String(error)}`);
  }finally{clearTimeout(timer);}
  const text=await response.text();
  let payload=null;
  try{payload=text?JSON.parse(text):null;}catch{throw new Error(`Lorrgs returned non-JSON (${response.status}) for ${path}`);}
  if(!response.ok)throw new Error(`Lorrgs HTTP ${response.status} for ${path}: ${JSON.stringify(payload).slice(0,500)}`);
  return payload;
}

export async function fetchLorrgsSpell(spellId,options={}){
  const id=finiteId(spellId);
  const payload=await getJson(`/spells/${id}`,options);
  return {provider:'lorrgs',endpoint:`/spells/${id}`,spell:payload||null};
}

export async function fetchLorrgsBossSpells(bossSlug,options={}){
  const slug=String(bossSlug||'').trim();
  if(!slug)throw new Error('bossSlug is required for Lorrgs boss spell membership');
  const payload=await getJson(`/bosses/${encodeURIComponent(slug)}/spells`,options);
  const entries=payload&&typeof payload==='object'&&!Array.isArray(payload)?payload:{};
  const spells=new Map();
  for(const [key,value] of Object.entries(entries)){
    const id=Number(value?.spell_id??key);
    if(Number.isInteger(id)&&id>0)spells.set(id,{...(value||{}),spell_id:id});
  }
  return {provider:'lorrgs',endpoint:`/bosses/${slug}/spells`,bossSlug:slug,spells};
}
