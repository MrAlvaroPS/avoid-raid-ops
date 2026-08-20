(()=>{
'use strict';
const RELEASE='3.9.12.3',KNOWLEDGE='/api/wcl/mechanic-knowledge';
let token=0,lastKey='';
const page=()=>String(document.querySelector('.page-head h1')?.textContent||'').trim().toLowerCase()==='mechanics';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>Number.isFinite(Number(v))?new Intl.NumberFormat('en-US').format(Number(v)):'—';
function scope(){const journal=Number(document.querySelector('.iris-mechanics-scope [data-boss]')?.value||0),difficulty=Number(document.querySelector('.iris-mechanics-scope [data-difficulty]')?.value||0);return{journal,difficulty};}
function card(){return document.querySelector('.iris-mechanics-knowledge .iris-k-source-grid .iris-k-source:nth-child(3)');}
function empiricalHost(){return document.querySelector('.iris-mechanics-knowledge .iris-k-mechanics');}
function paint(target,ref,difficultyName){
  if(!target)return;const maturity=String(ref?.maturity||'none'),row=ref||null;
  let cls='missing',badge='NOT STARTED',value='NOT AVAILABLE',meta=`No persisted ${esc(difficultyName||'same-difficulty')} public reference`;
  if(maturity==='foundation-building'){cls='partial';badge='BUILDING';value=`${fmt(row?.pulls)} PULLS`;meta=`${fmt(row?.sources)} discovered sources · ${fmt(row?.deepPulls)} deep · preliminary same-difficulty reference`;}
  else if(maturity==='foundation-ready'){cls='ready';badge='DATA READY';value=`${fmt(row?.sources)} SOURCES`;meta=`${fmt(row?.pulls)} pulls · ${fmt(row?.deepPulls)} Deep · ${fmt(row?.deepSources)} Deep sources · canonical same-difficulty sampling`;}
  else if(maturity==='foundation-incomplete'){cls='partial';badge='INCOMPLETE';value=`${fmt(row?.pulls)} PULLS`;meta='Persisted public reference exists but is not ready for operational comparison';}
  target.className=`iris-k-source ${cls}`;target.dataset.irisGlobalReferenceRelease=RELEASE;target.innerHTML=`<small>GLOBAL PUBLIC REFERENCE</small><strong>${value}</strong><p>${meta}</p><i>${badge}</i>`;
}
function paintEmpirical(data,ref,difficultyName){
  const host=empiricalHost(),mechanics=data?.mechanics||[];if(!host||mechanics.length)return;
  const maturity=String(ref?.maturity||'none');if(!['foundation-ready','foundation-building','foundation-incomplete'].includes(maturity))return;
  const ready=maturity==='foundation-ready';
  host.dataset.irisOperationalEvidenceRelease=RELEASE;
  host.innerHTML=`<div class="iris-k-empty iris-k-operational-evidence"><b>${ready?'PUBLIC CORPUS AVAILABLE':'PUBLIC CORPUS BUILDING'} · ${esc(String(difficultyName||'').toUpperCase())}</b><p>Iris has ${fmt(ref?.pulls)} same-difficulty public pulls across ${fmt(ref?.sources)} canonical sources${Number(ref?.deepPulls)>0?`, including ${fmt(ref?.deepPulls)} Deep pulls from ${fmt(ref?.deepSources)} Deep sources`:''}. This evidence can support operational comparison, but accepted causal relationships are still being synthesized and gated separately.</p><small>${ready?'DATA READY · not accepted mechanic knowledge':'BUILDING · incomplete operational reference'} · HOME/AvoiD excluded · cross-difficulty reuse forbidden</small></div>`;
}
async function refresh(){
  if(!page())return;const target=card(),s=scope();if(!target||!s.journal||!s.difficulty)return;const current=`${s.journal}:d${s.difficulty}`;if(current===lastKey&&target.dataset.irisGlobalReferenceRelease===RELEASE&&empiricalHost()?.dataset?.irisOperationalEvidenceRelease===RELEASE)return;lastKey=current;const mine=++token;
  try{const url=new URL(KNOWLEDGE,location.origin);url.searchParams.set('journal',String(s.journal));url.searchParams.set('difficulty',String(s.difficulty));const res=await fetch(url,{headers:{accept:'application/json'}}),payload=await res.json().catch(()=>null);if(mine!==token||!page())return;if(!res.ok||!payload?.ok)return;const data=payload.result||payload,ref=data?.sources?.globalReference||null;paint(card(),ref,data?.difficulty?.name);paintEmpirical(data,ref,data?.difficulty?.name);}
  catch{}
}
let queued=false;function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;if(!page()){lastKey='';token++;return;}refresh();});}
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['value','class']});document.addEventListener('change',e=>{if(e.target?.matches?.('.iris-mechanics-scope select')){lastKey='';schedule();}});window.addEventListener('popstate',schedule);window.addEventListener('hashchange',schedule);document.addEventListener('DOMContentLoaded',schedule,{once:true});window.addEventListener('load',schedule,{once:true});schedule();
})();
