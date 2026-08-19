(()=>{
'use strict';

const RELEASE='3.8.9';
const SHELL_RELEASE_MS=900;
const CORE_READY_POLL_MS=200;
const GET_TIMEOUTS=Object.freeze({
  '/api/wcl/report':45000,
  '/api/wcl/status':15000,
  '/api/wcl/telemetry':60000,
  '/api/wcl/history':60000,
  '/api/wcl/intelligence':60000,
  '/api/wcl/corpus':30000,
  '/api/wcl/reports':30000,
  '/api/wcl/mechanic-knowledge':30000,
  '/api/knowledge/raid-catalog':60000,
  '/api/knowledge':15000,
});

const nativeFetch=window.fetch.bind(window);
const diagnostics=window.__AVOID_WCL_REQUEST_DIAGNOSTICS__||{};
window.__AVOID_WCL_REQUEST_DIAGNOSTICS__=diagnostics;
function requestUrl(input){try{return new URL(input instanceof Request?input.url:String(input),location.href)}catch{return null}}
function requestMethod(input,init){return String(init?.method||(input instanceof Request?input.method:'GET')||'GET').toUpperCase();}
function record(path,patch){diagnostics[path]={...(diagnostics[path]||{}),...patch,updatedAt:Date.now()};window.dispatchEvent(new CustomEvent('avoid:wcl-request-state',{detail:{path,...diagnostics[path]}}));}
window.fetch=function avoidWclFetch(input,init={}){const url=requestUrl(input),method=requestMethod(input,init),timeout=url&&url.origin===location.origin&&method==='GET'?GET_TIMEOUTS[url.pathname]:null;if(!timeout||init?.signal)return nativeFetch(input,init);const controller=new AbortController(),startedAt=Date.now(),timer=setTimeout(()=>controller.abort(new DOMException(`AvoiD WCL request timeout after ${timeout}ms`,'TimeoutError')),timeout);record(url.pathname,{state:'pending',startedAt,timeoutMs:timeout});return nativeFetch(input,{...init,signal:controller.signal}).then(response=>{record(url.pathname,{state:'complete',status:response.status,durationMs:Date.now()-startedAt});return response;}).catch(error=>{const timedOut=controller.signal.aborted;record(url.pathname,{state:timedOut?'timeout':'error',durationMs:Date.now()-startedAt,error:error instanceof Error?error.message:String(error)});throw error;}).finally(()=>clearTimeout(timer));};
function root(){return document.getElementById('root')}function boot(){return document.getElementById('raidops-boot')}function statusCard(){return document.getElementById('raidops-wcl-bootstrap-status')}
function patchVisibleRelease(){const label=document.querySelector('.division b');if(!label)return;const release=`v${RELEASE}`;if(label.dataset.release!==release)label.dataset.release=release;if(!document.getElementById('raidops-release-v389-style')){const style=document.createElement('style');style.id='raidops-release-v389-style';style.textContent='.division b[data-release]{font-size:0}.division b[data-release]::after{content:attr(data-release);font-size:11px}';document.head.append(style);}}
function ensureStatusCard(){let card=statusCard();if(card)return card;card=document.createElement('div');card.id='raidops-wcl-bootstrap-status';card.setAttribute('role','status');card.style.cssText='position:fixed;z-index:2147483000;left:50%;top:50%;transform:translate(-50%,-50%);min-width:min(520px,calc(100vw - 48px));max-width:680px;padding:18px 22px;border:1px solid #27333b;border-radius:12px;background:rgba(8,12,15,.96);box-shadow:0 24px 80px rgba(0,0,0,.45);color:#dfe8ea;font:600 13px/1.45 ui-sans-serif,system-ui,sans-serif;letter-spacing:.01em';const title=document.createElement('b');title.textContent='IRIS · INTERFACE READY';title.style.cssText='display:block;color:#62e6ba;letter-spacing:.15em;font-size:12px;margin-bottom:7px';const copy=document.createElement('span');copy.dataset.bootstrapCopy='1';copy.textContent='Warcraft Logs is still syncing. The interface shell is loaded independently; live values unlock as soon as the core report responds.';copy.style.cssText='display:block;color:#a8b6bc;font-weight:500';card.append(title,copy);document.body.append(card);return card;}
function setCardMessage(message,tone='pending'){const card=ensureStatusCard(),copy=card.querySelector('[data-bootstrap-copy]');if(copy)copy.textContent=message;card.style.borderColor=tone==='error'?'#6d3434':tone==='ready'?'#285443':'#27333b';}
function revealPendingShell(){document.documentElement.classList.remove('raidops-booting');document.documentElement.classList.add('raidops-wcl-core-pending');const b=boot();if(b){b.hidden=true;b.style.setProperty('display','none','important')}const r=root();if(r){r.style.transition='opacity .18s ease,filter .18s ease';r.style.opacity='.34';r.style.filter='blur(1.5px)';r.style.pointerEvents='none'}patchVisibleRelease();setCardMessage('Warcraft Logs is still syncing. The interface shell is loaded independently; live values unlock as soon as the core report responds.');}
function revealCoreReady(){document.documentElement.classList.remove('raidops-booting','raidops-wcl-core-pending');document.documentElement.classList.add('raidops-wcl-core-ready');const b=boot();if(b){b.hidden=true;b.style.setProperty('display','none','important')}const r=root();if(r){r.style.removeProperty('opacity');r.style.removeProperty('filter');r.style.removeProperty('pointer-events')}patchVisibleRelease();const card=statusCard();if(card)card.remove();}
function coreReady(){return Boolean(window.__AVOID_WCL__?.ok)}
function begin(){patchVisibleRelease();setTimeout(()=>{if(coreReady())revealCoreReady();else revealPendingShell()},SHELL_RELEASE_MS);const timer=setInterval(()=>{patchVisibleRelease();if(coreReady()){revealCoreReady();clearInterval(timer)}},CORE_READY_POLL_MS);window.addEventListener('avoid:wcl-request-state',event=>{if(coreReady())return;const d=event.detail||{};if(d.path!=='/api/wcl/report'&&d.path!=='/api/wcl/status')return;if(d.state==='timeout')setCardMessage(`${d.path} exceeded its ${Math.round(Number(d.timeoutMs||0)/1000)}s browser safety timeout. The UI is no longer blocked; server/WCL diagnostics can be inspected independently.`,'error');else if(d.state==='error')setCardMessage(`${d.path} failed before live data became ready: ${String(d.error||'unknown error').slice(0,180)}`,'error');});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true});else begin();
})();
