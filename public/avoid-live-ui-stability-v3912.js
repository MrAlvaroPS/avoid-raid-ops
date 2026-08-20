(()=>{
'use strict';
const RELEASE='3.9.12.1';
const q=(s,r=document)=>r?.querySelector(s)||null;
const page=()=>String(q('.page-head h1')?.textContent||'').trim().toLowerCase();
const context=()=>window.__AVOID_EXECUTION_CONTEXT__||{};
function key(){const a=context().activeReport||{},scope=a.selectedScope||{},selected=q('[data-safe-live-fight].selected')||q('[data-live-fight].selected'),fight=selected?.dataset?.safeLiveFight||selected?.dataset?.liveFight||a?.selectedFight?.fightId||a?.selectedFight?.id||'latest';return`avoid-live-evidence:${a?.report?.code||'none'}:${scope?.scopeKey||`${scope?.encounterId||''}:d${scope?.difficulty||''}`}:f${fight}`;}
function remember(e){const details=e.target?.closest?.('.aop-evidence-drawer');if(!details)return;try{sessionStorage.setItem(key(),details.open?'1':'0');}catch{}}
function restore(){if(page()!=='live')return;const details=q('.aop-evidence-drawer');if(!details)return;let value=null;try{value=sessionStorage.getItem(key());}catch{}if(value==='1')details.open=true;else if(value==='0')details.open=false;}
function afterRender(){queueMicrotask(()=>requestAnimationFrame(restore));}
document.addEventListener('toggle',remember,true);
document.addEventListener('click',e=>{if(e.target?.closest?.('[data-safe-live-fight],[data-live-fight]'))afterRender();},true);
window.addEventListener('avoid:execution-context',afterRender);
window.addEventListener('avoid:active-report-data',afterRender);
window.addEventListener('popstate',afterRender);
window.addEventListener('hashchange',afterRender);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',afterRender,{once:true});else afterRender();
window.__AVOID_LIVE_UI_STABILITY__=Object.freeze({release:RELEASE,restore,evidenceDrawerStatePersists:true,noPollingTimer:true});
})();
