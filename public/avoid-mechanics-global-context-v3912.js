(()=>{
'use strict';
const RELEASE='3.9.12.1';
const q=(s,r=document)=>r?.querySelector(s)||null;
const page=()=>String(q('.page-head h1')?.textContent||'').trim().toLowerCase();
const x=()=>window.__AVOID_MECHANICS_RAID_EXECUTION__||window.__AVOID_RAID_EXECUTION__||null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
function render(){
  if(page()!=='mechanics')return;const data=x(),root=q('.canvas > .avoid-operational-root[data-kind="mechanics"]');if(!data||!root||root.hidden)return;const g=data.globalContext,hero=q('.aop-exec-hero',root);if(!hero)return;
  q('[data-mechanics-global-context]',root)?.remove();const mechanics=data.mechanics||[],homePulls=Number(data?.population?.pulls||0);
  if(!mechanics.length){for(const section of root.querySelectorAll('.aop-panel')){if(String(q('header b',section)?.textContent||'').includes('MECHANIC EVOLUTION'))section.hidden=true;}for(const tile of root.querySelectorAll('.aop-exec-stats > span')){const label=String(q('small',tile)?.textContent||'');if(label==='MECHANICAL ACCURACY'||label==='CURRENT BLOCKER'||label==='RECENT WINDOW')tile.hidden=true;}}
  if(!g?.available)return;
  const section=document.createElement('section');section.dataset.mechanicsGlobalContext=RELEASE;section.className='aop-panel aop-global-context';section.innerHTML=`<header><b>REFERENCE CONTEXT</b><small>same boss + same difficulty · HOME never trains GLOBAL</small></header><div class="aop-rl-facts"><span><small>PRIMARY REFERENCE</small><b>${esc(g.referenceMode||'GLOBAL')}</b></span><span><small>AVOID</small><b>${homePulls} pull${homePulls===1?'':'s'}</b></span><span><small>GLOBAL WIDE</small><b>${Math.round(g.widePulls||0)} pulls · ${Math.round(g.wideSources||0)} sources</b></span><span><small>GLOBAL DEEP</small><b>${Math.round(g.deepPulls||0)} pulls · ${Math.round(g.deepSources||0)} sources</b></span></div><div class="aop-clean"><b>${esc(g.meaning||'GLOBAL same-difficulty context is available.')}</b><br>Pull-specific outliers are computed in LIVE against canonical GLOBAL kills/wipes; Mechanics will become HOME-led only after enough AvoiD history exists.</div>`;hero.insertAdjacentElement('afterend',section);
}
let queued=false;function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;render();});}
window.addEventListener('avoid:raid-execution',schedule);window.addEventListener('avoid:execution-context',schedule);window.addEventListener('avoid:active-report-data',schedule);window.addEventListener('popstate',schedule);window.addEventListener('hashchange',schedule);setInterval(()=>{if(page()==='mechanics')schedule();},1200);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.__AVOID_MECHANICS_GLOBAL_CONTEXT__=Object.freeze({release:RELEASE,render});
})();