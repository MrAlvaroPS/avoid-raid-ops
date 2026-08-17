(()=>{
'use strict';
const RELEASE='3.9.0-refactor';
const CACHE_NAME='avoid-raidops-v390';
const MODE_KEY='avoid:data-mode:v390';
const LIVE_POLL_MS=30000;
const CACHEABLE=new Set(['/api/wcl/report','/api/wcl/status','/api/wcl/telemetry','/api/wcl/history','/api/wcl/intelligence','/api/wcl/reports','/api/knowledge']);
const labels={
  '/api/wcl/report':'Loading report','/api/wcl/status':'Checking live status','/api/wcl/telemetry':'Loading pull telemetry',
  '/api/wcl/history':'Loading raid history','/api/wcl/intelligence':'Running Iris analysis','/api/wcl/reports':'Updating AvoiD logs','/api/knowledge':'Loading game knowledge'
};
let dataMode=localStorage.getItem(MODE_KEY)==='stored'?'stored':'connected';
let catalog=null,knowledge=null,liveTimer=null,liveState='stopped',drawer=null,activityNode=null;
const activity=window.__AVOID_ACTIVITY__=Array.isArray(window.__AVOID_ACTIVITY__)?window.__AVOID_ACTIVITY__:[];
const previousFetch=window.fetch.bind(window);

function emit(message,state='busy',detail={}){
  const row={at:Date.now(),message:String(message),state,...detail};activity.push(row);while(activity.length>24)activity.shift();
  window.dispatchEvent(new CustomEvent('avoid:activity',{detail:row}));renderActivity(row);renderLog();
}
function renderActivity(row){
  if(!activityNode)return;activityNode.className=`raidops-activity ${row.state||''}`;const span=activityNode.querySelector('span');if(span)span.textContent=row.message;
}
function normalizedRequest(url){const u=new URL(url,location.href);u.searchParams.delete('_');u.searchParams.delete('force');return new Request(u.href,{method:'GET',headers:{Accept:'application/json'}})}
async function cacheMatch(url){if(!('caches'in window))return null;try{return await (await caches.open(CACHE_NAME)).match(normalizedRequest(url))}catch{return null}}
async function cachePut(url,response){if(!('caches'in window)||!response?.ok)return;try{const copy=response.clone();await (await caches.open(CACHE_NAME)).put(normalizedRequest(url),copy)}catch(error){console.warn('[AvoiD cache write]',error)}}
function info(input,init={}){try{const raw=input instanceof Request?input.url:String(input),url=new URL(raw,location.href),method=String(init.method||(input instanceof Request?input.method:'GET')||'GET').toUpperCase();return{url,method,cacheable:url.origin===location.origin&&method==='GET'&&CACHEABLE.has(url.pathname)}}catch{return{cacheable:false}}}

window.fetch=async(input,init={})=>{
  const meta=info(input,init);
  if(!meta.cacheable)return previousFetch(input,init);
  const cached=await cacheMatch(meta.url);
  if(dataMode==='stored'){
    if(cached){emit(`Stored · ${labels[meta.url.pathname]||meta.url.pathname}`,'ready',{path:meta.url.pathname,source:'cache'});return cached.clone()}
    const error=new Error(`No stored snapshot for ${meta.url.pathname}`);error.code='NO_STORED_SNAPSHOT';emit(error.message,'error',{path:meta.url.pathname});throw error;
  }
  try{
    const response=await previousFetch(input,init);
    if(response.ok){void cachePut(meta.url,response);}
    return response;
  }catch(error){
    if(cached){emit(`Network unavailable · using stored ${meta.url.pathname.replace('/api/wcl/','')}`,'ready',{path:meta.url.pathname,source:'cache-fallback'});return cached.clone()}
    throw error;
  }
};

function currentReport(){return new URLSearchParams(location.search).get('report')||window.__AVOID_WCL__?.report?.code||'28d9xF7GchL6ZPYt'}
function guildId(){return new URLSearchParams(location.search).get('guild')||window.__AVOID_WCL__?.guild?.id||window.__AVOID_WCL__?.reportGuild?.id||'788166'}
function fmtDate(ms){if(!Number.isFinite(Number(ms)))return'—';return new Date(Number(ms)).toLocaleString([], {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}

async function fetchJson(url,init){const response=await fetch(url,init);const payload=await response.json().catch(()=>({}));if(!response.ok||payload?.ok===false)throw new Error(payload?.error||`HTTP ${response.status}`);return payload}
async function syncCatalog(days=120,force=false){
  emit(force?'Refreshing AvoiD log catalogue':'Loading AvoiD log catalogue','busy');
  const u=new URL('/api/wcl/reports',location.origin);u.searchParams.set('report',currentReport());u.searchParams.set('guild',guildId());u.searchParams.set('days',String(days));if(force)u.searchParams.set('force','1');
  try{catalog=await fetchJson(u);emit(`${catalog.reports?.length||0} current-raid logs ready`,'ready');renderDrawer();return catalog}catch(error){emit(`Log catalogue failed · ${error.message}`,'error');renderDrawer();return null}
}
async function loadKnowledge(){try{knowledge=await fetchJson('/api/knowledge');renderDrawer();return knowledge}catch(error){emit(`Knowledge status failed · ${error.message}`,'error');return null}}
async function refreshKnowledge(){
  const patch=drawer?.querySelector('[data-k-patch]')?.value?.trim()||'unknown';const season=drawer?.querySelector('[data-k-season]')?.value?.trim()||'unknown';
  emit('Staging game knowledge revision','busy');
  try{knowledge=await fetchJson('/api/knowledge',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({action:'refresh',patch,season,build:'manual-refresh'})});emit('Knowledge candidate staged','ready');renderDrawer()}catch(error){emit(`Knowledge refresh failed · ${error.message}`,'error')}
}
async function activateKnowledge(){emit('Activating Iris knowledge revision','busy');try{knowledge=await fetchJson('/api/knowledge',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({action:'activate'})});emit('Iris revision active · derived data marked for reindex','ready');renderDrawer()}catch(error){emit(`Knowledge activation failed · ${error.message}`,'error')}}

function selectReport(code){if(!code||code===currentReport())return;const u=new URL(location.href);u.searchParams.set('report',code);u.searchParams.set('guild',guildId());emit(`Switching to report ${code}`,'busy');location.assign(u.href)}
function setMode(mode){dataMode=mode==='stored'?'stored':'connected';localStorage.setItem(MODE_KEY,dataMode);emit(dataMode==='stored'?'Stored-data mode enabled':'Connected-data mode enabled','ready');location.reload()}

async function liveTick(){
  if(liveState!=='running')return;
  const u=new URL('/api/wcl/status',location.origin);u.searchParams.set('report',currentReport());const encounter=new URLSearchParams(location.search).get('encounter');if(encounter)u.searchParams.set('encounter',encounter);u.searchParams.set('_',String(Date.now()));
  try{const status=await fetchJson(u);emit(status?.encounter?.latestFight?.inProgress?'Live pull detected':'Live log checked','ready',{kind:'live'});if(!status?.encounter?.latestFight?.inProgress)document.querySelector('.wcl button')?.click()}catch(error){emit(`Live poll failed · ${error.message}`,'error',{kind:'live'})}
}
function startLive(){if(dataMode==='stored'){emit('Live polling requires connected mode','error');return}liveState='running';clearInterval(liveTimer);liveTimer=setInterval(liveTick,LIVE_POLL_MS);emit('Live log polling started · 30s','busy');void liveTick();renderDrawer()}
function pauseLive(){if(liveState!=='running')return;liveState='paused';clearInterval(liveTimer);liveTimer=null;emit('Live log polling paused','ready');renderDrawer()}
function stopLive(){liveState='stopped';clearInterval(liveTimer);liveTimer=null;emit('Live log polling stopped','ready');renderDrawer()}

function renderLog(){const host=drawer?.querySelector('.raidops-data-log');if(!host)return;host.innerHTML=activity.slice(-5).reverse().map(row=>`<p class="${escapeHtml(row.state)}"><time>${new Date(row.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time><b>${escapeHtml(row.message)}</b></p>`).join('')||'<p><time>—</time><b>No activity yet</b></p>'}
function reportOptions(){const reports=catalog?.reports||[];if(!reports.length)return`<option value="${escapeHtml(currentReport())}">${escapeHtml(currentReport())} · current</option>`;return reports.map(r=>`<option value="${escapeHtml(r.code)}" ${r.code===currentReport()?'selected':''}>${escapeHtml(fmtDate(r.startTime))} · ${escapeHtml(r.title||r.code)}</option>`).join('')}
function renderDrawer(){
  if(!drawer)return;const reports=catalog?.reports||[],active=knowledge?.active,candidate=knowledge?.candidate;
  drawer.innerHTML=`
    <div class="raidops-data-head"><div><label>IRIS DATA PLATFORM · ${RELEASE}</label><h3>Data & Logs</h3><p>Selected report drives report-scoped screens; History remains encounter-wide across the valid current-raid catalogue.</p></div><button type="button" data-close>×</button></div>
    <section class="raidops-data-section"><label>DATA SOURCE</label><div class="raidops-data-row"><button type="button" data-mode="connected" class="${dataMode==='connected'?'primary':''}">CONNECTED</button><button type="button" data-mode="stored" class="${dataMode==='stored'?'primary':''}">USE STORED</button><button type="button" data-sync>SYNC LATEST</button><button type="button" data-history>LOAD HISTORY</button></div><p class="raidops-data-note"><strong>Noise policy:</strong> exact current WCL raid zone only. Mythic+ and unrelated/old raids never enter this catalogue.</p></section>
    <section class="raidops-data-section"><label>SELECTED RAID LOG</label><div class="raidops-data-row"><select data-report>${reportOptions()}</select><button type="button" data-open class="primary">OPEN LOG</button></div><div class="raidops-data-meta"><div><span>AVAILABLE</span><b>${reports.length||'—'} logs</b></div><div><span>LATEST</span><b>${escapeHtml(catalog?.latestReport?fmtDate(catalog.latestReport.startTime):'—')}</b></div><div><span>MODE</span><b>${dataMode.toUpperCase()}</b></div></div></section>
    <section class="raidops-data-section"><label>LIVE LOG</label><div class="raidops-data-row"><button type="button" data-live-start class="primary" ${liveState==='running'?'disabled':''}>START 30s</button><button type="button" data-live-pause ${liveState!=='running'?'disabled':''}>PAUSE</button><button type="button" data-live-stop class="warn" ${liveState==='stopped'?'disabled':''}>STOP</button></div><p class="raidops-data-note">Live mode watches the selected report. Rich datasets refresh only after a closed-pull change; it does not hammer full telemetry on every tick.</p></section>
    <section class="raidops-data-section"><label>GAME KNOWLEDGE</label><div class="raidops-data-meta"><div><span>ACTIVE</span><b>${escapeHtml(active?.revision||'none')}</b></div><div><span>CANDIDATE</span><b>${escapeHtml(candidate?.revision||'none')}</b></div><div><span>STORE</span><b>${escapeHtml(knowledge?.persistence||'—')}</b></div></div><div class="raidops-data-row"><input data-k-patch placeholder="Patch, e.g. 11.2.7" style="height:32px;border:1px solid #28323b;border-radius:5px;background:#0d1217;color:#aab4ba;padding:0 9px;font-size:8px;min-width:130px"><input data-k-season placeholder="Season" style="height:32px;border:1px solid #28323b;border-radius:5px;background:#0d1217;color:#aab4ba;padding:0 9px;font-size:8px;min-width:100px"><button type="button" data-k-refresh>REFRESH KNOWLEDGE</button><button type="button" data-k-activate class="primary" ${candidate?'':'disabled'}>ACTIVATE FOR IRIS</button></div><p class="raidops-data-note">Activation invalidates/re-derives interpretations against the new revision; immutable raw WCL evidence is never rewritten. Wowhead is reference enrichment, not a fabricated canonical API.</p></section>
    <section class="raidops-data-section"><label>CRITICAL ACTIVITY</label><div class="raidops-data-log"></div></section>`;
  drawer.querySelector('[data-close]')?.addEventListener('click',()=>drawer.hidden=true);
  drawer.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
  drawer.querySelector('[data-sync]')?.addEventListener('click',()=>syncCatalog(21,true));
  drawer.querySelector('[data-history]')?.addEventListener('click',()=>syncCatalog(180,true));
  drawer.querySelector('[data-open]')?.addEventListener('click',()=>selectReport(drawer.querySelector('[data-report]')?.value));
  drawer.querySelector('[data-live-start]')?.addEventListener('click',startLive);drawer.querySelector('[data-live-pause]')?.addEventListener('click',pauseLive);drawer.querySelector('[data-live-stop]')?.addEventListener('click',stopLive);
  drawer.querySelector('[data-k-refresh]')?.addEventListener('click',refreshKnowledge);drawer.querySelector('[data-k-activate]')?.addEventListener('click',activateKnowledge);
  renderLog();
}

function mount(){
  const selectors=document.querySelector('.selectors');if(!selectors||document.getElementById('raidops-data-button'))return;
  activityNode=document.createElement('div');activityNode.className='raidops-activity ready';activityNode.innerHTML='<i></i><span>Ready</span>';selectors.prepend(activityNode);
  const button=document.createElement('button');button.id='raidops-data-button';button.type='button';button.className='raidops-data-button';button.textContent='DATA ⌄';selectors.append(button);
  drawer=document.createElement('aside');drawer.id='raidops-data-hub';drawer.className='raidops-data-drawer';drawer.hidden=true;document.body.append(drawer);
  button.addEventListener('click',()=>{drawer.hidden=!drawer.hidden;if(!drawer.hidden){renderDrawer();if(!catalog)void syncCatalog(120,false);if(!knowledge)void loadKnowledge();}});
  window.addEventListener('avoid:wcl-request-state',event=>{const d=event.detail||{},label=labels[d.path];if(!label)return;if(d.state==='pending')emit(label,'busy',{path:d.path});else if(d.state==='complete')emit(`${label.replace(/^Loading /,'')} ready`,'ready',{path:d.path});else if(d.state==='timeout'||d.state==='error')emit(`${label} failed${d.error?` · ${String(d.error).slice(0,90)}`:''}`,'error',{path:d.path})});
  emit(dataMode==='stored'?'Stored data mode':'Connected data mode','ready');
}

window.__AVOID_DATA_HUB__=Object.freeze({release:RELEASE,cache:CACHE_NAME,get mode(){return dataMode},livePollMs:LIVE_POLL_MS,reportScope:'selected-report + encounter-wide history',noisePolicy:'exact-current-raid-zone'});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
