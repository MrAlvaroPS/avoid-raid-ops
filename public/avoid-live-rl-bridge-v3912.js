(()=>{
'use strict';
const RELEASE='3.9.12.1';
const q=(s,r=document)=>r?.querySelector(s)||null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compact=v=>{const n=Number(v);if(!Number.isFinite(n))return'—';const a=Math.abs(n);return a>=1e6?`${(n/1e6).toFixed(2)}M`:a>=1e3?`${(n/1e3).toFixed(1)}K`:String(Math.round(n));};
const page=()=>String(q('.page-head h1')?.textContent||'').trim().toLowerCase();
const data=()=>window.__AVOID_EXECUTION_CONTEXT__?.activeData||window.__AVOID_ACTIVE_REPORT_DATA__||{};
const official=row=>[...new Set((row?.officialMechanics||[]).map(x=>x?.mechanicName).filter(Boolean))].join(' · ');
function priorities(d){const rows=d?.reviewPriorities||[];return rows.length?rows.slice(0,5).map((x,i)=>`<div class="aop-call ${i?'muted':''}"><i>${i+1}</i><span><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></span></div>`).join(''):'<div class="aop-call muted"><i>—</i><span><b>NO RL PRIORITY YET</b><small>Waiting for current-pull diagnostic evidence.</small></span></div>';}
function pressure(d){const rows=d?.incomingPressure?.topAbilities||[];return rows.length?`<div class="aop-pressure-list">${rows.slice(0,6).map(x=>`<p><span><b>${esc(x.name)}</b><small>${esc(official(x)||'Observed damage source')}</small></span><strong>${x.sharePct!=null?Number(x.sharePct).toFixed(1)+'%':'—'}</strong><em>${compact(x.totalDamage)} damage</em></p>`).join('')}</div>`:'<div class="aop-clean">No current-pull incoming pressure breakdown is available.</div>';}
function render(){
  if(page()!=='live')return;const o=data().operationalExecution,d=o?.rlDiagnostic;if(o?.status!=='ready'||!d)return;
  const root=q('.canvas > .avoid-operational-root[data-kind="live"]');if(!root||q('[data-full-rl-bridge]',root))return;
  const target=q('.aop-pull-card',root);if(!target)return;
  const section=document.createElement('div');section.dataset.fullRlBridge=RELEASE;section.innerHTML=`<section class="aop-next aop-rl-brief"><header><span class="aop-badge warn">RL BRIEF</span><div><h3>Latest-pull decision brief</h3><p>Objective WCL facts first; certified Iris mechanic conclusions remain below.</p></div></header>${priorities(d)}</section><section class="aop-panel"><header><b>MECHANIC / DAMAGE PRESSURE · LATEST PULL</b><small>exact current pull · official Journal mapping where available</small></header>${pressure(d)}<div class="aop-control-strip"><span><small>ENEMY CASTS</small><b>${Math.round(d?.castPressure?.totalUniqueCasts||0)}</b></span><span><small>INTERRUPTS</small><b>${Math.round(d?.control?.interrupts||0)}</b></span><span><small>DEBUFF EVENTS</small><b>${Math.round(d?.debuffPressure?.totalDebuffEvents||0)}</b></span><span><small>DISPELS</small><b>${Math.round(d?.control?.dispels||0)}</b></span></div></section>`;
  target.insertAdjacentElement('afterend',section);
}
let queued=false;function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;render();});}
window.addEventListener('avoid:execution-context',schedule);window.addEventListener('avoid:active-report-data',schedule);window.addEventListener('popstate',schedule);window.addEventListener('hashchange',schedule);
setInterval(()=>{if(page()!=='live')return;const o=data().operationalExecution,root=q('.canvas > .avoid-operational-root[data-kind="live"]');if(o?.status==='ready'&&o?.rlDiagnostic&&root&&!q('[data-full-rl-bridge]',root))schedule();},1500);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.__AVOID_LIVE_RL_BRIDGE__=Object.freeze({release:RELEASE,render});
})();
