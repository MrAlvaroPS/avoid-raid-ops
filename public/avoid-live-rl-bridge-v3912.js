(()=>{
'use strict';
const RELEASE='3.9.12.3';
const cache=new Map(),flights=new Map();
const q=(s,r=document)=>r?.querySelector(s)||null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const page=()=>String(q('.page-head h1')?.textContent||'').trim().toLowerCase();
const ctx=()=>window.__AVOID_EXECUTION_CONTEXT__||{};
const data=()=>ctx().activeData||window.__AVOID_ACTIVE_REPORT_DATA__||{};
function key(a,s,f){return`${a?.report?.code||''}:${s?.scopeKey||`${s?.encounterId||''}:d${s?.difficulty||''}`}:f${Number(f)||0}`;}
function priorities(d){const rows=d?.rlSummary?.priorities||d?.reviewPriorities||[];return rows.length?rows.slice(0,3).map((x,i)=>`<div class="aop-call ${i?'muted':''}"><i>${i+1}</i><span><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></span></div>`).join(''):'<div class="aop-call muted"><i>—</i><span><b>NO HIGH-VALUE RL SIGNAL YET</b><small>Iris suppressed low-context telemetry instead of turning it into a call.</small></span></div>';}
function factStrip(d){const rows=d?.rlSummary?.facts||[],g=d?.globalReference;return rows.length||g?.available?`<div class="aop-rl-facts">${rows.slice(0,3).map(row=>`<span><small>${esc(row.label)}</small><b>${esc(row.value)}</b></span>`).join('')}${g?.available?`<span><small>GLOBAL REFERENCE</small><b>${Math.round(g.killPulls||0)} kills · ${Math.round(g.wipePulls||0)} wipes</b></span>`:''}</div>`:'';}
function selectedFight(root){const b=q('[data-live-fight].selected',root);return Number(b?.dataset?.liveFight)||null;}
async function load(a,s,f){const k=key(a,s,f);if(cache.has(k))return cache.get(k);if(flights.has(k))return flights.get(k);const u=new URL('/api/wcl/live-rl-diagnostic',location.origin);u.searchParams.set('report',a.report.code);u.searchParams.set('encounter',String(s.encounterId));u.searchParams.set('difficulty',String(s.difficulty));u.searchParams.set('fight',String(f));const flight=fetch(u,{headers:{accept:'application/json'}}).then(async r=>{const p=await r.json().catch(()=>null);if(!r.ok||!p?.ok)throw new Error(p?.error||`RL diagnostic HTTP ${r.status}`);cache.set(k,p.diagnostic);return p.diagnostic;}).finally(()=>flights.delete(k));flights.set(k,flight);return flight;}
function render(){
  if(page()!=='live')return;const c=ctx(),a=c.activeReport,o=data().operationalExecution;if(o?.status!=='ready'||!a)return;const root=q('.canvas > .avoid-operational-root[data-kind="live"]');if(!root)return;const fightId=selectedFight(root),scope=a.selectedScope;if(!fightId||!scope)return;
  const k=key(a,scope,fightId),base=o?.rlDiagnostic;if(Number(base?.scope?.fightId)===Number(fightId))cache.set(k,base);const d=cache.get(k)||null,existing=q('[data-full-rl-bridge]',root);if(existing&&Number(existing.dataset.fightId)===Number(fightId)&&Boolean(d))return;existing?.remove();
  const target=q('.aop-pull-card',root);if(!target)return;const section=document.createElement('div');section.dataset.fullRlBridge=RELEASE;section.dataset.fightId=String(fightId);section.innerHTML=`<section class="aop-next aop-rl-brief aop-rl-summary"><header><span class="aop-badge warn">IRIS RL BRIEF</span><div><h3>${esc(d?.rlSummary?.headline||'Analysing selected pull')}</h3><p>Pull ${esc(q('[data-live-fight].selected b',root)?.textContent?.replace('PULL ','')||'—')} · same-difficulty GLOBAL reference · certified Iris mechanics remain below.</p></div></header>${d?`${factStrip(d)}${priorities(d)}`:'<div class="aop-call muted"><i>…</i><span><b>ANALYSING SELECTED PULL</b><small>Loading the exact fight; another pull is never substituted.</small></span></div>'}</section>`;target.insertAdjacentElement('afterend',section);
  if(!d&&!flights.has(k))void load(a,scope,fightId).then(()=>{section.remove();schedule();}).catch(error=>{cache.set(k,{rlSummary:{headline:'Selected-pull diagnostic unavailable',priorities:[{title:'Diagnostic unavailable',detail:String(error?.message||error)}]},scope:{fightId}});section.remove();schedule();});
}
let queued=false;function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;render();});}
window.addEventListener('avoid:execution-context',schedule);window.addEventListener('avoid:active-report-data',schedule);window.addEventListener('popstate',schedule);window.addEventListener('hashchange',schedule);document.addEventListener('click',event=>{if(event.target?.closest?.('[data-live-fight]'))queueMicrotask(schedule);});
setInterval(()=>{if(page()==='live')schedule();},1500);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.__AVOID_LIVE_RL_BRIDGE__=Object.freeze({release:RELEASE,render,decisionLayer:true,selectedPullOwnsBrief:true,globalBenchmark:true});
})();