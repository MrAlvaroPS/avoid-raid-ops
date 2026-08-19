(()=>{
'use strict';
const RELEASE='3.9.12.4';
let selectedFightId=null,lastScopeKey=null;
const q=(s,r=document)=>r?.querySelector(s)||null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v));
const pct=(v,d=1)=>finite(v)?`${Number(v).toFixed(d)}%`:'—';
const compact=v=>{if(!finite(v))return'—';const n=Number(v),a=Math.abs(n);return a>=1e6?`${(n/1e6).toFixed(2)}M`:a>=1e3?`${(n/1e3).toFixed(1)}K`:String(Math.round(n));};
const time=ms=>{if(!finite(ms))return'—';const s=Math.max(0,Math.round(Number(ms)/1000)),m=Math.floor(s/60);return`${m}:${String(s%60).padStart(2,'0')}`;};
const page=()=>String(q('.page-head h1')?.textContent||'').trim().toLowerCase();
const ctx=()=>window.__AVOID_EXECUTION_CONTEXT__||{};
const data=()=>ctx().activeData||window.__AVOID_ACTIVE_REPORT_DATA__||{};
const badge=(text,tone='info')=>`<span class="aop-badge ${tone}">${esc(text)}</span>`;
function signalValue(s){if(!s||s.status==='unavailable')return'—';if(s.unit==='ms')return`${s.delta>=0?'+':'−'}${time(Math.abs(s.delta))}`;if(s.unit==='dps'||s.unit==='hps')return`${s.delta>=0?'+':'−'}${compact(Math.abs(s.delta))}`;if(s.unit==='deaths')return`${s.delta>=0?'+':''}${Math.round(s.delta)}`;return`${s.delta>=0?'+':''}${Number(s.delta).toFixed(1)}${s.unit==='pp'?'pp':''}`;}
function render(){
  if(page()!=='live')return;
  const c=ctx(),a=c.activeReport,o=data().operationalExecution,t=data().telemetry||window.__AVOID_WCL_TELEMETRY__,r=q('.canvas > .avoid-operational-root[data-kind="live"]');
  if(!r||!a||o?.status!=='boss-reference-not-ready'||!t?.pullIntelligence)return;
  const scope=a.selectedScope||{},scopeKey=scope.scopeKey||`${scope.encounterId||''}:d${scope.difficulty||''}`;
  if(scopeKey!==lastScopeKey){lastScopeKey=scopeKey;selectedFightId=null;}
  const pulls=t.pullIntelligence.pulls||[];
  if(!pulls.length)return;
  const byId=id=>pulls.find(p=>Number(p.fightId)===Number(id))||null;
  let sel=selectedFightId?byId(selectedFightId):null;if(!sel)sel=pulls.at(-1)||null;if(sel)selectedFightId=Number(sel.fightId);
  const cmp=t.pullIntelligence.currentVsPrevious||{},improvements=(cmp.improvements||[]).slice(0,3),regressions=(cmp.regressions||[]).slice(0,3),readiness=o.readiness||{};
  const rail=[...pulls].reverse().slice(0,20).map(p=>`<button data-safe-live-fight="${p.fightId}" class="${sel&&Number(sel.fightId)===Number(p.fightId)?'selected':''}"><span><b>PULL ${p.pullNumber}</b><small>${time(p.durationMs)} · S${p.stageCount||'—'}</small></span><strong>${p.kill?'KILL':pct(p.fightPercentage)}</strong></button>`).join('');
  const reason=readiness.status==='coverage-review'?'Coverage rehearsal needs review':readiness.status==='rehearsal-required'?'Current rehearsal is required':'Mechanic reference is not yet certified for Live';
  const previousCoverage=readiness.coverage&&finite(readiness.coverage.observedMechanics)&&finite(readiness.coverage.packMechanics)?`${readiness.coverage.observedMechanics}/${readiness.coverage.packMechanics} mechanics in previous rehearsal`:null;
  const directional=(rows,good)=>rows.length?rows.map(s=>`<p class="${good?'good':'bad'}"><strong>${esc(signalValue(s))}</strong><span><b>${esc(s.label||'Measured pull change')}</b><small>${esc(s.evidence||'Observed WCL')}</small></span></p>`).join(''):`<p class="muted">No ${good?'directional improvement':'directional regression'} is proven yet.</p>`;
  r.innerHTML=`<div class="aop-live-head"><div>${badge(c.live?.pollState==='running'?'● LIVE':'STATIC',c.live?.pollState==='running'?'bad':'info')} ${badge('SAFE TELEMETRY','good')}<h2>${esc(scope.bossName||'Active report')}</h2><p>${esc(scope.difficultyName||'')} · report ${esc(a.report?.code||'')} · ${pulls.length} analytical pulls</p></div><div class="aop-state warn"><small>MECHANIC INTELLIGENCE</small><b>GATED</b><span>${esc(reason)}</span></div></div><div class="aop-live-layout"><aside class="aop-pull-rail"><header><b>THIS REPORT</b><span>${pulls.length} pulls</span></header>${a.selectedFight?.inProgress?`<div class="aop-incoming"><i></i><b>PULL IN PROGRESS</b><small>not scored until close</small></div>`:''}${rail}</aside><main><section class="aop-pull-card"><div><small>${sel?`PULL ${sel.pullNumber}`:'CURRENT PULL'}</small><h3>${sel?.kill?'BOSS KILLED':sel?`${pct(sel.fightPercentage)} remaining`:'In progress'}</h3><p>${sel?`${time(sel.durationMs)} · stage ${sel.stageCount||'—'} · ${sel.meaningfulDeaths||0} meaningful deaths`:'Waiting for a completed pull.'}</p></div><div class="aop-metrics"><span><small>RAID DPS</small><b>${compact(sel?.raidDps)}</b></span><span><small>RAID HPS</small><b>${compact(sel?.raidHps)}</b></span><span><small>FIRST DEATH</small><b>${time(sel?.firstDeathMs)}</b></span><span><small>MECHANICS</small><b>GATED</b></span></div></section><section class="aop-two"><article><header><b>WHAT IMPROVED</b><small>objective WCL metrics · latest vs previous</small></header>${directional(improvements,true)}</article><article><header><b>WHAT REGRESSED</b><small>objective WCL metrics · latest vs previous</small></header>${directional(regressions,false)}</article></section><section class="aop-panel"><header><b>IRIS MECHANIC INTELLIGENCE</b><small>${readiness.dataReady?'Corpus DATA READY · ':''}same-difficulty safety gate remains active</small></header><div class="aop-clean"><b>No mechanic failure, blocker or next-pull call is being inferred yet.</b><br>${esc(reason)}${previousCoverage?` · ${esc(previousCoverage)}`:''}. Objective pull telemetry above remains valid and continues updating live.</div></section><section class="aop-next"><header>${badge('SAFE MODE','warn')}<div><h3>Keep the report running</h3><p>Iris will automatically switch to full mechanic intelligence once this exact boss+difficulty has a current LIVE READY rehearsal. The Active Report is not discarded.</p></div></header><div class="aop-call muted"><i>—</i><span><b>NO UNVERIFIED MECHANIC CALL</b><small>Measured pull facts are shown; mechanic blame and calls remain disabled.</small></span></div></section></main></div>`;
  r.querySelectorAll('[data-safe-live-fight]').forEach(b=>b.addEventListener('click',()=>{selectedFightId=Number(b.dataset.safeLiveFight);render();}));
}
let queued=false;function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;render();},0);}
window.addEventListener('avoid:execution-context',schedule);window.addEventListener('avoid:active-report-data',schedule);window.addEventListener('popstate',schedule);window.addEventListener('hashchange',schedule);
setInterval(()=>{if(page()==='live')render();},1000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.__AVOID_LIVE_SAFE_FALLBACK__=Object.freeze({release:RELEASE,render});
})();
