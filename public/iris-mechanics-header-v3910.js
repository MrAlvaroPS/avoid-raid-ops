(()=>{
'use strict';
const RELEASE='3.9.10.5';
const mechanics=()=>String(document.querySelector('.page-head h1')?.textContent||'').trim().toLowerCase()==='mechanics';
const raidName=()=>String(document.querySelector('.iris-k-scope-raid b')?.textContent||'').trim();
function restore(){
  const top=document.querySelector('.topbar');if(!top)return;
  const crumb=top.querySelector('.breadcrumbs');const raidSpan=crumb?.querySelectorAll('span')?.[1];
  if(raidSpan?.dataset.irisOriginalText!=null){raidSpan.textContent=raidSpan.dataset.irisOriginalText;delete raidSpan.dataset.irisOriginalText;}
  for(const button of top.querySelectorAll('.selectors > button[data-iris-original-hidden]')){button.hidden=button.dataset.irisOriginalHidden==='1';delete button.dataset.irisOriginalHidden;}
  delete top.dataset.irisMechanicsHeaderRelease;
}
function own(){
  if(!mechanics()){restore();return;}
  const top=document.querySelector('.topbar');if(!top)return;
  const crumb=top.querySelector('.breadcrumbs'),raidSpan=crumb?.querySelectorAll('span')?.[1],name=raidName();
  if(raidSpan){if(raidSpan.dataset.irisOriginalText==null)raidSpan.dataset.irisOriginalText=raidSpan.textContent||'';if(name)raidSpan.textContent=name.toUpperCase();}
  for(const button of top.querySelectorAll('.selectors > button:not(.live)')){if(button.dataset.irisOriginalHidden==null)button.dataset.irisOriginalHidden=button.hidden?'1':'0';button.hidden=true;}
  top.dataset.irisMechanicsHeaderRelease=RELEASE;
}
let queued=false;function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;own();});}
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
window.addEventListener('popstate',schedule);window.addEventListener('hashchange',schedule);document.addEventListener('DOMContentLoaded',schedule,{once:true});window.addEventListener('load',schedule,{once:true});schedule();
})();
