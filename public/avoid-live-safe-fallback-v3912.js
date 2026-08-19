(()=>{
'use strict';
const RELEASE='3.9.12.6';
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
function deathTimeline(sel){const meaningful=Array.isArray(sel?.meaningfulDeathTimeline)?sel.meaningfulDeathTimeline:[],raw=Array.isArray(sel?.rawDeathTimeline)?sel.rawDeathTimeline:[];return meaningful.length?meaningful:raw;}
function deathSequenceMarkup(sel){const rows=deathTimeline(sel);if(!rows.length)return'<div class="aop-clean">No friendly death event is available for this selected pull.</div>';return`<div class="aop-failure-list">${rows.slice(0,8).map((d,i)=>`<p><span>${i===0?'FIRST DEATH':`DEATH ${i+1}`} · ${esc(time(d.fightRelativeMs))}</span><b>${esc(d.player||`Actor ${d.actorId??'?'}`)}</b><small>${esc(d.killingBlow?`Killing blow: ${d.killingBlow}`:'Killing blow unavailable')}${finite(d.overkill)?` · overkill ${compact(d.overkill)}`:''}</small></p>`).join('')}</div>`;}
function safeFacts(sel){if(!sel)return[];const rows=deathTimeline(sel),first=sel.firstDeath||rows[0]||null,firstMs=finite(sel.firstDeathMs)?Number(sel.firstDeathMs):finite(first?.fightRelativeMs)?Number(first.fightRelativeMs):null,duration=finite(sel.durationMs)?Number(sel.durationMs):null,afterFirst=firstMs!=null&&duration!=null?Math.max(0,duration-firstMs):null,cascade=firstMs==null?0:rows.filter(d=>finite(d.fightRelativeMs)&&Number(d.fightRelativeMs)>=firstMs&&Number(d.fightRelativeMs)<=firstMs+10000).length;const out=[];
  if(firstMs!=null)out.push({title:'Review the first death first',detail:`${first?.player||'A player'} died at ${time(firstMs)}${first?.killingBlow?` · WCL killing blow: ${first.killingBlow}`:''}. This is an observed death event, not yet a mechanic-blame claim.`});
  if(cascade>=2)out.push({title:'Death cascade detected',detail:`${cascade} recorded death${cascade===1?'':'s'} landed within 10s of the first death. Inspect whether the later deaths were recoverable consequences or independent events.`});
  if(afterFirst!=null)out.push({title:'Progress after first death',detail:`The pull continued ${time(afterFirst)} after the first death and ended at ${pct(sel.fightPercentage)} remaining in stage ${sel.stageCount||'—'}.`});
  if(finite(sel.meaningfulDeaths))out.push({title:'Death load',detail:`${Number(sel.meaningfulDeaths)} meaningful death${Number(sel.meaningfulDeaths)===1?'':'s'} (${Number(sel.rawDeaths||0)} raw death events) across a ${sel.rosterSize||'—'} player roster.`});
  return out.slice(0,4);
}
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
  const cmp=t.pullIntelligence.currentVsPrevious||{},improvements=(cmp.improvements||[]).slice(0,3),regressions=(cmp.regressions||[]).slice(0,3),readiness=o.readiness||{},facts=safeFacts(sel);
  const rail=[...pulls].reverse().slice(0,20).map(p=>`<button data-safe-live-fight="${p.fightId}" class="${sel&&Number(sel.fightId)===Number(p.fightId)?'selected':''}"><span><b>PULL ${p.pullNumber}</b><small>${time(p.durationMs)} · S${p.stageCount||'—'}</small></span><strong>${p.kill?'KILL':pct(p.fightPercentage)}</strong></button>`).join('');
  const reason=readiness.status==='coverage-review'?'Coverage rehearsal needs review':readiness.status==='rehearsal-required'?'Current rehearsal is required':'Mechanic reference is not yet certified for Live';
  const previousCoverage=readiness.coverage&&finite(readiness.coverage.observedMechanics)&&finite(readiness.coverage.packMechanics)?`${readiness.coverage.observedMechanics}/${readiness.coverage.packMechanics} mechanics in previous rehearsal`:null;
  const directional=(rows,good)=>rows.length?rows.map(s=>`<p class="${good?'good':'bad'}"><strong>${esc(signalValue(s))}</strong><span><b>${esc(s.label||'Measured pull change')}</b><small>${esc(s.evidence||'Observed WCL')}</small></span></p>`).join(''):`<p class="muted">No ${good?'directional improvement':'directional regression'} is proven yet.</p>`;
  const factMarkup=facts.length?facts.map((f,i)=>`<div class="aop-call ${i===0?'':'muted'}"><i>${i+1}</i><span><b>${esc(f.title)}</b><small>${esc(f.detail)}</small></span></div>`).join(''):'<div class="aop-call muted"><i>—</i><span><b>NO DIAGNOSTIC PRIORITY YET</b><small>More completed-pull evidence is needed.</small></span></div>';
  r.innerHTML=`<div data-safe-live-shell="${RELEASE}"><div class="aop-live-head"><div>${badge(c.live?.pollState==='running'?'● LIVE':'STATIC',c.live?.pollState==='running'?'bad':'info')} ${badge('SAFE DIAGNOSTIC','good')}<h2>${esc(scope.bossName||'Active report')}</h2><p>${esc(scope.difficultyName||'')} · report ${esc(a.report?.code||'')} · ${pulls.length} analytical pulls</p></div><div class="aop-state warn"><small>MECHANIC INTELLIGENCE</small><b>GATED</b><span>${esc(reason)}</span></div></div><div class="aop-live-layout"><aside class="aop-pull-rail"><header><b>THIS REPORT</b><span>${pulls.length} pulls</span></header>${a.selectedFight?.inProgress?`<div class="aop-incoming"><i></i><b>PULL IN PROGRESS</b><small>not scored until close</small></div>`:''}${rail}</aside><main><section class="aop-pull-card"><div><small>${sel?`PULL ${sel.pullNumber}`:'CURRENT PULL'}</small><h3>${sel?.kill?'BOSS KILLED':sel?`${pct(sel.fightPercentage)} remaining`:'In progress'}</h3><p>${sel?`${time(sel.durationMs)} · stage ${sel.stageCount||'—'} · ${sel.meaningfulDeaths||0} meaningful deaths`:'Waiting for a completed pull.'}</p></div><div class="aop-metrics"><span><small>RAID DPS</small><b>${compact(sel?.raidDps)}</b></span><span><small>RAID HPS</small><b>${compact(sel?.raidHps)}</b></span><span><small>FIRST DEATH</small><b>${time(sel?.firstDeathMs)}</b></span><span><small>MEANINGFUL DEATHS</small><b>${finite(sel?.meaningfulDeaths)?Math.round(sel.meaningfulDeaths):'—'}</b></span></div></section><section class="aop-two"><article><header><b>WHAT IMPROVED</b><small>objective WCL metrics · latest vs previous</small></header>${directional(improvements,true)}</article><article><header><b>WHAT REGRESSED</b><small>objective WCL metrics · latest vs previous</small></header>${directional(regressions,false)}</article></section><section class="aop-panel"><header><b>DEATH SEQUENCE · SELECTED PULL</b><small>WCL observed facts · no causal mechanic claim</small></header>${deathSequenceMarkup(sel)}</section><section class="aop-next"><header>${badge('REVIEW NOW','warn')}<div><h3>Objective pull diagnosis</h3><p>These priorities come from observed progression and death timing only. They do not bypass the mechanic safety gate.</p></div></header>${factMarkup}</section><section class="aop-panel"><header><b>IRIS MECHANIC INTELLIGENCE</b><small>${readiness.dataReady?'Corpus DATA READY · ':''}same-difficulty safety gate remains active</small></header><div class="aop-clean"><b>Mechanic blame, blocker and mechanic calls remain disabled.</b><br>${esc(reason)}${previousCoverage?` · ${esc(previousCoverage)}`:''}. The death sequence and pull diagnosis above are still valid WCL observations.</div></section></main></div></div>`;
  r.querySelectorAll('[data-safe-live-fight]').forEach(b=>b.addEventListener('click',()=>{selectedFightId=Number(b.dataset.safeLiveFight);render();}));
}
let queued=false;function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;render();});}
window.addEventListener('avoid:execution-context',schedule);window.addEventListener('avoid:active-report-data',schedule);window.addEventListener('popstate',schedule);window.addEventListener('hashchange',schedule);
setInterval(()=>{
  if(page()!=='live')return;
  const o=data().operationalExecution,r=q('.canvas > .avoid-operational-root[data-kind="live"]');
  if(o?.status==='boss-reference-not-ready'&&data().telemetry?.pullIntelligence&&r&&!q('[data-safe-live-shell]',r))schedule();
},1500);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.__AVOID_LIVE_SAFE_FALLBACK__=Object.freeze({release:RELEASE,render,sameFrameRaceResolution:true,unconditionalRepaint:false,safeDiagnostic:true});
})();
