(()=>{
'use strict';
const RELEASE='3.9.0';
const CACHE_NAME='avoid-raidops-v390';
const PENDING_KEY='avoid:knowledge-reindex-pending:v390';
const DERIVED_PATHS=new Set(['/api/wcl/report','/api/wcl/status','/api/wcl/telemetry','/api/wcl/history','/api/wcl/intelligence']);
let running=false;

async function invalidateDerivedCache(){
  if(running||!('caches'in window))return;
  running=true;
  try{
    const cache=await caches.open(CACHE_NAME),keys=await cache.keys();let removed=0;
    for(const request of keys){
      const url=new URL(request.url);
      if(!DERIVED_PATHS.has(url.pathname))continue;
      if(await cache.delete(request))removed++;
    }
    localStorage.removeItem(PENDING_KEY);
    window.dispatchEvent(new CustomEvent('avoid:activity',{detail:{at:Date.now(),state:'busy',message:`Knowledge reindex · ${removed} derived snapshots invalidated`}}));
    setTimeout(()=>document.querySelector('.wcl button')?.click(),80);
  }catch(error){
    localStorage.setItem(PENDING_KEY,'1');
    console.warn('[AvoiD knowledge reindex]',error);
  }finally{running=false;}
}

function requestReindex(){
  localStorage.setItem(PENDING_KEY,'1');
  if(window.__AVOID_DATA_HUB__?.mode==='connected')void invalidateDerivedCache();
}

window.addEventListener('avoid:activity',event=>{
  const message=String(event.detail?.message||'');
  if(message.startsWith('Iris revision active'))requestReindex();
});

function resumePending(){if(localStorage.getItem(PENDING_KEY)==='1'&&window.__AVOID_DATA_HUB__?.mode==='connected')void invalidateDerivedCache()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',resumePending,{once:true});else resumePending();

window.__AVOID_KNOWLEDGE_REINDEX__=Object.freeze({release:RELEASE,cache:CACHE_NAME,policy:'invalidate-derived-cache-and-refresh',rawEvidence:'immutable'});
})();
