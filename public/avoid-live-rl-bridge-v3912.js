(()=>{
'use strict';
const RELEASE='3.9.12.2';
const q=(s,r=document)=>r?.querySelector(s)||null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const page=()=>String(q('.page-head h1')?.textContent||'').trim().toLowerCase();
const data=()=>window.__AVOID_EXECUTION_CONTEXT__?.activeData||window.__AVOID_ACTIVE_REPORT_DATA__||{};
function priorities(d){const rows=d?.rlSummary?.priorities||d?.reviewPriorities||[];return rows.length?rows.slice(0,3).map((x,i)=>`<div class="aop-call ${i?'muted':''}"><i>${i+1}</i><span><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></span></div>`).join(''):'<div class="aop-call muted"><i>—</i><span><b>NO HIGH-VALUE RL SIGNAL YET</b><small>Iris suppressed low-context telemetry instead of turning it into a call.</small></span></div>';}
function factStrip(d){const rows=d?.rlSummary?.facts||[];return rows.length?`<div class="aop-rl-facts">${rows.slice(0,4).map(row=>`<span><small>${esc(row.label)}</small><b>${esc(row.value)}</b></span>`).join('')}</div>`:'';}
function render(){
  if(page()!=='live')return;const o=data().operationalExecution,d=o?.rlDiagnostic;if(o?.status!=='ready'||!d)return;
  const root=q('.canvas > .avoid-operational-root[data-kind="live"]');if(!root||q('[data-full-rl-bridge]',root))return;
  const target=q('.aop-pull-card',root);if(!target)return;
  const section=document.createElement('div');section.dataset.fullRlBridge=RELEASE;section.innerHTML=`<section class="aop-next aop-rl-brief aop-rl-summary"><header><span class="aop-badge warn">IRIS RL BRIEF</span><div><h3>${esc(d?.rlSummary?.headline||'Latest-pull decision brief')}</h3><p>Highest-value findings first. Raw WCL evidence is deliberately kept below the decision layer.</p></div></header>${factStrip(d)}${priorities(d)}</section>`;
  target.insertAdjacentElement('afterend',section);
}
let queued=false;function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;render();});}
window.addEventListener('avoid:execution-context',schedule);window.addEventListener('avoid:active-report-data',schedule);window.addEventListener('popstate',schedule);window.addEventListener('hashchange',schedule);
setInterval(()=>{if(page()!=='live')return;const o=data().operationalExecution,root=q('.canvas > .avoid-operational-root[data-kind="live"]');if(o?.status==='ready'&&o?.rlDiagnostic&&root&&!q('[data-full-rl-bridge]',root))schedule();},1500);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.__AVOID_LIVE_RL_BRIDGE__=Object.freeze({release:RELEASE,render,decisionLayer:true});
})();